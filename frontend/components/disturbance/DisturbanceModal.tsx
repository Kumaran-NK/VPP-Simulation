'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '@/hooks/useSimulationStore';
import { useSimulationSocket } from '@/hooks/useSimulationSocket';

const DISTURBANCES = [
  { type: 'solar_spike', icon: '☀', label: 'Solar Spike', desc: 'Sudden solar irradiance surge', color: '#F5C451' },
  { type: 'frequency_trip', icon: '〽', label: 'Grid Frequency Dip', desc: 'Frequency drops to 49.5 Hz (physical)', color: '#F5A623' },
  { type: 'price_surge', icon: '₹', label: 'Price Surge', desc: '10× grid price spike', color: '#FF5C6C' },
  { type: 'demand_surge', icon: '📈', label: 'Demand Surge', desc: 'Sudden demand spike', color: '#22D3EE' },
  { type: 'force_islanding', icon: '⚠', label: 'Islanding', desc: 'Grid disconnects (physical)', color: '#FF5C6C' },
  { type: 'battery_degradation', icon: '🔋', label: 'Battery Degradation', desc: 'Accelerated battery wear', color: '#8B7CF6' },
];

/**
 * DisturbanceModal — command palette for triggering disturbance events.
 * Opened via header "⚡ Trigger Event" button.
 */
export default function DisturbanceModal() {
  const { disturbanceModalOpen, setDisturbanceModalOpen } = useUIStore();
  const { injectDisturbance } = useSimulationSocket();

  const handleTrigger = (type: string) => {
    injectDisturbance(type);
    setDisturbanceModalOpen(false);
  };

  return (
    <AnimatePresence>
      {disturbanceModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
            onClick={() => setDisturbanceModalOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[420px] max-w-[90vw]"
          >
            <div className="panel p-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
                <div>
                  <h3 className="eyebrow">TRIGGER DISTURBANCE</h3>
                  <p className="text-2xs text-ink-mute mt-0.5">Select an event to inject into the simulation</p>
                </div>
                <button
                  onClick={() => setDisturbanceModalOpen(false)}
                  className="text-ink-mute hover:text-ink text-sm px-1 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Disturbance list */}
              <div className="divide-y divide-line">
                {DISTURBANCES.map((d) => (
                  <button
                    key={d.type}
                    onClick={() => handleTrigger(d.type)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-panel-hover transition-colors text-left group"
                  >
                    <span className="text-lg w-7 text-center">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink group-hover:text-white transition-colors">
                        {d.label}
                      </div>
                      <div className="text-2xs text-ink-mute">{d.desc}</div>
                    </div>
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: d.color, background: `${d.color}15` }}
                    >
                      INJECT
                    </span>
                  </button>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-2.5 border-t border-line">
                <p className="text-[9px] text-ink-mute">
                  <span className="text-ink-dim font-semibold">Note:</span> Grid Frequency Dip and Islanding physically affect state. Others are signal events.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
