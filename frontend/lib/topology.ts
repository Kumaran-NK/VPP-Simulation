/**
 * topology.ts — VPP Neighbourhood Topology Generator
 *
 * Generates a GEOGRAPHICALLY PLAUSIBLE residential neighbourhood:
 *   - 3 housing blocks (A, B, C) separated by roads
 *   - Houses face streets, on real lot positions
 *   - Utility poles along street edges
 *   - Trees on lot corners and park areas
 *   - Street lights at each pole
 *   - Wire segments follow roads (not straight-through-house lines)
 *   - Infrastructure at edge of neighbourhood (substation, solar farm, BESS)
 *
 * WORLD SCALE: 1 unit ≈ 8 metres. Neighbourhood ≈ 160 × 160 wu.
 * ALL POSITIONS are [X, Y, Z] in Three.js (Y = up, Z = depth).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InfraType =
  | 'solar'
  | 'battery'
  | 'substation'
  | 'grid'
  | 'transformer';

export interface InfraNode {
  id: string;
  label: string;
  position: [number, number, number];
  type: InfraType;
}

export interface HouseMeta {
  id: number;
  variant: 0 | 1 | 2 | 3 | 4 | 5;   // 6 visual styles
  position: [number, number, number];
  rotation: number;                     // Y-axis radians, faces nearest road
  scale: number;                        // slight variation
  hasSolarSeed: boolean;               // structural solar presence (before live data)
  feederId: 'feeder-a' | 'feeder-b' | 'feeder-c';
  transformerId: string;
  poleIndex: number;                   // nearest pole index
  zone: 'zone-a' | 'zone-b';
  drivewaySide: 'north' | 'south' | 'east' | 'west';
}

export interface Feeder {
  id: 'feeder-a' | 'feeder-b' | 'feeder-c';
  label: string;
  transformerId: string;
  transformerPos: [number, number, number];
  houseIds: number[];
  zone: 'zone-a' | 'zone-b' | 'mixed';
}

export interface Edge {
  from: string;
  to: string;
  type: 'hv' | 'distribution' | 'feeder';
  waypoints: [number, number, number][];  // road-following path
}

export interface Road {
  id: string;
  startX: number;
  endX: number;
  startZ: number;
  endZ: number;
  width: number;
  direction: 'horizontal' | 'vertical';
}

export interface Topology {
  infra: InfraNode[];
  feeders: Feeder[];
  houses: HouseMeta[];
  /** Flat position lookup for compatibility: house id → [x, y, z] */
  housePositions: Map<number, [number, number, number]>;
  /** Feeder membership lookup */
  houseToFeeder: Map<number, string>;
  edges: Edge[];
  roads: Road[];
  polePositions: [number, number, number][];
  treePositions: [number, number, number][];
  streetLightPositions: [number, number, number][];
}

// ─────────────────────────────────────────────────────────────────────────────
// Neighbourhood Constants
// ─────────────────────────────────────────────────────────────────────────────

const Y = 0;  // ground level

// Infrastructure positions (top of map, edge of neighbourhood)
const INFRA = {
  grid:         [-55, Y, -72] as [number, number, number],
  solar:        [ 50, Y, -72] as [number, number, number],
  substation:   [  0, Y, -62] as [number, number, number],
  battery:      [-20, Y, -62] as [number, number, number],
  transformerA: [-42, Y, -50] as [number, number, number],
  transformerB: [  0, Y, -50] as [number, number, number],
  transformerC: [ 42, Y, -50] as [number, number, number],
};

// Road layout
const ROADS: Road[] = [
  // Main arterial road (horizontal, top of neighbourhood)
  { id: 'main-road',     startX: -70, endX: 70, startZ: -44, endZ: -40, width: 4, direction: 'horizontal' },
  // Secondary cross-roads (horizontal)
  { id: 'street-h1',    startX: -70, endX: 70, startZ: -28, endZ: -25, width: 3, direction: 'horizontal' },
  { id: 'street-h2',    startX: -70, endX: 70, startZ: -10, endZ: -7,  width: 3, direction: 'horizontal' },
  { id: 'street-h3',    startX: -70, endX: 70, startZ:   8, endZ:  11, width: 3, direction: 'horizontal' },
  { id: 'street-h4',    startX: -70, endX: 70, startZ:  26, endZ:  29, width: 3, direction: 'horizontal' },
  // Vertical divider roads
  { id: 'street-v1',    startX: -25, endX: -22, startZ: -44, endZ: 40, width: 3, direction: 'vertical' },
  { id: 'street-v2',    startX:  22, endX:  25, startZ: -44, endZ: 40, width: 3, direction: 'vertical' },
];

// ─────────────────────────────────────────────────────────────────────────────
// House Grid Generator
// ─────────────────────────────────────────────────────────────────────────────

interface BlockConfig {
  feederId: 'feeder-a' | 'feeder-b' | 'feeder-c';
  transformerId: string;
  zone: 'zone-a' | 'zone-b';
  // Start house id
  idOffset: number;
  count: number;
  // Block bounds (X range, Z range)
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  // Lot pitch
  lotW: number;   // X spacing
  lotD: number;   // Z spacing (depth)
  cols: number;
}

// Block A: houses 0–14  (left block, zone-a)
// Block B: houses 15–49 (centre block, mixed zone-a/b)
// Block C: houses 50–99 (right block, zone-b with EVs)
const BLOCK_CONFIGS: BlockConfig[] = [
  { feederId: 'feeder-a', transformerId: 'transformer-a', zone: 'zone-a', idOffset: 0,  count: 15, xMin: -68, xMax: -27, zMin: -40, zMax: 36, lotW: 5.5, lotD: 6.5, cols: 3 },
  { feederId: 'feeder-b', transformerId: 'transformer-b', zone: 'zone-a', idOffset: 15, count: 35, xMin: -20, xMax: 20,  zMin: -40, zMax: 36, lotW: 5.5, lotD: 6.0, cols: 5 },
  { feederId: 'feeder-c', transformerId: 'transformer-c', zone: 'zone-b', idOffset: 50, count: 50, xMin:  27, xMax: 68,  zMin: -40, zMax: 36, lotW: 5.0, lotD: 5.8, cols: 6 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic pseudo-random (seeded by house id)
// ─────────────────────────────────────────────────────────────────────────────
function seeded(id: number, salt = 0): number {
  const x = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildTopology(): Topology {

  // ── Infrastructure Nodes ────────────────────────────────────────────────
  const infra: InfraNode[] = [
    { id: 'grid',          label: 'MAIN GRID',       position: INFRA.grid,         type: 'grid' },
    { id: 'solar',         label: 'SOLAR FARM',      position: INFRA.solar,        type: 'solar' },
    { id: 'substation',    label: 'SUBSTATION',      position: INFRA.substation,   type: 'substation' },
    { id: 'battery',       label: 'BATTERY STORAGE', position: INFRA.battery,      type: 'battery' },
    { id: 'transformer-a', label: 'TRANSFORMER A',   position: INFRA.transformerA, type: 'transformer' },
    { id: 'transformer-b', label: 'TRANSFORMER B',   position: INFRA.transformerB, type: 'transformer' },
    { id: 'transformer-c', label: 'TRANSFORMER C',   position: INFRA.transformerC, type: 'transformer' },
  ];

  // ── Houses ──────────────────────────────────────────────────────────────
  const houses: HouseMeta[] = [];
  const housePositions = new Map<number, [number, number, number]>();
  const houseToFeeder = new Map<number, string>();

  for (const block of BLOCK_CONFIGS) {
    for (let i = 0; i < block.count; i++) {
      const houseId = block.idOffset + i;

      const col = i % block.cols;
      const row = Math.floor(i / block.cols);

      // Physical position: start from block origin, skip road rows
      let x = block.xMin + col * block.lotW + block.lotW / 2;
      let z = block.zMin + row * block.lotD + block.lotD / 2;

      // Skip road zones (push house down if it falls in road band)
      if (z > -29 && z < -24) z = -24 + block.lotD * 0.1;
      if (z > -11 && z < -6)  z = -6  + block.lotD * 0.1;
      if (z > 7   && z < 12)  z = 12  + block.lotD * 0.1;

      // Subtle position jitter (within lot)
      x += (seeded(houseId, 1) - 0.5) * 0.6;
      z += (seeded(houseId, 2) - 0.5) * 0.6;

      // Clamp to block bounds
      x = Math.max(block.xMin + 0.5, Math.min(block.xMax - 0.5, x));
      z = Math.max(block.zMin + 0.5, Math.min(block.zMax - 0.5, z));

      const pos: [number, number, number] = [x, Y, z];

      // House variant (0-5): deterministic
      const variant = (houseId % 6) as 0 | 1 | 2 | 3 | 4 | 5;

      // Scale variation
      const scale = 0.85 + seeded(houseId, 3) * 0.3;

      // Rotation: houses in left/right half of block face inward toward nearest vertical road
      const rotation = col < block.cols / 2 ? 0 : Math.PI;

      // Solar seed: ~65% of houses have structural solar
      const hasSolarSeed = seeded(houseId, 4) > 0.35;

      // Nearest pole: assign sequentially per row
      const poleIndex = Math.floor(i / 2);

      // Driveway side: always faces the road (south side of house, i.e. lower Z)
      const drivewaySide = 'south' as const;

      const meta: HouseMeta = {
        id: houseId,
        variant,
        position: pos,
        rotation,
        scale,
        hasSolarSeed,
        feederId: block.feederId,
        transformerId: block.transformerId,
        poleIndex,
        zone: block.zone,
        drivewaySide,
      };

      houses.push(meta);
      housePositions.set(houseId, pos);
      houseToFeeder.set(houseId, block.feederId);
    }
  }

  // ── Utility Poles ────────────────────────────────────────────────────────
  // Poles run along street edges, every 8 wu
  const polePositions: [number, number, number][] = [];

  // Along main road (Z = -41), left and right of vertical dividers
  for (let x = -68; x <= 68; x += 8) {
    polePositions.push([x, Y, -42]);
  }
  // Along street-h1
  for (let x = -68; x <= 68; x += 8) {
    polePositions.push([x, Y, -27]);
  }
  // Along street-h2
  for (let x = -68; x <= 68; x += 8) {
    polePositions.push([x, Y, -9]);
  }
  // Along street-h3
  for (let x = -68; x <= 68; x += 8) {
    polePositions.push([x, Y, 9]);
  }
  // Along street-h4
  for (let x = -68; x <= 68; x += 8) {
    polePositions.push([x, Y, 27]);
  }
  // Vertical street poles (v1 left side)
  for (let z = -44; z <= 36; z += 8) {
    polePositions.push([-23, Y, z]);
  }
  // Vertical street poles (v2 right side)
  for (let z = -44; z <= 36; z += 8) {
    polePositions.push([23, Y, z]);
  }

  // ── Trees ────────────────────────────────────────────────────────────────
  const treePositions: [number, number, number][] = [];

  // Trees along road verges and park patches
  const treeSeeds: [number, number][] = [
    [-65, -43], [-55, -43], [-45, -43], [-35, -43],
    [ 35, -43], [ 45, -43], [ 55, -43], [ 65, -43],
    [-65, 30], [-55, 30], [-45, 30], [-35, 30],
    [ 35, 30], [ 45, 30], [ 55, 30], [ 65, 30],
    [-67, -15], [-67, 0], [-67, 15],
    [ 67, -15], [ 67, 0], [ 67, 15],
    // Small park patch in centre-left gap
    [-12, 18], [-8, 22], [-15, 23], [-10, 26],
    // Park patch right
    [ 10, 18], [ 15, 22], [ 8, 23],
  ];
  for (const [tx, tz] of treeSeeds) {
    treePositions.push([tx, Y, tz]);
  }

  // ── Street Lights ────────────────────────────────────────────────────────
  // Place at every other pole
  const streetLightPositions: [number, number, number][] = polePositions
    .filter((_, i) => i % 2 === 0)
    .map(([x, , z]) => [x, Y, z]);

  // ── Feeders ──────────────────────────────────────────────────────────────
  const feeders: Feeder[] = [
    {
      id: 'feeder-a',
      label: 'FEEDER A',
      transformerId: 'transformer-a',
      transformerPos: INFRA.transformerA,
      houseIds: houses.filter(h => h.feederId === 'feeder-a').map(h => h.id),
      zone: 'zone-a',
    },
    {
      id: 'feeder-b',
      label: 'FEEDER B',
      transformerId: 'transformer-b',
      transformerPos: INFRA.transformerB,
      houseIds: houses.filter(h => h.feederId === 'feeder-b').map(h => h.id),
      zone: 'zone-a',
    },
    {
      id: 'feeder-c',
      label: 'FEEDER C',
      transformerId: 'transformer-c',
      transformerPos: INFRA.transformerC,
      houseIds: houses.filter(h => h.feederId === 'feeder-c').map(h => h.id),
      zone: 'zone-b',
    },
  ];

  // ── Edges (infrastructure connections with road-following waypoints) ─────
  const edges: Edge[] = [
    {
      from: 'solar',
      to: 'substation',
      type: 'hv',
      waypoints: [INFRA.solar, [25, Y, -65], INFRA.substation],
    },
    {
      from: 'grid',
      to: 'substation',
      type: 'hv',
      waypoints: [INFRA.grid, [-28, Y, -65], INFRA.substation],
    },
    {
      from: 'substation',
      to: 'battery',
      type: 'hv',
      waypoints: [INFRA.substation, INFRA.battery],
    },
    {
      from: 'substation',
      to: 'transformer-a',
      type: 'distribution',
      waypoints: [INFRA.substation, [-20, Y, -56], INFRA.transformerA],
    },
    {
      from: 'substation',
      to: 'transformer-b',
      type: 'distribution',
      waypoints: [INFRA.substation, INFRA.transformerB],
    },
    {
      from: 'substation',
      to: 'transformer-c',
      type: 'distribution',
      waypoints: [INFRA.substation, [20, Y, -56], INFRA.transformerC],
    },
    // Feeder trunks (transformer → main road poles)
    {
      from: 'transformer-a',
      to: 'pole-a-main',
      type: 'feeder',
      waypoints: [INFRA.transformerA, [-42, Y, -42]],
    },
    {
      from: 'transformer-b',
      to: 'pole-b-main',
      type: 'feeder',
      waypoints: [INFRA.transformerB, [0, Y, -42]],
    },
    {
      from: 'transformer-c',
      to: 'pole-c-main',
      type: 'feeder',
      waypoints: [INFRA.transformerC, [42, Y, -42]],
    },
  ];

  return {
    infra,
    feeders,
    houses,
    housePositions,
    houseToFeeder,
    edges,
    roads: ROADS,
    polePositions,
    treePositions,
    streetLightPositions,
  };
}

/** Singleton — computed once per app session. */
let _topo: Topology | null = null;
export function getTopology(): Topology {
  if (!_topo) _topo = buildTopology();
  return _topo;
}
