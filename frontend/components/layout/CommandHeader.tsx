'use client';

import React from 'react';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';
import { useSimulationSocket } from '@/hooks/useSimulationSocket';
import { SCENARIOS, DIFFICULTY_META, getScenario } from '@/lib/scenarios';
import { simTime } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * CommandHeader — slim top bar merging brand, connection, scenario,
 * agent toggle, clock, start/stop, and disturbance trigger.
 */
export default function CommandHeader() {
  const { connected, connecting, running, agentType, scenario, step, speed } =
    useSimulationStore();
  const { setDisturbanceModalOpen } = useUIStore();
  const { startSimulation, stopSimulation, selectScenario, setAgentType } =
    useSimulationSocket();

  const connStatus = connecting ? 'CONNECTING' : connected ? 'ONLINE' : 'OFFLINE';
  const connColor = connecting
    ? 'text-solar'
    : connected
    ? 'text-energy-green'
    : 'text-fault';

  const currentScenario = getScenario(scenario);
  const diff = currentScenario
    ? DIFFICULTY_META[currentScenario.difficulty]
    : null;

  return (
    <header className="relative z-50 flex items-center gap-3 px-4 py-2 border-b border-line bg-panel">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3 shrink-0">
        <span className="text-lg">⚡</span>
        <div className="leading-none">
          <h1 className="text-xs font-bold tracking-widest text-ink">
            VPP SIMULATOR
          </h1>
          <p className="text-[9px] text-ink-mute tracking-widest2 uppercase mt-0.5">
            Mission Control
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-line shrink-0" />

      {/* Connection status */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            connected ? 'bg-energy-green live-dot' : connecting ? 'bg-solar animate-pulse' : 'bg-fault',
          )}
        />
        <span className={cn('text-2xs font-mono font-semibold', connColor)}>
          {running ? 'LIVE' : connStatus}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-line shrink-0" />

      {/* Scenario dropdown */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="eyebrow hidden sm:inline">SCENARIO</span>
        <select
          value={scenario}
          onChange={(e) => selectScenario(e.target.value)}
          className="surface rounded-md px-2 py-1 text-2xs font-mono text-ink bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-energy-cyan/30"
          disabled={running}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id} className="bg-panel text-ink">
              {s.label}
            </option>
          ))}
        </select>
        {diff && (
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ color: diff.color, background: `${diff.color}15` }}
          >
            {diff.label.toUpperCase()}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-line shrink-0" />

      {/* Agent toggle */}
      <div className="flex items-center gap-1 shrink-0">
        {(['ppo', 'rule_based'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAgentType(t)}
            disabled={running}
            className={cn(
              'px-2 py-1 text-2xs font-mono font-semibold rounded-md transition-all',
              agentType === t
                ? 'bg-agent/15 text-agent border border-agent/30'
                : 'text-ink-mute hover:text-ink hover:bg-white/[0.03]',
            )}
          >
            {t === 'ppo' ? '🧠 PPO' : '🤖 RULE'}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clock */}
      <div className="flex items-center gap-2 shrink-0 mr-2">
        <span className="text-2xs text-ink-mute font-mono">
          STEP {step}/47
        </span>
        <span className="num text-sm font-semibold text-ink">
          {simTime(step)}
        </span>
      </div>

      {/* Start/Stop */}
      <button
        onClick={running ? stopSimulation : startSimulation}
        className={cn(
          'px-3 py-1.5 text-2xs font-mono font-bold rounded-md transition-all shrink-0',
          running
            ? 'bg-fault/15 text-fault border border-fault/30 hover:bg-fault/25'
            : 'bg-energy-green/15 text-energy-green border border-energy-green/30 hover:bg-energy-green/25',
        )}
      >
        {running ? '■ STOP' : '▶ START'}
      </button>

      {/* Disturbance trigger */}
      <button
        onClick={() => setDisturbanceModalOpen(true)}
        className="surface px-3 py-1.5 text-2xs font-mono font-bold text-warn rounded-md hover:border-warn/30 transition-all shrink-0"
      >
        ⚡ Trigger Event
      </button>
    </header>
  );
}
