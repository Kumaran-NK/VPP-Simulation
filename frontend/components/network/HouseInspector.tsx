'use client';

/**
 * HouseInspector.tsx — full telemetry panel for selected house.
 * Renders as an HTML overlay anchored to the right side.
 * Reads real backend per-house data from the simulation store.
 */

import React from 'react';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';
import { STATUS_COLOR, STATUS_LABEL, socColor } from '@/lib/palette';

const Field = ({ label, value, unit = '', color }: { label: string; value: string | number; unit?: string; color?: string }) => (
  <div className="flex justify-between items-center py-0.5 border-b border-white/5">
    <span className="text-[10px] text-ink-mute font-mono uppercase tracking-wider">{label}</span>
    <span className="text-[11px] font-mono font-semibold" style={{ color: color || '#E6EAF0' }}>
      {value}{unit && <span className="text-ink-mute text-[9px] ml-0.5">{unit}</span>}
    </span>
  </div>
);

export default function HouseInspector({ houseId }: { houseId: number }) {
  const houses = useSimulationStore((s) => s.houses);
  const { setSelectedHouseId, setFocusFeederId } = useUIStore();

  const house = houses[houseId];

  // Feeder / zone from topology (topology is static, import lazily)
  const { getTopology } = require('@/lib/topology');
  const topo = getTopology();
  const meta = topo.houses[houseId];
  const feederId = topo.houseToFeeder.get(houseId) ?? 'unknown';

  if (!house) {
    return (
      <div className="absolute top-16 right-3 w-52 panel p-3 z-20">
        <div className="text-xs text-ink-mute font-mono">House #{houseId} — waiting for data…</div>
      </div>
    );
  }

  const socPct = (house.battery_soc * 100).toFixed(1);
  const sohPct = (house.battery_soh * 100).toFixed(1);
  const netSign = house.net_power_kw >= 0 ? '+' : '';
  const statusColor = STATUS_COLOR[house.status] ?? '#8A93A3';
  const statusLabel = STATUS_LABEL[house.status] ?? house.status;

  const handleTrace = () => {
    setFocusFeederId(feederId);
  };

  return (
    <div className="absolute top-16 right-3 w-56 z-20 select-none">
      <div className="panel border border-white/10 rounded-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
          <div>
            <span className="text-[11px] font-mono font-bold text-ink">HOUSE #{houseId}</span>
            <span className="text-[9px] font-mono text-ink-mute ml-2">{house.zone?.toUpperCase()}</span>
          </div>
          <button
            onClick={() => setSelectedHouseId(null)}
            className="text-ink-mute hover:text-ink text-xs leading-none"
          >
            ✕
          </button>
        </div>

        {/* Status badge */}
        <div className="px-3 pt-2 pb-1">
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44` }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Fields */}
        <div className="px-3 pb-2 space-y-0.5">
          <Field label="Demand"     value={house.demand_kw.toFixed(2)}  unit="kW" />
          <Field label="Solar"      value={house.solar_kw.toFixed(2)}   unit="kW" color="#F5C451" />
          <Field label="Net Power"  value={`${netSign}${house.net_power_kw.toFixed(2)}`} unit="kW"
            color={house.net_power_kw > 0 ? '#34D399' : '#F5A623'} />
          <Field label="Battery SoC" value={socPct} unit="%" color={socColor(house.battery_soc)} />
          <Field label="Battery SoH" value={sohPct} unit="%" color={parseFloat(sohPct) > 90 ? '#34D399' : '#F5A623'} />
          <Field label="EV"          value={house.has_ev ? 'YES 🔌' : 'No'} color={house.has_ev ? '#22D3EE' : '#5A6373'} />
          <Field label="Feeder"      value={feederId.replace('feeder-', 'F').toUpperCase()} />
          <Field label="Transformer" value={meta?.transformerId?.replace('transformer-', 'T-').toUpperCase() ?? '—'} />
        </div>

        {/* Trace button */}
        <div className="px-3 pb-3">
          <button
            onClick={handleTrace}
            className="w-full text-[10px] font-mono uppercase tracking-wider py-1.5 rounded
              bg-energy-cyan/10 text-energy-cyan border border-energy-cyan/30
              hover:bg-energy-cyan/20 transition-colors"
          >
            ↯ Trace Power Path
          </button>
        </div>
      </div>
    </div>
  );
}
