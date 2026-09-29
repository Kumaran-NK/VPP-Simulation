'use client';

/**
 * SolarFarm.tsx
 * Large solar farm: 8 rows × 6 panels = 48 panels (InstancedMesh),
 * with mounting frames, inverter box, connection cable trench.
 */

import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/hooks/useSimulationStore';

const tempObj = new THREE.Object3D();
const ROWS = 8;
const COLS = 6;
const PANEL_COUNT = ROWS * COLS;
const ROW_SPACING = 3.2;
const COL_SPACING = 2.0;

export default function SolarFarm({ position }: { position: [number, number, number] }) {
  const sunIntensity = useSimulationStore((s) => s.sunIntensity);
  const totalSolar = useSimulationStore((s) => s.totalSolar);
  const panelRef = useRef<THREE.InstancedMesh>(null);
  const panelMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Initialize panel positions
  const initPanels = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (panelRef as any).current = mesh;
    let idx = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const px = (col - (COLS - 1) / 2) * COL_SPACING;
        const pz = (row - (ROWS - 1) / 2) * ROW_SPACING;
        // Panels tilt south (toward +Z in our coordinate system)
        tempObj.position.set(px, 1.8, pz);
        tempObj.rotation.set(-0.4, 0, 0);
        tempObj.scale.setScalar(1);
        tempObj.updateMatrix();
        mesh.setMatrixAt(idx, tempObj.matrix);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  // Update panel emissive with solar intensity
  useFrame(() => {
    if (!panelMatRef.current) return;
    panelMatRef.current.emissiveIntensity = 0.02 + sunIntensity * 0.18;
  });

  // Panel mounting frames (Z-aligned bars)
  const frames: [number, number, number][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const px = (col - (COLS - 1) / 2) * COL_SPACING;
      const pz = (row - (ROWS - 1) / 2) * ROW_SPACING;
      frames.push([px, 0.9, pz]);
    }
  }

  const totalW = COLS * COL_SPACING;
  const totalD = ROWS * ROW_SPACING;

  return (
    <group position={position}>
      {/* ── Gravel ground ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[totalW + 4, totalD + 4]} />
        <meshStandardMaterial color="#7a7060" roughness={1} />
      </mesh>

      {/* ── Panel array ── */}
      <instancedMesh ref={initPanels} args={[undefined, undefined, PANEL_COUNT]} castShadow>
        <boxGeometry args={[1.7, 0.06, 1.2]} />
        <meshStandardMaterial
          ref={panelMatRef}
          color="#0d1e38"
          emissive="#22D3EE"
          emissiveIntensity={0.05}
          metalness={0.8}
          roughness={0.2}
        />
      </instancedMesh>

      {/* ── Panel frames (mounting legs) ── */}
      {frames.map(([fx, fy, fz], i) => (
        <mesh key={i} castShadow position={[fx, fy, fz]}>
          <boxGeometry args={[0.06, 1.8, 0.06]} />
          <meshStandardMaterial color="#4a5060" roughness={0.6} metalness={0.7} />
        </mesh>
      ))}

      {/* ── Central inverter building ── */}
      <mesh castShadow position={[0, 1.2, -totalD / 2 - 2.5]}>
        <boxGeometry args={[4, 2.4, 2.0]} />
        <meshStandardMaterial color="#2a3540" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Inverter door */}
      <mesh position={[0, 1.2, -totalD / 2 - 1.48]}>
        <boxGeometry args={[1.2, 1.8, 0.05]} />
        <meshStandardMaterial color="#3a4550" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* ── Cable trench line ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -totalD / 2 - 4]}>
        <planeGeometry args={[0.4, 6]} />
        <meshStandardMaterial color="#222228" roughness={1} />
      </mesh>

      {/* ── Fence ── */}
      {[
        { pos: [0, 0.9, totalD / 2 + 2.2]  as [number,number,number], s: [totalW + 4.4, 1.8, 0.08] as [number,number,number] },
        { pos: [0, 0.9, -totalD / 2 - 5.5] as [number,number,number], s: [totalW + 4.4, 1.8, 0.08] as [number,number,number] },
        { pos: [-(totalW / 2 + 2.2), 0.9, -1.5] as [number,number,number], s: [0.08, 1.8, totalD + 8] as [number,number,number] },
        { pos: [ (totalW / 2 + 2.2), 0.9, -1.5] as [number,number,number], s: [0.08, 1.8, totalD + 8] as [number,number,number] },
      ].map((f, i) => (
        <mesh key={i} position={f.pos}>
          <boxGeometry args={f.s} />
          <meshStandardMaterial color="#5a6070" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}

      {/* ── Labels ── */}
      <Text position={[0, 5.0, 0]} fontSize={0.55} color="#F5C451" anchorX="center" anchorY="middle">
        ☀ SOLAR FARM
      </Text>
      <Text position={[0, 4.2, 0]} fontSize={0.32} color="#8A93A3" anchorX="center" anchorY="middle">
        {totalSolar > 0 ? `${(totalSolar * 1000).toFixed(0)} kW` : 'OFFLINE'}
      </Text>
    </group>
  );
}
