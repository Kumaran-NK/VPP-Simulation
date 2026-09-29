"""
RL Agent wrapper for VPP 3D visualization.

Supports multiple RL frameworks:
- Stable-Baselines3 (PPO, SAC, A2C, TD3, DQN)
- RLlib (Ray)
- Custom PyTorch models

Includes VecNormalize support for loading observation normalization
statistics saved during training.
"""

import os
from typing import Dict, Any, Optional
import numpy as np

# Windows DLL loading fix for PyTorch / c10.dll
import sys
if sys.platform == "win32":
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    try:
        import site
        for site_pkg in site.getsitepackages():
            torch_lib_path = os.path.join(site_pkg, "torch", "lib")
            if os.path.exists(torch_lib_path) and hasattr(os, "add_dll_directory"):
                try:
                    os.add_dll_directory(torch_lib_path)
                except Exception:
                    pass
    except Exception:
        pass

# Stable-Baselines3
try:
    from stable_baselines3 import PPO, SAC, A2C, TD3, DQN
    from stable_baselines3.common.base_class import BaseAlgorithm
    from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize
    SB3_AVAILABLE = True
except Exception as e:
    SB3_AVAILABLE = False
    print(f"⚠️  Stable-Baselines3 / PyTorch notice: {e}")

# RLlib
try:
    from ray.rllib.algorithms import Algorithm
    RLLIB_AVAILABLE = True
except Exception:
    RLLIB_AVAILABLE = False

# PyTorch
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except Exception as e:
    TORCH_AVAILABLE = False


class VppRLAgent:
    """
    Unified RL agent interface for VPP environment.
    
    Supports:
    - Stable-Baselines3 models (.zip files) with VecNormalize stats
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
        self.vec_normalize: Optional[Any] = None  # VecNormalize for obs normalisation
        
        if model_path and os.path.exists(model_path):
            try:
                self.load_model(model_path, model_type)
            except Exception as e:
                print(f"⚠️ Could not load model {model_path}: {e}. Falling back to rule-based agent.")
                self.model = None
    
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
            
            # Load VecNormalize stats if available
            self._load_vec_normalize(model_path)
        
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
    
    def _load_vec_normalize(self, model_path: str):
        """
        Load VecNormalize stats saved alongside the model during training.
        
        Looks for a file named <model_name>_vecnormalize.pkl in the same
        directory as the model file.
        """
        if not SB3_AVAILABLE:
            return
            
        # Derive VecNormalize path from model path
        # model_path might be "models/ppo_easy.zip" or "models/ppo_easy"
        base_path = model_path.replace(".zip", "")
        vecnorm_path = f"{base_path}_vecnormalize.pkl"
        
        if os.path.exists(vecnorm_path):
            try:
                # Create a dummy env to load VecNormalize into
                # We only need the normalization statistics (obs_rms, ret_rms)
                import gymnasium as gym
                
                # Create a minimal dummy env with the right observation shape
                dummy_env = DummyVecEnv([
                    lambda: gym.make("CartPole-v1")  # placeholder
                ])
                
                self.vec_normalize = VecNormalize.load(vecnorm_path, dummy_env)
                self.vec_normalize.training = False   # don't update running stats
                self.vec_normalize.norm_reward = False # don't normalise rewards
                
                print(f"✅ Loaded VecNormalize stats from {vecnorm_path}")
            except Exception as e:
                print(f"⚠️  Could not load VecNormalize stats: {e}")
                print("   Agent will work but observation normalisation is disabled.")
                self.vec_normalize = None
        else:
            print(f"ℹ️  No VecNormalize stats found at {vecnorm_path}")
    
    def normalize_observation(self, observation: np.ndarray) -> np.ndarray:
        """
        Normalise an observation using the VecNormalize running statistics.
        
        If no VecNormalize stats are loaded, returns the observation unchanged.
        """
        if self.vec_normalize is None:
            return observation
        
        try:
            # Apply the same normalisation used during training
            obs_rms = self.vec_normalize.obs_rms
            clip_obs = self.vec_normalize.clip_obs
            
            normalized = (observation - obs_rms.mean) / np.sqrt(obs_rms.var + 1e-8)
            normalized = np.clip(normalized, -clip_obs, clip_obs)
            return normalized.astype(np.float32)
        except Exception:
            return observation
    
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
        
        # Apply VecNormalize if available
        obs_array = self.normalize_observation(obs_array)
        
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
    Searches both backend/models/ and backend/trained_models/.
    """
    base_dir = os.path.dirname(__file__)
    candidate_dirs = [
        os.path.join(base_dir, "models"),
        os.path.join(base_dir, "trained_models"),
        os.path.join(os.path.dirname(base_dir), "trained_models")
    ]
    
    # Task to model filenames mapping (support full task name & short name)
    short_names = {
        "easy-arbitrage": "easy",
        "carbon-minimal": "carbon",
        "peak-shaving": "peak",
        "degraded-battery": "degraded",
        "grid-stress-test": "grid",
        "medium-forecast-error": "medium",
        "hard-frequency-response": "hard",
        "expert-demand-response": "expert",
        "islanding-emergency": "islanding",
    }
    
    short = short_names.get(task_id, task_id)
    possible_filenames = [
        f"ppo_{task_id}.zip",
        f"ppo_{short}.zip",
        f"sac_{task_id}.zip",
        f"sac_{short}.zip",
    ]
    
    found_path = None
    for d in candidate_dirs:
        for fn in possible_filenames:
            p = os.path.join(d, fn)
            if os.path.exists(p):
                found_path = p
                break
        if found_path:
            break
            
    if not found_path:
        print(f"⚠️  No trained model found for task '{task_id}' (searched dirs: {candidate_dirs})")
        print("   Falling back to rule-based agent.")
        return VppRLAgent()
        
    return VppRLAgent(found_path, "sb3")


def scan_available_models() -> Dict[str, Dict[str, Any]]:
    """
    Scan model directories and report availability per task.
    """
    base_dir = os.path.dirname(__file__)
    candidate_dirs = [
        os.path.join(base_dir, "models"),
        os.path.join(base_dir, "trained_models"),
        os.path.join(os.path.dirname(base_dir), "trained_models")
    ]
    
    tasks = [
        "easy-arbitrage", "carbon-minimal", "peak-shaving",
        "degraded-battery", "grid-stress-test",
        "medium-forecast-error", "hard-frequency-response",
        "expert-demand-response", "islanding-emergency"
    ]
    
    short_names = {
        "easy-arbitrage": "easy",
        "carbon-minimal": "carbon",
        "peak-shaving": "peak",
        "degraded-battery": "degraded",
        "grid-stress-test": "grid",
        "medium-forecast-error": "medium",
        "hard-frequency-response": "hard",
        "expert-demand-response": "expert",
        "islanding-emergency": "islanding",
    }
    
    status = {}
    for task_id in tasks:
        short = short_names.get(task_id, task_id)
        found_model = None
        found_vec = None
        
        for d in candidate_dirs:
            for fn in [f"ppo_{task_id}.zip", f"ppo_{short}.zip"]:
                p = os.path.join(d, fn)
                if os.path.exists(p):
                    found_model = p
                    vec_p = p.replace(".zip", "_vecnormalize.pkl")
                    if os.path.exists(vec_p):
                        found_vec = vec_p
                    break
            if found_model:
                break
                
        status[task_id] = {
            "model_found": found_model is not None,
            "vecnorm_found": found_vec is not None,
            "model_path": found_model or "",
            "vecnorm_path": found_vec or "",
        }
        
    return status
