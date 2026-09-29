# RL Models Directory

## 📁 Place Your Trained Models Here

Copy your trained RL models to this directory. The simulation server will automatically load them based on task ID.

## 📝 File Naming Convention

```
models/
├── ppo_easy.zip          ← Easy: Arbitrage task
├── ppo_medium.zip        ← Medium: Forecast Error task
├── ppo_hard.zip          ← Hard: Frequency Response task
├── sac_expert.zip        ← Expert: Demand Response task
└── dqn_islanding.zip     ← Islanding Emergency task
```

## 🎯 Task Mapping

| Task ID | Model File | Algorithm |
|---------|-----------|-----------|
| `easy-arbitrage` | `ppo_easy.zip` | PPO (recommended) |
| `medium-forecast-error` | `ppo_medium.zip` | PPO (recommended) |
| `hard-frequency-response` | `ppo_hard.zip` | PPO (recommended) |
| `expert-demand-response` | `sac_expert.zip` | SAC (recommended) |
| `islanding-emergency` | `dqn_islanding.zip` | DQN (recommended) |

**Note**: File names and algorithms are just recommendations. The system auto-detects the algorithm from the filename or tries PPO by default.

## 📦 Supported Formats

### Stable-Baselines3 (.zip)
```python
from stable_baselines3 import PPO

model = PPO("MlpPolicy", env)
model.learn(total_timesteps=1_000_000)
model.save("models/ppo_easy")  # Creates ppo_easy.zip
```

### PyTorch (.pt / .pth)
```python
import torch

model = YourCustomModel()
torch.save(model.state_dict(), "models/custom_model.pt")
```

### RLlib (directory)
```python
from ray.rllib.algorithms.ppo import PPO

algo = PPO(config=config, env=env_class)
algo.train()
algo.save("models/rllib_checkpoint")  # Creates directory
```

## 🔍 Model Detection

The system automatically:
1. Detects model type from file extension (.zip → SB3, .pt → PyTorch, directory → RLlib)
2. Detects algorithm from filename (ppo, sac, dqn, a2c, td3)
3. Falls back to rule-based agent if model not found

## 🧪 Testing Your Models

```bash
# Start simulation with your models
cd backend
python simulation_server.py

# Check loaded models
curl http://localhost:8001/models
```

## 📊 Model Requirements

### Observation Space
- **Dimension**: 52 features (see `preprocessing.py`)
- **Type**: Box(52,)
- **Range**: Features are normalized to [0, 1] or [-1, 1]

### Action Space
- **Dimension**: 5 actions
- **Type**: Box(5,)
- **Ranges**:
  - `global_charge_rate`: [-1.0, 1.0]
  - `min_reserve_pct`: [0.0, 1.0]
  - `defer_ev_charging`: [0.0, 1.0]
  - `accept_dr_bid`: [0.0, 1.0] (thresholded at 0.5)
  - `p2p_export_rate`: [0.0, 1.0]

## 🎓 Training Examples

See `RL_MODEL_INTEGRATION.md` in the project root for complete training examples.

## 🚨 Troubleshooting

### Model not loading?
- Check file exists: `ls -la models/`
- Check filename matches mapping in `rl_agent.py`
- Check file permissions: `chmod 644 models/*.zip`

### Import errors?
- Install: `pip install stable-baselines3 torch`
- Check versions: `pip list | grep stable-baselines3`

### Wrong predictions?
- Verify observation preprocessing in `preprocessing.py`
- Check action space dimensions match your training
- Test with: `python test_preprocessing.py`

## 📁 Optional: Checkpoints Subdirectory

```
models/
└── checkpoints/
    ├── ppo_easy_100k.zip
    ├── ppo_easy_500k.zip
    └── ppo_easy_1M.zip
```

Useful for:
- Comparing training progress
- A/B testing different checkpoints
- Rollback if final model overfits

---

**Place your models here and they'll automatically power the 3D visualization!** 🚀
