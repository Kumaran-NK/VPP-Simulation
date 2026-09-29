"""
Observation preprocessing for RL models.

Converts raw VPP observation dict to numpy array suitable for RL model input.
"""

import numpy as np
from typing import Dict, Any


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
        obs_array: Shape (52,) - preprocessed observation vector
    """
    features = []
    
    # ── Time features (3) ──
    step = obs.get("step_id", 0)
    features.append(step / 47.0)  # Normalized step (0-1)
    features.append(np.sin(2 * np.pi * step / 48))  # Cyclical time
    features.append(np.cos(2 * np.pi * step / 48))
    
    # ── Grid state (4) ──
    features.append(obs.get("market_price_per_mwh", 50.0) / 100.0)  # Normalized price
    features.append((obs.get("grid_frequency_hz", 50.0) - 50.0) / 0.5)  # Frequency deviation
    features.append(float(obs.get("grid_connected", True)))  # 1.0 or 0.0
    features.append(float(obs.get("emergency_active", False)))
    
    # ── Fleet aggregates (10) ──
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
    
    # ── Zone aggregates (10: 5 per zone × 2 zones) ──
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
    
    # ── Carbon credits (3) ──
    features.append(obs.get("carbon_credits_balance", 0.0) / 10.0)  # Normalized
    features.append(obs.get("carbon_earned_this_step", 0.0))
    features.append(obs.get("carbon_spent_this_step", 0.0))
    
    # ── DR bid (4) ──
    dr_bid = obs.get("dr_bid", {})
    features.append(float(dr_bid.get("active", False)))
    features.append(dr_bid.get("premium_multiplier", 1.0) / 3.0)  # Normalized
    features.append(dr_bid.get("committed_power_kw", 0.0) / 5.0)
    features.append(dr_bid.get("steps_remaining", 0) / 10.0)
    
    # ── Safety margin (2) ──
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
    
    # Price forecast (4)
    features.extend([p / 100.0 for p in price_forecast[:4]])  # Normalized
    # Solar forecast (4)
    features.extend([s / 6.0 for s in solar_forecast[:4]])
    
    # ── Forecast uncertainty (8: 4 + 4) ──
    price_uncertainty = obs.get("forecast_price_uncertainty", [])[:4]
    solar_uncertainty = obs.get("forecast_solar_uncertainty", [])[:4]
    
    while len(price_uncertainty) < 4:
        price_uncertainty.append(0.0)
    while len(solar_uncertainty) < 4:
        solar_uncertainty.append(0.0)
    
    # Price uncertainty (4)
    features.extend([u / 10.0 for u in price_uncertainty[:4]])
    # Solar uncertainty (4)
    features.extend([u / 1.0 for u in solar_uncertainty[:4]])
    
    # Convert to numpy array
    obs_array = np.array(features, dtype=np.float32)
    
    return obs_array


def get_observation_space_size() -> int:
    """
    Get the total dimension of the preprocessed observation space.
    
    Returns:
        int: Number of features in preprocessed observation (52)
    """
    # Feature count breakdown:
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
    # ──────────────────
    # Total: 52 features
    return 52


def get_action_space_size() -> int:
    """
    Get the dimension of the action space.
    
    Returns:
        int: Number of action dimensions (5)
    """
    # Action space (5 continuous dimensions):
    # 1. global_charge_rate (-1.0 to 1.0)
    # 2. min_reserve_pct (0.0 to 1.0)
    # 3. defer_ev_charging (0.0 to 1.0)
    # 4. accept_dr_bid (0.0 to 1.0, thresholded at 0.5)
    # 5. p2p_export_rate (0.0 to 1.0)
    return 5
