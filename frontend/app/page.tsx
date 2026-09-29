'use client';

import React from 'react';
import Dynamic from 'next/dynamic';
import LoadingScreen from '@/components/layout/LoadingScreen';
import CommandHeader from '@/components/layout/CommandHeader';
import Footer from '@/components/layout/Footer';
import TelemetryBar from '@/components/telemetry/TelemetryBar';
import ControlRail from '@/components/control/ControlRail';
import SystemStatusRail from '@/components/status/SystemStatusRail';
import { PowerFlowPanel, BatteryPanel, MarketPanel, CarbonPanel } from '@/components/panels/PanelStrip';
import ParetoObjectives from '@/components/pareto/ParetoObjectives';
import TradingTerminal from '@/components/trading/TradingTerminal';
import AnalyticsWorkspace from '@/components/analytics/AnalyticsWorkspace';
import DisturbanceModal from '@/components/disturbance/DisturbanceModal';
import { useSimulationSocket } from '@/hooks/useSimulationSocket';

// Dynamic import for 3D canvas (no SSR — needs WebGL)
const PowerNetwork3D = Dynamic(
  () => import('@/components/network/PowerNetwork3D'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-void border border-line rounded-xl">
        <div className="flex flex-col items-center gap-2 font-mono text-xs text-ink-mute">
          <span className="w-6 h-6 rounded-full border-2 border-energy-cyan border-t-transparent animate-spin" />
          <span>Initializing 3D Network...</span>
        </div>
      </div>
    ),
  },
);

export default function VppCommandCenter() {
  // Initialize WebSocket connection
  useSimulationSocket();

  return (
    <div className="min-h-screen bg-void text-ink font-sans flex flex-col selection:bg-energy-cyan/20">
      <LoadingScreen minDisplayTimeMs={1200} />

      {/* ── Command Header ─────────────────────────────── */}
      <CommandHeader />

      {/* ── Telemetry Bar ──────────────────────────────── */}
      <TelemetryBar />

      {/* ── Main Content ───────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-3 p-3 max-w-[1800px] w-full mx-auto">
        {/* ── Hero Grid: Control Rail | 3D Network | Status Rail ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-3" style={{ minHeight: '55vh' }}>
          {/* Left: Control Rail */}
          <aside className="hidden lg:block">
            <ControlRail />
          </aside>

          {/* Center: 3D Power Network (hero) */}
          <div className="panel overflow-hidden" style={{ minHeight: '500px' }}>
            <PowerNetwork3D />
          </div>

          {/* Right: System Status Rail */}
          <aside className="hidden lg:block">
            <SystemStatusRail />
          </aside>
        </div>

        {/* ── Panel Strip: 4 compact panels ────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PowerFlowPanel />
          <BatteryPanel />
          <MarketPanel />
          <CarbonPanel />
        </div>

        {/* ── Lower Grid: Pareto + Trading ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ParetoObjectives />
          <TradingTerminal />
        </div>

        {/* ── Analytics Workspace ──────────────────────── */}
        <AnalyticsWorkspace />

        {/* ── Mobile: Control & Status (shown below on narrow) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
          <ControlRail />
          <SystemStatusRail />
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <Footer />

      {/* ── Disturbance Modal (portal) ─────────────────── */}
      <DisturbanceModal />
    </div>
  );
}
