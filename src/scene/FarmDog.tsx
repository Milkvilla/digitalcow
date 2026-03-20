import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'
import { EXCLUSION_ZONES } from '../engine/constants.ts'

// ── Constants ───────────────────────────────────────────

const BODY_COLOR = '#8B6914'
const DARK_BROWN = '#5a4510'
const BELLY_COLOR = '#c4a040'
const NOSE_COLOR = '#222'
const DOG_SCALE = 1.2
const GROUND_Y = DOG_SCALE * 0.19
const WALK_SPEED = 0.8
const TROT_SPEED = 1.5

// Patrol waypoints around the farm (avoiding structures)
const PATROL_POINTS: [number, number][] = [
  [5, 3], [-3, 11], [8, -6], [-5, -8], [10, 5],
  [2, 8], [6, -3], [0, 5], [-3, -5], [7, 10],
  [-2, 3], [4, -9], [11, -1], [3, 12], [-1, -6],
]

// ── Helpers ─────────────────────────────────────────────

type DogBehavior = 'patrol' | 'sniff' | 'sit' | 'sleep' | 'play'

function angleDiff(target: number, current: number): number {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function isInExclusionZone(x: number, z: number): boolean {
  for (const zone of EXCLUSION_ZONES) {
    const dx = x - zone.center[0]
    const dz = z - zone.center[1]
    if (Math.sqrt(dx * dx + dz * dz) < zone.radius + 0.5) return true
  }
  return false
}

function pickPatrolPoint(): [number, number] {
  for (let i = 0; i < 20; i++) {
    const pt = PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)]
    const ox = pt[0] + (Math.random() - 0.5) * 3
    const oz = pt[1] + (Math.random() - 0.5) * 3
    if (!isInExclusionZone(ox, oz) && ox > -13 && ox < 13 && oz > -11 && oz < 13) {
      return [ox, oz]
    }
  }
  return [0, 0]
}

// ── Component ───────────────────────────────────────────

export default function FarmDog() {
  const groupRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)
  const tailRef = useRef<THREE.Group>(null!)
  const legFLRef = useRef<THREE.Mesh>(null!)
  const legFRRef = useRef<THREE.Mesh>(null!)
  const legBLRef = useRef<THREE.Mesh>(null!)
  const legBRRef = useRef<THREE.Mesh>(null!)

  const state = useRef({
    x: 5,
    z: 3,
    angle: 0,
    targetAngle: 0,
    behavior: 'patrol' as DogBehavior,
    timer: 3,
    targetX: 5,
    targetZ: 3,
    sittingLerp: 0,
  })

  useFrame((frameState, delta) => {
    if (!groupRef.current) return
    const t = frameState.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const timeOfDay = gameStore.getState().world.timeOfDay
    const isNight = timeOfDay < 6 || timeOfDay > 20

    // ── Timer-based state transitions ──────────────
    s.timer -= dt
    if (s.timer <= 0) {
      if (isNight && s.behavior !== 'sleep') {
        s.behavior = 'sleep'
        s.targetX = -9
        s.targetZ = 9
        s.timer = 20 + Math.random() * 20
      } else if (!isNight && s.behavior === 'sleep') {
        s.behavior = 'patrol'
        const pt = pickPatrolPoint()
        s.targetX = pt[0]; s.targetZ = pt[1]
        s.timer = 8 + Math.random() * 6
      } else if (s.behavior === 'patrol') {
        const r = Math.random()
        if (r < 0.3) {
          s.behavior = 'sniff'
          s.timer = 3 + Math.random() * 3
        } else if (r < 0.5) {
          s.behavior = 'sit'
          s.timer = 4 + Math.random() * 6
        } else if (r < 0.65) {
          s.behavior = 'play'
          s.timer = 2 + Math.random() * 2
        } else {
          const pt = pickPatrolPoint()
          s.targetX = pt[0]; s.targetZ = pt[1]
          s.timer = 6 + Math.random() * 8
        }
      } else {
        // sniff, sit, play → back to patrol
        s.behavior = 'patrol'
        const pt = pickPatrolPoint()
        s.targetX = pt[0]; s.targetZ = pt[1]
        s.timer = 6 + Math.random() * 8
      }
    }

    // ── Movement ─────────────────────────────────────
    let speed = 0

    switch (s.behavior) {
      case 'patrol': {
        const dx = s.targetX - s.x
        const dz = s.targetZ - s.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > 0.3) {
          speed = WALK_SPEED
          s.targetAngle = Math.atan2(dx, dz)
        } else {
          s.timer = Math.min(s.timer, 0.5)
        }
        break
      }

      case 'play': {
        // Playful zigzag movement
        const playDx = Math.sin(t * 3) * 1.5
        const playDz = Math.cos(t * 2.3) * 1.5
        const dx = playDx
        const dz = playDz
        speed = TROT_SPEED
        s.targetAngle = Math.atan2(dx, dz)
        s.x += dx * dt
        s.z += dz * dt
        speed = 0 // already moved directly
        break
      }

      case 'sleep': {
        const dx = s.targetX - s.x
        const dz = s.targetZ - s.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > 0.5) {
          speed = WALK_SPEED * 0.5
          s.targetAngle = Math.atan2(dx, dz)
        }
        break
      }

      case 'sniff':
      case 'sit':
        speed = 0
        break
    }

    // Apply movement toward target
    if (speed > 0) {
      const mx = s.targetX - s.x
      const mz = s.targetZ - s.z
      const mDist = Math.sqrt(mx * mx + mz * mz)
      if (mDist > 0.05) {
        s.x += (mx / mDist) * speed * dt
        s.z += (mz / mDist) * speed * dt
      }
    }

    // Smooth angle rotation
    const aDiff = angleDiff(s.targetAngle, s.angle)
    s.angle += aDiff * Math.min(1, dt * 4)

    // Clamp to field bounds
    s.x = Math.max(-13, Math.min(13, s.x))
    s.z = Math.max(-11, Math.min(13, s.z))

    // Push out of exclusion zones
    for (const zone of EXCLUSION_ZONES) {
      const zdx = s.x - zone.center[0]
      const zdz = s.z - zone.center[1]
      const zDist = Math.sqrt(zdx * zdx + zdz * zdz)
      if (zDist < zone.radius && zDist > 0.01) {
        s.x = zone.center[0] + (zdx / zDist) * zone.radius
        s.z = zone.center[1] + (zdz / zDist) * zone.radius
      }
    }

    // ── Sitting/sleeping body dip ────────────────────
    const sittingTarget = (s.behavior === 'sit' || s.behavior === 'sleep') ? 1 : 0
    s.sittingLerp += (sittingTarget - s.sittingLerp) * dt * 3

    // ── Apply transforms ─────────────────────────────
    // Model faces +X, so offset rotation by -PI/2 (same as Cow.tsx)
    const bodyDip = s.sittingLerp * 0.06
    const sleepExtra = s.behavior === 'sleep' ? 0.03 : 0
    groupRef.current.position.set(
      s.x,
      GROUND_Y - (bodyDip + sleepExtra) * DOG_SCALE,
      s.z,
    )
    groupRef.current.rotation.y = s.angle - Math.PI / 2

    // ── Tail wagging ─────────────────────────────────
    if (tailRef.current) {
      let wagSpeed = 0, wagAmount = 0
      if (s.behavior === 'play') { wagSpeed = 12; wagAmount = 0.6 }
      else if (s.behavior === 'patrol') { wagSpeed = 6; wagAmount = 0.35 }
      else if (s.behavior === 'sit' || s.behavior === 'sniff') { wagSpeed = 3; wagAmount = 0.25 }
      else { wagSpeed = 0.5; wagAmount = 0.1 }
      tailRef.current.rotation.z = Math.sin(t * wagSpeed) * wagAmount
      const baseAngle = s.behavior === 'play' ? -0.8 : s.behavior === 'sleep' ? 0.2 : -0.4
      tailRef.current.rotation.x = baseAngle
    }

    // ── Leg animation ────────────────────────────────
    const isMoving = speed > 0.1 || s.behavior === 'play'
    const legSpeed = s.behavior === 'play' ? 14 : 8
    const legSwing = isMoving ? 0.35 : 0

    if (legFLRef.current) legFLRef.current.rotation.x = Math.sin(t * legSpeed) * legSwing
    if (legFRRef.current) legFRRef.current.rotation.x = Math.sin(t * legSpeed + Math.PI) * legSwing
    if (legBLRef.current) {
      const sitBend = s.sittingLerp * 0.4
      legBLRef.current.rotation.x = Math.sin(t * legSpeed + Math.PI * 0.5) * legSwing + sitBend
    }
    if (legBRRef.current) {
      const sitBend = s.sittingLerp * 0.4
      legBRRef.current.rotation.x = Math.sin(t * legSpeed + Math.PI * 1.5) * legSwing + sitBend
    }

    // ── Head ─────────────────────────────────────────
    if (headRef.current) {
      if (s.behavior === 'sleep') {
        headRef.current.rotation.x = 0.3 + Math.sin(t * 0.5) * 0.02
        headRef.current.position.y = 0.05
      } else if (s.behavior === 'sniff') {
        const sniffBob = Math.sin(t * 3) * 0.15
        headRef.current.rotation.x = 0.2 + sniffBob
        headRef.current.position.y = 0.06 - Math.abs(sniffBob) * 0.1
      } else if (s.behavior === 'play') {
        headRef.current.rotation.x = -0.15
        headRef.current.position.y = 0.08 + Math.abs(Math.sin(t * 6)) * 0.02
      } else {
        headRef.current.rotation.x = 0
        headRef.current.position.y = 0.08
      }
    }
  })

  return (
    <group ref={groupRef} scale={DOG_SCALE}>
      {/* Body - elongated */}
      <mesh castShadow position={[0, 0, 0]} scale={[1.6, 0.9, 0.9]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Belly */}
      <mesh position={[0, -0.06, 0]} scale={[1.3, 0.6, 0.7]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color={BELLY_COLOR} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0.22, 0.08, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>
        {/* Snout */}
        <mesh position={[0.08, -0.02, 0]} scale={[1.4, 0.7, 0.8]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>
        {/* Nose */}
        <mesh position={[0.14, -0.02, 0]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color={NOSE_COLOR} />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.06, 0.03, 0.05]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1a1008" />
        </mesh>
        <mesh position={[0.06, 0.03, -0.05]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1a1008" />
        </mesh>
        {/* Ears - floppy */}
        <mesh position={[-0.02, 0.06, 0.08]} rotation={[0.3, 0, 0.5]}>
          <coneGeometry args={[0.03, 0.08, 6]} />
          <meshStandardMaterial color={DARK_BROWN} />
        </mesh>
        <mesh position={[-0.02, 0.06, -0.08]} rotation={[-0.3, 0, 0.5]}>
          <coneGeometry args={[0.03, 0.08, 6]} />
          <meshStandardMaterial color={DARK_BROWN} />
        </mesh>
      </group>

      {/* Tail */}
      <group ref={tailRef} position={[-0.24, 0.06, 0]} rotation={[-0.4, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.015, 0.008, 0.15, 6]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#a88028" />
        </mesh>
      </group>

      {/* Front left leg */}
      <mesh ref={legFLRef} castShadow position={[0.1, -0.12, 0.06]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 6]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      {/* Front right leg */}
      <mesh ref={legFRRef} castShadow position={[0.1, -0.12, -0.06]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 6]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      {/* Back left leg */}
      <mesh ref={legBLRef} castShadow position={[-0.12, -0.12, 0.06]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 6]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      {/* Back right leg */}
      <mesh ref={legBRRef} castShadow position={[-0.12, -0.12, -0.06]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 6]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
    </group>
  )
}
