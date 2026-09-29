/**
 * palette.ts — accent colours as plain hex constants.
 * three.js materials need hex numbers/strings (not CSS variables), and JS
 * charts want the same values the CSS tokens use, so this is the single source.
 */

export const COLORS = {
  void: '#05070B',
  panel: '#0A0E15',
  panelRaised: '#0E131C',

  ink: '#E6EAF0',
  inkDim: '#8A93A3',
  inkMute: '#5A6373',

  energyCyan: '#22D3EE',
  energyGreen: '#34D399',
  solar: '#F5C451',
  warn: '#F5A623',
  fault: '#FF5C6C',
  agent: '#8B7CF6',
} as const;

/** three.js hex numbers (0x…) for materials. */
export const HEX = {
  energyCyan: 0x22d3ee,
  energyGreen: 0x34d399,
  solar: 0xf5c451,
  warn: 0xf5a623,
  fault: 0xff5c6c,
  agent: 0x8b7cf6,
  ink: 0xe6eaf0,
  inkMute: 0x5a6373,
  ground: 0x070a11,
  gridLine: 0x0e1622,
  house: 0x1a2130,
} as const;

/** House status → colour. Mirrors backend status logic. */
export const STATUS_COLOR: Record<string, string> = {
  critical: COLORS.fault,
  importing: COLORS.warn,
  exporting: COLORS.energyGreen,
  charged: COLORS.energyCyan,
  normal: COLORS.inkMute,
};

export const STATUS_LABEL: Record<string, string> = {
  critical: 'Critical',
  importing: 'Importing',
  exporting: 'Exporting',
  charged: 'Charged',
  normal: 'Nominal',
};

/** Grid-frequency band → semantic colour (nominal 50 Hz). */
export function frequencyColor(hz: number): string {
  const d = Math.abs(hz - 50);
  if (d >= 0.5) return COLORS.fault;
  if (d >= 0.15) return COLORS.warn;
  return COLORS.energyGreen;
}

/** Status string → CSS colour. */
export function statusToCSS(status: string): string {
  return STATUS_COLOR[status] ?? COLORS.inkMute;
}

/** State-of-charge → colour. */
export function socColor(soc: number): string {
  if (soc < 0.15) return COLORS.fault;
  if (soc < 0.35) return COLORS.warn;
  if (soc > 0.8) return COLORS.energyCyan;
  return COLORS.energyGreen;
}
