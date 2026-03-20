import { useMemo } from 'react'
import * as THREE from 'three'

// ── Seeded random for deterministic stone placement ─────

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Stone colors ────────────────────────────────────────

const STONE_COLORS = ['#7a7268', '#8a8078', '#6a6258', '#9a9088']

// ── Stone description ───────────────────────────────────

interface StoneDesc {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
}

export default function StonePath() {
  const stones = useMemo(() => {
    const rng = seededRng(31415)

    // Cubic bezier from gate to trough area
    const p0 = new THREE.Vector3(14, 0, 0)    // start: gate
    const p1 = new THREE.Vector3(8, 0, 1.5)   // control 1: gentle curve
    const p2 = new THREE.Vector3(0, 0, 4)     // control 2: toward barn area
    const p3 = new THREE.Vector3(-6, 0, 5)    // end: trough near barn

    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3)

    const result: StoneDesc[] = []
    const stoneCount = 28

    for (let i = 0; i < stoneCount; i++) {
      const t = i / (stoneCount - 1)
      const point = curve.getPoint(t)

      // Offset perpendicular to path for natural width
      const tangent = curve.getTangent(t)
      const perpX = -tangent.z
      const perpZ = tangent.x
      const lateralOffset = (rng() - 0.5) * 0.6
      const forwardJitter = (rng() - 0.5) * 0.15

      const x = point.x + perpX * lateralOffset + tangent.x * forwardJitter
      const z = point.z + perpZ * lateralOffset + tangent.z * forwardJitter

      // Random stone size and rotation
      const baseWidth = 0.25 + rng() * 0.3
      const baseDepth = 0.2 + rng() * 0.25

      result.push({
        position: [x, 0.01, z],
        rotation: [0, rng() * Math.PI * 2, 0],
        scale: [baseWidth, 0.02 + rng() * 0.015, baseDepth],
        color: STONE_COLORS[Math.floor(rng() * STONE_COLORS.length)],
      })

      // Sometimes add a smaller companion stone
      if (rng() < 0.4) {
        const cx = x + (rng() - 0.5) * 0.4
        const cz = z + (rng() - 0.5) * 0.3
        const cWidth = 0.12 + rng() * 0.15
        const cDepth = 0.1 + rng() * 0.12

        result.push({
          position: [cx, 0.01, cz],
          rotation: [0, rng() * Math.PI * 2, 0],
          scale: [cWidth, 0.015 + rng() * 0.01, cDepth],
          color: STONE_COLORS[Math.floor(rng() * STONE_COLORS.length)],
        })
      }
    }

    return result
  }, [])

  return (
    <>
      {stones.map((stone, i) => (
        <mesh
          key={i}
          position={stone.position}
          rotation={stone.rotation}
          scale={stone.scale}
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={stone.color} flatShading />
        </mesh>
      ))}
    </>
  )
}
