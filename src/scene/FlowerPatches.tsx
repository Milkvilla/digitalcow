import { useRef, useMemo, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Constants ────────────────────────────────────────────

const PATCH_CENTERS: [number, number, number][] = [
  [5, 0, 5],
  [-3, 0, 11],
  [6, 0, -10],
  [-13, 0, 2],
]

const FLOWERS_PER_PATCH = [20, 18, 22, 16]
const PATCH_RADIUS = 2

const FLOWER_COLORS = [
  new THREE.Color('#e03030'),
  new THREE.Color('#e8c020'),
  new THREE.Color('#8030a0'),
  new THREE.Color('#f0e8e0'),
  new THREE.Color('#e06080'),
  new THREE.Color('#4060d0'),
]

const STEM_COLOR = new THREE.Color('#3a8828')

// ── Helpers ──────────────────────────────────────────────

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface FlowerData {
  x: number
  y: number
  z: number
  stemHeight: number
  headSize: number
  colorIndex: number
  phase: number
}

function generateFlowers(): FlowerData[] {
  const rng = seededRandom(42)
  const flowers: FlowerData[] = []

  for (let p = 0; p < PATCH_CENTERS.length; p++) {
    const [cx, , cz] = PATCH_CENTERS[p]
    const count = FLOWERS_PER_PATCH[p]

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2
      const dist = rng() * PATCH_RADIUS
      const x = cx + Math.cos(angle) * dist
      const z = cz + Math.sin(angle) * dist
      const stemHeight = 0.15 + rng() * 0.15
      const headSize = 0.03 + rng() * 0.03

      flowers.push({
        x,
        y: 0,
        z,
        stemHeight,
        headSize,
        colorIndex: Math.floor(rng() * FLOWER_COLORS.length),
        phase: rng() * Math.PI * 2,
      })
    }
  }

  return flowers
}

// ── Component ────────────────────────────────────────────

export default function FlowerPatches() {
  const stemRef = useRef<THREE.InstancedMesh>(null!)
  const headRef = useRef<THREE.InstancedMesh>(null!)

  const flowers = useMemo(() => generateFlowers(), [])
  const count = flowers.length
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.008, 0.01, 1, 4), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(1, 5, 4), [])

  // Set initial matrices and vertex colors for heads
  useLayoutEffect(() => {
    if (!stemRef.current || !headRef.current) return

    // Set vertex colors on the head instanced mesh
    const headColors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const f = flowers[i]
      const color = FLOWER_COLORS[f.colorIndex]
      headColors[i * 3] = color.r
      headColors[i * 3 + 1] = color.g
      headColors[i * 3 + 2] = color.b

      // Stem
      dummy.position.set(f.x, f.stemHeight * 0.5, f.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, f.stemHeight, 1)
      dummy.updateMatrix()
      stemRef.current.setMatrixAt(i, dummy.matrix)

      // Head
      dummy.position.set(f.x, f.stemHeight, f.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(f.headSize, f.headSize, f.headSize)
      dummy.updateMatrix()
      headRef.current.setMatrixAt(i, dummy.matrix)
    }

    stemRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true

    // Apply instance colors
    headRef.current.instanceColor = new THREE.InstancedBufferAttribute(headColors, 3)
    headRef.current.instanceColor.needsUpdate = true
  }, [flowers, count, dummy])

  useFrame((state) => {
    if (!stemRef.current || !headRef.current) return

    const t = state.clock.elapsedTime
    const wind = gameStore.getState().world.windStrength

    for (let i = 0; i < count; i++) {
      const f = flowers[i]
      const sway = Math.sin(t * 1.5 + f.phase) * wind * 0.1

      // Stem — sway rotation applied at base position
      dummy.position.set(f.x, f.stemHeight * 0.5, f.z)
      dummy.rotation.set(sway, 0, sway * 0.7)
      dummy.scale.set(1, f.stemHeight, 1)
      dummy.updateMatrix()
      stemRef.current.setMatrixAt(i, dummy.matrix)

      // Head — follows top of stem with sway offset
      const headOffsetX = Math.sin(sway) * f.stemHeight
      const headOffsetZ = Math.sin(sway * 0.7) * f.stemHeight
      dummy.position.set(
        f.x + headOffsetX,
        f.stemHeight * Math.cos(sway),
        f.z + headOffsetZ,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(f.headSize, f.headSize, f.headSize)
      dummy.updateMatrix()
      headRef.current.setMatrixAt(i, dummy.matrix)
    }

    stemRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={stemRef} args={[stemGeometry, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={STEM_COLOR} flatShading />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[headGeometry, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial flatShading />
      </instancedMesh>
    </>
  )
}
