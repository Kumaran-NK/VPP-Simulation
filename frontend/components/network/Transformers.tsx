'use client';

/**
 * Transformers.tsx
 * Three realistic pad-mount distribution transformers (A, B, C).
 * Each has: metal enclosure, cooling fins, HV bushing, LV service head, concrete pad.
 */

import React from 'react';
import { Text } from '@react-three/drei';
import type { InfraNode } from '@/lib/topology';

function PadMountTransformer({ label }: { label: string }) {
  return (
    <group>
      {/* Concrete pad */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[2.8, 2.2]} />
        <meshStandardMaterial color="#606268" roughness={0.95} />
      </mesh>

      {/* Main enclosure */}
      <mesh castShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[2.2, 1.8, 1.6]} />
        <meshStandardMaterial color="#2a3540" roughness={0.6} metalness={0.55} />
      </mesh>

      {/* Access panel on front */}
      <mesh position={[0, 0.9, 0.82]}>
        <boxGeometry args={[1.6, 1.2, 0.05]} />
        <meshStandardMaterial color="#222c38" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Cooling fins (left side) */}
      {[-0.4, -0.1, 0.2, 0.5].map((fz, i) => (
        <mesh key={i} castShadow position={[-1.15, 0.9, fz]}>
          <boxGeometry args={[0.05, 1.2, 0.18]} />
          <meshStandardMaterial color="#3a4a5a" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}

      {/* HV bushing (top) */}
      <mesh castShadow position={[0.4, 1.95, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.55, 7]} />
        <meshStandardMaterial color="#c8b060" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* LV service head (front top) */}
      <mesh castShadow position={[-0.4, 2.0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.3, 6]} />
        <meshStandardMaterial color="#3a4a5a" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Label — visible from medium distance */}
      <Text
        position={[0, 2.6, 0]}
        fontSize={0.3}
        color="#8A93A3"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

export default function Transformers({
  nodes,
}: {
  nodes: InfraNode[];
}) {
  const transformers = nodes.filter((n) => n.type === 'transformer');

  return (
    <>
      {transformers.map((t) => (
        <group key={t.id} position={t.position}>
          <PadMountTransformer label={t.label} />
        </group>
      ))}
    </>
  );
}
