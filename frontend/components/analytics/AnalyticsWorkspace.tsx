'use client';

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useSimulationStore, useUIStore, type AnalyticsChart } from '@/hooks/useSimulationStore';
import Panel from '@/components/ui/Panel';
import { cn } from '@/lib/cn';

const TABS: { id: AnalyticsChart; label: string; color: string }[] = [
  { id: 'power', label: 'POWER', color: '#22D3EE' },
  { id: 'battery', label: 'BATTERY', color: '#34D399' },
  { id: 'market', label: 'MARKET', color: '#F5A623' },
  { id: 'carbon', label: 'CARBON', color: '#FF5C6C' },
  { id: 'grid', label: 'GRID', color: '#8B7CF6' },
  { id: 'demand', label: 'DEMAND', color: '#F5C451' },
];

/**
 * AnalyticsWorkspace — tab selector → ONE expanded large chart.
 * Replaces the old RealtimeCharts which showed all 6 simultaneously.
 */
export default function AnalyticsWorkspace() {
  const historyData = useSimulationStore((s) => s.historyData);
  const { analyticsChart, setAnalyticsChart } = useUIStore();

  const chartData = historyData.slice(-48).map((item) => ({
    time: `${item.time}`,
    solar: Math.round((item.solar || 0) * 1000),
    demand: Math.round((item.demand || 0) * 1000),
    price: +(item.price || 0).toFixed(2),
    freq: +(item.frequency || 50).toFixed(2),
    soc: +((item.soc || 0) * 100).toFixed(1),
    carbon: +(item.carbon || 0).toFixed(1),
    soh: +((item.soh || 1) * 100).toFixed(1),
    reward: +(item.reward || 0).toFixed(3),
    profit: +(item.profit || 0).toFixed(0),
  }));

  const activeTab = TABS.find((t) => t.id === analyticsChart) || TABS[0];

  return (
    <Panel title="ANALYTICS" action={
      <div className="flex gap-1 p-0.5 bg-panel-inset border border-line rounded-lg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAnalyticsChart(tab.id)}
            className={cn(
              'px-2.5 py-1 text-[10px] font-mono font-semibold rounded-md transition-all',
              analyticsChart === tab.id
                ? 'bg-panel text-ink border border-line'
                : 'text-ink-mute hover:text-ink-dim',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    }>
      <div className="h-56 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center font-mono text-xs text-ink-mute border border-dashed border-line rounded-lg">
            Awaiting telemetry data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeTab.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={activeTab.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                stroke="#3B4250"
                tick={{ fontSize: 10, fill: '#5A6373', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                stroke="#3B4250"
                tick={{ fontSize: 10, fill: '#5A6373', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A0E15',
                  borderColor: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                  color: '#E6EAF0',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                }}
              />

              {analyticsChart === 'power' && (
                <>
                  <Area type="monotone" dataKey="solar" name="Solar (kW)" stroke="#F5C451" strokeWidth={1.5} fillOpacity={0.4} fill="url(#chartGrad)" />
                  <Area type="monotone" dataKey="demand" name="Demand (kW)" stroke="#22D3EE" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                </>
              )}
              {analyticsChart === 'battery' && (
                <Area type="monotone" dataKey="soc" name="SoC (%)" stroke="#34D399" strokeWidth={1.5} fillOpacity={1} fill="url(#chartGrad)" />
              )}
              {analyticsChart === 'market' && (
                <>
                  <Area type="monotone" dataKey="price" name="Price ($/MWh)" stroke="#F5A623" strokeWidth={1.5} fillOpacity={1} fill="url(#chartGrad)" />
                </>
              )}
              {analyticsChart === 'carbon' && (
                <Area type="monotone" dataKey="carbon" name="Carbon (kg CO₂)" stroke="#FF5C6C" strokeWidth={1.5} fillOpacity={1} fill="url(#chartGrad)" />
              )}
              {analyticsChart === 'grid' && (
                <Area type="monotone" dataKey="freq" name="Frequency (Hz)" stroke="#8B7CF6" strokeWidth={1.5} fillOpacity={1} fill="url(#chartGrad)" />
              )}
              {analyticsChart === 'demand' && (
                <Area type="monotone" dataKey="demand" name="Demand (kW)" stroke="#F5C451" strokeWidth={1.5} fillOpacity={1} fill="url(#chartGrad)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
