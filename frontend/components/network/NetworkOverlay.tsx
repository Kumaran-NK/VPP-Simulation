'use client';

/**
 * NetworkOverlay.tsx — HTML overlays over the 3D canvas.
 * Camera preset buttons, LIVE badge, weather badge, islanding alert, DR badge.
 */

import React from 'react';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';

// Camera target publisher — PowerNetwork3D reads from this
export const cameraTargets = {
  preset: null as null | { position: [number, number, number]; target: [number, number, number] },
};

function CameraButton({
  label,
  position,
  target,
  icon,
}: {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  icon?: string;
}) {
  const onClick = () => {
    cameraTargets.preset = { position, target };
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider
        px-2 py-1 rounded border border-white/10 bg-black/40 text-ink-mute
        hover:border-energy-cyan/40 hover:text-energy-cyan hover:bg-energy-cyan/5 transition-all"
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

export default function NetworkOverlay() {
  const running = useSimulationStore((s) => s.running);
  const connected = useSimulationStore((s) => s.connected);
  const weather = useSimulationStore((s) => s.weather);
  const gridConnected = useSimulationStore((s) => s.gridConnected);
  const gridFrequency = useSimulationStore((s) => s.gridFrequency);
  const drBid = useSimulationStore((s) => s.drBid);
  const step = useSimulationStore((s) => s.step);
  const maxSteps = useSimulationStore((s) => s.maxSteps);

  const WEATHER_ICONS: Record<string, string> = {
    clear_sky: '☀',
    partly_cloudy: '⛅',
    cloudy_disruption: '☁',
    storm: '⛈',
  };

  return (
    <>
      {/* ── Top-left: LIVE badge + progress ── */}
      <div className="absolute top-2 left-3 flex items-center gap-2 z-10">
        <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest
          px-2 py-1 rounded border ${running ? 'border-energy-cyan/30 text-energy-cyan' : 'border-white/10 text-ink-mute'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-energy-cyan animate-pulse' : 'bg-ink-mute'}`} />
          {running ? 'LIVE' : connected ? 'IDLE' : 'OFFLINE'}
        </div>
        {running && (
          <span className="text-[9px] font-mono text-ink-mute">
            STEP {step}/{maxSteps}
          </span>
        )}
      </div>

      {/* ── Top-right: camera controls ── */}
      <div className="absolute top-2 right-3 flex items-center gap-1 z-10">
        <CameraButton label="Top"      icon="⬆"  position={[0, 120, 5]}    target={[0, 0, 0]} />
        <CameraButton label="Overview" icon="🏘"  position={[0, 80, 95]}   target={[0, 0, 0]} />
        <CameraButton label="Grid"     icon="⚡"  position={[20, 35, -50]} target={[0, 5, -60]} />
        <CameraButton label="Reset"    icon="⟳"  position={[0, 80, 95]}   target={[0, 0, 10]} />
      </div>

      {/* ── Bottom-left: legend ── */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3 z-10">
        {[
          { color: '#34d399', label: 'Exporting' },
          { color: '#f5a623', label: 'Importing' },
          { color: '#f5c451', label: 'Charged' },
          { color: '#ff5c6c', label: 'Critical' },
          { color: '#c8b89a', label: 'Normal' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
            <span className="text-[9px] font-mono text-ink-mute">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom-right: weather badge ── */}
      <div className="absolute bottom-2 right-3 flex items-center gap-2 z-10">
        <div className="text-[10px] font-mono text-ink-mute px-2 py-1 rounded border border-white/10 bg-black/40">
          {WEATHER_ICONS[weather] ?? '🌤'} {weather.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>

      {/* ── Islanding alert overlay ── */}
      {!gridConnected && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="text-center px-6 py-3 rounded-xl bg-red-900/80 border border-red-500/60 shadow-2xl">
            <div className="text-lg font-mono font-bold text-red-400">⚠ GRID ISLANDED</div>
            <div className="text-xs font-mono text-red-300 mt-1">Running on solar + battery</div>
          </div>
        </div>
      )}

      {/* ── Frequency disturbance alert ── */}
      {gridConnected && gridFrequency < 49.8 && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="text-center px-4 py-2 rounded-lg bg-amber-900/80 border border-amber-500/60">
            <div className="text-xs font-mono font-bold text-amber-400">
              ⚡ FREQ ALARM — {gridFrequency.toFixed(2)} Hz
            </div>
          </div>
        </div>
      )}

      {/* ── DR Bid badge ── */}
      {drBid?.active && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="text-[9px] font-mono px-3 py-1 rounded border border-energy-cyan/40 bg-energy-cyan/10 text-energy-cyan animate-pulse">
            DR BID ACTIVE — {drBid.steps_remaining} steps remaining
          </div>
        </div>
      )}
    </>
  );
}
