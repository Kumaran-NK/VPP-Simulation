'use client';

/**
 * GridPylon.tsx
 * Main grid connection pylon — transmission tower style.
 * Pulses red on islanding/frequency emergency.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/hooks/useSimulationStore';

export default function GridPylon({ position }: { position: [number, number, number] }) {
  const gridConnected = useSimulationStore((s) => s.gridConnected);
  const gridFrequency = useSimulationStore((s) => s.gridFrequency);
  const gridEmergency = useSimulationStore((s) => s.gridEmergency);
  const warningRef = useRef<THREE.PointLight>(null);

  const isDistressed = !gridConnected || gridFrequency < 49.8 || gridEmergency;
  const statusColor = !gridConnected ? '#ff4400' : gridFrequency < 49.8 ? '#f5a623' : '#34d399';

  useFrame((state) => {
    if (!warningRef.current) return;
    warningRef.current.intensity = isDistressed
      ? 1.5 + Math.sin(state.clock.elapsedTime * 5) * 1.2
      : 0;
  });

  return (
    <group position={position}>
      {/* ── Tower legs (A-frame lattice) ── */}
      {[[-1.2, 1.2], [-1.2, -1.2], [1.2, 1.2], [1.2, -1.2]].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx * 0.5, 5, lz * 0.5]}>
          <cylinderGeometry args={[0.06, 0.14, 10, 4]} />
          <meshStandardMaterial color="#4a5a6a" roughness={0.6} metalness={0.7} />
        </mesh>
      ))}

      {/* ── Cross braces ── */}
      {[2, 5, 7.5].map((y, i) => (
        <mesh key={i} castShadow position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.08]} />
          <meshStandardMaterial color="#3a4a5a" roughness={0.6} metalness={0.7} />
        </mesh>
      ))}

      {/* ── Top crossarm ── */}
      <mesh castShadow position={[0, 10.5, 0]}>
        <boxGeometry args={[4.0, 0.12, 0.2]} />
        <meshStandardMaterial color="#3a4a5a" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* ── Insulators on crossarm ── */}
      {[-1.6, -0.5, 0.5, 1.6].map((ox, i) => (
        <mesh key={i} castShadow position={[ox, 10.2, 0]}>
          <cylinderGeometry args={[0.06, 0.04, 0.35, 6]} />
          <meshStandardMaterial color="#c8b060" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}

      {/* ── Warning light at top ── */}
      <mesh position={[0, 11.2, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={isDistressed ? 1.0 : 0.2}
        />
      </mesh>
      <pointLight ref={warningRef} position={[0, 11.5, 0]} color="#ff4400" intensity={0} distance={20} />

      {/* ── Labels ── */}
      <Text position={[0, 12.5, 0]} fontSize={0.45} color={statusColor} anchorX="center" anchorY="middle">
        {gridConnected ? 'MAIN GRID' : '⚠ ISLANDED'}
      </Text>
      <Text position={[0, 11.8, 0]} fontSize={0.28} color="#8A93A3" anchorX="center" anchorY="middle">
        {gridFrequency.toFixed(2)} Hz
      </Text>
    </group>
  );
}
