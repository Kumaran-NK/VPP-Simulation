#!/usr/bin/env python3
"""
VPP Orchestrator — Single-Command All-in-One Launcher

Launches and manages all 3 services concurrently:
1. VPP OpenEnv Server (Port 7860) via uvicorn server.app:app
2. 3D Simulation WebSocket Server (Port 8001) via python simulation_server.py
3. Next.js 3D Command Center Frontend (Port 3000) via npm run dev

Press Ctrl+C to terminate all services cleanly.
"""

import os
import sys
import time
import subprocess
import signal
import re

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

processes = []

def log(prefix: str, color_code: str, message: str):
    print(f"\033[{color_code}m[{prefix}]\033[0m {message}")

def kill_process_on_port(port: int):
    """Frees up a port on Windows if currently in use."""
    if os.name == 'nt':
        try:
            output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True, text=True)
            for line in output.strip().split('\n'):
                if "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid != '0':
                        subprocess.call(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        log("PORT-CLEANER", "33", f"Freed port {port} (killed PID {pid})")
        except Exception:
            pass

def cleanup_processes(signum=None, frame=None):
    print("\n🛑 Shutting down all VPP services...")
    for name, p in processes:
        if p.poll() is None:
            log(name, "31", "Terminating process...")
            try:
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                p.kill()
    print("✅ All services stopped safely.")
    sys.exit(0)

def main():
    print("""
╔═══════════════════════════════════════════════════════════╗
║         ⚡ VPP 3D COMMAND CENTER — ALL-IN-ONE             ║
║                                                           ║
║  1. VPP Env Server    → http://localhost:7860              ║
║  2. WebSocket Gateway → ws://localhost:8001/ws            ║
║  3. Next.js Frontend  → http://localhost:3000             ║
║                                                           ║
║  Press Ctrl+C to stop all services.                       ║
╚═══════════════════════════════════════════════════════════╝
""")

    # Free up ports from any stale background processes
    for port in [7860, 8001, 3000]:
        kill_process_on_port(port)

    # Catch Ctrl+C
    signal.signal(signal.SIGINT, cleanup_processes)
    signal.signal(signal.SIGTERM, cleanup_processes)

    # 1. Start VPP OpenEnv Server (server.app:app)
    log("VPP-ENV", "36", "Starting VPP OpenEnv server on http://localhost:7860...")
    env_p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "7860"],
        cwd=ROOT_DIR
    )
    processes.append(("VPP-ENV", env_p))

    time.sleep(2.5)

    # 2. Start Simulation WebSocket Server
    log("SIM-SERVER", "33", "Starting WebSocket Gateway on ws://localhost:8001/ws...")
    sim_p = subprocess.Popen(
        [sys.executable, os.path.join(BACKEND_DIR, "simulation_server.py")],
        cwd=BACKEND_DIR
    )
    processes.append(("SIM-SERVER", sim_p))

    time.sleep(2)

    # 3. Start Next.js Frontend
    log("FRONTEND", "32", "Starting Next.js Frontend on http://localhost:3000...")
    if os.name == 'nt':
        npm_cmd = ["cmd", "/c", "npm", "run", "dev"]
    else:
        npm_cmd = ["npm", "run", "dev"]

    frontend_p = subprocess.Popen(npm_cmd, cwd=FRONTEND_DIR)
    processes.append(("FRONTEND", frontend_p))

    print("\n🚀 All 3 services are active! Open: http://localhost:3000\n")

    # Monitor loop
    try:
        while True:
            time.sleep(1)
            for name, p in processes:
                if p.poll() is not None:
                    log(name, "31", f"Process exited with code {p.returncode}")
                    cleanup_processes()
    except KeyboardInterrupt:
        cleanup_processes()

if __name__ == "__main__":
    main()
