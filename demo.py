#!/usr/bin/env python3
"""
VPP 3D Orchestrator - Automated Demo Script

This script runs through all 5 tasks sequentially and demonstrates
key features of the 3D visualization system.

Usage:
    python demo.py [--speed SPEED]

Options:
    --speed SPEED   Playback speed multiplier (default: 1.0)
                    0.5 = half speed, 2.0 = double speed
"""

import argparse
import asyncio
import json
import sys
import time
from typing import Dict, List

import websocket
from websocket import WebSocketApp


class VppDemo:
    """Automated demo of VPP 3D visualization."""
    
    def __init__(self, ws_url: str = "ws://localhost:8001/ws", speed: float = 1.0):
        self.ws_url = ws_url
        self.speed = speed
        self.ws = None
        self.connected = False
        self.current_state = {}
        self.episode_complete = False
        
    def on_message(self, ws, message):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            
            if msg_type == "connection_established":
                print("✅ Connected to simulation server")
                self.connected = True
                
            elif msg_type == "state_update":
                self.current_state = data.get("data", {})
                self._print_state_update()
                
            elif msg_type == "episode_complete":
                print("\n" + "=" * 80)
                print("🏁 EPISODE COMPLETE")
                print("=" * 80)
                self._print_final_score(data.get("data", {}))
                self.episode_complete = True
                
            elif msg_type == "simulation_started":
                task_id = data.get("data", {}).get("task_id")
                print(f"\n🚀 Simulation started: {task_id}")
                print("-" * 80)
                
            elif msg_type == "error":
                error_msg = data.get("data", {}).get("message")
                print(f"❌ Error: {error_msg}")
                
        except json.JSONDecodeError:
            print(f"⚠️  Invalid JSON: {message}")
    
    def on_error(self, ws, error):
        """Handle WebSocket errors."""
        print(f"❌ WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close."""
        print(f"\n🔌 Connection closed: {close_msg or 'Normal closure'}")
        self.connected = False
    
    def on_open(self, ws):
        """Handle WebSocket open."""
        print("🔌 WebSocket connection opened")
    
    def _print_state_update(self):
        """Print current state in a compact format."""
        step = self.current_state.get("step", 0)
        sun = self.current_state.get("sun", {})
        grid = self.current_state.get("grid", {})
        metrics = self.current_state.get("metrics", {})
        pareto = self.current_state.get("pareto_score", {})
        weather = self.current_state.get("weather", "unknown")
        
        # Calculate time from step
        hours = (step * 15) // 60
        mins = (step * 15) % 60
        time_str = f"{hours:02d}:{mins:02d}"
        
        # Print compact status line
        print(
            f"Step {step:2d}/47 | {time_str} | "
            f"☀{sun.get('intensity', 0)*100:3.0f}% | "
            f"💰${grid.get('price', 0):5.1f} | "
            f"⚡{grid.get('frequency', 50):5.2f}Hz | "
            f"Weather: {weather:15s} | "
            f"Profit: ${metrics.get('cumulative_profit', 0):7.2f} | "
            f"Score: {pareto.get('aggregate_score', 0)*100:5.1f}%"
        )
        
        # Highlight special events
        if grid.get("emergency"):
            print("  ⚠️  EMERGENCY: Grid frequency low or offline!")
        
        dr_bid = self.current_state.get("dr_bid", {})
        if dr_bid.get("active") and dr_bid.get("steps_remaining", 0) == 0:
            print(f"  📢 NEW DR BID: {dr_bid.get('premium_multiplier', 1.0):.1f}× premium")
    
    def _print_final_score(self, data: Dict):
        """Print final Pareto score breakdown."""
        pareto = data.get("pareto_score", {})
        
        if not pareto:
            print("No score data available")
            return
        
        print(f"\nTask: {data.get('task_id', 'unknown')}")
        print(f"Steps Completed: {data.get('steps', 0)}")
        print("\n" + "=" * 80)
        print("PARETO SCORE BREAKDOWN")
        print("=" * 80)
        
        # Component scores
        scores = [
            ("Aggregate", pareto.get("aggregate_score", 0), "🎯"),
            ("Profit", pareto.get("profit_score", 0), "💰"),
            ("Safety", pareto.get("safety_score", 0), "🛡️"),
            ("Carbon", pareto.get("carbon_score", 0), "🌱"),
            ("Battery Health", pareto.get("degradation_score", 0), "🔋"),
            ("Demand Response", pareto.get("dr_score", 0), "📢"),
        ]
        
        for name, score, emoji in scores:
            bar_length = int(score * 50)
            bar = "█" * bar_length + "░" * (50 - bar_length)
            print(f"{emoji} {name:20s} {score*100:5.1f}% [{bar}]")
        
        print("\n" + "-" * 80)
        print("METRICS")
        print("-" * 80)
        print(f"Cumulative Profit:   ${pareto.get('cumulative_profit_usd', 0):,.2f}")
        print(f"Carbon Balance:      {pareto.get('carbon_credits_balance', 0):.2f} credits")
        print(f"Battery Health:      {pareto.get('mean_state_of_health', 1.0)*100:.2f}%")
        print(f"Safety Violations:   {pareto.get('safety_violations', 0)}")
        print(f"Grid Emergencies:    {pareto.get('grid_emergencies_ignored', 0)}")
        print(f"DR Bids Fulfilled:   {pareto.get('dr_bids_fulfilled', 0)}/{pareto.get('dr_bids_fulfilled', 0) + pareto.get('dr_bids_failed', 0)}")
    
    def send_command(self, command: str, **kwargs):
        """Send command to simulation server."""
        message = {"command": command, **kwargs}
        if self.ws:
            self.ws.send(json.dumps(message))
    
    def run_demo(self):
        """Run full demo sequence."""
        print("=" * 80)
        print("VPP 3D ORCHESTRATOR - AUTOMATED DEMO")
        print("=" * 80)
        print(f"\nWebSocket URL: {self.ws_url}")
        print(f"Playback Speed: {self.speed}×")
        print("\nConnecting...")
        
        # Create WebSocket connection
        self.ws = WebSocketApp(
            self.ws_url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # Run in thread
        import threading
        ws_thread = threading.Thread(target=self.ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        
        # Wait for connection
        timeout = 10
        start_time = time.time()
        while not self.connected and time.time() - start_time < timeout:
            time.sleep(0.1)
        
        if not self.connected:
            print("❌ Failed to connect to simulation server")
            print("\nMake sure the simulation server is running:")
            print("  cd backend && python simulation_server.py")
            return
        
        # Demo all tasks
        tasks = [
            ("easy-arbitrage", "Easy: Arbitrage", 
             "High solar, low demand, simple TOU pricing"),
            ("medium-forecast-error", "Medium: Forecast Error",
             "Heatwave + storm drop with forecast mismatch"),
            ("hard-frequency-response", "Hard: Frequency Response",
             "Grid stress with 10× price spike at 12:30"),
            ("expert-demand-response", "Expert: Demand Response",
             "DR auctions + adversarial cloud disruption"),
            ("islanding-emergency", "Islanding Emergency",
             "Grid disconnect 11:00-13:30, critical load priority"),
        ]
        
        for task_id, task_name, description in tasks:
            print("\n" + "=" * 80)
            print(f"DEMO: {task_name}")
            print("=" * 80)
            print(f"Description: {description}")
            print(f"\nStarting in 3 seconds...")
            time.sleep(3 / self.speed)
            
            # Start simulation
            self.episode_complete = False
            self.send_command("start", task_id=task_id)
            
            # Wait for episode to complete
            while not self.episode_complete:
                time.sleep(0.5 / self.speed)
            
            # Pause between tasks
            print(f"\nNext task in 5 seconds...\n")
            time.sleep(5 / self.speed)
        
        print("\n" + "=" * 80)
        print("✅ DEMO COMPLETE - All 5 tasks demonstrated")
        print("=" * 80)
        print("\nKey Features Showcased:")
        print("  ✓ Real-time 3D visualization (100 houses)")
        print("  ✓ Animated sun system (06:00 → 18:00)")
        print("  ✓ Dynamic weather (clear, clouds, storms)")
        print("  ✓ Grid visualization (price, frequency)")
        print("  ✓ Pareto scoring (5 objectives)")
        print("  ✓ Demand response auctions")
        print("  ✓ Grid islanding emergency")
        print("  ✓ P2P energy trading")
        print("  ✓ RL agent decisions")
        print("\nOpen http://localhost:3000 to see the 3D visualization!")
        
        # Close connection
        self.ws.close()


def main():
    parser = argparse.ArgumentParser(
        description="VPP 3D Orchestrator - Automated Demo Script"
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Playback speed multiplier (default: 1.0)"
    )
    parser.add_argument(
        "--ws-url",
        type=str,
        default="ws://localhost:8001/ws",
        help="WebSocket server URL (default: ws://localhost:8001/ws)"
    )
    
    args = parser.parse_args()
    
    demo = VppDemo(ws_url=args.ws_url, speed=args.speed)
    
    try:
        demo.run_demo()
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Demo error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
