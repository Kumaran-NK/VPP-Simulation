'use client';

/**
 * HouseField.tsx — 100 houses as multiple variant InstancedMeshes.
 *
 * 6 house variants × ~17 avg houses each.
 * Separate InstancedMesh for:
 *   - House body (per variant, vertex colours for status)
 *   - Roof (shared, terracotta/slate colours)
 *   - Windows (shared, emissive at night)
 *   - Rooftop solar panels (only where hasSolarSeed || solar_kw > 0.3)
 *   - EV markers (Zone B only)
 *
 * All animation runs in a SINGLE useFrame — no per-house React state.
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';
import type { Topology, HouseMeta } from '@/lib/topology';

// ─────────────────────────────────────────────────────────────────────────────
// Shared temps
// ─────────────────────────────────────────────────────────────────────────────
const tempObj = new THREE.Object3D();
const tempColor = new THREE.Color();

// ─────────────────────────────────────────────────────────────────────────────
// House status → hex colour
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_HEX: Record<string, number> = {
  exporting: 0x34d399,   // green
  importing: 0xf5a623,   // amber
  charged:   0x22d3ee,   // cyan
  critical:  0xff5c6c,   // red
  normal:    0xc8b89a,   // warm beige (realistic house colour)
};
const SELECTED_HEX = 0xffffff;
const HOVERED_HEX  = 0xe8e8d8;

// ─────────────────────────────────────────────────────────────────────────────
// Variant dimensions [bodyW, bodyH, bodyD, roofRise]
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS: [number, number, number, number][] = [
  [3.0, 1.8, 3.5, 1.2],  // 0 – single story bungalow
  [2.8, 3.2, 3.0, 1.4],  // 1 – two-story
  [2.4, 1.6, 2.8, 1.0],  // 2 – compact small
  [3.4, 2.0, 3.2, 0.6],  // 3 – modern flat-ish roof
  [3.8, 2.2, 4.0, 1.5],  // 4 – large family
  [2.2, 3.0, 2.6, 1.3],  // 5 – row house / tall
];

const ROOF_COLOURS = [0x8b4513, 0x6b3a2a, 0x5a5a6a, 0x4a5560, 0x7a3520, 0x5a4a3a];

// ─────────────────────────────────────────────────────────────────────────────
// Variant InstancedMesh component
// ─────────────────────────────────────────────────────────────────────────────
interface VariantMeshProps {
  variantIndex: number;
  houses: HouseMeta[];   // only houses of this variant
  allHouseMetas: HouseMeta[];  // full list for id→index mapping
  onClickHouse: (houseId: number) => void;
  onHoverHouse: (houseId: number | null) => void;
}

function VariantMesh({ variantIndex, houses, onClickHouse, onHoverHouse }: VariantMeshProps) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const winRef  = useRef<THREE.InstancedMesh>(null);

  const [bW, bH, bD, rRise] = VARIANTS[variantIndex];
  const count = houses.length;

  // Map instanceId → houseId for this variant
  const instanceToHouseId = useMemo(() => houses.map(h => h.id), [houses]);

  // Initialize matrices once
  const initAll = useCallback((bodies: THREE.InstancedMesh | null) => {
    if (!bodies) return;
    (bodyRef as any).current = bodies;

    houses.forEach((h, i) => {
      const [x, , z] = h.position;
      const y = 0;

      // Body
      tempObj.position.set(x, y + bH / 2, z);
      tempObj.scale.set(h.scale, h.scale, h.scale);
      tempObj.rotation.set(0, h.rotation, 0);
      tempObj.updateMatrix();
      bodies.setMatrixAt(i, tempObj.matrix);

      // Initial colour
      tempColor.set(STATUS_HEX.normal);
      bodies.setColorAt(i, tempColor);
    });

    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  }, [houses, bH]);

  const initRoof = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (roofRef as any).current = mesh;

    houses.forEach((h, i) => {
      const [x, , z] = h.position;

      // Roof ridge centred on top of body
      tempObj.position.set(x, bH * h.scale + rRise * h.scale * 0.5, z);
      tempObj.scale.set(h.scale * 1.08, h.scale, h.scale * 1.05);
      tempObj.rotation.set(0, h.rotation, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [houses, bH, rRise]);

  const initWindows = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (winRef as any).current = mesh;

    houses.forEach((h, i) => {
      const [x, , z] = h.position;

      tempObj.position.set(x, bH * h.scale * 0.55, z + bD * h.scale * 0.51);
      tempObj.scale.set(h.scale * 0.55, h.scale * 0.4, h.scale * 0.05);
      tempObj.rotation.set(0, h.rotation, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [houses, bH, bD]);

  // Animate colours each frame
  useFrame(() => {
    if (!bodyRef.current || !winRef.current) return;

    const simHouses = useSimulationStore.getState().houses;
    const selectedId = useUIStore.getState().selectedHouseId;
    const hoveredId  = useUIStore.getState().hoveredHouseId;
    const sunAngle   = useSimulationStore.getState().sunAngle;
    const sunInt     = useSimulationStore.getState().sunIntensity;
    const isNight    = sunAngle < 8 || sunAngle > 172 || sunInt < 0.05;

    // Window emissive
    const winMat = winRef.current.material as THREE.MeshStandardMaterial;
    winMat.emissiveIntensity = isNight ? 0.6 : 0.0;

    // Body colours
    for (let i = 0; i < count; i++) {
      const houseId = instanceToHouseId[i];
      const house = simHouses[houseId];
      let hex = house ? (STATUS_HEX[house.status] ?? STATUS_HEX.normal) : STATUS_HEX.normal;

      if (houseId === selectedId)      tempColor.set(SELECTED_HEX);
      else if (houseId === hoveredId)  tempColor.set(hex).lerp(new THREE.Color(HOVERED_HEX), 0.4);
      else                             tempColor.set(hex);

      bodyRef.current!.setColorAt(i, tempColor);
    }
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
  });

  // Click handler
  const onClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const houseId = instanceToHouseId[e.instanceId];
      if (houseId !== undefined) {
        const cur = useUIStore.getState().selectedHouseId;
        useUIStore.getState().setSelectedHouseId(cur === houseId ? null : houseId);
        onClickHouse(houseId);
      }
    }
  }, [instanceToHouseId, onClickHouse]);

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const houseId = instanceToHouseId[e.instanceId];
      if (houseId !== undefined) {
        useUIStore.getState().setHoveredHouseId(houseId);
        document.body.style.cursor = 'pointer';
        onHoverHouse(houseId);
      }
    }
  }, [instanceToHouseId, onHoverHouse]);

  const onPointerOut = useCallback(() => {
    useUIStore.getState().setHoveredHouseId(null);
    document.body.style.cursor = '';
    onHoverHouse(null);
  }, [onHoverHouse]);

  if (count === 0) return null;

  return (
    <group>
      {/* Body */}
      <instancedMesh
        ref={initAll}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[bW, bH, bD]} />
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0.05} />
      </instancedMesh>

      {/* Roof (pitched: use a cone-like box at angle) */}
      <instancedMesh ref={initRoof} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[bW + 0.2, rRise, bD + 0.2]} />
        <meshStandardMaterial
          color={`#${ROOF_COLOURS[variantIndex].toString(16).padStart(6, '0')}`}
          roughness={0.85}
          metalness={0.05}
        />
      </instancedMesh>

      {/* Windows — front face */}
      <instancedMesh ref={initWindows} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#d4e8f8"
          emissive="#ffe8a0"
          emissiveIntensity={0}
          roughness={0.1}
          metalness={0.1}
          transparent
          opacity={0.8}
        />
      </instancedMesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rooftop Solar Panels (single InstancedMesh for all solar houses)
// ─────────────────────────────────────────────────────────────────────────────
function RooftopSolar({ houses }: { topology: Topology; houses: HouseMeta[] }) {
  const solarHouses = useMemo(
    () => houses.filter((h) => h.hasSolarSeed),
    [houses],
  );
  const count = solarHouses.length;
  const panelMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sunIntensity = useSimulationStore((s) => s.sunIntensity);

  const initSolar = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    solarHouses.forEach((h, i) => {
      const [x, , z] = h.position;
      const [, bH] = VARIANTS[h.variant];
      const roofY = bH * h.scale + 0.5;

      tempObj.position.set(x, roofY, z - 0.3);
      tempObj.scale.set(h.scale * 0.9, h.scale * 0.9, h.scale * 0.9);
      tempObj.rotation.set(-0.35, h.rotation, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [solarHouses]);

  useFrame(() => {
    if (!panelMatRef.current) return;
    panelMatRef.current.emissiveIntensity = 0.02 + sunIntensity * 0.12;
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={initSolar} args={[undefined, undefined, count]} castShadow>
      <boxGeometry args={[1.8, 0.05, 1.2]} />
      <meshStandardMaterial
        ref={panelMatRef}
        color="#0d1e38"
        emissive="#22D3EE"
        emissiveIntensity={0.03}
        metalness={0.8}
        roughness={0.2}
      />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EV Marker (small chevron at driveway, Zone B only)
// ─────────────────────────────────────────────────────────────────────────────
function EVMarkers({ houses }: { houses: HouseMeta[] }) {
  const evHouses = useMemo(() => houses.filter((h) => h.zone === 'zone-b'), [houses]);
  const count = evHouses.length;
  const lodLevel = useUIStore((s) => s.lodLevel);

  const initEV = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    evHouses.forEach((h, i) => {
      const [x, , z] = h.position;
      tempObj.position.set(x, 0.25, z + 2.5);
      tempObj.scale.setScalar(0.5);
      tempObj.rotation.set(0, 0, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [evHouses]);

  // Only show at close/medium LOD
  if (lodLevel < 1 || count === 0) return null;

  return (
    <instancedMesh ref={initEV} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.8, 0.3, 1.6]} />
      <meshStandardMaterial
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={0.3}
        roughness={0.4}
        metalness={0.5}
      />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HouseField
// ─────────────────────────────────────────────────────────────────────────────
export default function HouseField({ topology }: { topology: Topology }) {
  // Group houses by variant
  const byVariant = useMemo(() => {
    const groups: HouseMeta[][] = [[], [], [], [], [], []];
    topology.houses.forEach((h) => {
      groups[h.variant].push(h);
    });
    return groups;
  }, [topology.houses]);

  const noop = useCallback(() => {}, []);

  return (
    <group>
      {byVariant.map((houses, variantIndex) => (
        <VariantMesh
          key={variantIndex}
          variantIndex={variantIndex}
          houses={houses}
          allHouseMetas={topology.houses}
          onClickHouse={noop}
          onHoverHouse={noop}
        />
      ))}

      <RooftopSolar topology={topology} houses={topology.houses} />
      <EVMarkers houses={topology.houses} />
    </group>
  );
}
