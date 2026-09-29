#!/usr/bin/env python3
"""
VPP RL Evaluation & Benchmarking Script.

Runs trained PPO models and rule-based baseline head-to-head on the same
evaluation seeds (disjoint from training seeds) and produces a structured
comparison table with Pareto scores.

Usage:
    python training/evaluate.py                # Full benchmark
    python training/evaluate.py --episodes 10  # More episodes for tighter CIs
    python training/evaluate.py --task easy-arbitrage  # Single task

Output:
    Console comparison table + JSON results to training/results/benchmark.json
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
if str(_PROJECT_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT / "backend"))

import numpy as np

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize

from training.vpp_gym_env import VppGymEnv
from training.config import ALL_TASK_IDS, get_config

# For rule-based baseline
from models import VppAction
from server.vpp_environment import VppEnvironment
from server.task_curves import EPISODE_STEPS
from preprocessing import preprocess_observation

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODELS_DIR = _PROJECT_ROOT / "backend" / "models"
RESULTS_DIR = _SCRIPT_DIR / "results"

# Evaluation seeds — completely disjoint from training seeds (42–46)
# and from eval-during-training seeds (542–546).
EVAL_SEEDS = [1000, 1001, 1002, 1003, 1004]


# ---------------------------------------------------------------------------
# Rule-based baseline (same logic as baseline_inference.py)
# ---------------------------------------------------------------------------

def _mean_soc_from_telemetry(telemetry: list) -> float:
    if not telemetry:
        return 0.5
    return sum(t.soc for t in telemetry) / len(telemetry)


def rule_based_action(obs, task_id: str) -> VppAction:
    """Deterministic rule-based policy (matches baseline_inference.py)."""
    step = obs.step_id
    price = obs.market_price_per_mwh
    mean_soc = _mean_soc_from_telemetry(obs.telemetry)

    # P2P
    p2p_avail = 0.0
    for zone in obs.zone_aggregates:
        if zone.zone_id == "zone-b":
            p2p_avail = zone.p2p_available_kw
    p2p_rate = 0.8 if p2p_avail > 0.75 else 0.0

    # EV deferral
    defer_ev = 0.6 if (32 <= step < 40 and price > 55.0) else 0.0

    # Islanding — conserve batteries
    if not obs.grid_connected:
        return VppAction(
            global_charge_rate=0.0,
            min_reserve_pct=0.40,
            defer_ev_charging=0.0,
            accept_dr_bid=False,
            p2p_export_rate=0.0,
        )

    # Frequency emergency — discharge immediately
    if obs.grid_frequency_hz < 49.8:
        return VppAction(
            global_charge_rate=-1.0,
            min_reserve_pct=0.10,
            defer_ev_charging=0.0,
            accept_dr_bid=False,
            p2p_export_rate=p2p_rate,
        )

    # DR commitment active — discharge to meet it
    dr_bid = obs.dr_bid
    if dr_bid.steps_remaining > 0:
        commit_fraction = min(1.0, dr_bid.committed_power_kw / 5.0)
        return VppAction(
            global_charge_rate=-commit_fraction,
            min_reserve_pct=0.20,
            defer_ev_charging=defer_ev,
            accept_dr_bid=False,
            p2p_export_rate=p2p_rate,
        )

    # Accept attractive DR bids
    if dr_bid.active and dr_bid.premium_multiplier >= 2.0 and mean_soc > 0.55:
        commit_fraction = min(1.0, dr_bid.committed_power_kw / 5.0)
        return VppAction(
            global_charge_rate=-commit_fraction,
            min_reserve_pct=0.20,
            defer_ev_charging=defer_ev,
            accept_dr_bid=True,
            p2p_export_rate=p2p_rate,
        )

    # Price-based arbitrage
    if price > 70.0 and mean_soc > 0.30:
        charge_rate = -0.8
    elif price > 55.0 and mean_soc > 0.45:
        charge_rate = -0.5
    elif price < 38.0 and mean_soc < 0.65 and step >= 17:
        charge_rate = 0.6
    elif mean_soc < 0.20 and price < 45.0:
        charge_rate = 0.4
    else:
        charge_rate = 0.0

    # Avoid grid purchases during high-emission morning
    if step < 17 and charge_rate > 0 and task_id != "hard-frequency-response":
        charge_rate = 0.0

    return VppAction(
        global_charge_rate=charge_rate,
        min_reserve_pct=0.20,
        defer_ev_charging=defer_ev,
        accept_dr_bid=False,
        p2p_export_rate=p2p_rate,
    )


def run_rule_baseline(task_id: str, seeds: List[int]) -> Dict:
    """Run rule-based baseline on given seeds, return aggregated results."""
    all_rewards = []
    all_pareto = []

    for seed in seeds:
        env = VppEnvironment()
        obs = env.reset(seed=seed, task_id=task_id)

        episode_reward = 0.0
        for _ in range(EPISODE_STEPS):
            if obs.done:
                break
            action = rule_based_action(obs, task_id)
            obs = env.step(action)
            episode_reward += float(obs.reward) if obs.reward else 0.0

        pareto = env.get_pareto_score().model_dump()
        all_rewards.append(episode_reward)
        all_pareto.append(pareto)

    return {
        "agent": "rule-based",
        "task_id": task_id,
        "episodes": len(seeds),
        "mean_reward": float(np.mean(all_rewards)),
        "std_reward": float(np.std(all_rewards)),
        "mean_aggregate_score": float(np.mean([p["aggregate_score"] for p in all_pareto])),
        "mean_profit_score": float(np.mean([p["profit_score"] for p in all_pareto])),
        "mean_safety_score": float(np.mean([p["safety_score"] for p in all_pareto])),
        "mean_carbon_score": float(np.mean([p["carbon_score"] for p in all_pareto])),
        "mean_degradation_score": float(np.mean([p["degradation_score"] for p in all_pareto])),
        "mean_dr_score": float(np.mean([p["dr_score"] for p in all_pareto])),
        "per_episode_pareto": all_pareto,
    }


# ---------------------------------------------------------------------------
# PPO evaluation
# ---------------------------------------------------------------------------

def run_ppo_agent(task_id: str, seeds: List[int]) -> Optional[Dict]:
    """Run trained PPO agent on given seeds, return aggregated results."""
    config = get_config(task_id)
    model_path = MODELS_DIR / f"{config.model_filename}.zip"
    vecnorm_path = MODELS_DIR / f"{config.model_filename}_vecnormalize.pkl"

    if not model_path.exists():
        print(f"  ⚠️  Model not found: {model_path}")
        return None

    # Load model
    model = PPO.load(str(model_path))

    all_rewards = []
    all_pareto = []

    for seed in seeds:
        # Create environment
        env = DummyVecEnv([lambda: VppGymEnv(task_id=task_id, seed=seed)])

        # Load VecNormalize stats if available
        if vecnorm_path.exists():
            env = VecNormalize.load(str(vecnorm_path), env)
            env.training = False       # don't update running stats
            env.norm_reward = False     # don't normalise rewards during eval
        else:
            print(f"  ⚠️  VecNormalize stats not found: {vecnorm_path}")

        obs = env.reset()
        episode_reward = 0.0
        done = False
        last_info = {}

        while not done:
            action, _states = model.predict(obs, deterministic=True)
            obs, reward, done, info = env.step(action)
            episode_reward += reward[0]
            last_info = info[0]

        # Get Pareto score from the underlying gym env
        underlying_env = env.venv.envs[0]
        if hasattr(underlying_env, 'env'):
            # Unwrap Monitor
            underlying_env = underlying_env.env
        pareto = underlying_env.get_pareto_score()

        all_rewards.append(episode_reward)
        all_pareto.append(pareto)
        env.close()

    return {
        "agent": "ppo",
        "task_id": task_id,
        "episodes": len(seeds),
        "model_path": str(model_path),
        "mean_reward": float(np.mean(all_rewards)),
        "std_reward": float(np.std(all_rewards)),
        "mean_aggregate_score": float(np.mean([p["aggregate_score"] for p in all_pareto])),
        "mean_profit_score": float(np.mean([p["profit_score"] for p in all_pareto])),
        "mean_safety_score": float(np.mean([p["safety_score"] for p in all_pareto])),
        "mean_carbon_score": float(np.mean([p["carbon_score"] for p in all_pareto])),
        "mean_degradation_score": float(np.mean([p["degradation_score"] for p in all_pareto])),
        "mean_dr_score": float(np.mean([p["dr_score"] for p in all_pareto])),
        "per_episode_pareto": all_pareto,
    }


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------

def run_benchmark(
    task_ids: Optional[List[str]] = None,
    seeds: Optional[List[int]] = None,
) -> Dict:
    """Run full benchmark: PPO vs Rule-based on all tasks."""
    task_ids = task_ids or ALL_TASK_IDS
    seeds = seeds or EVAL_SEEDS

    print("\n" + "█" * 72)
    print("  VPP RL BENCHMARK — PPO vs Rule-Based")
    print(f"  Eval seeds: {seeds} (disjoint from training)")
    print(f"  Episodes per agent per task: {len(seeds)}")
    print("█" * 72)

    results = {}

    for task_id in task_ids:
        print(f"\n{'─'*60}")
        print(f"  Evaluating: {task_id}")
        print(f"{'─'*60}")

        # Rule-based baseline
        print("  Running rule-based baseline...", end=" ", flush=True)
        t0 = time.time()
        rule_result = run_rule_baseline(task_id, seeds)
        print(f"done ({time.time()-t0:.1f}s)")

        # PPO agent
        print("  Running PPO agent...", end=" ", flush=True)
        t0 = time.time()
        ppo_result = run_ppo_agent(task_id, seeds)
        if ppo_result:
            print(f"done ({time.time()-t0:.1f}s)")
        else:
            print("skipped (no model)")

        results[task_id] = {
            "rule_based": rule_result,
            "ppo": ppo_result,
        }

    # ── Print comparison table ─────────────────────────────────────────
    _print_comparison_table(results)

    # ── Save results ───────────────────────────────────────────────────
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    results_path = RESULTS_DIR / "benchmark.json"

    # Make results JSON-serializable
    serializable = {}
    for task_id, task_results in results.items():
        serializable[task_id] = {}
        for agent_name, agent_result in task_results.items():
            if agent_result is None:
                serializable[task_id][agent_name] = None
            else:
                # Remove per_episode_pareto for cleaner output
                clean = {k: v for k, v in agent_result.items() if k != "per_episode_pareto"}
                serializable[task_id][agent_name] = clean

    with open(results_path, "w") as f:
        json.dump(serializable, f, indent=2)
    print(f"\n  📁 Results saved to: {results_path}")

    return results


def _print_comparison_table(results: Dict):
    """Print a formatted comparison table."""
    print("\n" + "=" * 88)
    print("  BENCHMARK RESULTS — PPO vs Rule-Based")
    print("=" * 88)

    # Header
    print(f"\n  {'Task':<28} │ {'Rule-Based':^14} │ {'PPO Agent':^14} │ {'Δ Improve':^12}")
    print(f"  {'─'*28}─┼─{'─'*14}─┼─{'─'*14}─┼─{'─'*12}")

    wins = 0
    total = 0

    for task_id, task_results in results.items():
        rule = task_results["rule_based"]
        ppo = task_results.get("ppo")

        rule_score = rule["mean_aggregate_score"]

        if ppo:
            ppo_score = ppo["mean_aggregate_score"]
            if rule_score > 0:
                improvement = ((ppo_score - rule_score) / rule_score) * 100
            else:
                improvement = 0.0

            if ppo_score > rule_score:
                wins += 1
                delta_str = f"+{improvement:.1f}%  ✅"
            else:
                delta_str = f"{improvement:.1f}%  ❌"

            print(f"  {task_id:<28} │ {rule_score:>10.4f}     │ {ppo_score:>10.4f}     │ {delta_str:>12}")
            total += 1
        else:
            print(f"  {task_id:<28} │ {rule_score:>10.4f}     │ {'N/A':^14} │ {'—':^12}")
            total += 1

    print(f"  {'─'*28}─┴─{'─'*14}─┴─{'─'*14}─┴─{'─'*12}")
    print(f"\n  PPO wins: {wins}/{total} tasks")

    if total > 0 and wins >= 3:
        print("  🏆 Success criterion met: PPO beats baseline on ≥3/5 tasks!")
    elif total > 0:
        print(f"  ⚠️  PPO wins on {wins}/{total} tasks (target: 3/5)")

    # Detailed per-objective breakdown
    print(f"\n  {'─'*88}")
    print(f"  {'DETAILED PARETO BREAKDOWN'}")
    print(f"  {'─'*88}")
    print(f"\n  {'Task':<25} │ {'Agent':^10} │ {'Profit':^8} │ {'Safety':^8} │ {'Carbon':^8} │ {'Batt':^8} │ {'DR':^8}")
    print(f"  {'─'*25}─┼─{'─'*10}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}")

    for task_id, task_results in results.items():
        rule = task_results["rule_based"]
        print(
            f"  {task_id:<25} │ {'Rule':^10} │ "
            f"{rule['mean_profit_score']:>6.4f}   │ "
            f"{rule['mean_safety_score']:>6.4f}   │ "
            f"{rule['mean_carbon_score']:>6.4f}   │ "
            f"{rule['mean_degradation_score']:>6.4f}   │ "
            f"{rule['mean_dr_score']:>6.4f}"
        )

        ppo = task_results.get("ppo")
        if ppo:
            print(
                f"  {'':25} │ {'PPO':^10} │ "
                f"{ppo['mean_profit_score']:>6.4f}   │ "
                f"{ppo['mean_safety_score']:>6.4f}   │ "
                f"{ppo['mean_carbon_score']:>6.4f}   │ "
                f"{ppo['mean_degradation_score']:>6.4f}   │ "
                f"{ppo['mean_dr_score']:>6.4f}"
            )
        print(f"  {'─'*25}─┼─{'─'*10}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*8}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Benchmark PPO agents vs rule-based baseline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--task",
        type=str,
        choices=ALL_TASK_IDS,
        default=None,
        help="Evaluate a single task (default: all tasks)",
    )
    parser.add_argument(
        "--episodes",
        type=int,
        default=5,
        help="Number of evaluation episodes per agent per task (default: 5)",
    )
    args = parser.parse_args()

    task_ids = [args.task] if args.task else None
    seeds = EVAL_SEEDS[:args.episodes]

    run_benchmark(task_ids=task_ids, seeds=seeds)


if __name__ == "__main__":
    main()
