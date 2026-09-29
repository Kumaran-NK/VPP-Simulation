'use client';

import React from 'react';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';
import { getScenario, DIFFICULTY_META } from '@/lib/scenarios';
import { num, pct, signed } from '@/lib/format';
import { cn } from '@/lib/cn';
import Panel from '@/components/ui/Panel';

/**
 * ControlRail — left sidebar showing agent identity, scenario summary,
 * RL action readout, and trigger event shortcut.
 */
export default function ControlRail() {
  const { agentType, scenario, lastAction, drBid } = useSimulationStore();
  const { setDisturbanceModalOpen } = useUIStore();

  const sc = getScenario(scenario);
  const diff = sc ? DIFFICULTY_META[sc.difficulty] : null;
  const action = lastAction;

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-1">
      {/* Agent Identity */}
      <Panel title="AGENT" className="shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{agentType === 'ppo' ? '🧠' : '🤖'}</span>
          <div>
            <div className="text-sm font-bold text-agent">
              {agentType === 'ppo' ? 'PPO Agent' : 'Rule-Based'}
            </div>
            <div className="text-2xs text-ink-mute">
              {agentType === 'ppo' ? 'Reinforcement Learning' : 'Heuristic Controller'}
            </div>
          </div>
        </div>
      </Panel>

      {/* Scenario */}
      <Panel title="SCENARIO" className="shrink-0">
        {sc ? (
          <>
            <div className="text-sm font-semibold text-ink mb-1">{sc.label}</div>
            {diff && (
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded inline-block mb-2"
                style={{ color: diff.color, background: `${diff.color}15` }}
              >
                {diff.label.toUpperCase()}
              </span>
            )}
            <p className="text-2xs text-ink-dim leading-relaxed">{sc.brief}</p>
          </>
        ) : (
          <span className="text-2xs text-ink-mute">No scenario selected</span>
        )}
      </Panel>

      {/* RL Action Readout */}
      <Panel title="RL ACTION" className="shrink-0">
        {action ? (
          <div className="space-y-1.5">
            <ActionRow
              label="Battery"
              value={signed(action.global_charge_rate, 2)}
              hint={action.global_charge_rate > 0.01 ? '▲ CHARGE' : action.global_charge_rate < -0.01 ? '▼ DISCHARGE' : 'IDLE'}
              color={action.global_charge_rate > 0.01 ? '#22D3EE' : action.global_charge_rate < -0.01 ? '#34D399' : '#5A6373'}
            />
            <ActionRow
              label="Reserve"
              value={pct(action.min_reserve_pct / 100)}
              color="#8A93A3"
            />
            <ActionRow
              label="EV Defer"
              value={action.defer_ev_charging ? 'YES' : 'NO'}
              color={action.defer_ev_charging ? '#F5A623' : '#5A6373'}
            />
            <ActionRow
              label="DR Bid"
              value={action.accept_dr_bid ? 'ACCEPT' : 'REJECT'}
              color={action.accept_dr_bid ? '#34D399' : '#5A6373'}
            />
            <ActionRow
              label="P2P Export"
              value={num(action.p2p_export_rate, 2)}
              color="#22D3EE"
            />
          </div>
        ) : (
          <span className="text-2xs text-ink-mute">Awaiting agent action...</span>
        )}
      </Panel>

      {/* DR Bid Status */}
      {drBid?.active && (
        <Panel title="DR BID" tone="active" className="shrink-0">
          <div className="space-y-1">
            <ActionRow label="Premium" value={`${num(drBid.premium_multiplier, 1)}×`} color="#F5C451" />
            <ActionRow label="Committed" value={`${num(drBid.committed_power_kw, 0)} kW`} color="#22D3EE" />
            <ActionRow label="Remaining" value={`${drBid.steps_remaining} steps`} color="#8A93A3" />
          </div>
        </Panel>
      )}

      {/* Trigger Event button */}
      <button
        onClick={() => setDisturbanceModalOpen(true)}
        className="surface rounded-lg px-3 py-2.5 text-2xs font-mono font-bold text-warn hover:border-warn/30 transition-all text-center shrink-0"
      >
        ⚡ Trigger Event
      </button>
    </div>
  );
}

function ActionRow({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] text-ink-mute uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="num text-xs font-semibold" style={color ? { color } : undefined}>
          {value}
        </span>
        {hint && (
          <span className="text-[9px] font-mono" style={color ? { color } : undefined}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
