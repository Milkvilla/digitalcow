import { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { useStore } from 'zustand'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, BrightnessContrast, HueSaturation, N8AO } from '@react-three/postprocessing'
import type { EngineEvent } from '../engine/types.ts'
import {
  CAMERA_POSITION,
  CAMERA_FOV,
  CAMERA_LOOK_AT,
  SIM_TICK,
  MAX_SUBSTEPS_PER_FRAME,
  SCENE_LAYOUT,
} from '../engine/constants.ts'
import { getSunPosition } from '../engine/time.ts'
import { getTimePalette } from '../engine/palette.ts'
import { useGameStore, gameStore } from '../ui/hooks.ts'
import { audioEngine } from '../audio/sounds.ts'
import { profilerStore, type ProfilerState } from '../ui/profiler-store.ts'

import SkyScene from './Sky.tsx'
import Ground from './Ground.tsx'
import Grass from './Grass.tsx'
import Trees from './Trees.tsx'
import Cow from './Cow.tsx'
import Barn from './Barn.tsx'
import Pond from './Pond.tsx'
import Fences from './Fences.tsx'
import Particles from './Particles.tsx'
import FoodItems from './Food.tsx'
import Clouds from './Clouds.tsx'
import Decorations from './Decorations.tsx'
import Creatures from './Creatures.tsx'
import Horizon from './Horizon.tsx'
import Windmill from './Windmill.tsx'
import HayBales from './HayBales.tsx'
import WaterWell from './WaterWell.tsx'
import StonePath from './StonePath.tsx'
import Scarecrow from './Scarecrow.tsx'
import Chickens from './Chickens.tsx'
import Ducks from './Ducks.tsx'
import FarmDog from './FarmDog.tsx'
import FlowerPatches from './FlowerPatches.tsx'
import BirdsOverhead from './BirdsOverhead.tsx'
import Fireflies from './Fireflies.tsx'
import CloudShadows from './CloudShadows.tsx'
import MoodBubbles from './MoodBubbles.tsx'
import MilkSystem from './MilkSystem.tsx'
import VegetableGarden from './VegetableGarden.tsx'
import SeasonalEffects from './SeasonalEffects.tsx'

function useProfiler<T>(selector: (s: ProfilerState) => T): T {
  return useStore(profilerStore, selector)
}

// ── Dynamic fog updater (palette-driven) ────────────────

function DynamicFog({ timeOfDay }: { timeOfDay: number }) {
  const { scene } = useThree()

  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    if (scene.fog) {
      ;(scene.fog as THREE.Fog).color.setRGB(...palette.fogColor)
    }
  })

  return null
}

// ── Cinematic camera (slow orbit around cow) ─────────────
// Reads cow position directly from store each frame (no React re-render dependency)

function CinematicCamera() {
  const { camera } = useThree()
  const angleRef = useRef(0)
  const timeRef = useRef(0)
  const initialized = useRef(false)
  // Persistent vectors — no allocations per frame
  const smoothTarget = useRef(new THREE.Vector3())
  const smoothCamPos = useRef(new THREE.Vector3())
  const _desiredTarget = useRef(new THREE.Vector3())
  const _desiredCamPos = useRef(new THREE.Vector3())

  useFrame((_state, delta) => {
    // Read cow position directly from store — avoids stale closure from React renders
    const cowPos = gameStore.getState().cow.position

    if (!initialized.current) {
      smoothTarget.current.set(cowPos[0], 0.6, cowPos[2])
      smoothCamPos.current.set(
        cowPos[0] + Math.cos(0) * 21,
        0.6 + 5.5,
        cowPos[2] + Math.sin(0) * 21,
      )
      initialized.current = true
    }

    timeRef.current += delta
    const t = timeRef.current

    // ── Desired look-at target (cow position, smoothed) ──
    _desiredTarget.current.set(cowPos[0], 0.6, cowPos[2])
    smoothTarget.current.lerp(_desiredTarget.current, 1 - Math.exp(-0.6 * delta))

    // ── Orbit parameters — all change very slowly ──
    angleRef.current += delta * 0.04            // ~157s full orbit
    const radius = 21 + Math.sin(t * 0.025) * 9   // 12–30, ~251s cycle
    const height = 9 + Math.sin(t * 0.035 + 1.2) * 6  // 3–15, ~180s cycle

    // ── Desired camera position ──
    _desiredCamPos.current.set(
      smoothTarget.current.x + Math.cos(angleRef.current) * radius,
      smoothTarget.current.y + height,
      smoothTarget.current.z + Math.sin(angleRef.current) * radius,
    )

    // ── Heavy exponential smoothing on camera position ──
    // 0.3 → ~3.3s to reach 63% of target — very buttery
    smoothCamPos.current.lerp(_desiredCamPos.current, 1 - Math.exp(-0.3 * delta))

    camera.position.copy(smoothCamPos.current)
    camera.lookAt(smoothTarget.current)
  })

  return null
}

// ── Shared layout constants ──────────────────────────────

const POND_POS = SCENE_LAYOUT.pond.position
const POND_R = SCENE_LAYOUT.pond.radius

// ── First-person camera (cow's eye view, WASD writes intent to store) ──

function FirstPersonCamera() {
  const { camera } = useThree()
  const initialized = useRef(false)
  const smoothPos = useRef(new THREE.Vector3())
  const smoothLookAt = useRef(new THREE.Vector3())
  const _desiredPos = useRef(new THREE.Vector3())
  const _desiredLookAt = useRef(new THREE.Vector3())
  const keys = useRef({ w: false, a: false, s: false, d: false, shift: false })
  const bobPhase = useRef(0)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'w' || k === 'arrowup') keys.current.w = true
      if (k === 'a' || k === 'arrowleft') keys.current.a = true
      if (k === 's' || k === 'arrowdown') keys.current.s = true
      if (k === 'd' || k === 'arrowright') keys.current.d = true
      if (k === 'shift') keys.current.shift = true
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'w' || k === 'arrowup') keys.current.w = false
      if (k === 'a' || k === 'arrowleft') keys.current.a = false
      if (k === 's' || k === 'arrowdown') keys.current.s = false
      if (k === 'd' || k === 'arrowright') keys.current.d = false
      if (k === 'shift') keys.current.shift = false
    }
    const blur = () => { keys.current = { w: false, a: false, s: false, d: false, shift: false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Clear intent when unmounting (switching away from first-person)
  useEffect(() => {
    return () => { gameStore.getState().setFirstPersonIntent(null) }
  }, [])

  useFrame((_state, delta) => {
    // Write movement intent to store — the engine tick consumes it
    const { w, a, s, d, shift } = keys.current
    const playerMoving = w || s || a || d

    if (playerMoving) {
      let forward = 0
      let turn = 0
      if (w) forward += 1
      if (s) forward -= 0.5
      if (a) turn += 1
      if (d) turn -= 1
      gameStore.getState().setFirstPersonIntent({ forward, turn, sprint: shift })
    } else {
      // Clear intent when no keys pressed
      if (gameStore.getState().firstPersonIntent !== null) {
        gameStore.getState().setFirstPersonIntent(null)
      }
    }

    // Read authoritative state (already updated by tick)
    const cow = gameStore.getState().cow
    const cx = cow.position[0]
    const cz = cow.position[2]
    const angle = cow.facingAngle
    const bh = cow.behavior

    // ── Behavior-dependent head offsets (mirrors Cow.tsx animations) ──
    const eyeHeight = 0.8 + cow.age * 0.8
    const simTime = gameStore.getState().world.simulationTime
    const actT = simTime - cow.activityStartedAt

    let eyeDrop = 0
    let lookDist = 15
    let lookY = eyeHeight * 0.55

    if (bh === 'eating') {
      const cycle = actT % 5
      let lowered: number
      if (cycle < 1) { const p = cycle; lowered = p * (2 - p) }           // reach down
      else if (cycle < 2) { lowered = 1.0 }                                // bite
      else if (cycle < 3.8) { lowered = 0.55 }                             // chew (head partway up)
      else { lowered = 0.55 * Math.max(0, 1 - (cycle - 3.8) / 1.2) }     // lift
      eyeDrop = 0.35 * lowered
      lookDist = 3 + (1 - lowered) * 12
      lookY = 0.1 + (1 - lowered) * (eyeHeight * 0.55 - 0.1)
    } else if (bh === 'drinking') {
      const cycle = actT % 3
      const dip = cycle < 0.8 ? Math.sin((cycle / 0.8) * Math.PI) * 0.1 : 0
      eyeDrop = 0.40 + dip * 0.5
      lookDist = 2.5
      lookY = 0.05
    } else if (bh === 'grazing') {
      let lowered = 1.0
      const liftCycle = actT % 8
      if (liftCycle > 6.0 && liftCycle < 7.5) {
        lowered = 1 - Math.sin(((liftCycle - 6) / 1.5) * Math.PI)
      }
      eyeDrop = 0.30 * lowered
      lookDist = 2.5 + (1 - lowered) * 12.5
      lookY = 0.05 + (1 - lowered) * (eyeHeight * 0.55 - 0.05)
    } else if (bh === 'sleeping') {
      eyeDrop = 0.55
      lookDist = 3
      lookY = 0.2
    } else if (bh === 'settling') {
      const progress = Math.min(actT / 2, 1)
      eyeDrop = 0.55 * progress
      lookDist = 3 + (1 - progress) * 12
      lookY = 0.2 + (1 - progress) * (eyeHeight * 0.55 - 0.2)
    }

    // ── Walk bob (from AI walking or player walking) ──
    const isWalking = bh === 'walking' || bh === 'running' || playerMoving
    if (isWalking) {
      bobPhase.current += delta * (bh === 'running' || shift ? 12 : 8)
    } else {
      bobPhase.current *= Math.max(0, 1 - 5 * delta)
    }
    const bobY = isWalking ? Math.sin(bobPhase.current) * 0.05 : 0
    const bobX = isWalking ? Math.cos(bobPhase.current * 0.5) * 0.03 : 0

    // ── Idle breathing ──
    const breatheY = Math.sin(simTime * 1.5) * 0.012
    const breatheX = Math.sin(simTime * 0.6) * 0.006

    // ── Assemble camera position ──
    const fwd = 1.2 + cow.age * 0.5
    _desiredPos.current.set(
      cx + Math.sin(angle) * fwd + bobX + breatheX,
      eyeHeight - eyeDrop + bobY + breatheY,
      cz + Math.cos(angle) * fwd,
    )

    _desiredLookAt.current.set(
      cx + Math.sin(angle) * lookDist,
      lookY + bobY * 0.3,
      cz + Math.cos(angle) * lookDist,
    )

    if (!initialized.current) {
      smoothPos.current.copy(_desiredPos.current)
      smoothLookAt.current.copy(_desiredLookAt.current)
      initialized.current = true
    }

    smoothPos.current.lerp(_desiredPos.current, 1 - Math.exp(-10 * delta))
    smoothLookAt.current.lerp(_desiredLookAt.current, 1 - Math.exp(-8 * delta))

    camera.position.copy(smoothPos.current)
    camera.lookAt(smoothLookAt.current)
  })

  return null
}

// ── Dense grass patch near pond ──────────────────────────

const GP_CENTER: [number, number, number] = [1, 0, -8]
const GP_HALF_X = 4.5
const GP_HALF_Z = 2.5

const POND_MARGIN = 0.8  // gap between pond edge and grass

function inGrassPatch(x: number, z: number): boolean {
  // Exclude anything near the pond
  const dxP = x - POND_POS[0]
  const dzP = z - POND_POS[2]
  if (dxP * dxP + dzP * dzP < (POND_R + POND_MARGIN) * (POND_R + POND_MARGIN)) return false

  const lx = (x - GP_CENTER[0]) / GP_HALF_X
  const lz = (z - GP_CENTER[2]) / GP_HALF_Z
  const noise = Math.sin(x * 3.7) * 0.12 + Math.cos(z * 4.3) * 0.10
  return (lx * lx + lz * lz * lz * lz) < (1.0 + noise)
}

function GrassPatch() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const { count, matrices, colors } = useMemo(() => {
    const colorOptions = ['#1e6b14', '#2d7a1e', '#3a9928', '#256b18', '#1a5510', '#48ad35', '#327822']
    const dummy = new THREE.Object3D()
    const tempMatrices: THREE.Matrix4[] = []
    const tempColors: THREE.Color[] = []
    let placed = 0
    for (let i = 0; i < 5000 && placed < 900; i++) {
      const x = GP_CENTER[0] + (Math.random() * 2 - 1) * (GP_HALF_X + 0.3)
      const z = GP_CENTER[2] + (Math.random() * 2 - 1) * (GP_HALF_Z + 0.3)
      if (!inGrassPatch(x, z)) continue
      const h = 0.18 + Math.random() * 0.35
      const w = 0.04 + Math.random() * 0.04
      dummy.position.set(x, h / 2, z)
      dummy.rotation.set(0, Math.random() * Math.PI, 0)
      dummy.scale.set(w, h, 1)
      dummy.updateMatrix()
      tempMatrices.push(dummy.matrix.clone())
      tempColors.push(new THREE.Color(colorOptions[Math.floor(Math.random() * colorOptions.length)]))
      placed++
    }
    return { count: placed, matrices: tempMatrices, colors: tempColors }
  }, [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    for (let i = 0; i < count; i++) {
      meshRef.current.setMatrixAt(i, matrices[i])
      meshRef.current.setColorAt(i, colors[i])
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [count, matrices, colors])

  return (
    <group>
      {/* Ground — overlapping irregular shapes */}
      <mesh position={[1, 0.005, -8]} rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[8.0, 4.5, 1, 1]} />
        <meshStandardMaterial color="#1f5c12" />
      </mesh>
      <mesh position={[2.5, 0.004, -7.4]} rotation={[-Math.PI / 2, 0, -0.2]}>
        <planeGeometry args={[5.0, 3.5, 1, 1]} />
        <meshStandardMaterial color="#236814" />
      </mesh>
      <mesh position={[-1.5, 0.003, -8.6]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <planeGeometry args={[4.0, 3.0, 1, 1]} />
        <meshStandardMaterial color="#1a5510" />
      </mesh>
      {/* All 900 grass blades in a single instanced draw call */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

// ── Rain particle system ─────────────────────────────────

function Rain({ intensity }: { intensity: number }) {
  const count = Math.floor(800 + intensity * 2200)  // 800–3000 drops
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50
      pos[i * 3 + 1] = Math.random() * 25
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50
      vel[i] = 12 + Math.random() * 8 + intensity * 10  // fall speed
    }
    return { positions: pos, velocities: vel }
  }, [count, intensity])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= velocities[i] * delta
      // Reset to top when hitting ground
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3] = (Math.random() - 0.5) * 50
        positions[i * 3 + 1] = 20 + Math.random() * 5
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50
      }
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.003, 0.003, 0.25 + intensity * 0.15, 3]} />
      <meshBasicMaterial color="#a8c4d8" transparent opacity={0.4 + intensity * 0.2} />
    </instancedMesh>
  )
}

// ── Renderer stats reporter (inside Canvas) ──────────────

function RendererStats() {
  const frameCount = useRef(0)

  useFrame(({ gl }) => {
    // Report every 30 frames to avoid spamming store updates
    frameCount.current++
    if (frameCount.current % 30 !== 0) return

    const info = gl.info
    profilerStore.getState().setStats({
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    })
  })

  return null
}

// ── Inner scene (runs inside Canvas) ─────────────────────

function Scene() {
  const timeOfDay = useGameStore((s) => s.world.timeOfDay)
  const timeSpeed = useGameStore((s) => s.world.timeSpeed)
  const isPaused = useGameStore((s) => s.world.isPaused)
  const windStrength = useGameStore((s) => s.world.windStrength)
  const cowPosition = useGameStore((s) => s.cow.position)
  const cowBehavior = useGameStore((s) => s.cow.behavior)
  const foods = useGameStore((s) => s.world.foods)
  const showButterflies = useGameStore((s) => s.world.showButterflies)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const rain = useGameStore((s) => s.rain)
  const rainIntensity = useGameStore((s) => s.rainIntensity)

  // Profiler toggles
  const profilerEnabled = useProfiler((s) => s.enabled)
  const t = useProfiler((s) => s.toggles)

  const eventsRef = useRef<EngineEvent[]>([])

  const sunPosition = getSunPosition(timeOfDay)

  // Init audio on first user click
  useEffect(() => {
    const initAudio = () => {
      audioEngine.init()
      window.removeEventListener('click', initAudio)
    }
    window.addEventListener('click', initAudio)
    return () => window.removeEventListener('click', initAudio)
  }, [])

  // Update wind volume
  useEffect(() => {
    audioEngine.setWindVolume(windStrength)
  }, [windStrength])

  // Update ambient sounds for time of day
  useEffect(() => {
    audioEngine.setAmbientForTime(timeOfDay)
  }, [Math.floor(timeOfDay)])

  // Simulation tick loop
  useFrame((_state, delta) => {
    if (isPaused) return

    const simDeltaTarget = delta * timeSpeed
    const substeps = Math.min(
      Math.ceil(simDeltaTarget / SIM_TICK),
      MAX_SUBSTEPS_PER_FRAME,
    )

    for (let i = 0; i < substeps; i++) {
      gameStore.getState().tick(SIM_TICK)
    }

    const state = gameStore.getState()
    eventsRef.current = state.events
    if (state.events.length > 0) {
      audioEngine.processEvents(state.events)
      state.flushEvents()
    }
  })

  return (
    <>
      <DynamicFog timeOfDay={timeOfDay} />
      {profilerEnabled && <RendererStats />}
      {t.sky && <SkyScene sunPosition={sunPosition} timeOfDay={timeOfDay} visible />}
      {t.clouds && <Clouds timeOfDay={timeOfDay} />}
      {t.horizon && <Horizon timeOfDay={timeOfDay} sunPosition={sunPosition} />}
      {t.ground && <Ground />}
      {t.grass && <Grass />}
      {t.decorations && <Decorations />}
      {t.trees && <Trees />}
      {t.cow && cameraMode !== 'firstPerson' && <Cow />}
      {t.grassPatch && <GrassPatch />}
      {t.barn && <Barn timeOfDay={timeOfDay} />}
      {t.pond && <Pond timeOfDay={timeOfDay} sunPosition={sunPosition} rain={rain} rainIntensity={rainIntensity} />}
      {t.fences && <Fences />}
      {t.food && <FoodItems foods={foods} />}
      {t.creatures && <Creatures timeOfDay={timeOfDay} showButterflies={showButterflies} />}
      {t.windmill && <Windmill />}
      {t.hayBales && <HayBales />}
      {t.waterWell && <WaterWell />}
      {t.stonePath && <StonePath />}
      {t.scarecrow && <Scarecrow />}
      {t.chickens && <Chickens />}
      {t.ducks && <Ducks />}
      {t.farmDog && <FarmDog />}
      {t.flowerPatches && <FlowerPatches />}
      {t.birdsOverhead && <BirdsOverhead />}
      {t.fireflies && <Fireflies timeOfDay={timeOfDay} />}
      {t.cloudShadows && <CloudShadows />}
      {t.moodBubbles && <MoodBubbles />}
      {t.milkSystem && <MilkSystem />}
      {t.vegetableGarden && <VegetableGarden />}
      {t.seasonalEffects && <SeasonalEffects />}
      {cameraMode === 'cinematic' && <CinematicCamera />}
      {cameraMode === 'firstPerson' && <FirstPersonCamera />}
      {rain && t.rain && <Rain intensity={rainIntensity} />}
      {t.particles && (
        <Particles
          events={eventsRef.current}
          cowPosition={cowPosition}
          cowBehavior={cowBehavior}
        />
      )}

      {/* Post-processing */}
      {t.postProcessing && (
        <EffectComposer multisampling={0}>
          <N8AO
            aoRadius={2.5}
            intensity={1.2}
            distanceFalloff={0.8}
            color="#2a1a08"
            halfRes
          />
          <Bloom
            luminanceThreshold={0.7}
            luminanceSmoothing={0.8}
            intensity={0.4}
            mipmapBlur
            levels={4}
            width={384}
            height={384}
          />
          <BrightnessContrast brightness={0.02} contrast={0.08} />
          <HueSaturation saturation={0.08} />
          <Vignette eskil={false} offset={0.12} darkness={0.4} />
        </EffectComposer>
      )}
    </>
  )
}

// ── Main export ─────────────────────────────────────────

function OrbitControlsWrapper() {
  const cameraMode = useGameStore((s) => s.cameraMode)
  if (cameraMode !== 'manual') return null
  return (
    <OrbitControls
      target={CAMERA_LOOK_AT}
      minPolarAngle={Math.PI * 0.15}
      maxPolarAngle={Math.PI * 0.45}
      minDistance={10}
      maxDistance={30}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
    />
  )
}

export function FarmScene() {
  const profilerEnabled = useProfiler((s) => s.enabled)
  const initialFogColor = useMemo(() => {
    const p = getTimePalette(8)
    return new THREE.Color(...p.fogColor)
  }, [])

  return (
    <Canvas
      shadows
      camera={{
        position: CAMERA_POSITION,
        fov: CAMERA_FOV,
        near: 0.1,
        far: 500,
      }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      style={{ width: '100%', height: '100%' }}
    >
      <fog attach="fog" args={[initialFogColor, 25, 85]} />

      <OrbitControlsWrapper />

      <Scene />

      {profilerEnabled && <Stats />}
    </Canvas>
  )
}

export default FarmScene
