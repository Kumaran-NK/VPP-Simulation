'use client';

/**
 * StreetLights.tsx
 * Street light poles — on at night, off during day.
 * Uses topology.streetLightPositions.
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';
import { useSimulationStore } from '@/hooks/useSimulationStore';

const tempObj = new THREE.Object3D();
const LIGHT_HEIGHT = 5.0;

export default function StreetLights({ topology }: { topology: Topology }) {
  const positions = topology.streetLightPositions;
  const count = positions.length;
  const headRef = useRef<THREE.InstancedMesh>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const sunAngle = useSimulationStore((s) => s.sunAngle);
  const sunIntensity = useSimulationStore((s) => s.sunIntensity);
  const isNight = sunAngle < 8 || sunAngle > 172 || sunIntensity < 0.05;

  const initHead = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (headRef as any).current = mesh;
    positions.forEach(([x, , z], i) => {
      tempObj.position.set(x, LIGHT_HEIGHT, z);
      tempObj.scale.setScalar(1);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  // Update emissive at night
  useFrame(() => {
    if (!headMatRef.current) return;
    headMatRef.current.emissiveIntensity = isNight ? 1.2 : 0.0;
  });

  // Point lights — only a few for perf (sample every 4th)
  const lightPositions = useMemo(() =>
    positions.filter((_, i) => i % 4 === 0),
    [positions],
  );

  return (
    <group>
      {/* Pole shafts (thin cylinders) */}
      {positions.map(([x, , z], i) => (
        <mesh key={i} castShadow position={[x, LIGHT_HEIGHT / 2, z]}>
          <cylinderGeometry args={[0.04, 0.05, LIGHT_HEIGHT, 5]} />
          <meshStandardMaterial color="#5a5a6a" roughness={0.8} metalness={0.4} />
        </mesh>
      ))}

      {/* Lamp heads */}
      <instancedMesh ref={initHead} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.35, 0.15, 0.35]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#888890"
          emissive="#ffdd88"
          emissiveIntensity={0}
          roughness={0.4}
          metalness={0.5}
        />
      </instancedMesh>

      {/* Actual point lights at night (sampled for performance) */}
      {isNight && lightPositions.map(([x, , z], i) => (
        <pointLight
          key={i}
          position={[x, LIGHT_HEIGHT - 0.1, z]}
          intensity={0.8}
          color="#ffcc66"
          distance={12}
          decay={2}
        />
      ))}
    </group>
  );
}
