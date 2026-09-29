#!/usr/bin/env python3
"""
VPP RL Training Script — Train PPO agents for Virtual Power Plant tasks.

Trains per-task PPO models using Stable-Baselines3 with VecNormalize for
observation/reward normalisation.  Models are saved to backend/models/ where
the simulation server's rl_agent.py picks them up automatically.

Usage:
    # Train a single task
    python training/train.py --task easy-arbitrage

    # Train all 5 tasks sequentially
    python training/train.py --all

    # Override timesteps
    python training/train.py --all --timesteps 500000

    # View training curves
    tensorboard --logdir training/logs/
"""

import argparse
import os
import sys
import time
from pathlib import Path

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
from stable_baselines3.common.callbacks import (
    CheckpointCallback,
    EvalCallback,
    CallbackList,
)
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.utils import set_random_seed

from training.vpp_gym_env import VppGymEnv
from training.config import get_config, ALL_TASK_IDS, TaskTrainingConfig


# ---------------------------------------------------------------------------
# Directories
# ---------------------------------------------------------------------------
MODELS_DIR = _PROJECT_ROOT / "backend" / "models"
LOGS_DIR = _SCRIPT_DIR / "logs"
CHECKPOINTS_DIR = _SCRIPT_DIR / "checkpoints"


def make_env(task_id: str, seed: int, rank: int = 0):
    """Factory function for creating a monitored VPP gym environment."""
    def _init():
        env = VppGymEnv(task_id=task_id, seed=seed + rank)
        env = Monitor(env)
        return env
    set_random_seed(seed)
    return _init


def train_task(
    task_id: str,
    timesteps_override: int | None = None,
    verbose: int = 1,
) -> dict:
    """
    Train a PPO agent for a single VPP task.

    Steps:
      1. Create vectorised environment with VecNormalize
      2. Configure PPO with task-specific hyperparameters
      3. Train for the specified number of timesteps
      4. Save model + VecNormalize stats to backend/models/
      5. Return training summary

    Args:
        task_id: VPP task identifier (e.g. "easy-arbitrage")
        timesteps_override: Override total_timesteps from config
        verbose: SB3 verbosity level

    Returns:
        dict with training summary (rewards, time, pareto scores)
    """
    config = get_config(task_id)
    total_timesteps = timesteps_override or config.total_timesteps

    print(f"\n{'='*72}")
    print(f"  TRAINING: {task_id}")
    print(f"  Timesteps: {total_timesteps:,}")
    print(f"  Learning Rate: {config.learning_rate}")
    print(f"  Network: {config.net_arch}")
    print(f"  Entropy Coef: {config.ent_coef}")
    print(f"  Gamma: {config.gamma}")
    print(f"  Seed: {config.training_seed}")
    print(f"{'='*72}\n")

    # ── Create environments ────────────────────────────────────────────
    # Training environment (VecNormalize wraps DummyVecEnv)
    train_env = DummyVecEnv([
        make_env(task_id, config.training_seed, rank=0)
    ])
    train_env = VecNormalize(
        train_env,
        norm_obs=config.norm_obs,
        norm_reward=config.norm_reward,
        clip_obs=config.clip_obs,
        clip_reward=config.clip_reward,
        gamma=config.gamma,
    )

    # Eval environment (separate seed, no reward normalisation update)
    eval_seed = config.training_seed + 500  # disjoint from training
    eval_env = DummyVecEnv([
        make_env(task_id, eval_seed, rank=0)
    ])
    eval_env = VecNormalize(
        eval_env,
        norm_obs=config.norm_obs,
        norm_reward=False,  # don't update reward stats during eval
        clip_obs=config.clip_obs,
        clip_reward=config.clip_reward,
        gamma=config.gamma,
        training=False,      # don't update running stats during eval
    )

    # ── Configure PPO ──────────────────────────────────────────────────
    model = PPO(
        policy="MlpPolicy",
        env=train_env,
        learning_rate=config.learning_rate,
        n_steps=config.n_steps,
        batch_size=config.batch_size,
        n_epochs=config.n_epochs,
        gamma=config.gamma,
        gae_lambda=config.gae_lambda,
        clip_range=config.clip_range,
        ent_coef=config.ent_coef,
        vf_coef=config.vf_coef,
        max_grad_norm=config.max_grad_norm,
        policy_kwargs={"net_arch": config.net_arch},
        tensorboard_log=str(LOGS_DIR),
        verbose=verbose,
        seed=config.training_seed,
    )

    # ── Callbacks ──────────────────────────────────────────────────────
    # Checkpoint every 50k steps
    checkpoint_dir = CHECKPOINTS_DIR / task_id
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_callback = CheckpointCallback(
        save_freq=50_000,
        save_path=str(checkpoint_dir),
        name_prefix=config.model_filename,
        verbose=0,
    )

    # Evaluate every 20k steps
    eval_log_dir = LOGS_DIR / f"eval_{task_id}"
    eval_log_dir.mkdir(parents=True, exist_ok=True)
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(checkpoint_dir),
        log_path=str(eval_log_dir),
        eval_freq=20_000,
        n_eval_episodes=5,
        deterministic=True,
        verbose=0,
    )

    callbacks = CallbackList([checkpoint_callback, eval_callback])

    # ── Train ──────────────────────────────────────────────────────────
    start_time = time.time()
    model.learn(
        total_timesteps=total_timesteps,
        callback=callbacks,
        tb_log_name=task_id,
        progress_bar=True,
    )
    elapsed = time.time() - start_time

    # ── Save model + VecNormalize stats ────────────────────────────────
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / config.model_filename
    vecnorm_path = MODELS_DIR / f"{config.model_filename}_vecnormalize.pkl"

    model.save(str(model_path))
    train_env.save(str(vecnorm_path))

    print(f"\n  ✅ Model saved:       {model_path}.zip")
    print(f"  ✅ VecNormalize saved: {vecnorm_path}")

    # ── Post-training evaluation (5 episodes) ──────────────────────────
    eval_rewards = []
    eval_pareto_scores = []

    # Sync eval env normalisation stats from training env
    eval_env.obs_rms = train_env.obs_rms
    eval_env.ret_rms = train_env.ret_rms

    for ep in range(5):
        obs = eval_env.reset()
        episode_reward = 0.0
        done = False
        while not done:
            action, _states = model.predict(obs, deterministic=True)
            obs, reward, done, info = eval_env.step(action)
            episode_reward += reward[0]
            if done[0] and "pareto_score" in info[0]:
                eval_pareto_scores.append(info[0]["pareto_score"])
        eval_rewards.append(episode_reward)

    # ── Training summary ───────────────────────────────────────────────
    mean_reward = np.mean(eval_rewards)
    std_reward = np.std(eval_rewards)

    summary = {
        "task_id": task_id,
        "total_timesteps": total_timesteps,
        "training_time_seconds": round(elapsed, 1),
        "eval_mean_reward": round(float(mean_reward), 2),
        "eval_std_reward": round(float(std_reward), 2),
        "model_path": str(model_path) + ".zip",
        "vecnorm_path": str(vecnorm_path),
    }

    if eval_pareto_scores:
        last_pareto = eval_pareto_scores[-1]
        summary["eval_aggregate_score"] = last_pareto.get("aggregate_score", 0.0)
        summary["eval_profit_score"] = last_pareto.get("profit_score", 0.0)
        summary["eval_safety_score"] = last_pareto.get("safety_score", 0.0)

    print(f"\n  📊 Eval Mean Reward: {mean_reward:.2f} ± {std_reward:.2f}")
    if eval_pareto_scores:
        agg = eval_pareto_scores[-1].get("aggregate_score", 0.0)
        print(f"  🎯 Pareto Aggregate: {agg:.4f}")
    print(f"  ⏱️  Training Time: {elapsed:.1f}s")

    # Cleanup
    train_env.close()
    eval_env.close()

    return summary


def train_all(
    timesteps_override: int | None = None,
    verbose: int = 1,
) -> list[dict]:
    """Train PPO agents for all 5 VPP tasks sequentially."""
    print("\n" + "█" * 72)
    print("  VPP RL TRAINING — ALL TASKS")
    print("█" * 72)

    summaries = []
    total_start = time.time()

    for task_id in ALL_TASK_IDS:
        summary = train_task(
            task_id,
            timesteps_override=timesteps_override,
            verbose=verbose,
        )
        summaries.append(summary)

    total_elapsed = time.time() - total_start

    # ── Print summary table ────────────────────────────────────────────
    print("\n" + "=" * 72)
    print("  TRAINING COMPLETE — ALL TASKS")
    print("=" * 72)
    print(f"\n  {'Task':<28} {'Reward':>10} {'Pareto':>10} {'Time':>8}")
    print(f"  {'─'*28} {'─'*10} {'─'*10} {'─'*8}")
    for s in summaries:
        reward = f"{s['eval_mean_reward']:.2f}"
        pareto = f"{s.get('eval_aggregate_score', 'N/A'):.4f}" if 'eval_aggregate_score' in s else "N/A"
        time_s = f"{s['training_time_seconds']:.0f}s"
        print(f"  {s['task_id']:<28} {reward:>10} {pareto:>10} {time_s:>8}")

    print(f"\n  Total training time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    print(f"  Models saved to: {MODELS_DIR}")
    print()

    return summaries


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Train PPO agents for VPP tasks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python training/train.py --all                    # Train all 5 tasks (200k steps each)
  python training/train.py --task easy-arbitrage     # Train single task
  python training/train.py --all --timesteps 500000  # Override timesteps
  tensorboard --logdir training/logs/                # View training curves
        """,
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--task",
        type=str,
        choices=ALL_TASK_IDS,
        help="Train a single task",
    )
    group.add_argument(
        "--all",
        action="store_true",
        help="Train all 5 tasks sequentially",
    )

    parser.add_argument(
        "--timesteps",
        type=int,
        default=None,
        help="Override total timesteps per task (default: 200,000)",
    )
    parser.add_argument(
        "--verbose",
        type=int,
        default=1,
        choices=[0, 1, 2],
        help="SB3 verbosity level (0=silent, 1=info, 2=debug)",
    )

    args = parser.parse_args()

    if args.all:
        train_all(timesteps_override=args.timesteps, verbose=args.verbose)
    else:
        train_task(args.task, timesteps_override=args.timesteps, verbose=args.verbose)


if __name__ == "__main__":
    main()
