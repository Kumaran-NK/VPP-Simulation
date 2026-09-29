'use client';

import React from 'react';
import { useSimulationStore } from '@/hooks/useSimulationStore';
import { num } from '@/lib/format';
import Panel from '@/components/ui/Panel';
import { cn } from '@/lib/cn';

const OBJECTIVES = [
  { key: 'profit_score', label: 'Profit', color: '#34D399', weight: 0.50 },
  { key: 'safety_score', label: 'Safety', color: '#22D3EE', weight: 0.20 },
  { key: 'carbon_score', label: 'Carbon', color: '#F5C451', weight: 0.15 },
  { key: 'degradation_score', label: 'Battery Health', color: '#8B7CF6', weight: 0.10 },
  { key: 'dr_score', label: 'Demand Response', color: '#F5A623', weight: 0.05 },
] as const;

/**
 * ParetoObjectives — horizontal bar chart of the 5 real objective scores
 * plus aggregate, with PPO vs RULE comparison when both have been observed.
 */
export default function ParetoObjectives() {
  const { paretoScore, paretoByAgent, agentType } = useSimulationStore();

  const ppo = paretoByAgent.ppo;
  const rule = paretoByAgent.rule_based;
  const hasComparison = Boolean(ppo && rule);

  return (
    <Panel title="MULTI-OBJECTIVE PERFORMANCE" subtitle="Pareto score decomposition">
      {paretoScore ? (
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-agent" />
              <span className="text-[9px] font-mono text-ink-dim">
                {agentType === 'ppo' ? 'PPO' : 'RULE'} (current)
              </span>
            </div>
            {hasComparison && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ink-mute" />
                <span className="text-[9px] font-mono text-ink-dim">
                  {agentType === 'ppo' ? 'RULE' : 'PPO'} (prior)
                </span>
              </div>
            )}
          </div>

          {/* Objective bars */}
          {OBJECTIVES.map((obj) => {
            const score = (paretoScore as any)[obj.key] ?? 0;
            const compareScore = hasComparison
              ? ((agentType === 'ppo' ? rule : ppo) as any)?.[obj.key] ?? 0
              : null;

            return (
              <div key={obj.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-ink-mute uppercase tracking-wider">
                    {obj.label}
                    <span className="text-ink-faint ml-1">({(obj.weight * 100).toFixed(0)}%)</span>
                  </span>
                  <span className="num text-2xs font-semibold" style={{ color: obj.color }}>
                    {num(score, 2)}
                  </span>
                </div>
                {/* Bar */}
                <div className="relative w-full h-2 bg-panel-inset rounded-full overflow-hidden">
                  {/* Comparison bar (behind) */}
                  {compareScore !== null && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full opacity-25"
                      style={{
                        width: `${Math.min(100, compareScore * 100)}%`,
                        backgroundColor: '#5A6373',
                      }}
                    />
                  )}
                  {/* Current bar */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, score * 100)}%`,
                      backgroundColor: obj.color,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Aggregate score */}
          <div className="border-t border-line pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">PARETO SCORE</span>
              <span className="num text-xl font-bold text-energy-cyan">
                {num(paretoScore.aggregate_score, 2)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-panel-inset rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-energy-cyan transition-all duration-500"
                style={{ width: `${Math.min(100, paretoScore.aggregate_score * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 text-2xs text-ink-mute font-mono">
          Awaiting episode data...
        </div>
      )}
    </Panel>
  );
}
