'use client';

/**
 * UtilityPoles.tsx
 * Utility pole InstancedMesh — wooden pole + crossarm + wire insulators.
 * Positions from topology.polePositions.
 */

import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';

const tempObj = new THREE.Object3D();
const POLE_HEIGHT = 6.5;

// Build a merged pole geometry (pole shaft + crossarm + 3 insulator stubs)
function buildPoleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.08, 0.12, POLE_HEIGHT, 6);
  geo.translate(0, POLE_HEIGHT / 2, 0);
  return geo;
}

function buildCrossarmGeometry(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(2.4, 0.12, 0.12);
  return geo;
}

export default function UtilityPoles({ topology }: { topology: Topology }) {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const positions = topology.polePositions;
  const count = positions.length;

  const initRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (poleRef as any).current = mesh;
    positions.forEach(([x, , z], i) => {
      tempObj.position.set(x, 0, z);
      tempObj.scale.set(1, 1, 1);
      tempObj.rotation.set(0, 0, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  const initCrossRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    (crossRef as any).current = mesh;
    positions.forEach(([x, , z], i) => {
      tempObj.position.set(x, POLE_HEIGHT - 0.2, z);
      tempObj.scale.set(1, 1, 1);
      tempObj.rotation.set(0, 0, 0);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  // Insulator blobs (3 per pole, on crossarm ends + centre)
  const insulatorPositions = useMemo(() => {
    const out: [number, number, number][] = [];
    positions.forEach(([x, , z]) => {
      out.push([x - 1.1, POLE_HEIGHT, z]);
      out.push([x,       POLE_HEIGHT, z]);
      out.push([x + 1.1, POLE_HEIGHT, z]);
    });
    return out;
  }, [positions]);

  const insulatorRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    insulatorPositions.forEach(([ix, iy, iz], i) => {
      tempObj.position.set(ix, iy, iz);
      tempObj.scale.setScalar(1);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [insulatorPositions]);

  return (
    <group>
      {/* Pole shafts */}
      <instancedMesh ref={initRef} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, POLE_HEIGHT, 6]} />
        <meshStandardMaterial color="#5a4020" roughness={0.95} metalness={0} />
      </instancedMesh>

      {/* Crossarms */}
      <instancedMesh ref={initCrossRef} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[2.4, 0.12, 0.12]} />
        <meshStandardMaterial color="#4a3518" roughness={0.9} metalness={0} />
      </instancedMesh>

      {/* Insulator stubs */}
      <instancedMesh ref={insulatorRef} args={[undefined, undefined, insulatorPositions.length]} castShadow>
        <cylinderGeometry args={[0.06, 0.04, 0.25, 5]} />
        <meshStandardMaterial color="#c8b060" roughness={0.7} metalness={0.1} />
      </instancedMesh>
    </group>
  );
}
