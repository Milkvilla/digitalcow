import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Pond constants ──────────────────────────────────────
const POND_X = -8
const POND_Z = -5
const POND_RADIUS = 3

// ── Duck definitions ────────────────────────────────────
interface DuckDef {
  orbitRadius: number
  orbitSpeed: number
  phase: number
  headColor: string
  isMale: boolean
  diveInterval: number
}

interface DuckState {
  x: number
  z: number
  angle: number
  accumAngle: number
  diveTimer: number
  diving: boolean
  diveProgress: number
  idleTimer: number
  isIdle: boolean
  prevX: number
  prevZ: number
}

const BODY_COLOR = '#f0ece0'
const MALE_HEAD = '#2a6830'
const FEMALE_HEAD = '#8a6a40'
const BEAK_COLOR = '#e8a020'

// Water level matching Pond.tsx formula
function getWaterLevel(): number {
  const store = gameStore.getState()
  const isRaining = store.rain === true || (store.rain as any)?.active === true
  const intensity = (store as any).rainIntensity ?? 0.5
  return isRaining ? 0.03 + intensity * 0.08 : 0.03
}

// ── Single duck ─────────────────────────────────────────

function Duck({ def }: { def: DuckDef }) {
  const groupRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Mesh>(null!)

  const state = useRef<DuckState>({
    x: POND_X + Math.cos(def.phase) * def.orbitRadius,
    z: POND_Z + Math.sin(def.phase) * def.orbitRadius,
    angle: def.phase,
    accumAngle: def.phase,
    diveTimer: def.diveInterval + Math.random() * 5,
    diving: false,
    diveProgress: 0,
    idleTimer: 8 + Math.random() * 12,
    isIdle: false,
    prevX: POND_X + Math.cos(def.phase) * def.orbitRadius,
    prevZ: POND_Z + Math.sin(def.phase) * def.orbitRadius,
  })

  useFrame((_frameState, delta) => {
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const t = _frameState.clock.elapsedTime

    // Rain speed boost
    const store = gameStore.getState()
    const isRaining = store.rain === true || (store.rain as any)?.active === true
    const speedMult = isRaining ? 1.4 : 1.0

    // Idle behavior — ducks sometimes stop and look around
    s.idleTimer -= dt
    if (s.idleTimer <= 0 && !s.isIdle && !s.diving) {
      s.isIdle = true
      s.idleTimer = 2 + Math.random() * 4 // idle for 2-6 seconds
    }
    if (s.isIdle) {
      s.idleTimer -= dt
      if (s.idleTimer <= 0) {
        s.isIdle = false
        s.idleTimer = 8 + Math.random() * 15 // next idle in 8-23 seconds
      }
    }

    // Accumulate orbit angle using delta (prevents jumps on speed change)
    const moveSpeed = s.isIdle ? 0.02 : def.orbitSpeed * speedMult
    s.accumAngle += dt * moveSpeed

    // Organic path: orbit + figure-8 modulation + slight wobble
    const oa = s.accumAngle
    const wobble = Math.sin(oa * 3.7 + def.phase * 2) * 0.12
    const figX = Math.sin(oa * 0.7 + def.phase) * def.orbitRadius * 0.25
    const figZ = Math.cos(oa * 0.5 + def.phase) * def.orbitRadius * 0.18

    const targetX = POND_X + Math.cos(oa) * (def.orbitRadius + wobble) + figX
    const targetZ = POND_Z + Math.sin(oa) * (def.orbitRadius + wobble) + figZ

    // Clamp to pond radius
    const dx = targetX - POND_X
    const dz = targetZ - POND_Z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const maxR = POND_RADIUS - 0.5
    if (dist > maxR) {
      s.x = POND_X + (dx / dist) * maxR
      s.z = POND_Z + (dz / dist) * maxR
    } else {
      s.x = targetX
      s.z = targetZ
    }

    // Smooth facing direction from actual movement
    const moveDx = s.x - s.prevX
    const moveDz = s.z - s.prevZ
    const moveDist = Math.sqrt(moveDx * moveDx + moveDz * moveDz)
    if (moveDist > 0.0001) {
      const targetAngle = Math.atan2(moveDx, moveDz)
      // Smooth angle interpolation
      let angleDiff = targetAngle - s.angle
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      s.angle += angleDiff * Math.min(dt * 3, 1)
    }
    s.prevX = s.x
    s.prevZ = s.z

    // Dive behavior
    s.diveTimer -= dt
    if (s.diveTimer <= 0 && !s.diving && !s.isIdle) {
      s.diving = true
      s.diveProgress = 0
    }
    if (s.diving) {
      s.diveProgress += dt * 1.8
      if (s.diveProgress >= 1) {
        s.diving = false
        s.diveTimer = def.diveInterval + Math.random() * 6
        s.diveProgress = 0
      }
    }

    // Track water level so ducks float on rising water
    const waterLevel = getWaterLevel()
    const bobY = waterLevel + 0.02 + Math.sin(t * 1.8 + def.phase) * 0.008
    const diveY = s.diving ? -Math.sin(s.diveProgress * Math.PI) * 0.06 : 0

    groupRef.current.position.set(s.x, bobY + diveY, s.z)
    groupRef.current.rotation.y = s.angle

    // Body tilt — lean into turns based on lateral movement
    if (bodyRef.current) {
      const lateral = moveDist > 0.0001 ? (moveDx * Math.cos(s.angle) - moveDz * Math.sin(s.angle)) * 0.5 : 0
      bodyRef.current.rotation.z += (lateral * 0.3 - bodyRef.current.rotation.z) * Math.min(dt * 4, 1)
    }

    // Head bob while swimming — more pronounced when moving
    if (headRef.current) {
      const swimBob = s.isIdle ? 0.03 : 0.08
      headRef.current.rotation.x = Math.sin(t * 3.5 + def.phase) * swimBob
      // Head forward pump (paddling motion)
      headRef.current.position.x = 0.1 + Math.sin(t * 3.5 + def.phase) * (s.isIdle ? 0.002 : 0.008)
      // Idle: look around
      if (s.isIdle) {
        headRef.current.rotation.y = Math.sin(t * 0.8 + def.phase * 3) * 0.4
      } else {
        headRef.current.rotation.y *= 0.9 // ease back to center
      }
    }
  })

  return (
    <group ref={groupRef}>
      {/* Body - elongated, slightly flat */}
      <mesh ref={bodyRef} castShadow position={[0, 0, 0]} scale={[1.3, 0.7, 0.9]}>
        <sphereGeometry args={[0.1, 7, 6]} />
        <meshStandardMaterial color={BODY_COLOR} flatShading />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0.1, 0.07, 0]}>
        <mesh>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial color={def.headColor} flatShading />
        </mesh>

        {/* Beak */}
        <mesh position={[0.05, -0.01, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.015, 0.04, 4]} />
          <meshStandardMaterial color={BEAK_COLOR} flatShading />
        </mesh>

        {/* Eyes */}
        <mesh position={[0.03, 0.015, 0.025]}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.03, 0.015, -0.025]}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* Tail */}
      <mesh position={[-0.14, 0.04, 0]} rotation={[0, 0, Math.PI / 3]}>
        <coneGeometry args={[0.02, 0.05, 4]} />
        <meshStandardMaterial color={BODY_COLOR} flatShading />
      </mesh>

      {/* Wake ripple (subtle ring behind duck) */}
      <mesh position={[-0.12, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.04, 0.07, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Main component ──────────────────────────────────────

export default function Ducks() {
  const duckDefs = useMemo<DuckDef[]>(() => [
    {
      orbitRadius: 1.4, orbitSpeed: 0.22, phase: 0,
      headColor: MALE_HEAD, isMale: true,
      diveInterval: 14,
    },
    {
      orbitRadius: 1.8, orbitSpeed: 0.15, phase: Math.PI * 0.7,
      headColor: FEMALE_HEAD, isMale: false,
      diveInterval: 18,
    },
    {
      orbitRadius: 1.1, orbitSpeed: 0.26, phase: Math.PI * 1.3,
      headColor: MALE_HEAD, isMale: true,
      diveInterval: 12,
    },
    {
      orbitRadius: 2.0, orbitSpeed: 0.12, phase: Math.PI * 0.4,
      headColor: FEMALE_HEAD, isMale: false,
      diveInterval: 20,
    },
  ], [])

  return (
    <group>
      {duckDefs.map((def, i) => (
        <Duck key={i} def={def} />
      ))}
    </group>
  )
}
