'use client';

import React from 'react';
import { cn } from '@/lib/cn';

interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Small unit rendered dimmed after the value. */
  unit?: string;
  /** Colour override for the value (semantic accent). */
  color?: string;
  /** Secondary line under the value (delta, context). */
  hint?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

/**
 * Stat — a labelled numeric readout. Number is always mono/tabular.
 * Used across telemetry, panels, and status rails for a consistent rhythm.
 */
export default function Stat({
  label,
  value,
  unit,
  color,
  hint,
  align = 'left',
  size = 'md',
  className,
}: StatProps) {
  const alignCls =
    align === 'right' ? 'items-end text-right' : align === 'center' ? 'items-center text-center' : 'items-start text-left';
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', alignCls, className)}>
      <span className="eyebrow truncate max-w-full">{label}</span>
      <span
        className={cn('num font-semibold leading-none tracking-tight truncate max-w-full', sizeMap[size])}
        style={color ? { color } : undefined}
      >
        {value}
        {unit && <span className="ml-1 text-2xs font-normal text-ink-mute">{unit}</span>}
      </span>
      {hint && <span className="text-2xs text-ink-mute truncate max-w-full">{hint}</span>}
    </div>
  );
}
