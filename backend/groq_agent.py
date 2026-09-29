#!/usr/bin/env python3
"""
Groq AI Agent for VPP Simulation.

Uses Groq's ultra-fast LLM inference (Llama 3.3 70B) to analyse
real-time grid state and produce intelligent VPP control actions
with human-readable reasoning.

The agent receives the full observation (market price, solar, demand,
battery SoC/SoH, grid frequency, DR bids, forecasts) and returns:
  1. Optimal 5-dimensional action vector
  2. Natural-language strategy explanation
  3. Risk assessment and confidence level
"""

import json
import os
import time
from typing import Any, Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Groq client (OpenAI-compatible SDK)
# ---------------------------------------------------------------------------
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    try:
        from openai import OpenAI as _OpenAI
        GROQ_AVAILABLE = True          # use openai SDK with groq base_url
    except ImportError:
        GROQ_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_TASK_PROFILES: Dict[str, str] = {
    "easy-arbitrage":
        "Simple day-ahead price arbitrage. Buy low / sell high. "
        "No weather events. Prioritise profit.",
    "carbon-minimal":
        "Minimise carbon footprint. Prefer solar self-consumption. "
        "Avoid grid imports during dirty-generation hours.",
    "peak-shaving":
        "Reduce peak grid demand. Flatten the load curve. "
        "Discharge batteries during demand spikes.",
    "degraded-battery":
        "Battery fleet has degraded SoH (70-85 %). "
        "Avoid deep cycling; keep SoC between 20-80 %.",
    "grid-stress-test":
        "Simulated grid stress: price spikes, frequency excursions. "
        "Maintain stability; avoid large sudden charge swings.",
    "medium-forecast-error":
        "Solar forecasts are unreliable (±30 %). "
        "Hedge bets; maintain comfortable reserves.",
    "hard-frequency-response":
        "Grid frequency deviations require fast response. "
        "Must ramp charge/discharge within 1 step to stabilise frequency.",
    "expert-demand-response":
        "Active demand-response programme. Evaluate DR bids carefully: "
        "accept only when premium justifies battery wear.",
    "islanding-emergency":
        "Grid disconnection event. Must survive on local solar + storage. "
        "Maximise self-sufficiency; protect critical loads.",
}

_SYSTEM_PROMPT = """\
You are the AI controller for a Virtual Power Plant (VPP) managing 100 residential \
homes, each equipped with rooftop solar panels and a home battery.

Your job is to analyse the current grid observation and output the optimal \
5-dimensional control action.

### Action space (all floats):
| Field               | Range       | Meaning |
|---------------------|-------------|---------|
| global_charge_rate   | -1.0 to 1.0 | Negative = discharge (sell), Positive = charge (buy) |
| min_reserve_pct      | 0.0 to 1.0  | Minimum battery SoC reserve before discharge allowed |
| defer_ev_charging    | 0.0 to 1.0  | 0 = charge EVs now, 1 = fully defer to off-peak |
| accept_dr_bid        | 0.0 or 1.0  | 1 = accept the current demand-response bid |
| p2p_export_rate      | 0.0 to 1.0  | Fraction of surplus to export via peer-to-peer |

### Rules:
- Protect battery health: avoid SoC < 0.15 or > 0.95 unless emergency.
- During islanding (grid disconnected): conserve energy, set high reserve.
- During frequency events (< 49.5 Hz or > 50.5 Hz): respond fast.
- Accept DR bids only when premium > 1.3× AND sufficient SoC headroom.
- Maximise the Pareto objective: profit + carbon savings − battery degradation.

### Response format (strict JSON, no markdown fences):
{
  "action": {
    "global_charge_rate": <float>,
    "min_reserve_pct": <float>,
    "defer_ev_charging": <float>,
    "accept_dr_bid": <bool>,
    "p2p_export_rate": <float>
  },
  "reasoning": "<1-2 sentence strategy explanation>",
  "risk_level": "<low|medium|high|critical>",
  "confidence": <0.0 to 1.0>
}
"""


def _build_user_prompt(obs: Dict[str, Any], task_id: str) -> str:
    """Build compact observation summary for the LLM."""
    # Zone aggregates
    zones = obs.get("zone_aggregates", [])
    zone_lines = []
    for z in zones:
        zone_lines.append(
            f"  {z['zone_id']}: SoC={z['mean_soc']:.2f}, SoH={z['mean_soh']:.2f}, "
            f"Solar={z['mean_solar_kw']:.1f}kW, Demand={z['mean_demand_kw']:.1f}kW, "
            f"P2P_avail={z['p2p_available_kw']:.1f}kW"
        )

    # DR bid
    dr = obs.get("dr_bid", {})
    dr_line = (
        f"DR Bid: active={dr.get('active', False)}, "
        f"premium={dr.get('premium_multiplier', 1.0):.2f}×, "
        f"committed={dr.get('committed_power_kw', 0):.1f}kW, "
        f"steps_remaining={dr.get('steps_remaining', 0)}"
    )

    # Forecasts (show first 4 steps if available)
    price_fc = obs.get("short_term_price_forecast", [])[:4]
    solar_fc = obs.get("short_term_solar_forecast", [])[:4]
    fc_line = ""
    if price_fc:
        fc_line += f"Price forecast (next 4): {[round(p, 1) for p in price_fc]}\n"
    if solar_fc:
        fc_line += f"Solar forecast (next 4): {[round(s, 2) for s in solar_fc]}\n"

    # Task profile
    task_desc = _TASK_PROFILES.get(task_id, "General VPP optimisation.")

    prompt = f"""\
## Current Task: {task_id}
{task_desc}

## Grid Observation — Step {obs.get('step_id', '?')}/47
Market price: ${obs.get('market_price_per_mwh', 50.0):.1f}/MWh
Grid frequency: {obs.get('grid_frequency_hz', 50.0):.2f} Hz
Grid connected: {obs.get('grid_connected', True)}
Emergency active: {obs.get('emergency_active', False)}
Carbon balance: {obs.get('carbon_credits_balance', 0.0):.2f}

## Zone Aggregates
{chr(10).join(zone_lines)}

## {dr_line}

{fc_line}
What is the optimal action?"""

    return prompt


class GroqVPPAgent:
    """
    AI agent powered by Groq's Llama 3.3 70B for real-time VPP control.

    Falls back gracefully if the API is unavailable or rate-limited.
    Caches the last successful action for use during transient failures.
    """

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.client = None
        self.enabled = False
        self.last_reasoning: Optional[str] = None
        self.last_risk: str = "low"
        self.last_confidence: float = 0.5
        self._last_action: Optional[Dict[str, Any]] = None
        self._call_count = 0
        self._error_count = 0

        if not self.api_key:
            print("ℹ️  GROQ_API_KEY not set — Groq AI agent disabled.")
            return

        try:
            # Prefer official Groq SDK
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            self.enabled = True
            print(f"✅ Groq AI Agent initialised (model: {self.model})")
        except ImportError:
            try:
                # Fall back to openai SDK with Groq base_url
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url="https://api.groq.com/openai/v1",
                )
                self.enabled = True
                print(f"✅ Groq AI Agent initialised via OpenAI SDK (model: {self.model})")
            except ImportError:
                print("⚠️  Neither groq nor openai package found. AI agent disabled.")

    # ------------------------------------------------------------------
    def get_action(
        self, obs: Dict[str, Any], task_id: str
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        """
        Query Groq LLM for the optimal VPP action.

        Returns:
            (action_dict, reasoning_text)

        On failure returns (None, error_message).
        """
        if not self.enabled or not self.client:
            return (None, "Groq agent not enabled")

        user_prompt = _build_user_prompt(obs, task_id)

        try:
            t0 = time.time()
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.15,      # low temp for deterministic decisions
                max_tokens=400,
                response_format={"type": "json_object"},
            )
            latency_ms = (time.time() - t0) * 1000
            self._call_count += 1

            raw = response.choices[0].message.content
            parsed = json.loads(raw)

            action = parsed.get("action", {})
            reasoning = parsed.get("reasoning", "")
            risk = parsed.get("risk_level", "low")
            confidence = parsed.get("confidence", 0.5)

            # Validate & clamp action values
            action_dict = {
                "global_charge_rate": float(max(-1, min(1, action.get("global_charge_rate", 0)))),
                "min_reserve_pct": float(max(0, min(1, action.get("min_reserve_pct", 0.2)))),
                "defer_ev_charging": float(max(0, min(1, action.get("defer_ev_charging", 0)))),
                "accept_dr_bid": bool(action.get("accept_dr_bid", False)),
                "p2p_export_rate": float(max(0, min(1, action.get("p2p_export_rate", 0)))),
            }

            self.last_reasoning = reasoning
            self.last_risk = risk
            self.last_confidence = confidence
            self._last_action = action_dict

            strategy_text = (
                f"🤖 Groq AI ({latency_ms:.0f}ms) | "
                f"Risk: {risk} | Confidence: {confidence:.0%}\n"
                f"💡 {reasoning}"
            )
            return (action_dict, strategy_text)

        except json.JSONDecodeError as e:
            self._error_count += 1
            return (self._last_action, f"⚠️ Groq returned invalid JSON: {e}")
        except Exception as e:
            self._error_count += 1
            return (self._last_action, f"⚠️ Groq API error: {e}")

    # ------------------------------------------------------------------
    @property
    def stats(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "model": self.model,
            "calls": self._call_count,
            "errors": self._error_count,
            "last_reasoning": self.last_reasoning,
            "last_risk": self.last_risk,
            "last_confidence": self.last_confidence,
        }
