# VPP 3D Orchestrator - Project Structure

```
vpp-3d-sim/
│
├── backend/                          # Python WebSocket server
│   ├── simulation_server.py         # Main WebSocket server (broadcasts state)
│   ├── requirements.txt              # Python dependencies
│   ├── Dockerfile                    # Docker image for backend
│   └── .env.example                  # Environment variables template
│
├── frontend/                         # Next.js React app
│   ├── app/                          # Next.js 13+ app directory
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Main dashboard page
│   │   └── globals.css               # Global styles (Tailwind)
│   │
│   ├── components/                   # React components
│   │   └── ThreeScene.tsx            # Three.js 3D scene component
│   │
│   ├── public/                       # Static assets
│   │   └── ...
│   │
│   ├── package.json                  # Node.js dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── next.config.js                # Next.js configuration
│   ├── tailwind.config.js            # Tailwind CSS configuration
│   ├── postcss.config.js             # PostCSS configuration
│   ├── Dockerfile                    # Docker image for frontend
│   └── .env.local.example            # Environment variables template
│
├── docker-compose.yml                # Multi-container orchestration
├── start-dev.sh                      # Development quick-start script
├── README.md                         # Main documentation
└── ARCHITECTURE.md                   # This file

```

---

## Component Descriptions

### Backend: `simulation_server.py`

**Purpose**: WebSocket server that orchestrates the simulation loop and broadcasts state to frontend clients.

**Key Classes**:
- `SimulationState`: Manages current simulation state
- `ConnectionManager`: Handles WebSocket connections
- `run_simulation_loop()`: Main async function running VPP episodes

**Endpoints**:
- `GET /health`: Health check
- `WebSocket /ws`: Real-time bidirectional communication

**Message Types** (WebSocket):
- `connection_established`: Initial state on connect
- `state_update`: Broadcast every 500ms during episode
- `episode_complete`: Final score when episode ends
- `error`: Error notifications

**Commands** (from frontend):
- `start`: Begin simulation with task_id
- `stop`: Halt current simulation
- `get_state`: Request current state snapshot

---

### Frontend: Three.js Components

#### `ThreeScene.tsx`

**Purpose**: Main 3D canvas with all visual elements.

**Sub-Components**:
- `House({ position, status, batterySOC, ... })`:
  - 3D house mesh with color-coded status
  - Battery indicator (glowing orb)
  - Solar panels (roof)
  - EV charger marker
  - Zone circle underneath

- `Sun({ intensity, angle })`:
  - Animated sun moving 0° → 180° (east → west)
  - Point light with intensity based on solar generation

- `PowerLine({ start, end, intensity, active })`:
  - Animated line between houses and grid
  - Color based on flow direction (green/red)

- `GridSubstation({ position, gridConnected, frequency })`:
  - Central grid connection point
  - Pulsing red during emergencies

- `WeatherSystem({ mode })`:
  - Procedural clouds based on weather mode
  - Animated drift

- `Ground()`:
  - Large plane for ground surface

**Rendering**:
- Uses `@react-three/fiber` (React renderer for Three.js)
- `OrbitControls` for camera interaction
- `Sky` component for realistic sky gradient
- `Environment` for ambient lighting

---

#### `page.tsx` (Dashboard)

**Purpose**: Main application page with controls and metrics.

**Sections**:
1. **Header**:
   - Connection status indicator
   - Task selector dropdown
   - Start/Stop buttons

2. **3D Scene** (left, flex-1):
   - Full Three.js canvas
   - Overlay info (step, time, price, frequency)
   - Legend (house status colors)
   - DR bid notifications

3. **Side Panel** (right, w-96):
   - Metrics cards (profit, carbon, SoH, reward)
   - Pareto score breakdown
   - Last action display
   - Historical charts (Recharts)

**State Management**:
- `useState` for local state
- `useEffect` for WebSocket connection
- `useCallback` for memoized command handlers

**WebSocket Integration**:
- Uses `socket.io-client`
- Listens for `message` events
- Sends `message` with JSON commands

---

## Data Flow

### Simulation Loop

```
1. Frontend: User clicks "Start" button
   ↓
2. Frontend: Sends WebSocket message { command: "start", task_id: "..." }
   ↓
3. Backend: run_simulation_loop() starts
   ↓
4. Backend: Connects to VPP Server (WebSocket via VppEnv)
   ↓
5. Backend: env.reset(task_id=...) → gets initial observation
   ↓
6. Backend: Updates SimulationState from observation
   ↓
7. Backend: Broadcasts { type: "state_update", data: {...} }
   ↓
8. Frontend: Receives state_update via WebSocket
   ↓
9. Frontend: Updates React state (simulationState)
   ↓
10. Frontend: React re-renders (ThreeScene + Dashboard)
    ↓
11. Backend: get_llm_action() or _rule_agent() decides action
    ↓
12. Backend: env.step(action) → gets new observation
    ↓
13. Backend: Updates SimulationState
    ↓
14. Backend: Broadcasts state_update
    ↓
15. Frontend: Receives and renders
    ↓
16. Repeat steps 11-15 until episode ends (48 steps)
    ↓
17. Backend: Broadcasts { type: "episode_complete", data: {...} }
    ↓
18. Frontend: Shows final Pareto score
```

---

## State Schema

### `SimulationState.to_dict()` (Backend → Frontend)

```typescript
{
  running: boolean;           // Is simulation active?
  task_id: string;            // e.g., "easy-arbitrage"
  step: number;               // 0-47
  episode_id: string;         // Unique episode identifier
  timestamp: string;          // ISO 8601 UTC timestamp
  
  sun: {
    intensity: number;        // 0.0-1.0
    angle: number;            // 0-180 degrees
  };
  
  grid: {
    price: number;            // USD/MWh
    frequency: number;        // Hz
    connected: boolean;       // Grid connection status
    emergency: boolean;       // Emergency active?
  };
  
  weather: string;            // "clear_sky" | "partly_cloudy" | "storm" | "cloudy"
  
  houses: Array<{
    id: number;               // 0-99
    asset_id: string;         // "home-000" to "home-099"
    zone: string;             // "zone-a" | "zone-b"
    has_ev: boolean;          // EV charger present?
    battery_soc: number;      // 0.0-1.0
    battery_soh: number;      // 0.8-1.0
    solar_kw: number;         // kW
    demand_kw: number;        // kW
    net_power_kw: number;     // solar - demand
    status: string;           // "exporting" | "importing" | "charged" | "critical" | "normal"
  }>;
  
  zone_aggregates: Array<{
    zone_id: string;          // "zone-a" | "zone-b"
    mean_soc: number;
    mean_soh: number;
    mean_solar_kw: number;
    mean_demand_kw: number;
    p2p_available_kw: number; // Surplus for P2P export
  }>;
  
  p2p_flow_kw: number;        // Zone B → Zone A power flow
  
  dr_bid: {
    active: boolean;
    premium_multiplier: number;
    committed_power_kw: number;
    steps_remaining: number;
  };
  
  metrics: {
    cumulative_profit: number;   // USD
    carbon_balance: number;      // Credits
    mean_soh: number;            // 0.8-1.0
    last_reward: number;         // Step reward
  };
  
  pareto_score: {
    aggregate_score: number;     // 0.0-1.0
    profit_score: number;
    safety_score: number;
    carbon_score: number;
    degradation_score: number;
    dr_score: number;
    // ... detailed metrics
  };
  
  last_action: {
    global_charge_rate: number;   // -1.0 to 1.0
    min_reserve_pct: number;      // 0.0 to 1.0
    defer_ev_charging: number;    // 0.0 to 1.0
    accept_dr_bid: boolean;
    p2p_export_rate: number;      // 0.0 to 1.0
  };
}
```

---

## Deployment Options

### Development (Manual)

1. **Terminal 1**: VPP Server
   ```bash
   cd /path/to/vpp-env
   uvicorn server.app:app --host 0.0.0.0 --port 7860
   ```

2. **Terminal 2**: Simulation Server
   ```bash
   cd vpp-3d-sim/backend
   python simulation_server.py
   ```

3. **Terminal 3**: Frontend
   ```bash
   cd vpp-3d-sim/frontend
   npm run dev
   ```

### Development (Script)

```bash
cd vpp-3d-sim
./start-dev.sh
```

### Production (Docker Compose)

```bash
cd vpp-3d-sim
docker-compose up --build
```

**Services**:
- `vpp-server`: Port 7860
- `simulation-server`: Port 8001
- `frontend`: Port 3000

### Production (Cloud)

**Recommended Stack**:
- **Kubernetes**: For container orchestration
- **Ingress**: NGINX with WebSocket support
- **Load Balancer**: Distribute frontend traffic
- **Redis**: Optional, for scaling WebSocket connections (Socket.IO adapter)
- **PostgreSQL**: Optional, for episode history persistence

**Example Deployment**:
```yaml
# frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: frontend
```

---

## Performance Considerations

### Backend

**Broadcast Rate**:
- Default: 500ms (2 updates/sec)
- Adjustable: 100-1000ms
- Trade-off: Smoothness vs CPU/network

**Concurrent Connections**:
- Each WebSocket connection subscribes to broadcasts
- Use Redis adapter for horizontal scaling (multiple server instances)

**Memory Usage**:
- SimulationState: ~10KB per state snapshot
- History buffer: Negligible (no server-side history)

### Frontend

**Three.js Performance**:
- 100 houses × 3 meshes each = ~300 objects
- Instanced rendering reduces draw calls
- LOD (Level of Detail) can reduce distant house complexity

**React Re-renders**:
- State updates trigger full re-render
- Optimization: React.memo for expensive components
- Future: Use Zustand/Redux for granular updates

**WebSocket Buffering**:
- Browser buffers incoming messages
- High broadcast rates can cause backlog
- Monitor with DevTools → Network → WS

**Chart Performance**:
- Recharts re-renders on data change
- Limit history to 50-100 points
- Use virtualization for longer histories

---

## Extension Points

### Adding New 3D Elements

1. **Create Component** in `ThreeScene.tsx`:
   ```typescript
   function MyElement({ position, ...props }) {
     return (
       <mesh position={position}>
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color="#ff0000" />
       </mesh>
     );
   }
   ```

2. **Add to Scene**:
   ```typescript
   <MyElement position={[x, y, z]} {...props} />
   ```

### Adding New Metrics

1. **Backend**: Update `SimulationState` class:
   ```python
   self.my_metric = 0.0
   ```

2. **Backend**: Update `to_dict()`:
   ```python
   "metrics": {
       ...existing,
       "my_metric": self.my_metric,
   }
   ```

3. **Frontend**: Access in dashboard:
   ```typescript
   const { my_metric } = simulationState.metrics || {};
   ```

### Integrating Your Own RL Model

1. **Replace `get_llm_action()` in `simulation_server.py`**:
   ```python
   def get_trained_model_action(obs: dict, task_id: str) -> Dict[str, Any]:
       # Load your trained model
       model = PPO.load("path/to/model.zip")
       
       # Convert obs to model input format
       obs_array = preprocess(obs)
       
       # Get action
       action, _states = model.predict(obs_array)
       
       # Convert to VppAction format
       return {
           "global_charge_rate": action[0],
           "min_reserve_pct": action[1],
           # ...
       }
   ```

2. **Update `run_simulation_loop()`**:
   ```python
   action_dict = get_trained_model_action(obs_dict, task_id)
   ```

---

## Testing Strategy

### Backend Unit Tests

```python
# tests/test_simulation_server.py
import pytest
from backend.simulation_server import SimulationState

def test_state_update():
    state = SimulationState()
    # Mock observation
    obs = create_mock_observation(step=5)
    state.update_from_observation(obs)
    
    assert state.step == 5
    assert len(state.houses) == 100
```

### Frontend Component Tests

```typescript
// components/__tests__/ThreeScene.test.tsx
import { render } from '@testing-library/react';
import ThreeScene from '../ThreeScene';

test('renders scene with houses', () => {
  const mockState = { houses: [/* ... */], sun: {}, grid: {} };
  render(<ThreeScene simulationState={mockState} />);
  // Assertions...
});
```

### Integration Tests

```bash
# tests/integration/test_full_flow.sh
#!/bin/bash

# Start services
docker-compose up -d

# Wait for health
curl --retry 10 http://localhost:7860/health
curl --retry 10 http://localhost:8001/health
curl --retry 10 http://localhost:3000

# Trigger simulation via WebSocket
node tests/integration/trigger_simulation.js

# Verify state updates received
# ...

# Cleanup
docker-compose down
```

---

## Security Considerations

### Production Checklist

- [ ] **CORS**: Restrict `allow_origins` to your frontend domain
- [ ] **WebSocket Auth**: Add token-based authentication
- [ ] **Rate Limiting**: Limit WebSocket message frequency per client
- [ ] **Input Validation**: Validate all incoming WebSocket commands
- [ ] **HTTPS/WSS**: Use TLS for production deployments
- [ ] **Environment Variables**: Never commit tokens/secrets
- [ ] **CSP**: Set Content-Security-Policy headers
- [ ] **Dependency Scanning**: Regularly update npm/pip packages

### Example: WebSocket Authentication

```python
# simulation_server.py
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Verify token
    if not verify_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    await connection_manager.connect(websocket)
    # ... rest of handler
```

---

## FAQ

### Q: Can I run this without the VPP server?

A: No, the simulation server depends on VPP OpenEnv server for the actual environment logic. However, you could mock the VPP server responses for frontend-only development.

### Q: How do I deploy to Hugging Face Spaces?

A: Hugging Face Spaces supports Docker. You can:
1. Create a new Space with Docker SDK
2. Copy `docker-compose.yml` and all files
3. Add `app_file: docker-compose.yml` to README.md
4. Push to Spaces repo

### Q: Can I use a different RL framework?

A: Yes! Replace the `get_llm_action()` function with your own model inference code. The interface is simple: `obs dict → action dict`.

### Q: How do I add more house details?

A: Modify the `House` component in `ThreeScene.tsx` to add more 3D elements (windows, doors, etc.). Update `SimulationState` to include additional data if needed.

---

**For more questions, open a GitHub issue or discussion.**
