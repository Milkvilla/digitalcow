import { useMemo } from 'react'
import type { Vec3 } from '../engine/types.ts'
import { SCENE_LAYOUT } from '../engine/constants.ts'

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

export default function Fences() {
  return (
    <>
      {SCENE_LAYOUT.fences.map((fence, i) => (
        <FenceSegment key={i} start={fence.start} end={fence.end} />
      ))}
      {/* Gate posts at the gap on the right side */}
      <GatePost position={[14, 0, -2]} />
      <GatePost position={[14, 0, 2]} />
    </>
  )
}
