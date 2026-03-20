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
  divePhase: number
  diveInterval: number
}

interface DuckState {
  x: number; z: number
  angle: number
  diveTimer: number
  diving: boolean
  diveProgress: number
}

const BODY_COLOR = '#f0ece0'
const MALE_HEAD = '#2a6830'
const FEMALE_HEAD = '#8a6a40'
const BEAK_COLOR = '#e8a020'

// ── Single duck ─────────────────────────────────────────

function Duck({ def }: { def: DuckDef }) {
  const groupRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)

  const state = useRef<DuckState>({
    x: POND_X + Math.cos(def.phase) * def.orbitRadius,
    z: POND_Z + Math.sin(def.phase) * def.orbitRadius,
    angle: def.phase,
    diveTimer: def.diveInterval,
    diving: false,
    diveProgress: 0,
  })

  useFrame((frameState, delta) => {
    if (!groupRef.current) return
    const t = frameState.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const s = state.current

    // Check rain for activity boost
    const store = gameStore.getState()
    const isRaining = store.rain === true || (store.rain as any)?.active === true
    const speedMult = isRaining ? 1.8 : 1.0

    // Orbit movement: gentle figure-8 / arc pattern
    const orbitAngle = t * def.orbitSpeed * speedMult + def.phase
    const targetX = POND_X + Math.cos(orbitAngle) * def.orbitRadius +
      Math.sin(orbitAngle * 0.7) * def.orbitRadius * 0.3
    const targetZ = POND_Z + Math.sin(orbitAngle) * def.orbitRadius +
      Math.cos(orbitAngle * 0.5) * def.orbitRadius * 0.2

    // Clamp to pond radius (with margin)
    const dx = targetX - POND_X
    const dz = targetZ - POND_Z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const maxR = POND_RADIUS - 0.4
    if (dist > maxR) {
      s.x = POND_X + (dx / dist) * maxR
      s.z = POND_Z + (dz / dist) * maxR
    } else {
      s.x = targetX
      s.z = targetZ
    }

    // Face direction of movement
    const nextAngle = (t + 0.05) * def.orbitSpeed * speedMult + def.phase
    const nextX = POND_X + Math.cos(nextAngle) * def.orbitRadius +
      Math.sin(nextAngle * 0.7) * def.orbitRadius * 0.3
    const nextZ = POND_Z + Math.sin(nextAngle) * def.orbitRadius +
      Math.cos(nextAngle * 0.5) * def.orbitRadius * 0.2
    s.angle = Math.atan2(nextX - s.x, nextZ - s.z)

    // Dive behavior
    s.diveTimer -= dt
    if (s.diveTimer <= 0 && !s.diving) {
      s.diving = true
      s.diveProgress = 0
    }
    if (s.diving) {
      s.diveProgress += dt * 2 // dive takes ~0.5 sec down + up
      if (s.diveProgress >= 1) {
        s.diving = false
        s.diveTimer = def.diveInterval + Math.random() * 5
        s.diveProgress = 0
      }
    }

    // Water bobbing
    const bobY = 0.05 + Math.sin(t * 2 + def.phase) * 0.01
    // Dive offset: quick dip down and back
    const diveY = s.diving ? -Math.sin(s.diveProgress * Math.PI) * 0.06 : 0

    groupRef.current.position.set(s.x, bobY + diveY, s.z)
    groupRef.current.rotation.y = s.angle

    // Head bob while swimming
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 3 + def.phase) * 0.08
      headRef.current.position.x = 0.1 + Math.sin(t * 3 + def.phase) * 0.005
    }
  })

  return (
    <group ref={groupRef}>
      {/* Body - elongated, slightly flat */}
      <mesh castShadow position={[0, 0, 0]} scale={[1.3, 0.7, 0.9]}>
        <sphereGeometry args={[0.1, 7, 6]} />
        <meshStandardMaterial color={BODY_COLOR} flatShading />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0.1, 0.07, 0]}>
        <mesh>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial color={def.headColor} flatShading />
        </mesh>

        {/* Beak - flat cone */}
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

      {/* Tail - upturned cone */}
      <mesh position={[-0.14, 0.04, 0]} rotation={[0, 0, Math.PI / 3]}>
        <coneGeometry args={[0.02, 0.05, 4]} />
        <meshStandardMaterial color={BODY_COLOR} flatShading />
      </mesh>
    </group>
  )
}

// ── Main component ──────────────────────────────────────

export default function Ducks() {
  const duckDefs = useMemo<DuckDef[]>(() => [
    {
      orbitRadius: 1.4, orbitSpeed: 0.25, phase: 0,
      headColor: MALE_HEAD, isMale: true,
      divePhase: 0, diveInterval: 12,
    },
    {
      orbitRadius: 1.8, orbitSpeed: 0.18, phase: Math.PI * 0.7,
      headColor: FEMALE_HEAD, isMale: false,
      divePhase: 2, diveInterval: 15,
    },
    {
      orbitRadius: 1.1, orbitSpeed: 0.3, phase: Math.PI * 1.3,
      headColor: MALE_HEAD, isMale: true,
      divePhase: 4, diveInterval: 10,
    },
    {
      orbitRadius: 2.0, orbitSpeed: 0.15, phase: Math.PI * 0.4,
      headColor: FEMALE_HEAD, isMale: false,
      divePhase: 6, diveInterval: 18,
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
