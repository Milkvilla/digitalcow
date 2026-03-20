import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from '../engine/types.ts'
import { SCENE_LAYOUT } from '../engine/constants.ts'
import { useGameStore } from '../ui/hooks.ts'

interface FenceSegmentProps {
  start: Vec3
  end: Vec3
}

function FenceSegment({ start, end }: FenceSegmentProps) {
  const { midX, midY, midZ, length, angle, postPositions } = useMemo(() => {
    const dx = end[0] - start[0]
    const dz = end[2] - start[2]
    const len = Math.sqrt(dx * dx + dz * dz)
    const ang = Math.atan2(dx, dz)

    const mx = (start[0] + end[0]) / 2
    const my = (start[1] + end[1]) / 2
    const mz = (start[2] + end[2]) / 2

    // Posts at start, end, and intermediate points
    const numPosts = Math.max(2, Math.floor(len / 2) + 1)
    const posts: Vec3[] = []
    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1)
      posts.push([
        start[0] + dx * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + dz * t,
      ])
    }

    return { midX: mx, midY: my, midZ: mz, length: len, angle: ang, postPositions: posts }
  }, [start, end])

  const postHeight = 0.8
  const railHeight1 = 0.3
  const railHeight2 = 0.6

  return (
    <group>
      {/* Fence posts */}
      {postPositions.map((pos, i) => (
        <mesh
          key={`post-${i}`}
          position={[pos[0], postHeight / 2, pos[2]]}
          castShadow
        >
          <boxGeometry args={[0.08, postHeight, 0.08]} />
          <meshStandardMaterial color="#6b4226" />
        </mesh>
      ))}

      {/* Lower rail */}
      <mesh
        position={[midX, midY + railHeight1, midZ]}
        rotation={[0, angle, 0]}
        castShadow
      >
        <boxGeometry args={[0.05, 0.05, length]} />
        <meshStandardMaterial color="#7a5230" />
      </mesh>

      {/* Upper rail */}
      <mesh
        position={[midX, midY + railHeight2, midZ]}
        rotation={[0, angle, 0]}
        castShadow
      >
        <boxGeometry args={[0.05, 0.05, length]} />
        <meshStandardMaterial color="#7a5230" />
      </mesh>
    </group>
  )
}

function GatePost({ position }: { position: Vec3 }) {
  return (
    <group>
      {/* Taller gate post */}
      <mesh position={[position[0], 0.55, position[2]]} castShadow>
        <boxGeometry args={[0.14, 1.1, 0.14]} />
        <meshStandardMaterial color="#5a3520" />
      </mesh>
      {/* Post cap */}
      <mesh position={[position[0], 1.12, position[2]]}>
        <boxGeometry args={[0.18, 0.06, 0.18]} />
        <meshStandardMaterial color="#4a2a18" />
      </mesh>
    </group>
  )
}

// ── Animated gate door ──────────────────────────────────

function GateDoor() {
  const gates = useGameStore((s) => s.world.gates)
  const isOpen = gates.length > 0 && gates[0].isOpen
  const doorRef = useRef<THREE.Group>(null!)
  const angleRef = useRef(isOpen ? -Math.PI / 2 : 0)

  useFrame((_state, delta) => {
    if (!doorRef.current) return
    const target = isOpen ? -Math.PI / 2 : 0
    angleRef.current += (target - angleRef.current) * Math.min(3 * delta, 1)
    doorRef.current.rotation.y = angleRef.current
  })

  const gateWidth = 3.8 // distance between posts (z: -2 to 2) minus post thickness
  const railColor = '#7a5230'
  const postColor = '#6b4226'

  return (
    <group position={[14, 0, -2]}>
      {/* Pivot at the left gate post (z = -2), swings inward */}
      <group ref={doorRef}>
        {/* Gate frame — vertical bars */}
        <mesh position={[0, 0.45, gateWidth * 0.02]} castShadow>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
          <meshStandardMaterial color={postColor} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.45, gateWidth * 0.98]} castShadow>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
          <meshStandardMaterial color={postColor} roughness={0.85} />
        </mesh>

        {/* Horizontal rails */}
        <mesh position={[0, 0.3, gateWidth / 2]} castShadow>
          <boxGeometry args={[0.05, 0.05, gateWidth]} />
          <meshStandardMaterial color={railColor} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.6, gateWidth / 2]} castShadow>
          <boxGeometry args={[0.05, 0.05, gateWidth]} />
          <meshStandardMaterial color={railColor} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.85, gateWidth / 2]} castShadow>
          <boxGeometry args={[0.04, 0.04, gateWidth]} />
          <meshStandardMaterial color={railColor} roughness={0.82} />
        </mesh>

        {/* Vertical slats */}
        {[0.2, 0.4, 0.6, 0.8].map((frac) => (
          <mesh key={frac} position={[0, 0.45, gateWidth * frac]} castShadow>
            <boxGeometry args={[0.035, 0.65, 0.035]} />
            <meshStandardMaterial color={railColor} roughness={0.85} />
          </mesh>
        ))}

        {/* Diagonal brace (cross support) */}
        <mesh
          position={[0, 0.45, gateWidth / 2]}
          rotation={[0, 0, Math.atan2(0.3, gateWidth)]}
          castShadow
        >
          <boxGeometry args={[0.035, 0.035, gateWidth * 0.95]} />
          <meshStandardMaterial color="#6a4a28" roughness={0.85} />
        </mesh>

        {/* Latch / handle */}
        <mesh position={[0.05, 0.5, gateWidth * 0.92]}>
          <boxGeometry args={[0.04, 0.08, 0.02]} />
          <meshStandardMaterial color="#555" metalness={0.6} roughness={0.35} />
        </mesh>

        {/* Hinge rings (at pivot post) */}
        <mesh position={[0, 0.3, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.025, 0.006, 4, 8]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.7, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.025, 0.006, 4, 8]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

export default function Fences() {
  return (
    <>
      {SCENE_LAYOUT.fences.map((fence, i) => (
        <FenceSegment key={i} start={fence.start} end={fence.end} />
      ))}
      {/* Gate posts at the gap on the right side */}
      <GatePost position={[14, 0, -2]} />
      <GatePost position={[14, 0, 2]} />
      {/* Animated gate door */}
      <GateDoor />
    </>
  )
}
