'use client';

/**
 * Substation.tsx
 * Realistic electrical substation — fenced compound, transformer structures,
 * switchgear cabinets, busbars, warning signs, lights.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/hooks/useSimulationStore';

const METAL = { metalness: 0.7, roughness: 0.35 };

export default function Substation({ position }: { position: [number, number, number] }) {
  const gridConnected = useSimulationStore((s) => s.gridConnected);
  const gridFrequency = useSimulationStore((s) => s.gridFrequency);
  const gridEmergency = useSimulationStore((s) => s.gridEmergency);
  const warningRef = useRef<THREE.PointLight>(null);

  const isDistressed = !gridConnected || gridFrequency < 49.8 || gridEmergency;

  useFrame((state) => {
    if (!warningRef.current) return;
    if (isDistressed) {
      warningRef.current.intensity = 1.5 + Math.sin(state.clock.elapsedTime * 4) * 1.0;
    } else {
      warningRef.current.intensity = 0.3;
    }
  });

  return (
    <group position={position}>
      {/* ── Concrete slab ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#555a60" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* ── Perimeter fence (4 sides) ── */}
      {[
        { pos: [0, 1.0, -5.2] as [number,number,number], scale: [14.4, 2, 0.08] as [number,number,number] },
        { pos: [0, 1.0,  5.2] as [number,number,number], scale: [14.4, 2, 0.08] as [number,number,number] },
        { pos: [-7.2, 1.0, 0] as [number,number,number], scale: [0.08, 2, 10.4] as [number,number,number] },
        { pos: [ 7.2, 1.0, 0] as [number,number,number], scale: [0.08, 2, 10.4] as [number,number,number] },
      ].map((f, i) => (
        <mesh key={i} castShadow position={f.pos}>
          <boxGeometry args={f.scale} />
          <meshStandardMaterial color="#6a7080" {...METAL} wireframe={false} />
        </mesh>
      ))}

      {/* ── Main transformer structure (3 cores) ── */}
      {[-2.5, 0, 2.5].map((ox, i) => (
        <group key={i} position={[ox, 0, -1.5]}>
          {/* Core body */}
          <mesh castShadow position={[0, 1.2, 0]}>
            <boxGeometry args={[1.4, 2.4, 1.2]} />
            <meshStandardMaterial color="#2d3540" {...METAL} />
          </mesh>
          {/* Cooling radiator fins */}
          {[-0.5, 0, 0.5].map((fz, j) => (
            <mesh key={j} castShadow position={[-0.8, 1.2, fz]}>
              <boxGeometry args={[0.06, 2.0, 0.3]} />
              <meshStandardMaterial color="#3a4550" roughness={0.6} metalness={0.8} />
            </mesh>
          ))}
          {/* HV bushing on top */}
          <mesh castShadow position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 0.6, 7]} />
            <meshStandardMaterial color="#c8b060" roughness={0.5} metalness={0.3} />
          </mesh>
          {/* Oil conservator tank */}
          <mesh castShadow position={[0, 2.9, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.35, 8]} />
            <meshStandardMaterial color="#3a4550" {...METAL} />
          </mesh>
        </group>
      ))}

      {/* ── Switchgear cabinets ── */}
      {[-4.5, 4.5].map((ox, i) => (
        <mesh key={i} castShadow position={[ox, 1.0, 1.5]}>
          <boxGeometry args={[1.8, 2.0, 1.0]} />
          <meshStandardMaterial color="#2a3540" {...METAL} />
        </mesh>
      ))}

      {/* ── Busbar structure ── */}
      <mesh castShadow position={[0, 3.2, -1.5]}>
        <boxGeometry args={[8, 0.12, 0.12]} />
        <meshStandardMaterial color="#9aaa80" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* ── Warning sign ── */}
      <mesh position={[0, 1.5, 5.0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshBasicMaterial color={isDistressed ? '#ff4400' : '#ffcc00'} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 1.5, 4.9]} fontSize={0.2} color="#000000" anchorX="center" anchorY="middle">
        ⚡ HIGH VOLTAGE
      </Text>

      {/* ── Status light ── */}
      <pointLight
        ref={warningRef}
        position={[0, 4.0, 0]}
        intensity={0.3}
        color={isDistressed ? '#ff4400' : '#44ff88'}
        distance={15}
      />
      <mesh position={[0, 4.0, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color={isDistressed ? '#ff4400' : '#44ff88'}
          emissive={isDistressed ? '#ff4400' : '#44ff88'}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* ── Label ── */}
      <Text position={[0, 5.0, 0]} fontSize={0.5} color="#22D3EE" anchorX="center" anchorY="middle">
        SUBSTATION
      </Text>
      {isDistressed && (
        <Text position={[0, 4.4, 0]} fontSize={0.28} color="#ff4400" anchorX="center" anchorY="middle">
          {!gridConnected ? '⚠ ISLANDED' : '⚠ FREQ ALARM'}
        </Text>
      )}
    </group>
  );
}
