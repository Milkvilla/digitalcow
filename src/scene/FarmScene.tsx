import { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { useStore } from 'zustand'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, BrightnessContrast, HueSaturation, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { EngineEvent } from '../engine/types.ts'
import {
  CAMERA_POSITION,
  CAMERA_FOV,
  CAMERA_LOOK_AT,
  SIM_TICK,
  MAX_SUBSTEPS_PER_FRAME,
  SCENE_LAYOUT,
  SUNSET_HOUR,
  outdoorLightFactor,
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

// ── Cinematic camera — film-quality director system ────────────
//
// Design principles:
//   1. Camera ALWAYS keeps the cow visible — no shots behind structures
//   2. Positions are clamped inside the farm perimeter (no fog)
//   3. Every shot blends via dual smoothing (position + target) for buttery transitions
//   4. Shot variety: intimate portraits, sweeping vistas, dynamic tracking, and moody angles
//   5. Each shot picks a safe angle that avoids occlusion zones BEFORE computing position

// Farm bounds (inside fence perimeter with margin)
const FARM_MIN_X = -13, FARM_MAX_X = 13
const FARM_MIN_Z = -11, FARM_MAX_Z = 13

// Structures the camera must avoid
const OCCLUSION_ZONES = [
  { x: -10, z: 8, r: 7.5 },   // barn
  { x: 10,  z: 10, r: 3.5 },  // windmill
]

// Points of interest for scenic shots
const POI: [number, number, number][] = [
  [-10, 2.5, 8],   // barn
  [-8, 0.5, -5],   // pond
  [10, 3, 10],     // windmill
  [3, 0.5, 7],     // water well
  [0, 0.5, 0],     // farm center
  [4, 0.5, 3],     // scarecrow area
  [-12, 0.5, 6],   // hay bales
]

function clampToFarm(pos: THREE.Vector3): void {
  pos.x = Math.max(FARM_MIN_X, Math.min(FARM_MAX_X, pos.x))
  pos.z = Math.max(FARM_MIN_Z, Math.min(FARM_MAX_Z, pos.z))
  pos.y = Math.max(0.3, pos.y) // never below ground
}

// Check if a position is inside any occlusion zone
function isOccluded(x: number, z: number): boolean {
  for (const zone of OCCLUSION_ZONES) {
    const dx = x - zone.x, dz = z - zone.z
    if (dx * dx + dz * dz < zone.r * zone.r) return true
  }
  return false
}

// Check if line-of-sight from camera to target is blocked by an occlusion zone
function isLineOfSightBlocked(cx: number, cz: number, tx: number, tz: number): boolean {
  const lx = tx - cx, lz = tz - cz
  const len2 = lx * lx + lz * lz
  if (len2 < 0.01) return false
  for (const zone of OCCLUSION_ZONES) {
    const t = Math.max(0, Math.min(1, ((zone.x - cx) * lx + (zone.z - cz) * lz) / len2))
    if (t < 0.05 || t > 0.95) continue
    const px = cx + lx * t - zone.x
    const pz = cz + lz * t - zone.z
    if (px * px + pz * pz < zone.r * zone.r * 0.7) return true
  }
  return false
}

// Find a safe angle around the cow that avoids occlusion and line-of-sight blockage
function findSafeAngle(cowX: number, cowZ: number, preferredAngle: number, radius: number): number {
  // Try preferred angle first
  const testX = cowX + Math.cos(preferredAngle) * radius
  const testZ = cowZ + Math.sin(preferredAngle) * radius
  if (!isOccluded(testX, testZ) && !isLineOfSightBlocked(testX, testZ, cowX, cowZ)) {
    return preferredAngle
  }
  // Search in 30° increments, alternating left/right from preferred
  for (let i = 1; i <= 6; i++) {
    for (const sign of [1, -1]) {
      const angle = preferredAngle + sign * i * (Math.PI / 6)
      const ax = cowX + Math.cos(angle) * radius
      const az = cowZ + Math.sin(angle) * radius
      if (!isOccluded(ax, az) && !isLineOfSightBlocked(ax, az, cowX, cowZ)) {
        return angle
      }
    }
  }
  return preferredAngle + Math.PI // flip 180° as last resort
}

type ShotType = 'orbit' | 'tracking' | 'closeup' | 'crane' | 'lowAngle' | 'establishing' | 'dolly' | 'overShoulder' | 'scenic' | 'flyby'

interface ShotDef {
  type: ShotType
  duration: number
  fov: number
}

const SHOT_SEQUENCE: ShotDef[] = [
  { type: 'establishing', duration: 14,  fov: 50 },   // high wide farm overview
  { type: 'orbit',        duration: 18,  fov: 40 },   // wide slow orbit
  { type: 'scenic',       duration: 14,  fov: 46 },   // POI showcase → cow
  { type: 'crane',        duration: 16,  fov: 44 },   // crane sweep
  { type: 'establishing', duration: 16,  fov: 52 },   // ultra-wide panoramic
  { type: 'dolly',        duration: 14,  fov: 42 },   // wide dolly
  { type: 'orbit',        duration: 20,  fov: 42 },   // wide dreamy orbit
  { type: 'scenic',       duration: 13,  fov: 44 },   // scenic sweep
  { type: 'crane',        duration: 15,  fov: 46 },   // high crane
  { type: 'establishing', duration: 14,  fov: 48 },   // drifting wide shot
  { type: 'orbit',        duration: 16,  fov: 38 },   // medium orbit
  { type: 'dolly',        duration: 14,  fov: 40 },   // gentle dolly
  { type: 'scenic',       duration: 14,  fov: 44 },   // scenic reveal
  { type: 'crane',        duration: 16,  fov: 42 },   // crane down
]

function CinematicCamera() {
  const { camera } = useThree()
  const timeRef = useRef(0)
  const shotTimeRef = useRef(0)
  const shotIndexRef = useRef(0)
  const initialized = useRef(false)
  const prevCowDir = useRef(new THREE.Vector3(0, 0, 1))

  // Smooth interpolation state
  const smoothPos = useRef(new THREE.Vector3())
  const smoothTarget = useRef(new THREE.Vector3())
  const smoothFov = useRef(CAMERA_FOV)

  // Per-shot seeds
  const seed = useRef({
    angle: Math.random() * Math.PI * 2,
    safeAngle: 0,
    poiIdx: 0,
    side: 1,
    startRadius: 12,
    heightBias: 0,
  })

  const _pos = useRef(new THREE.Vector3())
  const _target = useRef(new THREE.Vector3())

  useFrame((_state, delta) => {
    const state = gameStore.getState()
    const cowPos = state.cow.position
    const cowFacing = state.cow.facingAngle
    const dt = Math.min(delta, 0.05)

    const cowWorld = new THREE.Vector3(cowPos[0], 0.6, cowPos[2])
    const cowDir = new THREE.Vector3(Math.sin(cowFacing), 0, Math.cos(cowFacing))
    prevCowDir.current.lerp(cowDir, 1 - Math.exp(-2.0 * dt))

    if (!initialized.current) {
      const initAngle = findSafeAngle(cowPos[0], cowPos[2], Math.PI * 0.25, 12)
      smoothPos.current.set(
        cowPos[0] + Math.cos(initAngle) * 12,
        8,
        cowPos[2] + Math.sin(initAngle) * 12,
      )
      smoothTarget.current.copy(cowWorld)
      initialized.current = true
    }

    timeRef.current += dt
    shotTimeRef.current += dt
    const t = timeRef.current

    // ── Shot transitions ──
    const currentShot = SHOT_SEQUENCE[shotIndexRef.current % SHOT_SEQUENCE.length]
    if (shotTimeRef.current >= currentShot.duration) {
      shotTimeRef.current = 0
      shotIndexRef.current++
      const baseAngle = seed.current.angle + (Math.random() - 0.5) * 2.0
      const nextShot = SHOT_SEQUENCE[shotIndexRef.current % SHOT_SEQUENCE.length]
      seed.current = {
        angle: baseAngle,
        safeAngle: findSafeAngle(cowPos[0], cowPos[2], baseAngle, 14),
        poiIdx: Math.floor(Math.random() * POI.length),
        side: Math.random() > 0.5 ? 1 : -1,
        startRadius: 10 + Math.random() * 6,
        heightBias: Math.random() * 3,
      }
    }

    const shot = SHOT_SEQUENCE[shotIndexRef.current % SHOT_SEQUENCE.length]
    const progress = shotTimeRef.current / shot.duration
    const ease = progress * progress * (3 - 2 * progress) // smoothstep 0→1
    const s = seed.current

    // Slowly evolve the safe angle during the shot to keep it valid as cow moves
    s.safeAngle = findSafeAngle(cowWorld.x, cowWorld.z, s.safeAngle, 10)

    switch (shot.type) {
      case 'orbit': {
        // Wide orbit around cow
        s.angle += dt * 0.04
        const orbitR = 12 + s.startRadius * 0.5 + Math.sin(t * 0.025) * 2
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.angle, orbitR)
        const h = 6 + s.heightBias + Math.sin(t * 0.02 + 1.2) * 2.5
        _pos.current.set(
          cowWorld.x + Math.cos(safeA) * orbitR,
          h,
          cowWorld.z + Math.sin(safeA) * orbitR,
        )
        _target.current.set(cowWorld.x, cowWorld.y + 0.1, cowWorld.z)
        break
      }

      case 'tracking': {
        // Side tracking shot — moves parallel to cow direction
        const perpX = prevCowDir.current.z * s.side
        const perpZ = -prevCowDir.current.x * s.side
        const trackDist = 4.5 + Math.sin(t * 0.04) * 1
        let px = cowWorld.x + perpX * trackDist
        let pz = cowWorld.z + perpZ * trackDist
        // If that position is occluded, flip to other side
        if (isOccluded(px, pz) || isLineOfSightBlocked(px, pz, cowWorld.x, cowWorld.z)) {
          px = cowWorld.x - perpX * trackDist
          pz = cowWorld.z - perpZ * trackDist
        }
        _pos.current.set(px, cowWorld.y + 1.5 + Math.sin(t * 0.05) * 0.3, pz)
        _target.current.set(
          cowWorld.x + prevCowDir.current.x * 2,
          cowWorld.y + 0.3,
          cowWorld.z + prevCowDir.current.z * 2,
        )
        break
      }

      case 'closeup': {
        // Intimate close-up, gentle slow arc
        s.angle += dt * 0.06
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.angle, 3)
        const cr = 2.8 + Math.sin(t * 0.07) * 0.4
        _pos.current.set(
          cowWorld.x + Math.cos(safeA) * cr,
          cowWorld.y + 0.6 + Math.sin(t * 0.06) * 0.15,
          cowWorld.z + Math.sin(safeA) * cr,
        )
        _target.current.set(cowWorld.x, cowWorld.y + 0.25, cowWorld.z)
        break
      }

      case 'crane': {
        // Wide crane: sweeps from very high down to medium-high
        const craneH = 20 * (1 - ease) + 8 * ease
        const craneR = 18 * (1 - ease) + 12 * ease
        s.angle += dt * 0.03
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.angle, craneR)
        _pos.current.set(
          cowWorld.x + Math.cos(safeA) * craneR,
          craneH,
          cowWorld.z + Math.sin(safeA) * craneR,
        )
        _target.current.set(cowWorld.x, cowWorld.y, cowWorld.z)
        break
      }

      case 'lowAngle': {
        // Dramatic low angle — near ground, looking up at cow like a hero shot
        s.angle += dt * 0.035
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.angle, 5)
        const laR = 4.5 + Math.sin(t * 0.04) * 1
        _pos.current.set(
          cowWorld.x + Math.cos(safeA) * laR,
          0.35 + Math.sin(t * 0.06) * 0.1,
          cowWorld.z + Math.sin(safeA) * laR,
        )
        _target.current.set(cowWorld.x, cowWorld.y + 0.6, cowWorld.z)
        break
      }

      case 'establishing': {
        // High wide panoramic — shows the whole farm
        s.angle += dt * 0.01
        const estR = 20 + Math.sin(t * 0.008) * 3
        _pos.current.set(
          Math.cos(s.angle) * estR,
          18 + Math.sin(t * 0.012 + 2) * 3,
          Math.sin(s.angle) * estR,
        )
        // Target drifts from farm center toward cow
        _target.current.set(
          cowWorld.x * ease * 0.6,
          1 + cowWorld.y * ease * 0.4,
          cowWorld.z * ease * 0.6,
        )
        break
      }

      case 'dolly': {
        // Wide dolly: starts very wide, gently pushes in to medium distance
        const dollyStart = 20
        const dollyEnd = 10
        const dollyR = dollyStart * (1 - ease) + dollyEnd * ease
        const dollyH = 12 * (1 - ease) + 6 * ease
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.safeAngle, dollyR)
        _pos.current.set(
          cowWorld.x + Math.cos(safeA) * dollyR,
          dollyH,
          cowWorld.z + Math.sin(safeA) * dollyR,
        )
        _target.current.set(cowWorld.x, cowWorld.y + 0.15, cowWorld.z)
        break
      }

      case 'overShoulder': {
        // Behind and slightly above the cow, looking in the direction she faces
        const behindX = -prevCowDir.current.x
        const behindZ = -prevCowDir.current.z
        let px = cowWorld.x + behindX * 3 + prevCowDir.current.z * s.side * 1.2
        let pz = cowWorld.z + behindZ * 3 - prevCowDir.current.x * s.side * 1.2
        if (isOccluded(px, pz)) {
          px = cowWorld.x + behindX * 3 - prevCowDir.current.z * s.side * 1.2
          pz = cowWorld.z + behindZ * 3 + prevCowDir.current.x * s.side * 1.2
        }
        _pos.current.set(px, cowWorld.y + 1.6, pz)
        // Look ahead of cow — what she's looking at
        _target.current.set(
          cowWorld.x + prevCowDir.current.x * 8,
          cowWorld.y + 0.2,
          cowWorld.z + prevCowDir.current.z * 8,
        )
        break
      }

      case 'scenic': {
        // Distant scenic: starts framed on a POI from far away, sweeps wide to reveal cow
        const poi = POI[s.poiIdx]
        const fromX = poi[0] + Math.cos(s.safeAngle) * 10
        const fromZ = poi[2] + Math.sin(s.safeAngle) * 10
        const safeA = findSafeAngle(cowWorld.x, cowWorld.z, s.safeAngle, 14)
        const toX = cowWorld.x + Math.cos(safeA) * 14
        const toZ = cowWorld.z + Math.sin(safeA) * 14
        _pos.current.set(
          fromX * (1 - ease) + toX * ease,
          poi[1] + 8 * (1 - ease) + 7 * ease,
          fromZ * (1 - ease) + toZ * ease,
        )
        _target.current.set(
          poi[0] * (1 - ease) + cowWorld.x * ease,
          poi[1] * (1 - ease) + cowWorld.y * ease,
          poi[2] * (1 - ease) + cowWorld.z * ease,
        )
        break
      }

      case 'flyby': {
        // Fast low sweep past the cow — dynamic energy
        const flyAngle = s.safeAngle + ease * Math.PI * 0.8
        const flyR = 6 + (1 - Math.abs(ease - 0.5) * 2) * 3 // closest at midpoint
        _pos.current.set(
          cowWorld.x + Math.cos(flyAngle) * flyR,
          1.2 + Math.sin(ease * Math.PI) * 1.5, // arc up in the middle
          cowWorld.z + Math.sin(flyAngle) * flyR,
        )
        _target.current.set(cowWorld.x, cowWorld.y + 0.3, cowWorld.z)
        break
      }
    }

    // Clamp to farm bounds
    clampToFarm(_pos.current)

    // ── Dual-rate smoothing ──
    // Shots that move fast get tighter tracking; slow shots get dreamier smoothing
    const isQuickShot = shot.type === 'flyby' || shot.type === 'tracking'
    const posRate = isQuickShot ? 1.8 : 1.0
    const targetRate = isQuickShot ? 3.0 : 2.0

    const posLerp = 1 - Math.exp(-posRate * dt)
    const targetLerp = 1 - Math.exp(-targetRate * dt)
    const fovLerp = 1 - Math.exp(-1.0 * dt)

    smoothPos.current.lerp(_pos.current, posLerp)
    smoothTarget.current.lerp(_target.current, targetLerp)
    smoothFov.current += (shot.fov - smoothFov.current) * fovLerp

    camera.position.copy(smoothPos.current)
    camera.lookAt(smoothTarget.current)

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = smoothFov.current
      camera.updateProjectionMatrix()
    }
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

// ── Farm gate lights ────────────────────────────────────

function GateLightPost({ position }: { position: [number, number, number]; }) {
  return (
    <group position={position}>
      {/* Post-top cap */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.18]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Lamp housing */}
      <group position={[0, 1.15, 0]}>
        <mesh>
          <boxGeometry args={[0.20, 0.08, 0.16]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Glass lens */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.16, 0.012, 0.12]} />
          <meshBasicMaterial color="#fff8e0" />
        </mesh>
      </group>
    </group>
  )
}

function GateLights({ timeOfDay }: { timeOfDay: number }) {
  const factor = outdoorLightFactor(timeOfDay)
  const on = factor > 0
  const intensity = factor * 1.8 // dim: gate lights are subtle

  return (
    <group>
      <GateLightPost position={[14, 0, -2]} />
      <GateLightPost position={[14, 0, 2]} />
      {on && (
        <>
          <pointLight position={[14, 1.1, -2]} color="#ffcc66" intensity={intensity} distance={8} decay={1.8} />
          <pointLight position={[14, 1.1, 2]} color="#ffcc66" intensity={intensity} distance={8} decay={1.8} />
        </>
      )}
    </group>
  )
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
      {t.fences && <GateLights timeOfDay={timeOfDay} />}
      {t.food && <FoodItems foods={foods} />}
      {t.creatures && <Creatures timeOfDay={timeOfDay} showButterflies={showButterflies} />}
      {t.windmill && <Windmill timeOfDay={timeOfDay} />}
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
          <SMAA />
          <N8AO
            aoRadius={2.5}
            intensity={1.2}
            distanceFalloff={1.0}
            color="#1a0e04"
          />
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.8}
            intensity={0.4}
            mipmapBlur
            levels={4}
            width={512}
            height={512}
          />
          <BrightnessContrast brightness={0.02} contrast={0.08} />
          <HueSaturation saturation={0.08} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette eskil={false} offset={0.25} darkness={0.3} />
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
      maxDistance={50}
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
    <>
      {profilerEnabled && <style>{`
        .fps-stats { left: 16px !important; top: auto !important; bottom: 120px !important; }
      `}</style>}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{
          position: CAMERA_POSITION,
          fov: CAMERA_FOV,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ width: '100%', height: '100%' }}
      >
        <fog attach="fog" args={[initialFogColor, 40, 120]} />

        <OrbitControlsWrapper />

        <Scene />

        {profilerEnabled && <Stats className="fps-stats" />}
      </Canvas>
    </>
  )
}

export default FarmScene
