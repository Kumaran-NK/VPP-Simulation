'use client';

import React, { useMemo } from 'react';
import { useSimulationStore } from '@/hooks/useSimulationStore';
import { mw, num, signed } from '@/lib/format';
import { deriveFlows } from '@/lib/powerFlows';
import Panel from '@/components/ui/Panel';
import Sparkline from '@/components/ui/Sparkline';

/**
 * PanelStrip — four compact panels in a row:
 * PowerFlow | Battery | Market | Carbon
 */
export function PowerFlowPanel() {
  const totalSolar = useSimulationStore((s) => s.totalSolar);
  const totalDemand = useSimulationStore((s) => s.totalDemand);
  const lastAction = useSimulationStore((s) => s.lastAction);
  const p2pFlowKw = useSimulationStore((s) => s.p2pFlowKw);
  const gridConnected = useSimulationStore((s) => s.gridConnected);
  const historyData = useSimulationStore((s) => s.historyData);

  const { summary } = useMemo(
    () => deriveFlows({ totalSolar, totalDemand, lastAction, p2pFlowKw, gridConnected }),
    [totalSolar, totalDemand, lastAction, p2pFlowKw, gridConnected],
  );

  const solarHistory = historyData.slice(-20).map((h) => h.solar);
  const demandHistory = historyData.slice(-20).map((h) => h.demand);

  return (
    <Panel title="POWER FLOW">
      <div className="grid grid-cols-2 gap-3">
        <CompactStat label="Solar" value={mw(summary.solarMW)} unit="MW" color="#F5C451" />
        <CompactStat label="Demand" value={mw(summary.demandMW)} unit="MW" color="#22D3EE" />
        <CompactStat
          label="Battery"
          value={signed(summary.batteryMW, 2)}
          unit="MW"
          color={summary.charging ? '#22D3EE' : summary.discharging ? '#34D399' : '#5A6373'}
        />
        <CompactStat
          label="Grid"
          value={signed(summary.gridMW, 2)}
          unit="MW"
          color={summary.gridMW > 0 ? '#F5A623' : '#34D399'}
        />
      </div>
      <div className="flex gap-2 mt-3">
        <Sparkline data={solarHistory} color="#F5C451" width={80} height={24} />
        <Sparkline data={demandHistory} color="#22D3EE" width={80} height={24} />
      </div>
    </Panel>
  );
}

export function BatteryPanel() {
  const meanSoc = useSimulationStore((s) => s.meanSoc);
  const meanSoh = useSimulationStore((s) => s.meanSoh);
  const lastAction = useSimulationStore((s) => s.lastAction);
  const historyData = useSimulationStore((s) => s.historyData);

  const chargeRate = lastAction?.global_charge_rate ?? 0;
  const socHistory = historyData.slice(-20).map((h) => h.soc * 100);

  return (
    <Panel title="BATTERY">
      <div className="grid grid-cols-2 gap-3">
        <CompactStat label="SoC" value={`${(meanSoc * 100).toFixed(0)}`} unit="%" color={meanSoc > 0.7 ? '#34D399' : meanSoc > 0.3 ? '#F5C451' : '#FF5C6C'} />
        <CompactStat label="SoH" value={`${(meanSoh * 100).toFixed(1)}`} unit="%" color={meanSoh < 0.9 ? '#F5A623' : '#8A93A3'} />
        <CompactStat
          label="Action"
          value={chargeRate > 0.01 ? '▲ CHG' : chargeRate < -0.01 ? '▼ DIS' : 'IDLE'}
          color={chargeRate > 0.01 ? '#22D3EE' : chargeRate < -0.01 ? '#34D399' : '#5A6373'}
        />
        <CompactStat label="Rate" value={num(Math.abs(chargeRate), 2)} color="#8A93A3" />
      </div>
      <div className="mt-3">
        <Sparkline data={socHistory} color="#34D399" width={160} height={24} />
      </div>
    </Panel>
  );
}

export function MarketPanel() {
  const gridPrice = useSimulationStore((s) => s.gridPrice);
  const gridFrequency = useSimulationStore((s) => s.gridFrequency);
  const historyData = useSimulationStore((s) => s.historyData);

  const priceHistory = historyData.slice(-20).map((h) => h.price);
  const freqHistory = historyData.slice(-20).map((h) => h.frequency);

  return (
    <Panel title="MARKET">
      <div className="grid grid-cols-2 gap-3">
        <CompactStat label="Price" value={`$${num(gridPrice, 0)}`} unit="/MWh" color={gridPrice > 100 ? '#F5A623' : '#8A93A3'} />
        <CompactStat label="Frequency" value={num(gridFrequency, 2)} unit="Hz" color={Math.abs(gridFrequency - 50) > 0.15 ? '#F5A623' : '#34D399'} />
      </div>
      <div className="flex gap-2 mt-3">
        <Sparkline data={priceHistory} color="#F5A623" width={80} height={24} />
        <Sparkline data={freqHistory} color="#34D399" width={80} height={24} />
      </div>
    </Panel>
  );
}

export function CarbonPanel() {
  const carbonBalance = useSimulationStore((s) => s.carbonBalance);
  const cumulativeProfit = useSimulationStore((s) => s.cumulativeProfit);
  const historyData = useSimulationStore((s) => s.historyData);

  const carbonHistory = historyData.slice(-20).map((h) => h.carbon);

  return (
    <Panel title="CARBON">
      <div className="grid grid-cols-2 gap-3">
        <CompactStat
          label="Balance"
          value={num(carbonBalance, 1)}
          unit="kg CO₂"
          color={carbonBalance < 0 ? '#34D399' : '#F5A623'}
        />
        <CompactStat
          label="Profit"
          value={`$${num(cumulativeProfit, 0)}`}
          color={cumulativeProfit >= 0 ? '#34D399' : '#FF5C6C'}
        />
      </div>
      <div className="mt-3">
        <Sparkline data={carbonHistory} color={carbonBalance < 0 ? '#34D399' : '#F5A623'} width={160} height={24} />
      </div>
    </Panel>
  );
}

function CompactStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-ink-mute uppercase tracking-wider">{label}</span>
      <span className="num text-sm font-semibold leading-none" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="text-[9px] text-ink-mute ml-0.5 font-normal">{unit}</span>}
      </span>
    </div>
  );
}
