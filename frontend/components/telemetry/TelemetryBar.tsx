'use client';

import React from 'react';
import { useSimulationStore } from '@/hooks/useSimulationStore';
import { mw, pct, num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { frequencyColor, socColor } from '@/lib/palette';

/**
 * TelemetryBar — a single compact row of live metrics.
 * Replaces the old LiveKpiStrip card grid. Color ONLY when out of range.
 */
export default function TelemetryBar() {
  const {
    connected,
    running,
    totalDemand,
    totalSolar,
    meanSoc,
    gridFrequency,
    gridPrice,
    carbonBalance,
    gridConnected,
  } = useSimulationStore();

  const items: { label: string; value: string; unit: string; color?: string }[] = [
    {
      label: 'DEMAND',
      value: mw(totalDemand),
      unit: 'MW',
    },
    {
      label: 'SOLAR',
      value: mw(totalSolar),
      unit: 'MW',
      color: totalSolar > 0.01 ? '#F5C451' : undefined,
    },
    {
      label: 'SOC',
      value: pct(meanSoc),
      unit: '',
      color: socColor(meanSoc),
    },
    {
      label: 'GRID',
      value: gridConnected ? num(gridFrequency, 2) : 'OFF',
      unit: gridConnected ? 'Hz' : '',
      color: gridConnected ? frequencyColor(gridFrequency) : '#FF5C6C',
    },
    {
      label: 'PRICE',
      value: `₹${num(gridPrice, 1)}`,
      unit: '/kWh',
      color: gridPrice > 100 ? '#F5A623' : undefined,
    },
    {
      label: 'CO₂',
      value: num(carbonBalance, 1),
      unit: 'kg',
      color: carbonBalance < 0 ? '#34D399' : carbonBalance > 5 ? '#F5A623' : undefined,
    },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-line bg-panel-inset overflow-x-auto">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5 mr-3 shrink-0">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            running
              ? 'bg-energy-green live-dot'
              : connected
              ? 'bg-ink-mute'
              : 'bg-fault',
          )}
        />
        <span
          className={cn(
            'text-[10px] font-mono font-bold tracking-wider',
            running ? 'text-energy-green' : 'text-ink-mute',
          )}
        >
          LIVE
        </span>
      </div>

      {/* Metric items */}
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-1.5 px-3 shrink-0"
        >
          <span className="text-[9px] font-semibold tracking-widest text-ink-mute">
            {item.label}
          </span>
          <span
            className="num text-sm font-semibold"
            style={item.color ? { color: item.color } : { color: '#E6EAF0' }}
          >
            {item.value}
          </span>
          {item.unit && (
            <span className="text-[9px] text-ink-mute">{item.unit}</span>
          )}
        </div>
      ))}
    </div>
  );
}
