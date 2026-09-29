'use client';

/**
 * EnergyFlows.tsx — Directional energy particle streams.
 *
 * One InstancedMesh for ALL particles across all active flows.
 * Particles travel along waypoint paths derived from topology edges + feeders.
 * Direction, speed, colour, and density all driven by real backend state.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Topology } from '@/lib/topology';
import type { Flow } from '@/lib/powerFlows';
import { useUIStore } from '@/hooks/useSimulationStore';


const tempObj = new THREE.Object3D();
const tempColor = new THREE.Color();

const MAX_PARTICLES_PER_FLOW = 12;
const FEEDER_PARTICLES = 5;

// Build particles for infra-level flows
interface ParticleStream {
  waypoints: THREE.Vector3[];
  color: number;
  intensity: number;
  speed: number;
  count: number;
  seeds: number[];
}

function buildInfraStreams(
  flows: Flow[],
  topology: Topology,
): ParticleStream[] {
  const posMap = new Map<string, [number, number, number]>();
  for (const node of topology.infra) {
    posMap.set(node.id, node.position);
  }

  const streams: ParticleStream[] = [];

  for (const flow of flows) {
    if (flow.powerMW < 0.003) continue;

    // Find waypoints from edges
    const edge = topology.edges.find(
      (e) => e.from === flow.from && e.to === flow.to,
    ) || topology.edges.find(
      (e) => e.from === flow.to && e.to === flow.from,
    );

    let wpts: THREE.Vector3[];
    if (edge && edge.waypoints.length >= 2) {
      const pts = edge.waypoints.map((wp) => new THREE.Vector3(...wp));
      wpts = flow.from === edge.to ? [...pts].reverse() : pts;
    } else {
      const fromPos = posMap.get(flow.from);
      const toPos = posMap.get(flow.to);
      if (!fromPos || !toPos) continue;
      wpts = [new THREE.Vector3(...fromPos), new THREE.Vector3(...toPos)];
    }

    // Lift particles above ground
    wpts = wpts.map((v) => new THREE.Vector3(v.x, v.y + 7.0, v.z));

    const particleCount = Math.max(3, Math.round(flow.intensity * MAX_PARTICLES_PER_FLOW));
    const speed = 0.3 + flow.intensity * 0.7;

    streams.push({
      waypoints: wpts,
      color: parseInt(flow.color.replace('#', ''), 16),
      intensity: flow.intensity,
      speed,
      count: particleCount,
      seeds: Array.from({ length: particleCount }, (_, i) => i / particleCount),
    });
  }

  return streams;
}

// Interpolate along waypoints at t=0..1
function interpolateWaypoints(
  waypoints: THREE.Vector3[],
  t: number,
  out: THREE.Vector3,
): void {
  if (waypoints.length === 1) { out.copy(waypoints[0]); return; }
  const total = waypoints.length - 1;
  const scaled = t * total;
  const idx = Math.min(Math.floor(scaled), total - 1);
  const frac = scaled - idx;
  out.lerpVectors(waypoints[idx], waypoints[idx + 1], frac);
}

export default function EnergyFlows({
  topology,
  flows,
}: {
  topology: Topology;
  flows: Flow[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lodLevel = useUIStore((s) => s.lodLevel);

  // Build infra streams
  const infraStreams = useMemo(
    () => buildInfraStreams(flows, topology),
    [flows, topology],
  );

  // Build feeder streams (substation → transformer → houses)
  const feederStreams = useMemo<ParticleStream[]>(() => {
    if (flows.length === 0) return [];
    const streams: ParticleStream[] = [];

    for (const feeder of topology.feeders) {
      const tPos = new THREE.Vector3(...feeder.transformerPos).setY(7.0);
      const substPos = new THREE.Vector3(0, 7.0, -62);

      streams.push({
        waypoints: [substPos, tPos],
        color: 0x22d3ee,
        intensity: 0.35,
        speed: 0.4,
        count: FEEDER_PARTICLES,
        seeds: Array.from({ length: FEEDER_PARTICLES }, (_, i) => i / FEEDER_PARTICLES),
      });
    }
    return streams;
  }, [topology.feeders, flows.length]);

  // All streams
  const allStreams = useMemo(
    () => [...infraStreams, ...(lodLevel >= 0 ? feederStreams : [])],
    [infraStreams, feederStreams, lodLevel],
  );

  const totalParticles = allStreams.reduce((s, st) => s + st.count, 0);
  const maxParticles = Math.max(totalParticles, 8);

  useFrame((state) => {
    if (!meshRef.current || totalParticles === 0) return;

    const time = state.clock.elapsedTime;
    let idx = 0;

    for (const stream of allStreams) {
      for (const seed of stream.seeds) {
        const t = ((time * stream.speed + seed) % 1);

        interpolateWaypoints(stream.waypoints, t, tempObj.position);
        // Small perpendicular wobble
        tempObj.position.y += Math.sin(t * Math.PI * 3 + time * 2) * 0.12;

        const scale = 0.05 + Math.sin(t * Math.PI) * 0.04;
        tempObj.scale.setScalar(scale);
        tempObj.updateMatrix();

        meshRef.current!.setMatrixAt(idx, tempObj.matrix);
        tempColor.set(stream.color);
        meshRef.current!.setColorAt(idx, tempColor);
        idx++;
      }
    }

    // Hide unused
    for (; idx < meshRef.current.count; idx++) {
      tempObj.position.set(0, -200, 0);
      tempObj.scale.setScalar(0);
      tempObj.updateMatrix();
      meshRef.current!.setMatrixAt(idx, tempObj.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (totalParticles === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxParticles]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}


