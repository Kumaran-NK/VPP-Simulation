'use client';

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────
export interface SimulationEvent {
  id: string;
  time: string;
  type: 'info' | 'warning' | 'success' | 'danger' | 'action';
  icon: string;
  message: string;
}

export interface HistoryPoint {
  step: number;
  time: string;
  profit: number;
  carbon: number;
  soh: number;
  reward: number;
  demand: number;
  solar: number;
  soc: number;
  frequency: number;
  price: number;
  carbonIntensity: number;
}

export interface P2PTrade {
  id: string;
  from: string;
  to: string;
  power: number;
  price: number;
  time: string;
  status: 'executed' | 'pending' | 'failed';
}

export interface House {
  id: number;
  asset_id: string;
  zone: 'zone-a' | 'zone-b';
  has_ev: boolean;
  battery_soc: number;
  battery_soh: number;
  solar_kw: number;
  demand_kw: number;
  net_power_kw: number;
  status: 'critical' | 'exporting' | 'importing' | 'charged' | 'normal';
}

export interface LastAction {
  global_charge_rate: number;
  min_reserve_pct: number;
  defer_ev_charging: boolean;
  accept_dr_bid: boolean;
  p2p_export_rate: number;
}

export interface ParetoScore {
  profit_score: number;
  safety_score: number;
  carbon_score: number;
  degradation_score: number;
  dr_score: number;
  aggregate_score: number;
  cumulative_profit_usd: number;
}

export interface DrBid {
  active: boolean;
  premium_multiplier: number;
  committed_power_kw: number;
  steps_remaining: number;
}

export interface ZoneAggregate {
  zone_id: string;
  mean_soc: number;
  mean_soh: number;
  mean_solar_kw: number;
  mean_demand_kw: number;
  p2p_available_kw: number;
}

export interface SimulationState {
  // Connection
  connected: boolean;
  connecting: boolean;

  // Simulation control
  running: boolean;
  agentType: 'ppo' | 'rule_based';
  scenario: string;
  step: number;
  maxSteps: number;
  speed: number;

  // Raw backend data
  rawState: any;

  // Sun & Weather
  sunIntensity: number;
  sunAngle: number;
  weather: string;

  // Grid
  gridPrice: number;
  gridFrequency: number;
  gridConnected: boolean;
  gridEmergency: boolean;

  // Aggregated metrics
  totalDemand: number;
  totalSolar: number;
  meanSoc: number;
  meanSoh: number;

  // Financial & Carbon
  cumulativeProfit: number;
  carbonBalance: number;
  lastReward: number;

  // Pareto
  paretoScore: ParetoScore | null;
  paretoByAgent: { ppo?: ParetoScore; rule_based?: ParetoScore };

  // Last Action
  lastAction: LastAction | null;

  // DR Bid
  drBid: DrBid | null;

  // P2P
  p2pFlowKw: number;
  p2pTrades: P2PTrade[];

  // Houses & Zones
  houses: House[];
  zoneAggregates: ZoneAggregate[];

  // History
  historyData: HistoryPoint[];

  // Events
  events: SimulationEvent[];

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setAgentType: (type: 'ppo' | 'rule_based') => void;
  setScenario: (scenario: string) => void;
  setSpeed: (speed: number) => void;
  setRunning: (running: boolean) => void;
  updateFromBackend: (data: any) => void;
  addEvent: (event: Omit<SimulationEvent, 'id'>) => void;
  clearHistory: () => void;
  reset: () => void;
}

// ── UI State ──────────────────────────────────────────────
export type AnalyticsChart = 'power' | 'battery' | 'market' | 'carbon' | 'grid' | 'demand';

export interface UIState {
  selectedChart: string;
  showTrading: boolean;
  showAlerts: boolean;
  selectedNode: string | null;
  sidebarCollapsed: boolean;
  loadingComplete: boolean;

  // Revamp additions
  selectedHouseId: number | null;
  hoveredHouseId: number | null;
  focusFeederId: string | null;
  analyticsChart: AnalyticsChart;
  disturbanceModalOpen: boolean;
  lodLevel: number; // 0=far, 1=mid, 2=close

  setSelectedChart: (chart: string) => void;
  setShowTrading: (show: boolean) => void;
  setShowAlerts: (show: boolean) => void;
  setSelectedNode: (node: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLoadingComplete: (complete: boolean) => void;
  setSelectedHouseId: (id: number | null) => void;
  setHoveredHouseId: (id: number | null) => void;
  setFocusFeederId: (id: string | null) => void;
  setAnalyticsChart: (chart: AnalyticsChart) => void;
  setDisturbanceModalOpen: (open: boolean) => void;
  setLodLevel: (level: number) => void;
}

// ── Helper ────────────────────────────────────────────────
let eventCounter = 0;
function genEventId() {
  return `evt_${Date.now()}_${eventCounter++}`;
}

function formatSimTime(step: number): string {
  const totalMinutes = step * 15; // 15-min intervals starting at 06:00
  const hours = Math.floor(totalMinutes / 60) + 6;
  const minutes = totalMinutes % 60;
  return `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ── Simulation Store ──────────────────────────────────────
export const useSimulationStore = create<SimulationState>((set, get) => ({
  // Connection
  connected: false,
  connecting: false,

  // Simulation control
  running: false,
  agentType: 'ppo',
  scenario: 'easy-arbitrage',
  step: 0,
  maxSteps: 47,
  speed: 1,

  // Raw
  rawState: {},

  // Sun & Weather
  sunIntensity: 0,
  sunAngle: 0,
  weather: 'clear_sky',

  // Grid
  gridPrice: 50.0,
  gridFrequency: 50.0,
  gridConnected: true,
  gridEmergency: false,

  // Aggregated
  totalDemand: 0,
  totalSolar: 0,
  meanSoc: 0.5,
  meanSoh: 1.0,

  // Financial
  cumulativeProfit: 0,
  carbonBalance: 0,
  lastReward: 0,

  // Pareto
  paretoScore: null,
  paretoByAgent: {},

  // Last Action
  lastAction: null,

  // DR
  drBid: null,

  // P2P
  p2pFlowKw: 0,
  p2pTrades: [],

  // Houses
  houses: [],
  zoneAggregates: [],

  // History
  historyData: [],

  // Events
  events: [],

  // ── Actions ────────────────────────────────────────────
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setAgentType: (agentType) => set({ agentType }),
  setScenario: (scenario) => set({ scenario }),
  setSpeed: (speed) => set({ speed }),
  setRunning: (running) => set({ running }),

  clearHistory: () => set({ historyData: [], events: [] }),

  reset: () => set({
    running: false,
    step: 0,
    rawState: {},
    sunIntensity: 0,
    sunAngle: 0,
    weather: 'clear_sky',
    gridPrice: 50.0,
    gridFrequency: 50.0,
    gridConnected: true,
    gridEmergency: false,
    totalDemand: 0,
    totalSolar: 0,
    meanSoc: 0.5,
    meanSoh: 1.0,
    cumulativeProfit: 0,
    carbonBalance: 0,
    lastReward: 0,
    paretoScore: null,
    paretoByAgent: {},
    lastAction: null,
    drBid: null,
    p2pFlowKw: 0,
    p2pTrades: [],
    houses: [],
    zoneAggregates: [],
    historyData: [],
    events: [],
  }),

  addEvent: (event) => set((state) => ({
    events: [
      { ...event, id: genEventId() },
      ...state.events.slice(0, 99), // Keep last 100
    ],
  })),

  updateFromBackend: (data) => {
    const state = get();
    const step = data.step ?? state.step;
    const time = formatSimTime(step);

    // Compute aggregated metrics from houses
    let totalDemand = 0;
    let totalSolar = 0;
    let totalSoc = 0;
    let totalSoh = 0;
    const houses: House[] = data.houses ?? [];

    for (const h of houses) {
      totalDemand += h.demand_kw || 0;
      totalSolar += h.solar_kw || 0;
      totalSoc += h.battery_soc || 0;
      totalSoh += h.battery_soh || 1;
    }
    const count = houses.length || 1;

    const metrics = data.metrics ?? {};
    const grid = data.grid ?? {};
    const sun = data.sun ?? {};

    // Generate P2P trades from flow data
    const newTrades: P2PTrade[] = [];
    if ((data.p2p_flow_kw ?? 0) > 0.1) {
      newTrades.push({
        id: `trade_${step}_${Date.now()}`,
        from: 'Zone B (Solar)',
        to: 'Zone A (Load)',
        power: data.p2p_flow_kw,
        price: grid.price ?? 50,
        time,
        status: 'executed',
      });
    }

    // Build history point
    const historyPoint: HistoryPoint = {
      step,
      time,
      profit: metrics.cumulative_profit ?? 0,
      carbon: metrics.carbon_balance ?? 0,
      soh: metrics.mean_soh ?? totalSoh / count,
      reward: metrics.last_reward ?? 0,
      demand: totalDemand / 1000, // kW → MW
      solar: totalSolar / 1000,
      soc: totalSoc / count,
      frequency: grid.frequency ?? 50.0,
      price: grid.price ?? 50.0,
      carbonIntensity: 0,
    };

    // Store pareto by agent type for PPO vs RULE comparison
    const paretoScore: ParetoScore | null = data.pareto_score ?? null;
    const newParetoByAgent = { ...state.paretoByAgent };
    if (paretoScore) {
      newParetoByAgent[state.agentType] = paretoScore;
    }

    set({
      rawState: data,
      running: data.running ?? state.running,
      step,
      sunIntensity: sun.intensity ?? 0,
      sunAngle: sun.angle ?? 0,
      weather: data.weather ?? 'clear_sky',
      gridPrice: grid.price ?? 50.0,
      gridFrequency: grid.frequency ?? 50.0,
      gridConnected: grid.connected !== false,
      gridEmergency: grid.emergency ?? false,
      totalDemand: totalDemand / 1000, // MW
      totalSolar: totalSolar / 1000,   // MW
      meanSoc: totalSoc / count,
      meanSoh: metrics.mean_soh ?? totalSoh / count,
      cumulativeProfit: metrics.cumulative_profit ?? 0,
      carbonBalance: metrics.carbon_balance ?? 0,
      lastReward: metrics.last_reward ?? 0,
      paretoScore,
      paretoByAgent: newParetoByAgent,
      lastAction: data.last_action ?? null,
      drBid: data.dr_bid ?? null,
      p2pFlowKw: data.p2p_flow_kw ?? 0,
      houses,
      zoneAggregates: data.zone_aggregates ?? [],
      historyData: [...state.historyData.slice(-99), historyPoint],
      p2pTrades: [...newTrades, ...state.p2pTrades.slice(0, 49)],
    });
  },
}));

// ── UI Store ──────────────────────────────────────────────
export const useUIStore = create<UIState>((set) => ({
  selectedChart: 'power',
  showTrading: true,
  showAlerts: true,
  selectedNode: null,
  sidebarCollapsed: false,
  loadingComplete: false,

  // Revamp additions
  selectedHouseId: null,
  hoveredHouseId: null,
  focusFeederId: null,
  analyticsChart: 'power',
  disturbanceModalOpen: false,
  lodLevel: 0,

  setSelectedChart: (chart) => set({ selectedChart: chart }),
  setShowTrading: (show) => set({ showTrading: show }),
  setShowAlerts: (show) => set({ showAlerts: show }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setLoadingComplete: (complete) => set({ loadingComplete: complete }),
  setSelectedHouseId: (id) => set({ selectedHouseId: id }),
  setHoveredHouseId: (id) => set({ hoveredHouseId: id }),
  setFocusFeederId: (id) => set({ focusFeederId: id }),
  setAnalyticsChart: (chart) => set({ analyticsChart: chart }),
  setDisturbanceModalOpen: (open) => set({ disturbanceModalOpen: open }),
  setLodLevel: (level) => set({ lodLevel: level }),
}));
