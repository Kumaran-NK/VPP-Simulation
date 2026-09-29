'use client';

/**
 * PowerLines.tsx
 * Overhead electrical wires following roads between poles and transformers.
 * Static conduit wires (always visible) — particles are in EnergyFlows.tsx.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';
import { useSimulationStore } from '@/hooks/useSimulationStore';

const POLE_HEIGHT = 6.5;
const WIRE_Y = POLE_HEIGHT - 0.3;  // just below crossarm

// Helper: create a slightly sagging wire line primitive
function WireLine({
  start,
  end,
  color,
  opacity,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: number;
  opacity: number;
}) {
  const lineObj = useMemo(() => {
    const [sx, sy, sz] = start;
    const [ex, ey, ez] = end;

    // Catenary sag: 3 mid-points dipping slightly
    const mid1: [number, number, number] = [
      sx + (ex - sx) * 0.33,
      (sy + ey) / 2 - 0.15,
      sz + (ez - sz) * 0.33,
    ];
    const mid2: [number, number, number] = [
      sx + (ex - sx) * 0.66,
      (sy + ey) / 2 - 0.2,
      sz + (ez - sz) * 0.66,
    ];

    const pts = [
      new THREE.Vector3(...start),
      new THREE.Vector3(...mid1),
      new THREE.Vector3(...mid2),
      new THREE.Vector3(...end),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geo, mat);
  }, [start, end, color, opacity]);

  return <primitive object={lineObj} />;
}

export default function PowerLines({ topology }: { topology: Topology }) {
  const gridConnected = useSimulationStore((s) => s.gridConnected);

  // Infrastructure edges (HV and distribution)
  const infraLines = useMemo(() => {
    return topology.edges.map((edge, i) => {
      const waypoints = edge.waypoints;
      if (!waypoints || waypoints.length < 2) return null;

      const color = edge.type === 'hv' ? 0x334455 : 0x223344;
      const opacity = edge.type === 'hv' ? 0.55 : 0.4;

      // For grid edge during islanding — dim it
      const actualOpacity =
        (edge.from === 'grid' || edge.to === 'grid') && !gridConnected
          ? 0.08
          : opacity;

      return waypoints.slice(1).map((wp, j) => (
        <WireLine
          key={`edge-${i}-${j}`}
          start={waypoints[j]}
          end={wp}
          color={color}
          opacity={actualOpacity}
        />
      ));
    });
  }, [topology.edges, gridConnected]);

  // Pole-to-pole wires along streets
  // Generate wire runs along each pole row
  const poleWires = useMemo(() => {
    const wires: JSX.Element[] = [];
    const poles = topology.polePositions;

    // Find poles in same street row (same Z within ±1 unit)
    const rows = new Map<number, [number, number, number][]>();
    for (const [px, , pz] of poles) {
      const rowKey = Math.round(pz);
      if (!rows.has(rowKey)) rows.set(rowKey, []);
      rows.get(rowKey)!.push([px, WIRE_Y, pz]);
    }

    let idx = 0;
    rows.forEach((rowPoles) => {
      // Sort by X
      const sorted = [...rowPoles].sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < sorted.length - 1; i++) {
        wires.push(
          <WireLine
            key={`pw-${idx++}`}
            start={sorted[i]}
            end={sorted[i + 1]}
            color={0x2a3a4a}
            opacity={0.35}
          />,
        );
      }
    });

    // Vertical street wires
    const cols = new Map<number, [number, number, number][]>();
    for (const [px, , pz] of poles) {
      const colKey = Math.round(px);
      if (!cols.has(colKey)) cols.set(colKey, []);
      cols.get(colKey)!.push([px, WIRE_Y, pz]);
    }

    cols.forEach((colPoles) => {
      if (colPoles.length < 2) return;
      const sorted = [...colPoles].sort((a, b) => a[2] - b[2]);
      for (let i = 0; i < sorted.length - 1; i++) {
        wires.push(
          <WireLine
            key={`pw-${idx++}`}
            start={sorted[i]}
            end={sorted[i + 1]}
            color={0x2a3a4a}
            opacity={0.3}
          />,
        );
      }
    });

    return wires;
  }, [topology.polePositions]);

  // Islanding visual break — two red marker spheres on grid connection
  const gridEdge = topology.edges.find((e) => e.from === 'grid' || e.to === 'grid');
  const islandingBreak = useMemo(() => {
    if (!gridEdge || !gridEdge.waypoints || gridEdge.waypoints.length < 2) return null;
    const wp = gridEdge.waypoints;
    const midIdx = Math.floor(wp.length / 2);
    const mp = wp[midIdx];
    return mp;
  }, [gridEdge]);

  return (
    <group>
      {infraLines}
      {poleWires}

      {/* Islanding break markers */}
      {!gridConnected && islandingBreak && (
        <>
          <mesh position={[islandingBreak[0] - 0.5, islandingBreak[1] + WIRE_Y, islandingBreak[2]]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={1.0} />
          </mesh>
          <mesh position={[islandingBreak[0] + 0.5, islandingBreak[1] + WIRE_Y, islandingBreak[2]]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={1.0} />
          </mesh>
          <pointLight
            position={[islandingBreak[0], islandingBreak[1] + WIRE_Y, islandingBreak[2]]}
            color="#ff4400"
            intensity={2}
            distance={12}
          />
        </>
      )}
    </group>
  );
}
