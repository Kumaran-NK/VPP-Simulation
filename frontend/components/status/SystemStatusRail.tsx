'use client';

import React from 'react';
import { useSimulationStore } from '@/hooks/useSimulationStore';
import { num, pct, usd } from '@/lib/format';
import { frequencyColor, socColor } from '@/lib/palette';
import { cn } from '@/lib/cn';
import Panel from '@/components/ui/Panel';

/**
 * SystemStatusRail — right sidebar showing grid status, battery health,
 * carbon balance, and Pareto aggregate score.
 */
export default function SystemStatusRail() {
  const {
    gridFrequency,
    gridConnected,
    gridEmergency,
    gridPrice,
    meanSoc,
    meanSoh,
    carbonBalance,
    cumulativeProfit,
    lastReward,
    paretoScore,
    weather,
  } = useSimulationStore();

  const freqColor = frequencyColor(gridFrequency);
  const socCol = socColor(meanSoc);

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pl-1">
      {/* Grid Status */}
      <Panel
        title="GRID"
        tone={!gridConnected ? 'fault' : gridFrequency < 49.8 ? 'warn' : 'default'}
        className="shrink-0"
      >
        <div className="space-y-2">
          <StatusRow label="Frequency" value={gridConnected ? `${num(gridFrequency, 2)} Hz` : 'OFFLINE'} color={freqColor} />
          <StatusRow label="Status" value={gridConnected ? (gridEmergency ? 'EMERGENCY' : 'CONNECTED') : 'ISLANDED'} color={!gridConnected ? '#FF5C6C' : gridEmergency ? '#F5A623' : '#34D399'} />
          <StatusRow label="Price" value={`$${num(gridPrice, 0)}/MWh`} color={gridPrice > 100 ? '#F5A623' : '#8A93A3'} />
        </div>
      </Panel>

      {/* Battery */}
      <Panel title="BATTERY" className="shrink-0">
        <div className="space-y-2">
          <StatusRow label="Mean SoC" value={pct(meanSoc)} color={socCol} />
          <StatusRow label="Mean SoH" value={pct(meanSoh)} color={meanSoh < 0.9 ? '#F5A623' : '#8A93A3'} />
          {/* SoC bar */}
          <div className="w-full h-1.5 bg-panel-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, meanSoc * 100)}%`, backgroundColor: socCol }}
            />
          </div>
        </div>
      </Panel>

      {/* Carbon */}
      <Panel title="CARBON" className="shrink-0">
        <div className="space-y-2">
          <StatusRow
            label="Balance"
            value={`${num(carbonBalance, 1)} kg CO₂`}
            color={carbonBalance < 0 ? '#34D399' : '#F5A623'}
          />
          <StatusRow
            label={carbonBalance < 0 ? 'Carbon Saved' : 'Carbon Emitted'}
            value={`${num(Math.abs(carbonBalance), 1)} kg`}
            color="#8A93A3"
          />
        </div>
      </Panel>

      {/* Financial */}
      <Panel title="FINANCIAL" className="shrink-0">
        <div className="space-y-2">
          <StatusRow label="Profit" value={usd(cumulativeProfit)} color={cumulativeProfit >= 0 ? '#34D399' : '#FF5C6C'} />
          <StatusRow label="Last Reward" value={num(lastReward, 3)} color="#8A93A3" />
        </div>
      </Panel>

      {/* Pareto Aggregate */}
      {paretoScore && (
        <Panel title="PARETO" className="shrink-0">
          <div className="flex items-center gap-2">
            <span className="num text-2xl font-bold text-energy-cyan">
              {num(paretoScore.aggregate_score, 2)}
            </span>
            <span className="text-2xs text-ink-mute">/ 1.00</span>
          </div>
          <div className="w-full h-1.5 bg-panel-inset rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-energy-cyan transition-all duration-500"
              style={{ width: `${Math.min(100, paretoScore.aggregate_score * 100)}%` }}
            />
          </div>
        </Panel>
      )}

      {/* Weather */}
      <Panel title="WEATHER" className="shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {weather === 'clear_sky' ? '☀️' : weather === 'partly_cloudy' ? '⛅' : weather === 'cloudy' || weather === 'cloudy_disruption' ? '☁️' : weather === 'storm' ? '⛈️' : weather === 'heatwave' ? '🌡️' : '🌤️'}
          </span>
          <span className="text-2xs text-ink-dim capitalize">
            {weather.replace(/_/g, ' ')}
          </span>
        </div>
      </Panel>
    </div>
  );
}

function StatusRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] text-ink-mute uppercase tracking-wider">{label}</span>
      <span className="num text-xs font-semibold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
