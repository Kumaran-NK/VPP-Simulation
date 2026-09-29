'use client';

/**
 * WeatherEnvironment.tsx
 * Realistic sky, sun, clouds, and ambient lighting driven by backend state.
 * Uses @react-three/drei's Sky component (already installed).
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/hooks/useSimulationStore';

// ── Cloud Group ────────────────────────────────────────────
interface CloudProps {
  position: [number, number, number];
  scale: number;
  speed: number;
}

function CloudGroup({ position, scale, speed }: CloudProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startX = position[0];

  useFrame((state) => {
    if (!groupRef.current) return;
    // Slow drift westward
    groupRef.current.position.x = startX + (state.clock.elapsedTime * speed * 0.8) % 80 - 40;
  });

  const puffs = useMemo<[number, number, number, number][]>(() => [
    [0, 0, 0, 1.0],
    [3.5, 1, 0, 0.85],
    [-3, 0.5, 0, 0.75],
    [6, -0.5, 1, 0.7],
    [-5, -0.5, -1, 0.65],
  ], []);

  return (
    <group ref={groupRef} position={position}>
      {puffs.map(([px, py, pz, ps], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[scale * ps, 10, 8]} />
          <meshStandardMaterial
            color="#e8eef4"
            transparent
            opacity={0.72}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Dynamic Lighting ───────────────────────────────────────
export function DynamicLighting() {
  const sunIntensity = useSimulationStore((s) => s.sunIntensity);
  const sunAngle = useSimulationStore((s) => s.sunAngle);
  const weather = useSimulationStore((s) => s.weather);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  const isNight = sunAngle < 8 || sunAngle > 172 || sunIntensity < 0.05;

  // Sun arc: 0° = east horizon, 90° = zenith, 180° = west horizon
  const theta = (sunAngle / 180) * Math.PI;
  const sunX = -Math.cos(theta) * 80;
  const sunY = Math.sin(theta) * 60 + 5;
  const sunZ = -60;

  // Weather dims the sun
  const weatherDim =
    weather === 'storm' ? 0.05 :
    weather === 'cloudy_disruption' ? 0.2 :
    weather === 'partly_cloudy' ? 0.65 : 1.0;

  const sunBrightness = isNight ? 0 : sunIntensity * weatherDim;

  // Sunset warm colour
  const isSunset = sunAngle > 150 || sunAngle < 20;
  const sunColor = isSunset ? '#ffaa55' : sunIntensity > 0.5 ? '#fff8e7' : '#c8d8ee';
  const ambientColor = isNight ? '#0a0d1f' : isSunset ? '#ff8844' : '#7899cc';
  const ambientIntensity = isNight ? 0.04 : 0.08 + sunIntensity * 0.28 * weatherDim;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <hemisphereLight
        args={['#6699cc', '#2a4a1a', isNight ? 0.02 : 0.12 + sunIntensity * 0.1]}
      />
      <directionalLight
        ref={dirRef}
        position={[sunX, sunY, sunZ]}
        intensity={sunBrightness * 1.2}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-bias={-0.001}
      />
      {/* Night fill light — very dim blue from above */}
      {isNight && <pointLight position={[0, 50, 0]} intensity={0.06} color="#1a2a5a" />}
    </>
  );
}

// ── Main Weather Environment ──────────────────────────────
export default function WeatherEnvironment() {
  const sunIntensity = useSimulationStore((s) => s.sunIntensity);
  const sunAngle = useSimulationStore((s) => s.sunAngle);
  const weather = useSimulationStore((s) => s.weather);

  const isNight = sunAngle < 8 || sunAngle > 172 || sunIntensity < 0.05;

  // Sun position for drei Sky
  const theta = (sunAngle / 180) * Math.PI;
  const sunX = -Math.cos(theta) * 1;
  const sunY = Math.sin(theta) * 0.8;
  const sunZ = -0.8;

  // Sky parameters by weather
  const skyParams = useMemo(() => {
    if (isNight) return { turbidity: 0.1, rayleigh: 0.1, mieCoefficient: 0.001, mieDirectionalG: 0.8 };
    switch (weather) {
      case 'storm':            return { turbidity: 25, rayleigh: 4, mieCoefficient: 0.04, mieDirectionalG: 0.6 };
      case 'cloudy_disruption':return { turbidity: 15, rayleigh: 3, mieCoefficient: 0.02, mieDirectionalG: 0.7 };
      case 'partly_cloudy':    return { turbidity: 6,  rayleigh: 2, mieCoefficient: 0.01, mieDirectionalG: 0.8 };
      default:                 return { turbidity: 2,  rayleigh: 1, mieCoefficient: 0.005, mieDirectionalG: 0.85 };
    }
  }, [weather, isNight]);

  // Cloud density by weather
  const cloudCount =
    weather === 'storm' ? 8 :
    weather === 'cloudy_disruption' ? 6 :
    weather === 'partly_cloudy' ? 4 : 0;

  const cloudScale =
    weather === 'storm' ? 8 :
    weather === 'cloudy_disruption' ? 6 : 4;

  // Fixed cloud positions (random-looking but deterministic)
  const cloudDefs: CloudProps[] = useMemo(() => [
    { position: [-50, 38, -40] as [number,number,number], scale: cloudScale * 1.0, speed: 0.15 },
    { position: [ 20, 42, -60] as [number,number,number], scale: cloudScale * 0.8, speed: 0.12 },
    { position: [-10, 35, -20] as [number,number,number], scale: cloudScale * 1.2, speed: 0.18 },
    { position: [ 55, 40, -50] as [number,number,number], scale: cloudScale * 0.9, speed: 0.10 },
    { position: [-35, 36, -55] as [number,number,number], scale: cloudScale * 0.7, speed: 0.14 },
    { position: [ 10, 44, -70] as [number,number,number], scale: cloudScale * 1.1, speed: 0.11 },
    { position: [-60, 39, -35] as [number,number,number], scale: cloudScale * 0.75, speed: 0.16 },
    { position: [ 40, 37, -30] as [number,number,number], scale: cloudScale * 0.85, speed: 0.13 },
  ], [cloudScale]);

  // Night sky — stars (static points)
  const starGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 0; i < 600; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta2 = Math.random() * Math.PI * 2;
      const r = 150;
      verts.push(
        r * Math.sin(phi) * Math.cos(theta2),
        r * Math.abs(Math.cos(phi)) + 30,
        r * Math.sin(phi) * Math.sin(theta2),
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  const starMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: '#ffffff', size: 0.4, sizeAttenuation: true }),
    [],
  );

  return (
    <>
      {/* Sky (not rendered at night to avoid bright horizon) */}
      {!isNight && (
        <Sky
          sunPosition={[sunX, sunY, sunZ]}
          turbidity={skyParams.turbidity}
          rayleigh={skyParams.rayleigh}
          mieCoefficient={skyParams.mieCoefficient}
          mieDirectionalG={skyParams.mieDirectionalG}
          distance={500}
        />
      )}

      {/* Night sky background */}
      {isNight && (
        <mesh>
          <sphereGeometry args={[180, 32, 32]} />
          <meshBasicMaterial color="#020510" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Stars at night */}
      {isNight && <points geometry={starGeometry} material={starMaterial} />}

      {/* Fog — matches weather */}
      {!isNight && weather === 'clear_sky' && (
        <fog attach="fog" args={['#c8d8f0', 80, 220]} />
      )}
      {!isNight && weather === 'partly_cloudy' && (
        <fog attach="fog" args={['#9aabb8', 60, 180]} />
      )}
      {(weather === 'cloudy_disruption' || weather === 'storm') && (
        <fog attach="fog" args={['#4a5560', 40, 130]} />
      )}
      {isNight && <fog attach="fog" args={['#010308', 50, 160]} />}

      {/* Clouds */}
      {cloudDefs.slice(0, cloudCount).map((c, i) => (
        <CloudGroup key={i} {...c} />
      ))}
    </>
  );
}
