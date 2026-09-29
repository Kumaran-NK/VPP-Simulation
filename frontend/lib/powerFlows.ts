/**
 * powerFlows.ts — pure derivation of directional power flows from real state.
 *
 * SHARED by the 3D scene (EnergyFlows) and PowerFlowPanel so the numbers agree.
 *
 * Honesty note: the backend exposes solar (MW), demand (MW), per-house net power,
 * the agent's battery command (`global_charge_rate`, signed), and the Zone B→A P2P
 * flow (kW) — but NOT battery power in MW. So:
 *   • flow DIRECTION on the battery edge is exact (sign of global_charge_rate),
 *   • flow MAGNITUDE on battery/grid edges is an estimate: charge_rate scaled by a
 *     named nominal reference, then closed into a consistent power balance.
 * Solar, demand and P2P magnitudes are the real values.
 */

import type { House, LastAction } from '@/hooks/useSimulationStore';

/** Nominal fleet battery power used to turn the normalized charge command into MW.
 *  ~100 homes × ~6 kW inverters ≈ 0.6 MW. Display reference only; direction is real. */
export const FLEET_BATTERY_MW = 0.6;

export type FlowKind = 'solar' | 'battery' | 'grid' | 'load' | 'p2p';

export interface Flow {
  from: string;
  to: string;
  /** Signed is resolved into from/to; this is the magnitude in MW. */
  powerMW: number;
  color: string;
  kind: FlowKind;
  /** 0-1 intensity for particle density / opacity. */
  intensity: number;
}

export interface FlowSummary {
  solarMW: number;
  demandMW: number;
  /** + = importing from grid, − = exporting to grid. */
  gridMW: number;
  /** + = charging (sink), − = discharging (source). */
  batteryMW: number;
  /** Zone B → Zone A peer transfer, MW. */
  p2pMW: number;
  charging: boolean;
  discharging: boolean;
  chargeRate: number;
}

import { COLORS } from './palette';

export interface FlowInput {
  totalSolar: number; // MW
  totalDemand: number; // MW
  lastAction: LastAction | null;
  p2pFlowKw: number;
  gridConnected: boolean;
}

/** Node ids used by the topology + flows. */
export const NODE = {
  solar: 'solar',
  controller: 'controller',
  battery: 'battery',
  substation: 'substation',
  grid: 'grid',
} as const;

export function summarize(input: FlowInput): FlowSummary {
  const solarMW = Math.max(0, input.totalSolar || 0);
  const demandMW = Math.max(0, input.totalDemand || 0);
  const chargeRate = input.lastAction?.global_charge_rate ?? 0;
  const batteryMW = chargeRate * FLEET_BATTERY_MW; // + charging, − discharging
  // Power balance: grid makes up the difference. + import, − export.
  const gridMW = input.gridConnected ? demandMW - solarMW + batteryMW : 0;
  const p2pMW = Math.max(0, (input.p2pFlowKw || 0) / 1000);
  return {
    solarMW,
    demandMW,
    gridMW,
    batteryMW,
    p2pMW,
    charging: chargeRate > 0.01,
    discharging: chargeRate < -0.01,
    chargeRate,
  };
}

const norm = (mw: number, ref: number) => Math.min(1, Math.abs(mw) / ref);

/**
 * Derive the infrastructure-level flows (solar/battery/grid/substation).
 * Feeder→house flows are added by the 3D scene from topology.
 */
export function deriveFlows(input: FlowInput): { flows: Flow[]; summary: FlowSummary } {
  const s = summarize(input);
  const flows: Flow[] = [];

  // Solar → Controller (all generation is routed through the VPP controller)
  if (s.solarMW > 0.005) {
    flows.push({
      from: NODE.solar,
      to: NODE.controller,
      powerMW: s.solarMW,
      color: COLORS.solar,
      kind: 'solar',
      intensity: norm(s.solarMW, 1.2),
    });
  }

  // Battery edge — direction flips on the sign of the charge command
  if (Math.abs(s.batteryMW) > 0.005) {
    if (s.charging) {
      flows.push({
        from: NODE.controller,
        to: NODE.battery,
        powerMW: Math.abs(s.batteryMW),
        color: COLORS.energyCyan,
        kind: 'battery',
        intensity: norm(s.batteryMW, FLEET_BATTERY_MW),
      });
    } else {
      flows.push({
        from: NODE.battery,
        to: NODE.controller,
        powerMW: Math.abs(s.batteryMW),
        color: COLORS.energyGreen,
        kind: 'battery',
        intensity: norm(s.batteryMW, FLEET_BATTERY_MW),
      });
    }
  }

  // Controller ↔ Substation (net after solar + battery)
  const controllerNet = s.solarMW - s.batteryMW; // power available to push toward grid/loads
  if (Math.abs(controllerNet) > 0.005) {
    flows.push({
      from: NODE.controller,
      to: NODE.substation,
      powerMW: Math.abs(controllerNet),
      color: COLORS.energyCyan,
      kind: 'load',
      intensity: norm(controllerNet, 1.2),
    });
  }

  // Grid ↔ Substation — direction on import/export
  if (input.gridConnected && Math.abs(s.gridMW) > 0.005) {
    if (s.gridMW > 0) {
      // importing
      flows.push({
        from: NODE.grid,
        to: NODE.substation,
        powerMW: s.gridMW,
        color: COLORS.warn,
        kind: 'grid',
        intensity: norm(s.gridMW, 1.0),
      });
    } else {
      // exporting
      flows.push({
        from: NODE.substation,
        to: NODE.grid,
        powerMW: Math.abs(s.gridMW),
        color: COLORS.energyGreen,
        kind: 'grid',
        intensity: norm(s.gridMW, 1.0),
      });
    }
  }

  return { flows, summary: s };
}

/** Split the substation supply across feeders by each feeder's share of demand. */
export function feederDemandShares(houses: House[], feederHouseIds: number[][]): number[] {
  const demandByFeeder = feederHouseIds.map((ids) => {
    let d = 0;
    for (const id of ids) {
      const h = houses[id];
      if (h) d += h.demand_kw || 0;
    }
    return d;
  });
  const total = demandByFeeder.reduce((a, b) => a + b, 0) || 1;
  return demandByFeeder.map((d) => d / total);
}
