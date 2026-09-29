"""
Per-task PPO hyperparameters for VPP environment training.

Each task has fundamentally different dynamics — arbitrage rewards
time-shifting, frequency response rewards fast reaction, islanding
rewards conservative reserve management, etc.  Hyperparameters are
tuned accordingly rather than using one-size-fits-all defaults.

All configs are compatible with Stable-Baselines3 PPO.
"""

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class TaskTrainingConfig:
    """Training configuration for a single VPP task."""

    task_id: str
    model_filename: str          # output filename (without extension)
    total_timesteps: int = 200_000

    # PPO hyperparameters
    learning_rate: float = 3e-4
    n_steps: int = 2048           # steps per rollout buffer collection
    batch_size: int = 64
    n_epochs: int = 10            # gradient updates per rollout
    gamma: float = 0.99           # discount factor
    gae_lambda: float = 0.95      # GAE lambda for advantage estimation
    clip_range: float = 0.2       # PPO clipping range
    ent_coef: float = 0.01        # entropy bonus coefficient
    vf_coef: float = 0.5          # value function loss coefficient
    max_grad_norm: float = 0.5    # gradient clipping

    # Network architecture
    net_arch: List[int] = field(default_factory=lambda: [256, 256])

    # VecNormalize settings
    norm_obs: bool = True         # normalise observations
    norm_reward: bool = True      # normalise rewards
    clip_obs: float = 10.0        # observation clipping after normalisation
    clip_reward: float = 10.0     # reward clipping after normalisation

    # Training seeds (eval seeds are disjoint — see evaluate.py)
    training_seed: int = 42


# ── Per-task configurations ─────────────────────────────────────────────

TASK_CONFIGS: Dict[str, TaskTrainingConfig] = {

    # ─── Easy: Arbitrage ────────────────────────────────────────────────
    # Simple TOU profile: charge cheap daytime, sell expensive evening.
    # Fast to learn — higher LR, fewer timesteps would suffice but we
    # keep 200k for consistency and polish.
    "easy-arbitrage": TaskTrainingConfig(
        task_id="easy-arbitrage",
        model_filename="ppo_easy",
        total_timesteps=200_000,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        net_arch=[256, 256],
        training_seed=42,
    ),

    # ─── Medium: Forecast Error ─────────────────────────────────────────
    # Heatwave + storm surprise at midday. Agent must learn to handle
    # forecast uncertainty — slightly higher entropy to encourage
    # exploration of conservative strategies.
    "medium-forecast-error": TaskTrainingConfig(
        task_id="medium-forecast-error",
        model_filename="ppo_medium",
        total_timesteps=200_000,
        learning_rate=2.5e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.015,           # slightly higher entropy
        net_arch=[256, 256],
        training_seed=43,
    ),

    # ─── Hard: Frequency Response ───────────────────────────────────────
    # 10x price spike at step 26 + frequency emergency. Agent must
    # conserve reserves for the spike — needs longer horizon awareness.
    # Lower LR for stability; higher gamma to weight future spike.
    "hard-frequency-response": TaskTrainingConfig(
        task_id="hard-frequency-response",
        model_filename="ppo_hard",
        total_timesteps=200_000,
        learning_rate=2e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.995,              # higher discount — future spike matters
        gae_lambda=0.97,          # longer GAE horizon
        clip_range=0.2,
        ent_coef=0.01,
        net_arch=[256, 256],
        training_seed=44,
    ),

    # ─── Expert: Demand Response ────────────────────────────────────────
    # DR auctions every 6 steps + adversarial cloud event. Most complex
    # task — needs to learn bid acceptance strategy. Higher entropy to
    # explore DR bid acceptance; wider network for complex policy.
    "expert-demand-response": TaskTrainingConfig(
        task_id="expert-demand-response",
        model_filename="ppo_expert",
        total_timesteps=200_000,
        learning_rate=2e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.02,            # higher entropy for DR bid exploration
        net_arch=[256, 256, 128],  # deeper network for complex policy
        training_seed=45,
    ),

    # ─── Islanding Emergency ────────────────────────────────────────────
    # Grid disconnects steps 20-29. Agent must learn ultra-conservative
    # battery management during islanding. Lower entropy — exploitation
    # of safe strategies is more important than exploration.
    "islanding-emergency": TaskTrainingConfig(
        task_id="islanding-emergency",
        model_filename="ppo_islanding",
        total_timesteps=200_000,
        learning_rate=2.5e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.995,              # high discount — must prepare for islanding
        gae_lambda=0.97,
        clip_range=0.15,          # tighter clipping for stability
        ent_coef=0.005,           # low entropy — conservative policy needed
        net_arch=[256, 256],
        training_seed=46,
    ),
}


def get_config(task_id: str) -> TaskTrainingConfig:
    """Get training configuration for a specific task."""
    if task_id not in TASK_CONFIGS:
        raise ValueError(
            f"Unknown task_id: {task_id}. "
            f"Available: {list(TASK_CONFIGS.keys())}"
        )
    return TASK_CONFIGS[task_id]


ALL_TASK_IDS = list(TASK_CONFIGS.keys())
