'use client';

import React from 'react';
import { motion } from 'motion/react';

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'normal' | 'warning' | 'critical' | 'good';
  className?: string;
}

const statusColors = {
  normal: 'text-vpp-cyan-400',
  warning: 'text-vpp-amber-400',
  critical: 'text-vpp-red-400',
  good: 'text-vpp-emerald-400',
};

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const trendColors = {
  up: 'text-vpp-emerald-400',
  down: 'text-vpp-red-400',
  stable: 'text-slate-400',
};

export default function MetricCard({
  icon,
  label,
  value,
  unit = '',
  trend,
  trendValue,
  status = 'normal',
  className = '',
}: MetricCardProps) {
  return (
    <div className={`glass-card p-3 flex flex-col gap-1 min-w-0 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm opacity-70">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 truncate">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <motion.span
          key={String(value)}
          initial={{ opacity: 0.5, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`value-display text-xl font-semibold ${statusColors[status]}`}
        >
          {typeof value === 'number' ? value.toFixed(1) : value}
        </motion.span>
        {unit && (
          <span className="text-xs text-slate-500 font-mono">{unit}</span>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className={`flex items-center gap-1 text-[10px] ${trendColors[trend]}`}>
          <span>{trendIcons[trend]}</span>
          {trendValue && <span>{trendValue}</span>}
        </div>
      )}
    </div>
  );
}
