#!/usr/bin/env python3
"""
3D Simulation WebSocket Server for VPP Environment

Broadcasts real-time simulation state to frontend clients:
- House battery/solar/demand states
- Sun position and intensity
- Grid price and frequency
- Weather conditions
- RL agent actions and reasoning
"""

import asyncio
import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Any

# Load .env before anything else
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Add parent directory to path to import VPP modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from client import VppEnv
    from models import VppAction, VppObservation
    VPP_AVAILABLE = True
except ImportError:
    print("⚠️  VPP modules not found. Make sure VPP project is accessible.")
    VPP_AVAILABLE = False

# Import RL agent wrapper
try:
    from rl_agent import VppRLAgent, load_model_for_task, scan_available_models
    from preprocessing import preprocess_observation
    RL_AGENT_AVAILABLE = True
except ImportError:
    print("⚠️  RL agent modules not found. Falling back to rule-based agent.")
    RL_AGENT_AVAILABLE = False
    scan_available_models = None

# Groq AI agent
try:
    from groq_agent import GroqVPPAgent
    groq_agent = GroqVPPAgent()
    GROQ_AVAILABLE = groq_agent.enabled
except Exception as e:
    print(f"⚠️  Groq AI agent not loaded: {e}")
    groq_agent = None
    GROQ_AVAILABLE = False


class SimulationState:
    """Manages real-time simulation state for broadcasting to 3D frontend."""
    
    def __init__(self):
        self.running = False
        self.task_id = "easy-arbitrage"
        self.step = 0
        self.episode_id: Optional[str] = None
        self.sun_intensity = 0.0
        self.sun_angle = 0.0  # 0-360 degrees
        self.grid_price = 50.0
        self.grid_frequency = 50.0
        self.grid_connected = True
        self.weather_mode = "clear_sky"
        self.houses: List[Dict] = []
        self.zone_aggregates: List[Dict] = []
        self.pareto_score: Optional[Dict] = None
        self.last_action: Optional[Dict] = None
        self.last_reward = 0.0
        self.cumulative_profit = 0.0
        self.carbon_balance = 0.0
        self.mean_soh = 1.0
        self.emergency_active = False
        self.dr_bid: Optional[Dict] = None
        self.p2p_flow_kw = 0.0  # Zone B → Zone A power flow
        
    def update_from_observation(self, obs: 'VppObservation', action: Optional['VppAction'] = None):
        """Update simulation state from VPP observation."""
        self.step = obs.step_id
        
        # Calculate sun position (0-360 degrees, 0=east, 90=south, 180=west)
        # 48 steps = 12 hours (06:00 to 18:00)
        # Map: step 0 (06:00) → 0°, step 24 (12:00) → 90°, step 47 (17:45) → 180°
        self.sun_angle = (obs.step_id / 47.0) * 180.0  # 0° to 180°
        
        # Sun intensity from mean solar generation
        if obs.telemetry:
            mean_solar = sum(t.current_solar_gen_kw for t in obs.telemetry) / len(obs.telemetry)
            self.sun_intensity = min(1.0, mean_solar / 6.0)  # Normalize to 0-1 (peak ~6kW)
        
        # Grid state
        self.grid_price = obs.market_price_per_mwh
        self.grid_frequency = obs.grid_frequency_hz
        self.grid_connected = obs.grid_connected
        self.emergency_active = obs.emergency_active
        
        # Weather mode
        self.weather_mode = self._infer_weather_mode(obs)
        
        # House states (100 homes)
        self.houses = []
        for i, telem in enumerate(obs.telemetry):
            # Determine house zone
            zone = "zone-a" if i < 40 else "zone-b"
            has_ev = zone == "zone-b"
            
            # Calculate power flow direction
            net_power = telem.current_solar_gen_kw - telem.current_house_load_kw
            
            house_state = {
                "id": i,
                "asset_id": telem.asset_id,
                "zone": zone,
                "has_ev": has_ev,
                "battery_soc": round(telem.soc, 3),
                "battery_soh": round(telem.state_of_health, 3),
                "solar_kw": round(telem.current_solar_gen_kw, 2),
                "demand_kw": round(telem.current_house_load_kw, 2),
                "net_power_kw": round(net_power, 2),
                "status": self._get_house_status(telem.soc, net_power),
                # Position will be set by frontend layout
            }
            self.houses.append(house_state)
        
        # Zone aggregates
        self.zone_aggregates = [
            {
                "zone_id": z.zone_id,
                "mean_soc": round(z.mean_soc, 3),
                "mean_soh": round(z.mean_soh, 3),
                "mean_solar_kw": round(z.mean_solar_kw, 2),
                "mean_demand_kw": round(z.mean_demand_kw, 2),
                "p2p_available_kw": round(z.p2p_available_kw, 2),
            }
            for z in obs.zone_aggregates
        ]
        
        # P2P power flow (Zone B → Zone A)
        zone_b_agg = next((z for z in obs.zone_aggregates if z.zone_id == "zone-b"), None)
        self.p2p_flow_kw = zone_b_agg.p2p_available_kw if zone_b_agg else 0.0
        
        # Metrics
        self.carbon_balance = obs.carbon_credits_balance
        if obs.telemetry:
            self.mean_soh = sum(t.state_of_health for t in obs.telemetry) / len(obs.telemetry)
        
        # Pareto score
        if obs.pareto_score:
            self.pareto_score = obs.pareto_score
        
        # DR bid
        self.dr_bid = {
            "active": obs.dr_bid.active,
            "premium_multiplier": obs.dr_bid.premium_multiplier,
            "committed_power_kw": obs.dr_bid.committed_power_kw,
            "steps_remaining": obs.dr_bid.steps_remaining,
        }
        
        # Last action
        if action:
            self.last_action = {
                "global_charge_rate": round(action.global_charge_rate, 2),
                "min_reserve_pct": round(action.min_reserve_pct, 2),
                "defer_ev_charging": round(action.defer_ev_charging, 2),
                "accept_dr_bid": action.accept_dr_bid,
                "p2p_export_rate": round(action.p2p_export_rate, 2),
            }
        
        # Reward
        self.last_reward = obs.reward if obs.reward is not None else 0.0
        
        # Cumulative profit from pareto score
        if self.pareto_score:
            self.cumulative_profit = self.pareto_score.get("cumulative_profit_usd", 0.0)
    
    def _get_house_status(self, soc: float, net_power: float) -> str:
        """Determine house visual status for color coding."""
        if soc < 0.15:
            return "critical"  # Red
        elif net_power > 0.5:
            return "exporting"  # Green (selling to grid)
        elif net_power < -0.5:
            return "importing"  # Yellow (buying from grid)
        elif soc > 0.8:
            return "charged"  # Blue
        else:
            return "normal"  # White/Gray
    
    def _infer_weather_mode(self, obs: 'VppObservation') -> str:
        """Infer weather mode from observation patterns."""
        # Check for storm (medium task: sudden solar drop)
        if obs.step_id >= 18 and obs.step_id <= 23:
            if obs.telemetry:
                mean_solar = sum(t.current_solar_gen_kw for t in obs.telemetry) / len(obs.telemetry)
                if mean_solar < 2.0:
                    return "storm"
        
        # Check for clouds (expert task: step 24-26)
        if obs.step_id >= 24 and obs.step_id <= 26:
            if obs.telemetry:
                mean_solar = sum(t.current_solar_gen_kw for t in obs.telemetry) / len(obs.telemetry)
                expected_solar = 4.0  # Expected at solar noon
                if mean_solar < expected_solar * 0.4:
                    return "cloudy"
        
        # Default: clear or partly cloudy based on mean solar
        if obs.telemetry:
            mean_solar = sum(t.current_solar_gen_kw for t in obs.telemetry) / len(obs.telemetry)
            if mean_solar > 3.0:
                return "clear_sky"
            else:
                return "partly_cloudy"
        
        return "clear_sky"
    
    def to_dict(self) -> Dict:
        """Serialize simulation state for WebSocket broadcast."""
        return {
            "running": self.running,
            "task_id": self.task_id,
            "step": self.step,
            "episode_id": self.episode_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sun": {
                "intensity": round(self.sun_intensity, 3),
                "angle": round(self.sun_angle, 1),  # 0-180 degrees
            },
            "grid": {
                "price": round(self.grid_price, 2),
                "frequency": round(self.grid_frequency, 2),
                "connected": self.grid_connected,
                "emergency": self.emergency_active,
            },
            "weather": self.weather_mode,
            "houses": self.houses,
            "zone_aggregates": self.zone_aggregates,
            "p2p_flow_kw": round(self.p2p_flow_kw, 2),
            "dr_bid": self.dr_bid,
            "metrics": {
                "cumulative_profit": round(self.cumulative_profit, 2),
                "carbon_balance": round(self.carbon_balance, 2),
                "mean_soh": round(self.mean_soh, 4),
                "last_reward": round(self.last_reward, 2),
            },
            "pareto_score": self.pareto_score,
            "last_action": self.last_action,
        }


class ConnectionManager:
    """Manages WebSocket connections for broadcasting simulation state."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
    
    async def broadcast(self, message: Dict):
        """Broadcast message to all connected clients."""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        
        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)


# Global state
simulation_state = SimulationState()
connection_manager = ConnectionManager()
simulation_task: Optional[asyncio.Task] = None

# Global RL model cache (one model per task)
_model_cache: Dict[str, 'VppRLAgent'] = {}


def _observation_to_dict(obs: 'VppObservation') -> Dict[str, Any]:
    """Convert VppObservation to dict for processing."""
    return {
        "step_id": obs.step_id,
        "market_price_per_mwh": obs.market_price_per_mwh,
        "grid_frequency_hz": obs.grid_frequency_hz,
        "grid_connected": obs.grid_connected,
        "emergency_active": obs.emergency_active,
        "telemetry": [
            {
                "asset_id": t.asset_id,
                "soc": t.soc,
                "state_of_health": t.state_of_health,
                "current_solar_gen_kw": t.current_solar_gen_kw,
                "current_house_load_kw": t.current_house_load_kw,
            }
            for t in obs.telemetry
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
            for z in obs.zone_aggregates
        ],
        "carbon_credits_balance": obs.carbon_credits_balance,
        "carbon_earned_this_step": obs.carbon_earned_this_step,
        "carbon_spent_this_step": obs.carbon_spent_this_step,
        "dr_bid": {
            "active": obs.dr_bid.active,
            "premium_multiplier": obs.dr_bid.premium_multiplier,
            "committed_power_kw": obs.dr_bid.committed_power_kw,
            "steps_remaining": obs.dr_bid.steps_remaining,
        },
        "safety_margin_pct": obs.safety_margin_pct,
        "demand_shed_this_step_kwh": obs.demand_shed_this_step_kwh,
        "short_term_price_forecast": getattr(obs, "short_term_price_forecast", []),
        "short_term_solar_forecast": getattr(obs, "short_term_solar_forecast", []),
        "forecast_price_uncertainty": getattr(obs, "forecast_price_uncertainty", []),
        "forecast_solar_uncertainty": getattr(obs, "forecast_solar_uncertainty", []),
    }


def _rule_agent(obs: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    """Simple rule-based fallback agent."""
    mean_soc = 0.5
    if obs.get("telemetry"):
        mean_soc = sum(t["soc"] for t in obs["telemetry"]) / len(obs["telemetry"])
    
    price = obs.get("market_price_per_mwh", 50.0)
    
    # Simple rule: charge when cheap and low SoC, discharge when expensive and high SoC
    if price < 40 and mean_soc < 0.6:
        charge_rate = 0.5
    elif price > 60 and mean_soc > 0.4:
        charge_rate = -0.5
    else:
        charge_rate = 0.0
    
    return {
        "global_charge_rate": charge_rate,
        "min_reserve_pct": 0.2,
        "defer_ev_charging": 0.0,
        "accept_dr_bid": False,
        "p2p_export_rate": 0.0,
    }


def get_rl_action(obs: Dict[str, Any], task_id: str) -> tuple:
    """
    Get action with 3-tier fallback:
      1. Task-specific trained RL model
      2. Groq AI LLM agent (Llama 3.3 70B)
      3. Simple rule-based agent

    Returns:
        (action_dict, ai_reasoning_text_or_None)
    """
    global _model_cache
    ai_reasoning = None
    
    # ── Tier 1: Trained RL model ──────────────────────────────────────
    if RL_AGENT_AVAILABLE:
        try:
            if task_id not in _model_cache:
                _model_cache[task_id] = load_model_for_task(task_id)
            agent = _model_cache[task_id]
            if agent and agent.model is not None:
                return (agent.get_action_dict(obs, task_id), "🧠 RL Model active")
        except Exception as e:
            print(f"⚠️  RL model error ({e}). Trying Groq AI…")
    
    # ── Tier 2: Groq AI LLM agent ─────────────────────────────────────
    if GROQ_AVAILABLE and groq_agent is not None:
        try:
            action, reasoning = groq_agent.get_action(obs, task_id)
            if action is not None:
                return (action, reasoning)
            # action was None but we got a message (cached / error)
            ai_reasoning = reasoning
        except Exception as e:
            print(f"⚠️  Groq agent error ({e}). Falling back to rules.")
            ai_reasoning = f"⚠️ Groq error: {e}"
    
    # ── Tier 3: Rule-based fallback ────────────────────────────────────
    return (_rule_agent(obs, task_id), ai_reasoning or "📏 Rule-based fallback")


async def run_simulation_loop(task_id: str):
    """Main simulation loop - runs VPP episode and broadcasts state updates."""
    global simulation_state
    
    simulation_state.running = True
    simulation_state.task_id = task_id
    simulation_state.step = 0
    
    if not VPP_AVAILABLE:
        await connection_manager.broadcast({
            "type": "error",
            "data": {"message": "VPP modules not available"}
        })
        return
    
    try:
        # Connect to VPP server
        vpp_server_url = os.getenv("VPP_SERVER_URL", "http://localhost:7860")
        
        with VppEnv(base_url=vpp_server_url).sync() as env:
            # Reset environment
            result = env.reset(task_id=task_id)
            obs_dict = _observation_to_dict(result.observation)
            obs = result.observation
            
            simulation_state.episode_id = f"sim_{task_id}_{datetime.now().strftime('%H%M%S')}"
            simulation_state.update_from_observation(obs)
            
            # Broadcast initial state
            await connection_manager.broadcast({
                "type": "state_update",
                "data": simulation_state.to_dict()
            })
            
            # Run episode
            done = False
            while not done and simulation_state.running:
                # Get action from RL / Groq AI / rule-based fallback
                action_dict, ai_reasoning = get_rl_action(obs_dict, task_id)
                action = VppAction(**action_dict)
                
                # Step environment
                result = env.step(action)
                obs = result.observation
                obs_dict = _observation_to_dict(obs)
                done = result.done
                
                # Update simulation state
                simulation_state.update_from_observation(obs, action)
                
                # Build broadcast payload
                state_payload = simulation_state.to_dict()
                if ai_reasoning:
                    state_payload["ai_reasoning"] = ai_reasoning
                if GROQ_AVAILABLE and groq_agent:
                    state_payload["ai_stats"] = groq_agent.stats
                
                # Broadcast updated state
                await connection_manager.broadcast({
                    "type": "state_update",
                    "data": state_payload
                })
                
                # Wait 500ms for visual smoothness
                await asyncio.sleep(0.5)
            
            # Episode complete
            simulation_state.running = False
            await connection_manager.broadcast({
                "type": "episode_complete",
                "data": {
                    "task_id": task_id,
                    "steps": simulation_state.step,
                    "pareto_score": simulation_state.pareto_score,
                }
            })
    
    except Exception as e:
        simulation_state.running = False
        await connection_manager.broadcast({
            "type": "error",
            "data": {"message": str(e)}
        })
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan manager for cleanup on shutdown."""
    yield
    # Stop simulation if running
    global simulation_task
    if simulation_task and not simulation_task.done():
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            pass


# FastAPI app
app = FastAPI(title="VPP 3D Simulation Server", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "simulation_running": simulation_state.running}


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


@app.get("/ai-stats")
async def ai_stats():
    """Groq AI agent statistics."""
    if groq_agent:
        return groq_agent.stats
    return {"enabled": False, "message": "Groq AI agent not loaded"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time simulation state updates."""
    await connection_manager.connect(websocket)
    
    try:
        # Send initial state
        await websocket.send_json({
            "type": "connection_established",
            "data": simulation_state.to_dict()
        })
        
        # Keep connection alive and handle incoming commands
        while True:
            data = await websocket.receive_json()
            command = data.get("command")
            
            if command == "start":
                task_id = data.get("task_id", simulation_state.task_id)
                
                global simulation_task
                if simulation_task and not simulation_task.done():
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Simulation already running"}
                    })
                else:
                    simulation_task = asyncio.create_task(run_simulation_loop(task_id))
                    await websocket.send_json({
                        "type": "simulation_started",
                        "data": {"task_id": task_id}
                    })
            
            elif command == "stop":
                simulation_state.running = False
                await websocket.send_json({
                    "type": "simulation_stopped",
                    "data": {}
                })

            elif command == "set_agent_type":
                agent_type = data.get("agent_type", "ppo")
                simulation_state.agent_type = agent_type
                await connection_manager.broadcast({
                    "type": "agent_changed",
                    "data": {"agent_type": agent_type}
                })

            elif command == "select_scenario":
                scenario_id = data.get("scenario_id", "easy-arbitrage")
                simulation_state.task_id = scenario_id
                await connection_manager.broadcast({
                    "type": "scenario_changed",
                    "data": {"task_id": scenario_id}
                })

            elif command == "inject_disturbance":
                dist_type = data.get("disturbance_type", "unknown")
                payload = data.get("payload", {})
                
                # Apply disturbance to simulation state
                if dist_type == "frequency_trip":
                    simulation_state.grid_frequency = float(payload.get("target_freq", 49.1))
                elif dist_type == "force_islanding":
                    simulation_state.grid_connected = False
                    simulation_state.emergency_active = True

                await connection_manager.broadcast({
                    "type": "disturbance_injected",
                    "data": {
                        "disturbance_type": dist_type,
                        "payload": payload,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                })
            
            elif command == "get_state":
                await websocket.send_json({
                    "type": "state_update",
                    "data": simulation_state.to_dict()
                })
    
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        connection_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("SIMULATION_PORT", "8001"))
    
    # ── Model availability diagnostics ─────────────────────────────────
    model_status_lines = []
    if RL_AGENT_AVAILABLE and scan_available_models is not None:
        status = scan_available_models()
        for task_id, info in status.items():
            if info["model_found"]:
                norm_icon = "✅" if info["vecnorm_found"] else "⚠️"
                model_status_lines.append(
                    f"  ║  ✅ {task_id:<28} (norm: {norm_icon})"
                )
            else:
                model_status_lines.append(
                    f"  ║  ❌ {task_id:<28} → rule-based fallback"
                )
    
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║        VPP 3D Simulation Server                           ║
║                                                           ║
║  🚀 Server running on http://localhost:{port}              ║
║  📡 WebSocket endpoint: ws://localhost:{port}/ws           ║
║  ❤️  Health check: http://localhost:{port}/health          ║
║  🤖 Models API: http://localhost:{port}/models             ║
║                                                           ║
║  Agent Status:                                            ║
║  - RL Framework Available: {str(RL_AGENT_AVAILABLE).ljust(31)} ║
║  - VPP Available: {str(VPP_AVAILABLE).ljust(40)} ║
║  - Groq AI Agent: {str(GROQ_AVAILABLE).ljust(40)} ║
║                                                           ║""")
    
    if model_status_lines:
        print("║  Model Availability:                                      ║")
        for line in model_status_lines:
            print(f"{line.ljust(60)}║")
        print("║                                                           ║")
    
    print(f"""║  Ready to power your 3D visualization! 🎉                 ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=port)
