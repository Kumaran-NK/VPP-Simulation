/**
 * scenarios.ts — the 5 REAL task IDs the backend accepts.
 * Mirrors TASK_METADATA in server/task_curves.py. The previous UI sent invalid
 * IDs (carbon-minimal, peak-shaving, …) that the backend silently ignored.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Scenario {
  id: string;
  label: string;
  difficulty: Difficulty;
  profitTargetUsd: number;
  carbonTargetCredits: number;
  weather: string;
  hasIslanding: boolean;
  hasDrAuction: boolean;
  /** One-line summary for the selector. */
  brief: string;
  /** Full description shown on expand — faithful to the backend. */
  detail: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'easy-arbitrage',
    label: 'Energy Arbitrage',
    difficulty: 'easy',
    profitTargetUsd: 500,
    carbonTargetCredits: 5,
    weather: 'clear_sky',
    hasIslanding: false,
    hasDrAuction: false,
    brief: 'Charge by day, discharge into the evening peak.',
    detail:
      'High solar, low demand, simple time-of-use pricing (cheap daytime, expensive evening). Strategy: charge by day, discharge in the evening peak.',
  },
  {
    id: 'medium-forecast-error',
    label: 'Forecast Error',
    difficulty: 'medium',
    profitTargetUsd: 200,
    carbonTargetCredits: 3,
    weather: 'heatwave',
    hasIslanding: false,
    hasDrAuction: false,
    brief: 'Heatwave AC spike + a storm the forecast missed.',
    detail:
      'Heatwave: AC demand spikes 4× from 10:00–14:00, and a sudden storm suppresses real solar around midday while forecasts stay optimistic. Sinusoidal pricing rewards arbitrage; the agent must manage forecast uncertainty.',
  },
  {
    id: 'hard-frequency-response',
    label: 'Frequency Response',
    difficulty: 'hard',
    profitTargetUsd: 1000,
    carbonTargetCredits: 8,
    weather: 'partly_cloudy',
    hasIslanding: false,
    hasDrAuction: false,
    brief: '10× price spike + 49.5 Hz dip at 12:30 — discharge now.',
    detail:
      'Grid stress: a single-step 10× price spike at 12:30 (step 26). Frequency drops to 49.5 Hz — the agent must discharge immediately. Deplete batteries before the spike and revenue is lost. Requires look-ahead and reserve management.',
  },
  {
    id: 'expert-demand-response',
    label: 'Demand Response',
    difficulty: 'expert',
    profitTargetUsd: 800,
    carbonTargetCredits: 6,
    weather: 'cloudy_disruption',
    hasIslanding: false,
    hasDrAuction: true,
    brief: 'DR auctions with escalating penalties + a cloud event.',
    detail:
      'DR auction every 6 steps with 1.5–3.0× premiums. Windows are graded by delivered-vs-committed energy; consecutive misses escalate penalties (2×, 3×, 4×). An adversarial cloud event at 12:00 disrupts solar for 3 steps, and a demand spike at 10:30 coincides with the lowest solar. Choose bids balancing commitment vs reserve risk.',
  },
  {
    id: 'islanding-emergency',
    label: 'Islanding Emergency',
    difficulty: 'hard',
    profitTargetUsd: 400,
    carbonTargetCredits: 4,
    weather: 'partly_cloudy',
    hasIslanding: true,
    hasDrAuction: false,
    brief: 'Grid drops at 11:00 for 10 steps — batteries only.',
    detail:
      'Grid disconnects at 11:00 (step 20) for 10 steps — the neighbourhood runs on batteries alone. Critical load is prioritized; flexible load sheds first when supply is scarce. Grid reconnects at 13:30 (step 30) with an 8× price spike and a one-step soft-sync discharge cap. Any blackout during islanding is heavily penalized.',
  },
];

export const DEFAULT_SCENARIO_ID = 'easy-arbitrage';

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; color: string; rank: number }> = {
  easy: { label: 'Easy', color: '#34D399', rank: 1 },
  medium: { label: 'Medium', color: '#F5C451', rank: 2 },
  hard: { label: 'Hard', color: '#F5A623', rank: 3 },
  expert: { label: 'Expert', color: '#FF5C6C', rank: 4 },
};
