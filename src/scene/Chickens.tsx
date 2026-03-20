import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Chicken colors ──────────────────────────────────────
const CHICKEN_COLORS = ['#f5f0e8', '#f0e0c8', '#c89060', '#e8d8c0', '#d0a870', '#f8f2ea', '#b87838', '#e0c898']
const BEAK_COLOR = '#e8c020'
const COMB_COLOR = '#cc2020'
const LEG_COLOR = '#d8a030'

// ── Flock center ────────────────────────────────────────
const FLOCK_X = -7
const FLOCK_Z = 12
const FLOCK_RADIUS = 3

interface ChickenState {
  x: number; z: number
  targetX: number; targetZ: number
  state: 'pecking' | 'walking' | 'idle' | 'scattered'
  timer: number; angle: number; headBob: number
  color: string; scaleVar: number
}

// ── Main flock component ────────────────────────────────

export default function Chickens() {
  const count = 7
  const chickenRefs = useRef<(THREE.Group | null)[]>([])

  // Seed initial states with useMemo
  const chickenStates = useRef<ChickenState[]>(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const r = 1 + (i * 0.7) % 3
      return {
        x: FLOCK_X + Math.cos(angle) * r,
        z: FLOCK_Z + Math.sin(angle) * r,
        targetX: FLOCK_X + Math.cos(angle + 1) * r,
        targetZ: FLOCK_Z + Math.sin(angle + 1) * r,
        state: 'pecking' as const,
        timer: 3 + (i * 1.1) % 2,
        angle: angle,
        headBob: 0,
        color: CHICKEN_COLORS[i % CHICKEN_COLORS.length],
        scaleVar: 0.9 + (i % 3) * 0.1,
      }
    })
  )

  useFrame((frameState, delta) => {
    const t = frameState.clock.elapsedTime
    const cowPos = gameStore.getState().cow.position
    const dt = Math.min(delta, 0.05) // cap delta

    for (let i = 0; i < count; i++) {
      const s = chickenStates.current[i]
      const group = chickenRefs.current[i]
      if (!group) continue

      const headGroup = group.children[1] as THREE.Group // head group
      const legL = group.children[5] as THREE.Mesh
      const legR = group.children[6] as THREE.Mesh

      // Check cow proximity for scatter
      const dxCow = s.x - cowPos[0]
      const dzCow = s.z - cowPos[2]
      const cowDist = Math.sqrt(dxCow * dxCow + dzCow * dzCow)

      if (cowDist < 3 && s.state !== 'scattered') {
        s.state = 'scattered'
        s.timer = 2
        // Scatter away from cow
        const awayAngle = Math.atan2(dzCow, dxCow)
        s.targetX = s.x + Math.cos(awayAngle) * 4
        s.targetZ = s.z + Math.sin(awayAngle) * 4
      }

      s.timer -= dt

      // State transitions
      if (s.timer <= 0) {
        switch (s.state) {
          case 'pecking':
            s.state = 'idle'
            s.timer = 1 + Math.random()
            break
          case 'idle':
            s.state = 'walking'
            s.timer = 2 + Math.random() * 3
            // Pick new target near flock center
            const walkAngle = Math.random() * Math.PI * 2
            const walkR = Math.random() * FLOCK_RADIUS * 0.8
            s.targetX = FLOCK_X + Math.cos(walkAngle) * walkR
            s.targetZ = FLOCK_Z + Math.sin(walkAngle) * walkR
            break
          case 'walking':
            s.state = 'pecking'
            s.timer = 3 + Math.random() * 2
            break
          case 'scattered':
            s.state = 'pecking'
            s.timer = 3 + Math.random() * 2
            break
        }
      }

      // Movement
      const speed = s.state === 'scattered' ? 2.0 : s.state === 'walking' ? 0.3 : 0
      if (speed > 0) {
        const dx = s.targetX - s.x
        const dz = s.targetZ - s.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > 0.1) {
          s.x += (dx / dist) * speed * dt
          s.z += (dz / dist) * speed * dt
          s.angle = Math.atan2(dx, dz)
        }
      }

      // Clamp to flock radius
      const fDx = s.x - FLOCK_X
      const fDz = s.z - FLOCK_Z
      const fDist = Math.sqrt(fDx * fDx + fDz * fDz)
      if (fDist > FLOCK_RADIUS) {
        s.x = FLOCK_X + (fDx / fDist) * FLOCK_RADIUS
        s.z = FLOCK_Z + (fDz / fDist) * FLOCK_RADIUS
      }

      // Apply position
      group.position.set(s.x, 0, s.z)
      group.rotation.y = s.angle

      // Head animation
      if (headGroup) {
        if (s.state === 'pecking') {
          // Pecking: head bobs down
          const peckPhase = Math.sin(t * 6 + i * 2) * 0.5 + 0.5
          headGroup.rotation.x = peckPhase * 0.6
          headGroup.position.y = 0.22 - peckPhase * 0.06
          headGroup.position.x = 0.07 + peckPhase * 0.02
        } else if (s.state === 'walking') {
          // Walking: head bobs forward
          const walkBob = Math.sin(t * 8 + i) * 0.3
          headGroup.rotation.x = walkBob * 0.2
          headGroup.position.y = 0.22
          headGroup.position.x = 0.07 + Math.abs(walkBob) * 0.015
        } else if (s.state === 'idle') {
          // Idle: occasional head turn
          headGroup.rotation.x = 0
          headGroup.rotation.y = Math.sin(t * 0.8 + i * 3) * 0.4
          headGroup.position.y = 0.22
          headGroup.position.x = 0.07
        } else {
          // Scattered: head stretched forward
          headGroup.rotation.x = -0.2
          headGroup.position.y = 0.22
          headGroup.position.x = 0.09
        }
      }

      // Leg animation (walking / scattered)
      if (legL && legR) {
        if (s.state === 'walking' || s.state === 'scattered') {
          const legSpeed = s.state === 'scattered' ? 14 : 8
          legL.rotation.x = Math.sin(t * legSpeed + i) * 0.4
          legR.rotation.x = Math.sin(t * legSpeed + i + Math.PI) * 0.4
        } else {
          legL.rotation.x = 0
          legR.rotation.x = 0
        }
      }
    }
  })

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          ref={(el) => { chickenRefs.current[i] = el }}
          scale={chickenStates.current[i].scaleVar}
        >
          {/* Body */}
          <mesh castShadow position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color={chickenStates.current[i].color} flatShading />
          </mesh>

          {/* Head group */}
          <group position={[0.07, 0.22, 0]}>
            <mesh>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshStandardMaterial color={chickenStates.current[i].color} flatShading />
            </mesh>
            <mesh position={[0.04, -0.005, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.012, 0.03, 4]} />
              <meshStandardMaterial color={BEAK_COLOR} flatShading />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.018, 4, 4]} />
              <meshStandardMaterial color={COMB_COLOR} flatShading />
            </mesh>
            <mesh position={[0.03, 0.01, 0.02]}>
              <sphereGeometry args={[0.006, 4, 4]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.03, 0.01, -0.02]}>
              <sphereGeometry args={[0.006, 4, 4]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>

          {/* Tail */}
          <mesh position={[-0.1, 0.16, 0]} rotation={[0, 0, Math.PI / 4]}>
            <coneGeometry args={[0.025, 0.06, 4]} />
            <meshStandardMaterial color={CHICKEN_COLORS[(i + 2) % CHICKEN_COLORS.length]} flatShading />
          </mesh>

          {/* Left wing */}
          <mesh position={[0, 0.12, 0.065]} scale={[0.06, 0.04, 0.015]}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial color={CHICKEN_COLORS[(i + 1) % CHICKEN_COLORS.length]} flatShading />
          </mesh>

          {/* Right wing */}
          <mesh position={[0, 0.12, -0.065]} scale={[0.06, 0.04, 0.015]}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial color={CHICKEN_COLORS[(i + 1) % CHICKEN_COLORS.length]} flatShading />
          </mesh>

          {/* Left leg */}
          <mesh position={[0, 0.03, 0.025]}>
            <cylinderGeometry args={[0.005, 0.005, 0.06, 4]} />
            <meshStandardMaterial color={LEG_COLOR} flatShading />
          </mesh>

          {/* Right leg */}
          <mesh position={[0, 0.03, -0.025]}>
            <cylinderGeometry args={[0.005, 0.005, 0.06, 4]} />
            <meshStandardMaterial color={LEG_COLOR} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}
