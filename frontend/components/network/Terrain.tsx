'use client';

/**
 * Terrain.tsx
 * Realistic ground: grass, asphalt roads, sidewalks, driveways.
 * No dark grid — a real neighbourhood ground plane.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';

// ── Ground Base ────────────────────────────────────────────
function GrassBase() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[180, 180]} />
      <meshStandardMaterial
        color="#3a5c2a"
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

// ── Road Surface ───────────────────────────────────────────
function RoadSurface({ topology }: { topology: Topology }) {
  const planes = useMemo(() => {
    return topology.roads.map((road) => {
      const isH = road.direction === 'horizontal';
      const w = isH ? road.endX - road.startX : road.width;
      const d = isH ? road.width : road.endZ - road.startZ;
      const cx = isH ? (road.startX + road.endX) / 2 : (road.startX + road.endX) / 2;
      const cz = isH ? (road.startZ + road.endZ) / 2 : (road.startZ + road.endZ) / 2;
      return { id: road.id, cx, cz, w, d };
    });
  }, [topology.roads]);

  return (
    <>
      {planes.map(({ id, cx, cz, w, d }) => (
        <mesh
          key={id}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[cx, 0, cz]}
        >
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#2a2d32" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
    </>
  );
}

// ── Centre Line Markings ───────────────────────────────────
function RoadMarkings({ topology }: { topology: Topology }) {
  const lines = useMemo(() => {
    return topology.roads
      .filter((r) => r.direction === 'horizontal')
      .map((road) => {
        const len = road.endX - road.startX;
        const cx = (road.startX + road.endX) / 2;
        const cz = (road.startZ + road.endZ) / 2;
        return { id: road.id, cx, cz, len };
      });
  }, [topology.roads]);

  return (
    <>
      {lines.map(({ id, cx, cz, len }) => (
        <mesh
          key={id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[cx, 0.01, cz]}
        >
          <planeGeometry args={[len, 0.15]} />
          <meshBasicMaterial color="#cccc44" opacity={0.6} transparent />
        </mesh>
      ))}
    </>
  );
}

// ── Lot Patches (slightly lighter grass per house lot) ──────
function LotPatches({ topology }: { topology: Topology }) {
  // Only render at medium LOD — this is decorative
  return (
    <>
      {topology.houses.map((h) => (
        <mesh
          key={h.id}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[h.position[0], 0.01, h.position[2]]}
        >
          <planeGeometry args={[4.0, 5.5]} />
          <meshStandardMaterial
            color="#3d6430"
            roughness={1}
            metalness={0}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Driveway strips ────────────────────────────────────────
function Driveways({ topology }: { topology: Topology }) {
  return (
    <>
      {topology.houses.map((h) => (
        <mesh
          key={h.id}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[h.position[0], 0.015, h.position[2] + 2.8]}
        >
          <planeGeometry args={[1.4, 1.8]} />
          <meshStandardMaterial color="#3a3d42" roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

// ── Main Export ────────────────────────────────────────────
export default function Terrain({ topology }: { topology: Topology }) {
  return (
    <group>
      <GrassBase />
      <RoadSurface topology={topology} />
      <RoadMarkings topology={topology} />
      <LotPatches topology={topology} />
      <Driveways topology={topology} />
    </group>
  );
}
