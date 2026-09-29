'use client';

import React from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'active' | 'warn' | 'fault';

const toneRing: Record<Tone, string> = {
  default: '',
  active: 'ring-active',
  warn: 'ring-warn',
  fault: 'ring-fault',
};

interface PanelProps {
  children?: React.ReactNode;
  className?: string;
  /** Small caps eyebrow header. */
  title?: string;
  /** Secondary muted text next to the title. */
  subtitle?: string;
  /** Right-aligned slot in the header (badge, toggle, button). */
  action?: React.ReactNode;
  tone?: Tone;
  /** Remove inner padding (for flush content like charts/canvas). */
  flush?: boolean;
  raised?: boolean;
  as?: 'div' | 'section' | 'article';
}

/**
 * Panel — the single surface primitive. Near-solid, hairline border, faint
 * inner top highlight (no heavy blur). Optional titled header row.
 */
export default function Panel({
  children,
  className,
  title,
  subtitle,
  action,
  tone = 'default',
  flush = false,
  raised = false,
  as: Tag = 'div',
}: PanelProps) {
  const hasHeader = Boolean(title || action);
  return (
    <Tag
      className={cn(
        raised ? 'panel-raised' : 'panel',
        'relative flex flex-col overflow-hidden',
        toneRing[tone],
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-line">
          <div className="min-w-0">
            {title && <h3 className="eyebrow truncate">{title}</h3>}
            {subtitle && <p className="mt-1 text-2xs text-ink-mute truncate">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(flush ? '' : 'p-4', 'flex-1 min-h-0')}>{children}</div>
    </Tag>
  );
}
