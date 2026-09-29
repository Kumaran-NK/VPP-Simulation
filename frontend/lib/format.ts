/**
 * format.ts — number / unit formatting helpers.
 * All display numbers go through here so units and precision stay consistent.
 */

/** Fixed-precision, but renders 0 cleanly and guards NaN/undefined. */
export function num(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

/** Power in MW (input already MW). */
export function mw(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}`;
}

/** Power in kW (input kW). */
export function kw(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}`;
}

/** Signed value with explicit +/- and optional unit. */
export function signed(v: number | null | undefined, digits = 2, unit = ''): string {
  if (v == null || Number.isNaN(v)) return '—';
  const s = v > 0 ? '+' : v < 0 ? '' : '';
  return `${s}${v.toFixed(digits)}${unit}`;
}

/** Percent from a 0-1 ratio. */
export function pct(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Percent from an already-0-100 value. */
export function pct100(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

/** Currency, compacting thousands to k. */
export function usd(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(digits)}`;
}

/** $/MWh grid price. */
export function price(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `$${v.toFixed(0)}`;
}

/**
 * Simulation clock. Backend runs 48 steps of 15 min starting 06:00.
 * step 0 → 06:00, step 4 → 07:00, wraps past midnight.
 */
export function simTime(step: number): string {
  const totalMinutes = step * 15;
  const hours = (Math.floor(totalMinutes / 60) + 6) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Compact int with thousands separators. */
export function int(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return Math.round(v).toLocaleString('en-US');
}
