'use client';

/**
 * PowerNetwork3D.tsx — Main 3D scene host.
 *
 * Assembles:
 *   WeatherEnvironment (sky, clouds, stars, fog)
 *   DynamicLighting (sun-driven directional + ambient)
 *   Terrain (grass, roads, driveways)
 *   Trees, StreetLights, UtilityPoles, PowerLines
 *   SolarFarm, BatteryStorage, Substation, Transformers, GridPylon
 *   HouseField (100 houses, 6 variants, rooftop solar, EV markers)
 *   EnergyFlows (particle streams)
 *   NetworkOverlay (HTML overlays)
 *   HouseInspector (selected house panel)
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore, useUIStore } from '@/hooks/useSimulationStore';
import { getTopology } from '@/lib/topology';
import { deriveFlows } from '@/lib/powerFlows';

// Environment
import WeatherEnvironment, { DynamicLighting } from './WeatherEnvironment';
import Terrain from './Terrain';
import Trees from './Trees';
import StreetLights from './StreetLights';
import UtilityPoles from './UtilityPoles';
import PowerLines from './PowerLines';

// Infrastructure
import SolarFarm from './SolarFarm';
import BatteryStorage from './BatteryStorage';
import Substation from './Substation';
import Transformers from './Transformers';
import GridPylon from './GridPylon';

// Houses & flows
import HouseField from './HouseField';
import EnergyFlows from './EnergyFlows';

// HTML overlays
import HouseInspector from './HouseInspector';
import NetworkOverlay, { cameraTargets } from './NetworkOverlay';

// ── Camera Preset Controller ──────────────────────────────
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lerpPos = new THREE.Vector3();
const _lerpTarget = new THREE.Vector3();

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);
  const lerping = useRef(false);

  // Watch for selected house to fly to it
  const selectedHouseId = useUIStore((s) => s.selectedHouseId);
  const topology = useMemo(() => getTopology(), []);

  useEffect(() => {
    // Camera presets from overlay buttons
    const interval = setInterval(() => {
      if (cameraTargets.preset) {
        const { position, target } = cameraTargets.preset;
        targetPos.current = new THREE.Vector3(...position);
        targetLook.current = new THREE.Vector3(...target);
        lerping.current = true;
        cameraTargets.preset = null;
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedHouseId !== null) {
      const pos = topology.housePositions.get(selectedHouseId);
      if (pos) {
        targetPos.current = new THREE.Vector3(pos[0], 18, pos[2] + 18);
        targetLook.current = new THREE.Vector3(pos[0], 0, pos[2]);
        lerping.current = true;
      }
    }
  }, [selectedHouseId, topology]);

  useFrame(() => {
    if (!lerping.current || !targetPos.current || !targetLook.current) return;

    _lerpPos.lerp(targetPos.current, 0.07);
    _lerpTarget.lerp(targetLook.current, 0.07);

    camera.position.lerp(targetPos.current, 0.06);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.06);
      controlsRef.current.update();
    }

    // Stop when close enough
    if (camera.position.distanceTo(targetPos.current) < 0.5) {
      lerping.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      minDistance={10}
      maxDistance={180}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, 0, 10]}
    />
  );
}

// ── LOD Manager ──────────────────────────────────────────
function LODManager() {
  const { setLodLevel } = useUIStore();
  const prevLevel = useRef(0);

  useFrame(({ camera }) => {
    const dist = camera.position.length();
    let level = 0;
    if (dist < 35) level = 2;
    else if (dist < 70) level = 1;

    if (level !== prevLevel.current) {
      prevLevel.current = level;
      setLodLevel(level);
    }
  });

  return null;
}

// ── Scene Content ─────────────────────────────────────────
function SceneContent() {
  const topology = useMemo(() => getTopology(), []);

  const totalSolar = useSimulationStore((s) => s.totalSolar);
  const totalDemand = useSimulationStore((s) => s.totalDemand);
  const lastAction = useSimulationStore((s) => s.lastAction);
  const p2pFlowKw = useSimulationStore((s) => s.p2pFlowKw);
  const gridConnected = useSimulationStore((s) => s.gridConnected);

  const { flows } = useMemo(
    () => deriveFlows({ totalSolar, totalDemand, lastAction, p2pFlowKw, gridConnected }),
    [totalSolar, totalDemand, lastAction, p2pFlowKw, gridConnected],
  );

  return (
    <>
      {/* ── Environment ── */}
      <DynamicLighting />
      <WeatherEnvironment />

      {/* ── Ground & Roads ── */}
      <Terrain topology={topology} />

      {/* ── Vegetation & Street Furniture ── */}
      <Trees topology={topology} />
      <StreetLights topology={topology} />
      <UtilityPoles topology={topology} />

      {/* ── Electrical Wires ── */}
      <PowerLines topology={topology} />

      {/* ── Major Infrastructure ── */}
      <SolarFarm position={topology.infra.find(n => n.id === 'solar')!.position} />
      <BatteryStorage position={topology.infra.find(n => n.id === 'battery')!.position} />
      <Substation position={topology.infra.find(n => n.id === 'substation')!.position} />
      <Transformers nodes={topology.infra} />
      <GridPylon position={topology.infra.find(n => n.id === 'grid')!.position} />

      {/* ── 100 Houses ── */}
      <HouseField topology={topology} />

      {/* ── Energy Particle Flows ── */}
      <EnergyFlows topology={topology} flows={flows} />

      {/* ── Controls ── */}
      <CameraController />
      <LODManager />
    </>
  );
}

// ── Main Export ──────────────────────────────────────────
export default function PowerNetwork3D() {
  const selectedHouseId = useUIStore((s) => s.selectedHouseId);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <Canvas
        shadows
        camera={{ position: [0, 80, 95], fov: 45, near: 0.5, far: 500 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        dpr={[1, 1.5]}
      >
        <SceneContent />
      </Canvas>

      {/* HTML overlays */}
      <NetworkOverlay />
      {selectedHouseId !== null && <HouseInspector houseId={selectedHouseId} />}
    </div>
  );
}
