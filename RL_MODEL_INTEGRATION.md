# RL Model Integration Guide

## 📁 Recommended Directory Structure

```
vpp-3d-sim/
├── backend/
│   ├── simulation_server.py
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── models/                          ← CREATE THIS FOLDER
│   │   ├── __init__.py
│   │   ├── ppo_easy.zip                 ← Your trained PPO model (easy task)
│   │   ├── ppo_medium.zip               ← PPO for medium task
│   │   ├── ppo_hard.zip                 ← PPO for hard task
│   │   ├── sac_expert.zip               ← SAC for expert task
│   │   ├── dqn_islanding.zip            ← DQN for islanding task
│   │   │
│   │   └── checkpoints/                 ← Optional: training checkpoints
│   │       ├── ppo_easy_100k.zip
│   │       ├── ppo_easy_500k.zip
│   │       └── ppo_easy_1M.zip
│   │
│   ├── rl_agent.py                      ← CREATE THIS FILE (agent wrapper)
│   └── preprocessing.py                 ← CREATE THIS FILE (obs → model input)
│
└── ...
```

---

## 🔧 Step 1: Create Model Directory

```bash
cd vpp-3d-sim/backend
mkdir -p models/checkpoints
touch models/__init__.py
```

---

## 🤖 Step 2: Create RL Agent Wrapper

Create `backend/rl_agent.py`:

```python
"""
RL Agent wrapper for VPP 3D visualization.

Supports multiple RL frameworks:
- Stable-Baselines3 (PPO, SAC, A2C, TD3, DQN)
- RLlib (Ray)
- Custom PyTorch models
"""

import os
from typing import Dict, Any, Optional
import numpy as np

# Stable-Baselines3
try:
    from stable_baselines3 import PPO, SAC, A2C, TD3, DQN
    from stable_baselines3.common.base_class import BaseAlgorithm
    SB3_AVAILABLE = True
except ImportError:
    SB3_AVAILABLE = False
    print("⚠️  Stable-Baselines3 not installed. Install with: pip install stable-baselines3")

# RLlib
try:
    from ray.rllib.algorithms import Algorithm
    RLLIB_AVAILABLE = True
except ImportError:
    RLLIB_AVAILABLE = False

# PyTorch
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class VppRLAgent:
    """
    Unified RL agent interface for VPP environment.
    
    Supports:
    - Stable-Baselines3 models (.zip files)
    - RLlib checkpoints
    - Custom PyTorch models (.pt files)
    """
    
    def __init__(self, model_path: Optional[str] = None, model_type: str = "sb3"):
        """
        Initialize RL agent.
        
        Args:
            model_path: Path to trained model file
            model_type: "sb3", "rllib", "pytorch", or "custom"
        """
        self.model_path = model_path
        self.model_type = model_type
        self.model = None
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path, model_type)
    
    def load_model(self, model_path: str, model_type: str = "sb3"):
        """Load trained model from file."""
        self.model_path = model_path
        self.model_type = model_type
        
        if model_type == "sb3":
            if not SB3_AVAILABLE:
                raise ImportError("Stable-Baselines3 not available")
            
            # Auto-detect algorithm from filename or load as PPO by default
            if "ppo" in model_path.lower():
                self.model = PPO.load(model_path)
            elif "sac" in model_path.lower():
                self.model = SAC.load(model_path)
            elif "dqn" in model_path.lower():
                self.model = DQN.load(model_path)
            elif "a2c" in model_path.lower():
                self.model = A2C.load(model_path)
            elif "td3" in model_path.lower():
                self.model = TD3.load(model_path)
            else:
                # Try PPO as default
                self.model = PPO.load(model_path)
            
            print(f"✅ Loaded SB3 model from {model_path}")
        
        elif model_type == "rllib":
            if not RLLIB_AVAILABLE:
                raise ImportError("RLlib not available")
            
            self.model = Algorithm.from_checkpoint(model_path)
            print(f"✅ Loaded RLlib model from {model_path}")
        
        elif model_type == "pytorch":
            if not TORCH_AVAILABLE:
                raise ImportError("PyTorch not available")
            
            self.model = torch.load(model_path)
            self.model.eval()
            print(f"✅ Loaded PyTorch model from {model_path}")
        
        else:
            raise ValueError(f"Unknown model_type: {model_type}")
    
    def predict(self, observation: np.ndarray, deterministic: bool = True) -> np.ndarray:
        """
        Get action from model.
        
        Args:
            observation: Preprocessed observation array
            deterministic: Use deterministic (greedy) policy
        
        Returns:
            action: Action array
        """
        if self.model is None:
            raise RuntimeError("No model loaded. Call load_model() first.")
        
        if self.model_type == "sb3":
            action, _states = self.model.predict(observation, deterministic=deterministic)
            return action
        
        elif self.model_type == "rllib":
            action = self.model.compute_single_action(observation, explore=not deterministic)
            return np.array(action)
        
        elif self.model_type == "pytorch":
            with torch.no_grad():
                obs_tensor = torch.FloatTensor(observation).unsqueeze(0)
                action_tensor = self.model(obs_tensor)
                return action_tensor.squeeze(0).numpy()
        
        else:
            raise ValueError(f"Unsupported model_type: {self.model_type}")
    
    def get_action_dict(self, observation: Dict[str, Any], task_id: str) -> Dict[str, Any]:
        """
        Convert raw VPP observation to action dict.
        
        Args:
            observation: Raw observation dict from VPP environment
            task_id: Current task ID
        
        Returns:
            action_dict: Dict with VPP action fields
        """
        from preprocessing import preprocess_observation
        
        # Preprocess observation
        obs_array = preprocess_observation(observation)
        
        # Get action from model
        action_array = self.predict(obs_array, deterministic=True)
        
        # Convert to VPP action format
        return self.format_action(action_array)
    
    @staticmethod
    def format_action(action_array: np.ndarray) -> Dict[str, Any]:
        """
        Convert model output to VPP action dict.
        
        Expected action_array format (5 dimensions):
        - [0]: global_charge_rate (-1.0 to 1.0)
        - [1]: min_reserve_pct (0.0 to 1.0)
        - [2]: defer_ev_charging (0.0 to 1.0)
        - [3]: accept_dr_bid (0.0 to 1.0, > 0.5 = True)
        - [4]: p2p_export_rate (0.0 to 1.0)
        """
        action_array = np.atleast_1d(action_array)
        
        return {
            "global_charge_rate": float(np.clip(action_array[0], -1.0, 1.0)),
            "min_reserve_pct": float(np.clip(action_array[1], 0.0, 1.0)),
            "defer_ev_charging": float(np.clip(action_array[2], 0.0, 1.0)) if len(action_array) > 2 else 0.0,
            "accept_dr_bid": bool(action_array[3] > 0.5) if len(action_array) > 3 else False,
            "p2p_export_rate": float(np.clip(action_array[4], 0.0, 1.0)) if len(action_array) > 4 else 0.0,
        }


# Task-specific model loader
def load_model_for_task(task_id: str) -> VppRLAgent:
    """
    Load the appropriate model for a given task.
    
    Model selection logic:
    - easy-arbitrage → models/ppo_easy.zip
    - medium-forecast-error → models/ppo_medium.zip
    - hard-frequency-response → models/ppo_hard.zip
    - expert-demand-response → models/sac_expert.zip
    - islanding-emergency → models/dqn_islanding.zip
    """
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    
    # Task to model mapping
    model_mapping = {
        "easy-arbitrage": "ppo_easy.zip",
        "medium-forecast-error": "ppo_medium.zip",
        "hard-frequency-response": "ppo_hard.zip",
        "expert-demand-response": "sac_expert.zip",
        "islanding-emergency": "dqn_islanding.zip",
    }
    
    model_filename = model_mapping.get(task_id)
    
    if model_filename is None:
        print(f"⚠️  No model mapping for task: {task_id}")
        return VppRLAgent()  # Empty agent (will fall back to rule-based)
    
    model_path = os.path.join(models_dir, model_filename)
    
    if not os.path.exists(model_path):
        print(f"⚠️  Model not found: {model_path}")
        print(f"   Falling back to rule-based agent for task: {task_id}")
        return VppRLAgent()  # Empty agent
    
    # Detect model type from extension
    if model_path.endswith(".zip"):
        model_type = "sb3"
    elif model_path.endswith(".pt") or model_path.endswith(".pth"):
        model_type = "pytorch"
    elif os.path.isdir(model_path):
        model_type = "rllib"
    else:
        model_type = "sb3"  # Default
    
    agent = VppRLAgent(model_path, model_type)
    return agent
```

---

## 📊 Step 3: Create Preprocessing Module

Create `backend/preprocessing.py`:

```python
"""
Observation preprocessing for RL models.

Converts raw VPP observation dict to numpy array suitable for RL model input.
"""

import numpy as np
from typing import Dict, Any, List


def preprocess_observation(obs: Dict[str, Any]) -> np.ndarray:
    """
    Convert VPP observation dict to flat numpy array.
    
    Feature engineering:
    - Aggregate fleet statistics (mean, min, max SoC/SoH)
    - Zone-level statistics
    - Grid state (price, frequency, connected)
    - Time features (step, time of day)
    - Market features (DR bid, P2P availability)
    - Forecast features (short-term price/solar)
    
    Returns:
        obs_array: Shape (N,) where N is the total number of features
    """
    features = []
    
    # ── Time features ──
    step = obs.get("step_id", 0)
    features.append(step / 47.0)  # Normalized step (0-1)
    features.append(np.sin(2 * np.pi * step / 48))  # Cyclical time
    features.append(np.cos(2 * np.pi * step / 48))
    
    # ── Grid state ──
    features.append(obs.get("market_price_per_mwh", 50.0) / 100.0)  # Normalized price
    features.append((obs.get("grid_frequency_hz", 50.0) - 50.0) / 0.5)  # Frequency deviation
    features.append(float(obs.get("grid_connected", True)))  # 1.0 or 0.0
    features.append(float(obs.get("emergency_active", False)))
    
    # ── Fleet aggregates ──
    telemetry = obs.get("telemetry", [])
    
    if telemetry:
        socs = [t["soc"] for t in telemetry]
        sohs = [t.get("state_of_health", 1.0) for t in telemetry]
        solar = [t["current_solar_gen_kw"] for t in telemetry]
        demand = [t["current_house_load_kw"] for t in telemetry]
        
        # SoC statistics
        features.append(np.mean(socs))
        features.append(np.min(socs))
        features.append(np.max(socs))
        features.append(np.std(socs))
        
        # SoH statistics
        features.append(np.mean(sohs))
        features.append(np.min(sohs))
        
        # Solar statistics
        features.append(np.mean(solar))
        features.append(np.max(solar))
        
        # Demand statistics
        features.append(np.mean(demand))
        features.append(np.max(demand))
    else:
        # Default values if no telemetry
        features.extend([0.5, 0.5, 0.5, 0.0,  # SoC stats
                        1.0, 1.0,              # SoH stats
                        0.0, 0.0,              # Solar stats
                        0.0, 0.0])             # Demand stats
    
    # ── Zone aggregates ──
    zone_aggs = obs.get("zone_aggregates", [])
    
    for zone_id in ["zone-a", "zone-b"]:
        zone = next((z for z in zone_aggs if z.get("zone_id") == zone_id), None)
        
        if zone:
            features.append(zone.get("mean_soc", 0.5))
            features.append(zone.get("mean_soh", 1.0))
            features.append(zone.get("mean_solar_kw", 0.0) / 6.0)  # Normalized
            features.append(zone.get("mean_demand_kw", 0.0) / 3.0)
            features.append(zone.get("p2p_available_kw", 0.0) / 3.0)
        else:
            features.extend([0.5, 1.0, 0.0, 0.0, 0.0])
    
    # ── Carbon credits ──
    features.append(obs.get("carbon_credits_balance", 0.0) / 10.0)  # Normalized
    features.append(obs.get("carbon_earned_this_step", 0.0))
    features.append(obs.get("carbon_spent_this_step", 0.0))
    
    # ── DR bid ──
    dr_bid = obs.get("dr_bid", {})
    features.append(float(dr_bid.get("active", False)))
    features.append(dr_bid.get("premium_multiplier", 1.0) / 3.0)  # Normalized
    features.append(dr_bid.get("committed_power_kw", 0.0) / 5.0)
    features.append(dr_bid.get("steps_remaining", 0) / 10.0)
    
    # ── Safety margin ──
    features.append(obs.get("safety_margin_pct", 0.0) / 100.0)
    features.append(obs.get("demand_shed_this_step_kwh", 0.0) / 10.0)
    
    # ── Short-term forecasts (4 steps ahead) ──
    price_forecast = obs.get("short_term_price_forecast", [])[:4]
    solar_forecast = obs.get("short_term_solar_forecast", [])[:4]
    
    # Pad to 4 steps if needed
    while len(price_forecast) < 4:
        price_forecast.append(50.0)
    while len(solar_forecast) < 4:
        solar_forecast.append(0.0)
    
    features.extend([p / 100.0 for p in price_forecast[:4]])  # Normalized
    features.extend([s / 6.0 for s in solar_forecast[:4]])
    
    # ── Forecast uncertainty ──
    price_uncertainty = obs.get("forecast_price_uncertainty", [])[:4]
    solar_uncertainty = obs.get("forecast_solar_uncertainty", [])[:4]
    
    while len(price_uncertainty) < 4:
        price_uncertainty.append(0.0)
    while len(solar_uncertainty) < 4:
        solar_uncertainty.append(0.0)
    
    features.extend([u / 10.0 for u in price_uncertainty[:4]])
    features.extend([u / 1.0 for u in solar_uncertainty[:4]])
    
    # Convert to numpy array
    obs_array = np.array(features, dtype=np.float32)
    
    return obs_array


def get_observation_space_size() -> int:
    """
    Get the total dimension of the preprocessed observation space.
    
    Returns:
        int: Number of features in preprocessed observation
    """
    # Count features from preprocess_observation:
    # Time: 3
    # Grid: 4
    # Fleet aggregates: 10
    # Zone aggregates: 10 (5 per zone × 2 zones)
    # Carbon: 3
    # DR bid: 4
    # Safety: 2
    # Price forecast: 4
    # Solar forecast: 4
    # Price uncertainty: 4
    # Solar uncertainty: 4
    # Total: 52 features
    return 52


def get_action_space_size() -> int:
    """
    Get the dimension of the action space.
    
    Returns:
        int: Number of action dimensions (5)
    """
    # Action space:
    # 1. global_charge_rate
    # 2. min_reserve_pct
    # 3. defer_ev_charging
    # 4. accept_dr_bid (continuous 0-1, thresholded at 0.5)
    # 5. p2p_export_rate
    return 5
```

---

## 🔌 Step 4: Update simulation_server.py

Edit `backend/simulation_server.py` around line 180:

```python
# Add imports at top
from rl_agent import VppRLAgent, load_model_for_task

# Global model cache (one model per task)
_model_cache: Dict[str, VppRLAgent] = {}

def get_llm_action(obs: dict, task_id: str) -> Dict[str, Any]:
    """
    Get action from RL model (or fall back to rule-based).
    
    Priority:
    1. Try task-specific trained model
    2. Try LLM if HF_TOKEN is set
    3. Fall back to rule-based agent
    """
    global _model_cache
    
    # Try RL model first
    if task_id not in _model_cache:
        _model_cache[task_id] = load_model_for_task(task_id)
    
    agent = _model_cache[task_id]
    
    if agent.model is not None:
        try:
            return agent.get_action_dict(obs, task_id)
        except Exception as e:
            print(f"⚠️  RL model error: {e}. Falling back to rule agent.")
    
    # Fall back to LLM or rule-based
    if USE_LLM and client is not None:
        try:
            # Original LLM logic here
            summary = _summarise_obs(obs)
            prompt = ACTION_PROMPT.format(task_id=task_id, **summary)
            
            response = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=120,
            )
            
            text = _extract_response_text(response)
            decision = _extract_json(text)
            
            return {
                "global_charge_rate": float(max(-1.0, min(1.0, decision.get("global_charge_rate", 0.0)))),
                "min_reserve_pct": float(max(0.0, min(1.0, decision.get("min_reserve_pct", 0.2)))),
                "defer_ev_charging": float(max(0.0, min(1.0, decision.get("defer_ev_charging", 0.0)))),
                "accept_dr_bid": bool(decision.get("accept_dr_bid", False)),
                "p2p_export_rate": float(max(0.0, min(1.0, decision.get("p2p_export_rate", 0.0)))),
            }
        except Exception as e:
            print(f"⚠️  LLM error: {e}. Falling back to rule agent.")
    
    # Final fallback: rule-based agent
    return _rule_agent(obs, task_id)
```

---

## 📦 Step 5: Update requirements.txt

Add to `backend/requirements.txt`:

```txt
# Existing dependencies
fastapi>=0.115.0
uvicorn>=0.24.0
...

# RL frameworks (choose what you need)
stable-baselines3>=2.0.0        # For PPO, SAC, DQN, etc.
torch>=2.0.0                    # PyTorch backend
gymnasium>=0.29.0               # Gym environments

# Optional: Advanced RL frameworks
# ray[rllib]>=2.0.0             # Ray RLlib (uncomment if needed)
# tensorflow>=2.13.0            # For TensorFlow-based models
```

---

## 🎯 Step 6: Place Your Trained Models

Copy your trained models to the `backend/models/` directory:

```bash
# Example: Copy PPO model for easy task
cp /path/to/your/ppo_easy.zip backend/models/

# Example: Copy all models
cp /path/to/models/*.zip backend/models/

# File naming convention (recommended):
# - ppo_easy.zip          (PPO for easy-arbitrage)
# - ppo_medium.zip        (PPO for medium-forecast-error)
# - ppo_hard.zip          (PPO for hard-frequency-response)
# - sac_expert.zip        (SAC for expert-demand-response)
# - dqn_islanding.zip     (DQN for islanding-emergency)
```

---

## 🧪 Step 7: Test Your Integration

```bash
# 1. Start VPP server
cd /path/to/vpp-env
uvicorn server.app:app --port 7860

# 2. Start simulation server (with your models)
cd vpp-3d-sim/backend
python simulation_server.py

# 3. Start frontend
cd vpp-3d-sim/frontend
npm run dev

# 4. Open browser and test
# http://localhost:3000
# - Select task
# - Click Start
# - Watch your trained model control the fleet!
```

---

## 🔍 Debugging

### Check if models are loaded:

```python
# Add to simulation_server.py
@app.get("/models")
async def list_models():
    """List loaded RL models."""
    models_info = {}
    for task_id, agent in _model_cache.items():
        models_info[task_id] = {
            "model_path": agent.model_path,
            "model_type": agent.model_type,
            "loaded": agent.model is not None,
        }
    return models_info
```

Then visit: `http://localhost:8001/models`

### Test preprocessing:

```python
# backend/test_preprocessing.py
from preprocessing import preprocess_observation, get_observation_space_size

# Mock observation
obs = {
    "step_id": 10,
    "market_price_per_mwh": 55.0,
    "grid_frequency_hz": 50.0,
    "telemetry": [{"soc": 0.5, "state_of_health": 1.0, 
                   "current_solar_gen_kw": 2.0, "current_house_load_kw": 1.5}] * 100,
    # ... rest of observation
}

obs_array = preprocess_observation(obs)
print(f"Observation shape: {obs_array.shape}")
print(f"Expected size: {get_observation_space_size()}")
print(f"Features: {obs_array[:10]}...")  # First 10 features
```

---

## 🎓 Training Your Own Models

### Example: Train PPO for Easy Task

```python
# train_ppo_easy.py
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from client import VppEnv

# Create vectorized environment
def make_env():
    return VppEnv(base_url="http://localhost:7860").sync()

env = make_vec_env(make_env, n_envs=4)

# Train PPO
model = PPO("MlpPolicy", env, verbose=1, 
            learning_rate=3e-4, 
            n_steps=2048,
            batch_size=64,
            n_epochs=10)

model.learn(total_timesteps=1_000_000)

# Save model
model.save("backend/models/ppo_easy")

print("✅ Model saved to backend/models/ppo_easy.zip")
```

Run training:
```bash
python train_ppo_easy.py
```

---

## 📋 Summary Checklist

- [ ] Create `backend/models/` directory
- [ ] Create `backend/rl_agent.py` (agent wrapper)
- [ ] Create `backend/preprocessing.py` (observation preprocessing)
- [ ] Update `backend/simulation_server.py` (integrate RL agent)
- [ ] Update `backend/requirements.txt` (add stable-baselines3)
- [ ] Copy your trained models to `backend/models/`
- [ ] Test with: `python simulation_server.py`
- [ ] Open `http://localhost:3000` and watch your RL agent!

---

## 🚀 Your Models Are Now Integrated!

The 3D visualization will automatically use your trained models when available:
1. **Task starts** → `load_model_for_task(task_id)` loads the appropriate model
2. **Every step** → `agent.get_action_dict(obs, task_id)` gets action from model
3. **Real-time** → See your model's decisions in stunning 3D!

If a model isn't found, it gracefully falls back to the rule-based agent, so you can train models incrementally.
