'use client';

/**
 * BatteryStorage.tsx
 * Realistic Battery Energy Storage System (BESS):
 *   4 battery containers + inverter + fencing + status LEDs
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/hooks/useSimulationStore';

export default function BatteryStorage({ position }: { position: [number, number, number] }) {
  const meanSoc = useSimulationStore((s) => s.meanSoc);
  const meanSoh = useSimulationStore((s) => s.meanSoh);
  const lastAction = useSimulationStore((s) => s.lastAction);
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);

  const soc = Math.max(0, Math.min(1, meanSoc));
  const chargeRate = lastAction?.global_charge_rate ?? 0;
  const isCharging = chargeRate > 0.01;
  const isDischarging = chargeRate < -0.01;

  const ledColor = soc > 0.7 ? '#34D399' : soc > 0.3 ? '#F5C451' : '#FF5C6C';
  const stateStr = isCharging ? '▲ CHARGING' : isDischarging ? '▼ DISCHARGING' : 'IDLE';

  useFrame((state) => {
    if (!ledRef.current) return;
    if (isCharging || isDischarging) {
      ledRef.current.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    } else {
      ledRef.current.emissiveIntensity = 0.15;
    }
  });

  // Container positions: 2×2 grid
  const containers: [number, number, number][] = [
    [-3.5, 0, -1.5], [0, 0, -1.5],
    [-3.5, 0,  1.5], [0, 0,  1.5],
  ];

  return (
    <group position={position}>
      {/* ── Concrete pad ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial color="#50555a" roughness={0.9} />
      </mesh>

      {/* ── Fence ── */}
      {[
        { pos: [0, 0.9, -3.6] as [number,number,number], s: [10.4, 1.8, 0.08] as [number,number,number] },
        { pos: [0, 0.9,  3.6] as [number,number,number], s: [10.4, 1.8, 0.08] as [number,number,number] },
        { pos: [-5.2, 0.9, 0] as [number,number,number], s: [0.08, 1.8,  7.2] as [number,number,number] },
        { pos: [ 5.2, 0.9, 0] as [number,number,number], s: [0.08, 1.8,  7.2] as [number,number,number] },
      ].map((f, i) => (
        <mesh key={i} position={f.pos}>
          <boxGeometry args={f.s} />
          <meshStandardMaterial color="#6a7080" roughness={0.7} metalness={0.4} wireframe={false} />
        </mesh>
      ))}

      {/* ── Battery containers ── */}
      {containers.map(([cx, cy, cz], i) => (
        <group key={i} position={[cx, cy, cz]}>
          {/* Container body */}
          <mesh castShadow position={[0, 1.0, 0]}>
            <boxGeometry args={[2.8, 2.0, 2.4]} />
            <meshStandardMaterial color="#2d3840" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* LED strip */}
          <mesh position={[0, 1.8, 1.22]}>
            <boxGeometry args={[2.4, 0.12, 0.05]} />
            <meshStandardMaterial
              ref={i === 0 ? ledRef : undefined}
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={0.2}
              roughness={0.3}
            />
          </mesh>
          {/* Container vents */}
          {[-0.8, 0, 0.8].map((vx, vi) => (
            <mesh key={vi} position={[vx, 1.0, 1.22]}>
              <boxGeometry args={[0.5, 1.4, 0.04]} />
              <meshStandardMaterial color="#1a2228" roughness={0.8} metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Inverter cabinet (between containers) ── */}
      <mesh castShadow position={[3.5, 0.9, 0]}>
        <boxGeometry args={[1.6, 1.8, 3.0]} />
        <meshStandardMaterial color="#22303a" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* ── SoC label (always visible) ── */}
      <Text position={[-1.8, 3.2, 0]} fontSize={0.42} color="#34D399" anchorX="center" anchorY="middle">
        {`🔋 SoC ${(soc * 100).toFixed(0)}%`}
      </Text>
      <Text position={[-1.8, 2.7, 0]} fontSize={0.28} color="#8A93A3" anchorX="center" anchorY="middle">
        {`SoH ${(meanSoh * 100).toFixed(1)}%  |  ${stateStr}`}
      </Text>
    </group>
  );
}
