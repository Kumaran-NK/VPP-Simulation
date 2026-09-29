'use client';

/**
 * Trees.tsx
 * Low-poly tree InstancedMesh — trunks + canopy.
 * 3 size variants, positions from topology.treePositions.
 * At night canopy is darker; no emissive.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';
import { useSimulationStore } from '@/hooks/useSimulationStore';

const tempObj = new THREE.Object3D();

function seeded(id: number, salt = 0): number {
  const x = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Trees({ topology }: { topology: Topology }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);

  const positions = topology.treePositions;
  const count = positions.length;

  const sunIntensity = useSimulationStore((s) => s.sunIntensity);
  const sunAngle = useSimulationStore((s) => s.sunAngle);
  const isNight = sunAngle < 8 || sunAngle > 172 || sunIntensity < 0.05;

  // Per-tree metadata (scale, height)
  const treeMeta = useMemo(() =>
    positions.map((_, i) => ({
      scale: 0.7 + seeded(i, 10) * 0.8,
      height: 3.5 + seeded(i, 11) * 2.5,
    })), [positions]);

  // Initialize positions
  useMemo(() => {
    if (!trunkRef.current || !canopyRef.current) return;

    positions.forEach(([x, , z], i) => {
      const { scale, height } = treeMeta[i];

      // Trunk
      tempObj.position.set(x, height * 0.25, z);
      tempObj.scale.set(scale * 0.3, scale * height * 0.5, scale * 0.3);
      tempObj.rotation.set(0, 0, 0);
      tempObj.updateMatrix();
      trunkRef.current!.setMatrixAt(i, tempObj.matrix);

      // Canopy (sphere, sits on top of trunk)
      tempObj.position.set(x, height * 0.5 + scale * 1.5, z);
      tempObj.scale.set(scale * 1.5, scale * 1.4, scale * 1.5);
      tempObj.rotation.set(0, 0, 0);
      tempObj.updateMatrix();
      canopyRef.current!.setMatrixAt(i, tempObj.matrix);
    });

    trunkRef.current!.instanceMatrix.needsUpdate = true;
    canopyRef.current!.instanceMatrix.needsUpdate = true;
  }, [positions, treeMeta]);

  // Canopy material ref for night dimming
  const canopyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!canopyMatRef.current) return;
    const target = isNight ? '#1a2d10' : '#2d5a1f';
    canopyMatRef.current.color.set(target);
  });

  return (
    <group>
      {/* Trunks */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.2, 1, 6]} />
        <meshStandardMaterial color="#4a3020" roughness={0.95} metalness={0} />
      </instancedMesh>

      {/* Canopy */}
      <instancedMesh ref={canopyRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial
          ref={canopyMatRef}
          color="#2d5a1f"
          roughness={0.9}
          metalness={0}
        />
      </instancedMesh>
    </group>
  );
}
