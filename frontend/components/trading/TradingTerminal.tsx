'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSimulationStore } from '@/hooks/useSimulationStore';
import { num, kw } from '@/lib/format';
import Panel from '@/components/ui/Panel';

/**
 * TradingTerminal — P2P trading terminal with summary stats and a
 * FROM→TO / MW / PRICE table. Trade rows are derived from real flows
 * (p2p_flow_kw, zone aggregates, battery/grid flows).
 */
export default function TradingTerminal() {
  const { p2pTrades, p2pFlowKw, gridPrice, zoneAggregates, lastAction, totalSolar, running } =
    useSimulationStore();

  // Derive summary metrics from real data
  const activeMW = p2pFlowKw / 1000;
  const volume = activeMW * (gridPrice * 0.85); // approximate ₹ value
  const activeOrders = p2pTrades.filter((t) => t.status === 'executed').length;

  // Build derived trade rows from real state
  const derivedTrades: { from: string; to: string; mw: number; price: number; key: string }[] = [];

  // Zone B → Zone A P2P
  if (p2pFlowKw > 0.5) {
    derivedTrades.push({
      from: 'Zone B (Solar)',
      to: 'Zone A (Load)',
      mw: p2pFlowKw / 1000,
      price: gridPrice * 0.85,
      key: 'p2p-zb-za',
    });
  }

  // Battery → Grid (discharging)
  const chargeRate = lastAction?.global_charge_rate ?? 0;
  if (chargeRate < -0.05) {
    derivedTrades.push({
      from: 'Battery Storage',
      to: 'Grid Import',
      mw: Math.abs(chargeRate) * 0.6,
      price: gridPrice,
      key: 'bat-grid',
    });
  }

  // Solar → Load (excess export)
  if (totalSolar > 0.05 && chargeRate <= 0) {
    derivedTrades.push({
      from: 'Solar Farm',
      to: 'Distribution',
      mw: totalSolar * 0.6,
      price: gridPrice * 0.9,
      key: 'solar-dist',
    });
  }

  return (
    <Panel title="P2P MARKET" action={
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-energy-green live-dot' : 'bg-ink-mute'}`} />
        <span className={`text-[9px] font-mono font-bold ${running ? 'text-energy-green' : 'text-ink-mute'}`}>
          {running ? 'LIVE' : 'IDLE'}
        </span>
      </div>
    }>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-ink-mute uppercase">Active Energy</div>
          <div className="num text-sm font-bold text-ink">
            {num(activeMW, 2)} <span className="text-[9px] text-ink-mute font-normal">MW</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-ink-mute uppercase">Volume</div>
          <div className="num text-sm font-bold text-ink">
            ₹{num(Math.abs(volume), 0)}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-ink-mute uppercase">Orders</div>
          <div className="num text-sm font-bold text-ink">
            {activeOrders}
          </div>
        </div>
      </div>

      {/* Trade table */}
      <div className="border border-line rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 bg-panel-inset px-3 py-1.5 text-[9px] text-ink-mute font-bold uppercase border-b border-line">
          <div className="col-span-4">FROM → TO</div>
          <div className="col-span-4 text-right">MW</div>
          <div className="col-span-4 text-right">PRICE</div>
        </div>

        {/* Rows */}
        <div className="max-h-36 overflow-y-auto divide-y divide-line">
          <AnimatePresence mode="popLayout">
            {derivedTrades.length > 0 ? (
              derivedTrades.map((trade) => (
                <motion.div
                  key={trade.key}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-12 px-3 py-2 text-xs hover:bg-panel-hover transition-colors"
                >
                  <div className="col-span-4 text-ink-dim text-2xs">
                    <span className="text-energy-green">{trade.from}</span>
                    <span className="text-ink-mute mx-1">→</span>
                    <span className="text-energy-cyan">{trade.to}</span>
                  </div>
                  <div className="col-span-4 text-right num font-semibold text-ink">
                    {num(trade.mw, 2)}
                  </div>
                  <div className="col-span-4 text-right num text-ink-dim">
                    ${num(trade.price, 1)}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-2xs text-ink-mute font-mono">
                No active trades
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Panel>
  );
}
