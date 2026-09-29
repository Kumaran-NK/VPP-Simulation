"""
Gymnasium environment wrapper for the VPP (Virtual Power Plant) simulation.

Wraps VppEnvironment directly as a gymnasium.Env — no HTTP server required.
Uses the existing preprocessing pipeline (52 normalised features) and the
environment's built-in multi-objective reward signal.

Usage:
    env = VppGymEnv(task_id="easy-arbitrage", seed=42)
    obs, info = env.reset()
    action = env.action_space.sample()
    obs, reward, terminated, truncated, info = env.step(action)
"""

import os
import sys
from typing import Any, Dict, Optional, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path so we can import server/, models, etc.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from models import VppAction
from server.vpp_environment import VppEnvironment
from server.task_curves import EPISODE_STEPS

# Re-use the existing feature engineering — keeps training/inference consistent.
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from preprocessing import preprocess_observation, get_observation_space_size


class VppGymEnv(gym.Env):
    """
    Gymnasium wrapper for VppEnvironment.

    Observation space : Box(52,)   — preprocessed features from preprocessing.py
    Action space      : Box(5,)    — [charge_rate, reserve_pct, ev_defer,
                                       dr_accept_prob, p2p_export]

    The environment is deterministic for a given (task_id, seed) pair.
    Different seeds produce different random-noise realisations in the
    forecast curves, but the underlying solar/demand/price profiles are
    task-deterministic.
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        task_id: str = "easy-arbitrage",
        seed: Optional[int] = None,
        max_episode_steps: int = EPISODE_STEPS,
    ):
        super().__init__()

        self.task_id = task_id
        self._seed = seed
        self._max_episode_steps = max_episode_steps

        # Underlying VPP environment (pure Python — no network)
        self._env = VppEnvironment()

        # ── Observation space (52 normalised features) ──────────────────────
        obs_dim = get_observation_space_size()
        self.observation_space = spaces.Box(
            low=-5.0,            # some features can go slightly negative
            high=5.0,            # generous upper bound (features mostly in [0,1])
            shape=(obs_dim,),
            dtype=np.float32,
        )

        # ── Action space (5 continuous dimensions) ──────────────────────────
        # [0] global_charge_rate :  [-1, 1]  discharge ←→ charge
        # [1] min_reserve_pct   :  [ 0, 1]  safety floor
        # [2] defer_ev_charging :  [ 0, 1]  EV deferral fraction
        # [3] accept_dr_bid     :  [ 0, 1]  thresholded at 0.5 → bool
        # [4] p2p_export_rate   :  [ 0, 1]  P2P export fraction
        self.action_space = spaces.Box(
            low=np.array([-1.0, 0.0, 0.0, 0.0, 0.0], dtype=np.float32),
            high=np.array([1.0, 1.0, 1.0, 1.0, 1.0], dtype=np.float32),
            dtype=np.float32,
        )

        # Episode tracking
        self._current_obs_dict: Optional[Dict] = None
        self._step_count: int = 0

    # ── Gymnasium API ───────────────────────────────────────────────────────

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset the environment and return (observation, info)."""
        # Use provided seed, or fall back to constructor seed, or generate one
        effective_seed = seed if seed is not None else self._seed
        if effective_seed is None:
            effective_seed = np.random.randint(0, 2**31)

        # Reset the underlying VPP environment
        vpp_obs = self._env.reset(seed=effective_seed, task_id=self.task_id)

        # Convert VPP observation → dict → preprocessed numpy array
        self._current_obs_dict = self._obs_to_dict(vpp_obs)
        obs_array = preprocess_observation(self._current_obs_dict)

        self._step_count = 0

        info = {
            "task_id": self.task_id,
            "seed": effective_seed,
            "step_id": vpp_obs.step_id,
        }

        return obs_array, info

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Execute one environment step.

        Returns:
            observation, reward, terminated, truncated, info
        """
        # Convert numpy action → VppAction
        action = np.clip(action, self.action_space.low, self.action_space.high)
        vpp_action = VppAction(
            global_charge_rate=float(action[0]),
            min_reserve_pct=float(action[1]),
            defer_ev_charging=float(action[2]),
            accept_dr_bid=bool(action[3] > 0.5),
            p2p_export_rate=float(action[4]),
        )

        # Step the underlying environment
        vpp_obs = self._env.step(vpp_action)

        # Convert observation
        self._current_obs_dict = self._obs_to_dict(vpp_obs)
        obs_array = preprocess_observation(self._current_obs_dict)

        # Reward — use the environment's built-in multi-objective reward
        reward = float(vpp_obs.reward) if vpp_obs.reward is not None else 0.0

        # Termination — episode ends when done flag is set
        terminated = bool(vpp_obs.done)
        self._step_count += 1
        truncated = self._step_count >= self._max_episode_steps and not terminated

        # Info dict with useful debugging data
        info = {
            "step_id": vpp_obs.step_id,
            "market_price": vpp_obs.market_price_per_mwh,
            "grid_frequency": vpp_obs.grid_frequency_hz,
            "grid_connected": vpp_obs.grid_connected,
            "carbon_balance": vpp_obs.carbon_credits_balance,
        }

        # Include Pareto score when available (end of episode or every step)
        if vpp_obs.pareto_score is not None:
            info["pareto_score"] = vpp_obs.pareto_score

        return obs_array, reward, terminated, truncated, info

    # ── Helpers ─────────────────────────────────────────────────────────────

    def get_pareto_score(self) -> Dict[str, float]:
        """Get the current Pareto score from the underlying environment."""
        pareto = self._env.get_pareto_score()
        return pareto.model_dump()

    @staticmethod
    def _obs_to_dict(vpp_obs) -> Dict[str, Any]:
        """Convert VppObservation to the dict format expected by preprocessing.py."""
        return {
            "step_id": vpp_obs.step_id,
            "market_price_per_mwh": vpp_obs.market_price_per_mwh,
            "grid_frequency_hz": vpp_obs.grid_frequency_hz,
            "grid_connected": vpp_obs.grid_connected,
            "emergency_active": vpp_obs.emergency_active,
            "telemetry": [
                {
                    "asset_id": t.asset_id,
                    "soc": t.soc,
                    "state_of_health": t.state_of_health,
                    "current_solar_gen_kw": t.current_solar_gen_kw,
                    "current_house_load_kw": t.current_house_load_kw,
                }
                for t in vpp_obs.telemetry
            ],
            "zone_aggregates": [
                {
                    "zone_id": z.zone_id,
                    "mean_soc": z.mean_soc,
                    "mean_soh": z.mean_soh,
                    "mean_solar_kw": z.mean_solar_kw,
                    "mean_demand_kw": z.mean_demand_kw,
                    "p2p_available_kw": z.p2p_available_kw,
                }
                for z in vpp_obs.zone_aggregates
            ],
            "carbon_credits_balance": vpp_obs.carbon_credits_balance,
            "carbon_earned_this_step": vpp_obs.carbon_earned_this_step,
            "carbon_spent_this_step": vpp_obs.carbon_spent_this_step,
            "dr_bid": {
                "active": vpp_obs.dr_bid.active,
                "premium_multiplier": vpp_obs.dr_bid.premium_multiplier,
                "committed_power_kw": vpp_obs.dr_bid.committed_power_kw,
                "steps_remaining": vpp_obs.dr_bid.steps_remaining,
            },
            "safety_margin_pct": vpp_obs.safety_margin_pct,
            "demand_shed_this_step_kwh": vpp_obs.demand_shed_this_step_kwh,
            "short_term_price_forecast": vpp_obs.short_term_price_forecast,
            "short_term_solar_forecast": vpp_obs.short_term_solar_forecast,
            "forecast_price_uncertainty": vpp_obs.forecast_price_uncertainty,
            "forecast_solar_uncertainty": vpp_obs.forecast_solar_uncertainty,
        }
