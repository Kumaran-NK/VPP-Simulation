# 🎯 Quick Reference: Where to Place Your RL Models

## 📍 Model Directory Location

```
vpp-3d-sim/backend/models/
```

## 📦 Copy Your Models Here

```bash
# Example: Copy your trained PPO model for easy task
cp /path/to/your/trained_model.zip vpp-3d-sim/backend/models/ppo_easy.zip

# Copy all your models at once
cp /path/to/your/models/*.zip vpp-3d-sim/backend/models/
```

## 🗂️ Expected File Structure

```
vpp-3d-sim/
├── backend/
│   ├── models/                    ← YOUR MODELS GO HERE
│   │   ├── __init__.py           ✅ Created
│   │   ├── README.md             ✅ Created
│   │   │
│   │   ├── ppo_easy.zip          ← Place your PPO model for easy task
│   │   ├── ppo_medium.zip        ← Place your PPO model for medium task
│   │   ├── ppo_hard.zip          ← Place your PPO model for hard task
│   │   ├── sac_expert.zip        ← Place your SAC model for expert task
│   │   └── dqn_islanding.zip     ← Place your DQN model for islanding task
│   │
│   ├── rl_agent.py               ✅ Created (loads your models)
│   ├── preprocessing.py          ✅ Created (prepares observations)
│   └── simulation_server.py      ✅ Already exists
│
└── ...
```

## 🚀 One-Command Setup

```bash
# 1. Navigate to project
cd vpp-3d-sim/backend

# 2. Create models directory (if not exists)
mkdir -p models/checkpoints

# 3. Copy your trained models
cp /path/to/your/ppo_model.zip models/ppo_easy.zip
cp /path/to/your/sac_model.zip models/sac_expert.zip
# ... copy other models

# 4. Start simulation server
python simulation_server.py

# Done! Your models are now powering the 3D visualization
```

## ✅ File Naming Rules

| Task | Expected Filename | Your Model |
|------|------------------|------------|
| Easy Arbitrage | `ppo_easy.zip` | Copy here → |
| Medium Forecast Error | `ppo_medium.zip` | Copy here → |
| Hard Frequency Response | `ppo_hard.zip` | Copy here → |
| Expert Demand Response | `sac_expert.zip` | Copy here → |
| Islanding Emergency | `dqn_islanding.zip` | Copy here → |

## 🔧 Customizing Model Selection

Edit `backend/rl_agent.py` (line ~140):

```python
model_mapping = {
    "easy-arbitrage": "YOUR_MODEL_NAME.zip",        # ← Change filename here
    "medium-forecast-error": "YOUR_MODEL_NAME.zip", # ← Change filename here
    # ...
}
```

## 📊 Model Specifications

Your models should:
- **Input**: 52-dimensional observation vector (see `preprocessing.py`)
- **Output**: 5-dimensional action vector:
  - `[0]` global_charge_rate: -1.0 to 1.0
  - `[1]` min_reserve_pct: 0.0 to 1.0
  - `[2]` defer_ev_charging: 0.0 to 1.0
  - `[3]` accept_dr_bid: 0.0 to 1.0 (> 0.5 = True)
  - `[4]` p2p_export_rate: 0.0 to 1.0

## 🧪 Test Your Integration

```bash
# 1. Start simulation server
cd vpp-3d-sim/backend
python simulation_server.py

# 2. In another terminal, check loaded models
curl http://localhost:8001/models

# Expected output:
# {
#   "easy-arbitrage": {
#     "model_path": "/path/to/models/ppo_easy.zip",
#     "model_type": "sb3",
#     "loaded": true
#   }
# }

# 3. Start frontend and test
cd vpp-3d-sim/frontend
npm run dev

# 4. Open browser
# http://localhost:3000
# - Select task
# - Click Start
# - Watch your model control the fleet in 3D!
```

## 🎓 Training New Models

```python
# train_model.py
from stable_baselines3 import PPO
from client import VppEnv

# Create environment
env = VppEnv(base_url="http://localhost:7860").sync()

# Train PPO
model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=1_000_000)

# Save to models directory
model.save("backend/models/ppo_easy")
print("✅ Model saved!")
```

## 🚨 Fallback Behavior

If a model file is not found, the system automatically falls back to:
1. **LLM agent** (if `HF_TOKEN` is set)
2. **Rule-based agent** (always available)

This means you can train models incrementally without breaking the system.

## 📁 Alternative: Use Different Directory

```python
# Edit backend/rl_agent.py (line ~135)
models_dir = os.path.join(os.path.dirname(__file__), "models")

# Change to:
models_dir = "/your/custom/path/to/models"
```

## 💡 Pro Tips

1. **Start with one task**: Train a model for `easy-arbitrage` first
2. **Test immediately**: Copy model → restart server → test in browser
3. **Use checkpoints**: Save training checkpoints in `models/checkpoints/`
4. **Compare models**: Swap model files and compare performance visually
5. **Monitor logs**: Watch terminal for model loading success/errors

---

## 🎉 Summary

**Where**: `vpp-3d-sim/backend/models/`  
**What**: Your trained `.zip` model files  
**How**: `cp your_model.zip backend/models/ppo_easy.zip`  
**Test**: `python backend/simulation_server.py`  
**Watch**: `http://localhost:3000` 🚀

---

**Your RL models will now control 100 houses in stunning 3D!**
