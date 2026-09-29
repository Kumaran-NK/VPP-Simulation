# ⚡ VPP 3D Orchestrator

> **Real-time 3D Virtual Power Plant Simulation**  
> Transform your RL environment into a stunning visual experience with 100 houses, animated sun, weather system, and live battery orchestration.

![Architecture](https://img.shields.io/badge/Architecture-React%20+%20Three.js%20+%20FastAPI-blue)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🌟 Features

### 3D Visualization
- **100 Interactive Houses** with real-time battery states
- **Animated Sun** following realistic day/night arc (06:00 → 18:00)
- **Dynamic Weather System** (clear sky, clouds, storms)
- **Power Grid Lines** with animated energy flow
- **Zone Separation** (Zone A: standard, Zone B: EV chargers)
- **P2P Energy Trading** visualization between zones
- **Emergency Indicators** (grid offline, frequency drops)

### Real-Time Metrics
- **Pareto Score Dashboard** (profit, safety, carbon, battery health, DR)
- **Live Charts** tracking profit, carbon credits, battery SoH
- **Last Action Display** showing RL agent decisions
- **Demand Response** bid notifications
- **Grid Status** monitoring (price, frequency, connection)

### RL Integration
- **WebSocket Transport** for real-time state updates
- **LLM or Rule-Based Agent** controlling the fleet
- **5 Task Scenarios** from easy to expert difficulty
- **Multi-Objective Optimization** visual feedback

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Port 3000)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   Next.js + React + Three.js + Tailwind                │ │
│  │   - 3D Scene (houses, sun, grid, weather)              │ │
│  │   - Dashboard (metrics, charts, controls)              │ │
│  │   - WebSocket Client (real-time updates)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ WebSocket (Port 8001)
┌─────────────────────────────────────────────────────────────┐
│               Simulation Server (Port 8001)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   FastAPI + WebSocket                                   │ │
│  │   - Broadcasts simulation state every 500ms             │ │
│  │   - Manages episode lifecycle                           │ │
│  │   - RL agent controller (LLM or rule-based)             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│               VPP OpenEnv Server (Port 7860)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   Your Original VPP Environment                         │ │
│  │   - 100 home batteries                                  │ │
│  │   - Solar/Demand/Price curves                           │ │
│  │   - Pareto scoring (5 objectives)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose **OR**
- Python 3.10+ and Node.js 20+

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and navigate
cd vpp-3d-sim

# 2. Set environment variables (optional for LLM agent)
export HF_TOKEN=your_huggingface_token_here
export MODEL_NAME=Qwen/Qwen2.5-72B-Instruct

# 3. Start all services
docker-compose up --build

# 4. Open browser
# Frontend: http://localhost:3000
# VPP Server: http://localhost:7860
# Simulation WS: ws://localhost:8001
```

### Option 2: Manual Setup

#### Start VPP Server
```bash
# Terminal 1: VPP OpenEnv Server
cd /path/to/your/vpp-env
uvicorn server.app:app --host 0.0.0.0 --port 7860
```

#### Start Simulation Server
```bash
# Terminal 2: 3D Simulation WebSocket Server
cd vpp-3d-sim/backend
pip install -r requirements.txt
python simulation_server.py
```

#### Start Frontend
```bash
# Terminal 3: Next.js Frontend
cd vpp-3d-sim/frontend
npm install
npm run dev
```

#### Open Browser
Navigate to `http://localhost:3000`

---

## 🎮 Usage

### Starting a Simulation

1. **Select Task** from dropdown:
   - Easy: Arbitrage ⭐☆☆☆☆
   - Medium: Forecast Error ⭐⭐☆☆☆
   - Hard: Frequency Response ⭐⭐⭐☆☆
   - Expert: Demand Response ⭐⭐⭐⭐☆
   - Islanding Emergency ⭐⭐⭐☆☆

2. **Click "▶ Start"** button

3. **Watch the simulation**:
   - Sun rises and sets across 12 hours (48 steps)
   - Houses change colors based on battery/power state
   - Grid lines animate showing power flow
   - Metrics update in real-time

4. **Monitor Dashboard**:
   - Pareto score breakdown
   - Profit/Carbon/Battery health charts
   - Last RL agent action
   - DR bid notifications

### House Color Legend
- 🟢 **Green** → Exporting power (selling to grid)
- 🟡 **Yellow** → Importing power (buying from grid)
- 🔵 **Blue** → Fully charged (>80% SoC)
- 🔴 **Red** → Critical battery (<15% SoC)
- ⚪ **Gray** → Neutral state

### Camera Controls
- **Orbit**: Left mouse drag
- **Zoom**: Mouse wheel
- **Pan**: Right mouse drag

---

## 📊 Visual Features

### Sun System
- **Position**: 0° (sunrise, east) → 90° (noon, south) → 180° (sunset, west)
- **Intensity**: Scaled by mean solar generation (0-100%)
- **Realistic Lighting**: Directional shadows and ambient light

### Weather System
- **Clear Sky**: No clouds, full solar generation
- **Partly Cloudy**: Scattered clouds, reduced generation
- **Storm**: Dense clouds (medium task), severe solar drop
- **Cloudy**: Expert task adversarial event (steps 24-26)

### Power Grid
- **Substation**: Central grid connection point
  - Green glow = normal operation
  - Red pulse = frequency emergency or offline
- **Power Lines**: Animated flow between houses and grid
  - Green = exporting power
  - Red = importing power
  - Thickness based on power magnitude

### P2P Trading
- **Zone B → Zone A**: Yellow animated line
- **Flow indicator**: Shows surplus solar routing to deficit zone

---

## 🔧 Configuration

### Environment Variables

#### Backend (`simulation_server.py`)
```bash
VPP_SERVER_URL=http://localhost:7860  # VPP OpenEnv server URL
SIMULATION_PORT=8001                   # WebSocket server port
HF_TOKEN=hf_xxx                        # Hugging Face API token (optional)
API_BASE_URL=https://router.huggingface.co/v1
MODEL_NAME=Qwen/Qwen2.5-72B-Instruct
```

#### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8001  # WebSocket server URL
```

### Customization

#### Update Broadcast Rate
Edit `simulation_server.py`:
```python
# Line ~XXX: Change sleep duration (default 500ms)
await asyncio.sleep(0.5)  # Change to 0.1 for 100ms updates
```

#### Modify House Layout
Edit `ThreeScene.tsx`:
```typescript
// Line ~XXX: Change grid size
const gridSize = 10; // 10x10 = 100 houses
const spacing = 3;    // Distance between houses
```

#### Adjust Camera Angle
Edit `ThreeScene.tsx`:
```typescript
<Canvas camera={{ position: [0, 30, 30], fov: 60 }}>
// Change [x, y, z] for different initial view
```

---

## 🏆 Use Cases

### 1. Research & Development
- **Visualize RL Training**: See how your agent learns over time
- **Debug Policy Behavior**: Spot unexpected actions visually
- **Compare Algorithms**: Side-by-side visual comparison

### 2. Demonstrations & Presentations
- **Investor Pitches**: Stunning visual > terminal logs
- **Conference Talks**: Real-time simulation during presentations
- **Educational Material**: Teach RL concepts with interactive demo

### 3. Product Development
- **Real VPP Deployment**: Pre-visualize before hardware rollout
- **Stakeholder Alignment**: Show grid operators how system behaves
- **Regulatory Approval**: Demonstrate safety constraints visually

### 4. Competitions & Hackathons
- **Live Leaderboard**: Show top agents' behaviors in 3D
- **Public Engagement**: Spectators can watch RL agents compete
- **Team Collaboration**: Distributed teams visualize same simulation

---

## 📈 Performance Optimization

### Backend
- **Broadcast Throttling**: Default 500ms prevents client overload
- **State Delta Updates**: Only send changed house states (future)
- **Compression**: Enable WebSocket compression for large payloads

### Frontend
- **Level of Detail (LOD)**: Reduce polygon count for distant houses
- **Instanced Rendering**: Render 100 houses efficiently
- **Chart Windowing**: Keep only last 50 data points in memory

---

## 🐛 Troubleshooting

### WebSocket Connection Failed
```bash
# Check if simulation server is running
curl http://localhost:8001/health

# Check CORS settings in simulation_server.py
# Ensure frontend URL is allowed
```

### 3D Scene Not Loading
```bash
# Check browser console for errors
# Ensure Three.js dependencies installed
cd frontend && npm install three @react-three/fiber @react-three/drei
```

### Houses Not Updating
```bash
# Verify VPP server is reachable
curl http://localhost:7860/health

# Check WebSocket messages in browser DevTools → Network → WS
# Should see state_update messages every 500ms
```

### High CPU Usage
```bash
# Reduce broadcast rate in simulation_server.py
await asyncio.sleep(1.0)  # Increase from 0.5 to 1.0

# Simplify 3D scene (reduce house count for testing)
const gridSize = 5; // 5x5 = 25 houses
```

---

## 🛣️ Roadmap

- [ ] **RL Model Training Integration** (Stable-Baselines3)
- [ ] **Multi-Episode Replay** (scrub timeline, playback controls)
- [ ] **Comparative View** (side-by-side agent comparison)
- [ ] **VR Support** (Oculus/Meta Quest integration)
- [ ] **Mobile App** (React Native port)
- [ ] **Cloud Deployment** (Kubernetes helm charts)
- [ ] **Recording/Export** (MP4 video export of episodes)
- [ ] **Multiplayer Mode** (multiple operators controlling zones)

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **OpenEnv**: Environment framework
- **Three.js**: 3D graphics library
- **React Three Fiber**: React renderer for Three.js
- **Next.js**: React framework
- **FastAPI**: Python web framework
- **Socket.IO**: WebSocket library

---

## 📞 Contact

- **Issues**: [GitHub Issues](https://github.com/your-username/vpp-3d-sim/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/vpp-3d-sim/discussions)

---

**Built with ❤️ for the RL and Energy communities**
