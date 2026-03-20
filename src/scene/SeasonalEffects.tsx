import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Constants ────────────────────────────────────────────

const SPREAD_X = 30
const SPREAD_Z = 30
const MIN_HEIGHT = 0.05
const SPAWN_HEIGHT = 8

// ── Particle counts ─────────────────────────────────────

const PETAL_COUNT = 25
const LEAF_COUNT = 18
const SNOW_COUNT = 50

// ── Types ────────────────────────────────────────────────

interface ParticleData {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  rotSpeed: number
  phase: number
}

// ── Pre-allocated helpers ────────────────────────────────

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

// ── Particle colors ──────────────────────────────────────

const PETAL_COLORS = [
  new THREE.Color('#ffb7c5'),
  new THREE.Color('#ff9eb5'),
  new THREE.Color('#ffc8d8'),
  new THREE.Color('#ffddea'),
  new THREE.Color('#ffa0b8'),
]

const LEAF_COLORS = [
  new THREE.Color('#cc6622'),
  new THREE.Color('#dd4422'),
  new THREE.Color('#eebb22'),
  new THREE.Color('#bb5522'),
  new THREE.Color('#dd8833'),
  new THREE.Color('#cc3333'),
]

const SNOW_COLOR = new THREE.Color('#f0f4ff')

// ── Initialize particle arrays ───────────────────────────

function initParticles(count: number, fallSpeed: number): ParticleData[] {
  const particles: ParticleData[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * SPREAD_X,
      y: MIN_HEIGHT + Math.random() * (SPAWN_HEIGHT - MIN_HEIGHT),
      z: (Math.random() - 0.5) * SPREAD_Z,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(fallSpeed + Math.random() * fallSpeed * 0.5),
      vz: (Math.random() - 0.5) * 0.3,
      rotSpeed: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return particles
}

// ── Spring: cherry blossom petals ────────────────────────

function SpringPetals() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const particles = useRef<ParticleData[]>(initParticles(PETAL_COUNT, 0.6))
  const initialized = useRef(false)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = _state.clock.elapsedTime
    const wind = gameStore.getState().world.windStrength

    // Set colors once
    if (!initialized.current) {
      for (let i = 0; i < PETAL_COUNT; i++) {
        _color.copy(PETAL_COLORS[i % PETAL_COLORS.length])
        meshRef.current.setColorAt(i, _color)
      }
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
      initialized.current = true
    }

    for (let i = 0; i < PETAL_COUNT; i++) {
      const p = particles.current[i]

      p.x += (p.vx + wind * 0.4 + Math.sin(t * 0.7 + p.phase) * 0.3) * dt
      p.y += p.vy * dt
      p.z += (p.vz + Math.sin(t + p.phase) * 0.2) * dt

      if (p.y < MIN_HEIGHT) {
        p.x = (Math.random() - 0.5) * SPREAD_X
        p.y = SPAWN_HEIGHT + Math.random() * 2
        p.z = (Math.random() - 0.5) * SPREAD_Z
        p.phase = Math.random() * Math.PI * 2
      }

      // Wrap horizontally
      if (p.x > 18) p.x = -18
      if (p.x < -18) p.x = 18
      if (p.z > 16) p.z = -14
      if (p.z < -14) p.z = 16

      const sway = Math.sin(t * 1.5 + p.phase) * 0.3

      _dummy.position.set(p.x, p.y, p.z)
      _dummy.rotation.set(
        sway,
        t * p.rotSpeed,
        Math.sin(t * 0.8 + p.phase) * 0.5,
      )
      _dummy.scale.setScalar(0.06 + Math.sin(p.phase) * 0.02)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PETAL_COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 0.7]} />
      <meshStandardMaterial
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
        flatShading
      />
    </instancedMesh>
  )
}

// ── Autumn: falling leaves ───────────────────────────────

function AutumnLeaves() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const particles = useRef<ParticleData[]>(initParticles(LEAF_COUNT, 0.4))
  const initialized = useRef(false)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = _state.clock.elapsedTime
    const wind = gameStore.getState().world.windStrength

    if (!initialized.current) {
      for (let i = 0; i < LEAF_COUNT; i++) {
        _color.copy(LEAF_COLORS[i % LEAF_COLORS.length])
        meshRef.current.setColorAt(i, _color)
      }
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
      initialized.current = true
    }

    for (let i = 0; i < LEAF_COUNT; i++) {
      const p = particles.current[i]

      // Spiral downward
      p.x += (p.vx + wind * 0.5 + Math.sin(t * 0.7 + p.phase) * 0.5) * dt
      p.y += p.vy * dt
      p.z += (p.vz + Math.cos(t * 0.5 + p.phase) * 0.4) * dt

      if (p.y < MIN_HEIGHT) {
        p.x = (Math.random() - 0.5) * SPREAD_X
        p.y = SPAWN_HEIGHT + Math.random() * 2
        p.z = (Math.random() - 0.5) * SPREAD_Z
        p.phase = Math.random() * Math.PI * 2
      }

      if (p.x > 18) p.x = -18
      if (p.x < -18) p.x = 18
      if (p.z > 16) p.z = -14
      if (p.z < -14) p.z = 16

      _dummy.position.set(p.x, p.y, p.z)
      _dummy.rotation.set(
        Math.sin(t * 1.2 + p.phase) * 0.8,
        t * p.rotSpeed * 0.8,
        Math.cos(t * 0.9 + p.phase) * 0.6,
      )
      _dummy.scale.setScalar(0.08 + Math.sin(p.phase) * 0.03)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, LEAF_COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 0.6]} />
      <meshStandardMaterial
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
        flatShading
      />
    </instancedMesh>
  )
}

// ── Winter: snowflakes + ground snow ─────────────────────

function WinterSnow() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const particles = useRef<ParticleData[]>(initParticles(SNOW_COUNT, 0.3))
  const initialized = useRef(false)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = _state.clock.elapsedTime
    const wind = gameStore.getState().world.windStrength

    if (!initialized.current) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        meshRef.current.setColorAt(i, SNOW_COLOR)
      }
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
      initialized.current = true
    }

    for (let i = 0; i < SNOW_COUNT; i++) {
      const p = particles.current[i]

      // Gentle lateral drift
      p.x += (p.vx * 0.3 + wind * 0.2 + Math.sin(t * 0.4 + p.phase) * 0.15) * dt
      p.y += p.vy * dt
      p.z += (p.vz * 0.3 + Math.cos(t * 0.3 + p.phase) * 0.12) * dt

      if (p.y < MIN_HEIGHT) {
        p.x = (Math.random() - 0.5) * SPREAD_X
        p.y = SPAWN_HEIGHT + Math.random() * 3
        p.z = (Math.random() - 0.5) * SPREAD_Z
        p.phase = Math.random() * Math.PI * 2
      }

      if (p.x > 18) p.x = -18
      if (p.x < -18) p.x = 18
      if (p.z > 16) p.z = -14
      if (p.z < -14) p.z = 16

      _dummy.position.set(p.x, p.y, p.z)
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.setScalar(0.03 + Math.sin(p.phase + t * 0.5) * 0.01)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, SNOW_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>

      {/* Scattered snow patches — small irregular drifts */}
      {[
        { pos: [2, 0.01, 3] as const, size: [3, 2] as const, rot: 0.3, op: 0.15 },
        { pos: [-4, 0.01, -2] as const, size: [2.5, 1.8] as const, rot: -0.2, op: 0.12 },
        { pos: [5, 0.01, -6] as const, size: [2, 1.5] as const, rot: 0.5, op: 0.13 },
        { pos: [-7, 0.01, 7] as const, size: [2.5, 2] as const, rot: 0.1, op: 0.10 },
        { pos: [8, 0.01, 5] as const, size: [1.8, 1.3] as const, rot: -0.4, op: 0.12 },
        { pos: [-2, 0.01, -7] as const, size: [2.2, 1.6] as const, rot: 0.7, op: 0.11 },
        { pos: [0, 0.01, 10] as const, size: [3, 1.5] as const, rot: -0.1, op: 0.10 },
      ].map((patch, i) => (
        <mesh key={i} position={patch.pos} rotation={[-Math.PI / 2, 0, patch.rot]} receiveShadow>
          <circleGeometry args={[Math.max(patch.size[0], patch.size[1]) * 0.5, 8]} />
          <meshStandardMaterial color="#e0e8f0" transparent opacity={patch.op} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

// ── Main component ───────────────────────────────────────

export default function SeasonalEffects() {
  const season = gameStore.getState().world.season
  const [currentSeason, setCurrentSeason] = useState(season)
  const prevRef = useRef(season)

  useFrame(() => {
    const s = gameStore.getState().world.season
    if (s !== prevRef.current) {
      prevRef.current = s
      setCurrentSeason(s)
    }
  })

  return (
    <group>
      {currentSeason === 0 && <SpringPetals />}
      {/* season === 1 is summer — base scene is already summer-like */}
      {currentSeason === 2 && <AutumnLeaves />}
      {currentSeason === 3 && <WinterSnow />}
    </group>
  )
}
