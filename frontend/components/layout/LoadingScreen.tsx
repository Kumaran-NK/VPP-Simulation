'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '@/hooks/useSimulationStore';

const INIT_STEPS = [
  { label: 'Simulation Engine', icon: '⚙️', delay: 200 },
  { label: 'WebSocket Protocol', icon: '📡', delay: 400 },
  { label: 'PPO Controller', icon: '🧠', delay: 600 },
  { label: 'Grid Model', icon: '⚡', delay: 800 },
  { label: 'Market Engine', icon: '💹', delay: 1000 },
  { label: 'Energy Network', icon: '🔋', delay: 1200 },
];

interface LoadingScreenProps {
  minDisplayTimeMs?: number;
}

export default function LoadingScreen({ minDisplayTimeMs = 1800 }: LoadingScreenProps) {
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const { loadingComplete, setLoadingComplete } = useUIStore();

  useEffect(() => {
    INIT_STEPS.forEach((step, index) => {
      setTimeout(() => {
        setCompletedSteps(index + 1);
      }, step.delay);
    });

    // Complete loading
    setTimeout(() => {
      setLoadingComplete(true);
    }, minDisplayTimeMs);
  }, [setLoadingComplete]);

  return (
    <AnimatePresence>
      {!loadingComplete && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg, #05070B 0%, #0A0E15 50%, #0E131C 100%)' }}
        >
          <div className="flex flex-col items-center gap-8">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="text-4xl mb-3">⚡</div>
              <h1 className="text-xl font-bold tracking-widest text-white">
                VPP SIMULATOR
              </h1>
              <p className="text-xs text-ink-mute tracking-wider mt-1">
                INITIALIZING ENERGY NETWORK...
              </p>
            </motion.div>

            {/* Steps */}
            <div className="flex flex-col gap-2.5 w-64">
              {INIT_STEPS.map((step, index) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: step.delay / 1000, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm w-5 text-center">
                    {completedSteps > index ? '✓' : step.icon}
                  </span>
                  <span className={`text-xs font-mono ${
                    completedSteps > index ? 'text-energy-green' : 'text-ink-mute'
                  }`}>
                    {step.label}
                  </span>
                  {completedSteps === index + 1 && (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-energy-cyan"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-64 h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #22D3EE, #34D399)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${(completedSteps / INIT_STEPS.length) * 100}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
