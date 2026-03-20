import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Constants ────────────────────────────────────────────

const WRAP_BOUND = 20

// ── Types ────────────────────────────────────────────────

interface ShadowDef {
  x: number
  z: number
  width: number
  depth: number
  rotation: number
  opacity: number
}

// ── Helpers ──────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createShadows(): ShadowDef[] {
  const rng = seededRandom(55)
  const shadows: ShadowDef[] = []

  for (let i = 0; i < 4; i++) {
    shadows.push({
      x: (rng() - 0.5) * 30,
      z: (rng() - 0.5) * 20,
      width: 3 + rng() * 3,
      depth: 2 + rng() * 2,
      rotation: rng() * Math.PI,
      opacity: 0.04 + rng() * 0.03,
    })
  }

  return shadows
}

// ── Component ────────────────────────────────────────────

export default function CloudShadows() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const shadows = useMemo(() => createShadows(), [])

  useFrame((_state, delta) => {
    const wind = gameStore.getState().world.windStrength

    for (let i = 0; i < shadows.length; i++) {
      const shadow = shadows[i]
      shadow.x += delta * wind * 0.5

      // Wrap around when off-screen
      if (shadow.x > WRAP_BOUND) {
        shadow.x = -WRAP_BOUND
      }

      const mesh = meshRefs.current[i]
      if (mesh) {
        mesh.position.x = shadow.x
      }
    }
  })

  return (
    <>
      {shadows.map((shadow, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el
          }}
          position={[shadow.x, 0.01, shadow.z]}
          rotation={[-Math.PI / 2, 0, shadow.rotation]}
          scale={[shadow.width, shadow.depth, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#222222"
            transparent
            opacity={shadow.opacity}
            depthWrite={false}
            blending={THREE.MultiplyBlending}
          />
        </mesh>
      ))}
    </>
  )
}
