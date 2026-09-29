'use client';

import React from 'react';

type StatusType = 'live' | 'connected' | 'connecting' | 'disconnected' | 'warning' | 'critical' | 'idle' | 'active' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const config: Record<StatusType, { color: string; text: string; textColor: string }> = {
  live: { color: 'bg-emerald-400', text: 'LIVE', textColor: 'text-emerald-400' },
  connected: { color: 'bg-emerald-400', text: 'Connected', textColor: 'text-emerald-400' },
  active: { color: 'bg-cyan-400', text: 'ACTIVE', textColor: 'text-cyan-400' },
  connecting: { color: 'bg-amber-400', text: 'Connecting', textColor: 'text-amber-400' },
  disconnected: { color: 'bg-rose-500', text: 'Disconnected', textColor: 'text-rose-400' },
  warning: { color: 'bg-amber-400', text: 'Warning', textColor: 'text-amber-400' },
  critical: { color: 'bg-rose-500', text: 'Critical', textColor: 'text-rose-400' },
  idle: { color: 'bg-slate-500', text: 'Idle', textColor: 'text-slate-400' },
  neutral: { color: 'bg-slate-400', text: 'NEUTRAL', textColor: 'text-slate-400' },
};

export default function StatusBadge({
  status,
  label,
  pulse = true,
  size = 'sm',
}: StatusBadgeProps) {
  const cfg = config[status] || config.idle;
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="flex items-center gap-1.5 font-mono">
      <span className="relative flex">
        {pulse && (status === 'live' || status === 'connected' || status === 'active') && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.color} opacity-40 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${cfg.color}`} />
      </span>
      <span className={`${textSize} font-semibold tracking-wider uppercase ${cfg.textColor}`}>
        {label || cfg.text}
      </span>
    </div>
  );
}
