import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Constants ────────────────────────────────────────────

const SCENE_HALF = 30

// ── Types ────────────────────────────────────────────────

interface FlockDef {
  birdCount: number
  offsets: { x: number; z: number }[]
  direction: number
  speed: number
  height: number
  progress: number
  lateralOffset: number
  delay: number
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

function createFlocks(rng: () => number): FlockDef[] {
  const flocks: FlockDef[] = []
  for (let f = 0; f < 3; f++) {
    const birdCount = 4 + Math.floor(rng() * 5)
    const offsets: { x: number; z: number }[] = []
    for (let b = 0; b < birdCount; b++) {
      const side = b % 2 === 0 ? 1 : -1
      const row = Math.ceil(b / 2)
      offsets.push({
        x: side * row * 1.2 + (rng() - 0.5) * 0.3,
        z: -row * 1.5 + (rng() - 0.5) * 0.3,
      })
    }
    flocks.push({
      birdCount,
      offsets,
      direction: rng() * Math.PI * 2,
      speed: 1.5 + rng() * 1.5,
      height: 14 + rng() * 6,
      progress: -SCENE_HALF,
      lateralOffset: (rng() - 0.5) * 8,
      delay: f * 15 + rng() * 10,
    })
  }
  return flocks
}

function resetFlock(flock: FlockDef, rng: () => number) {
  flock.direction = rng() * Math.PI * 2
  flock.speed = 1.5 + rng() * 1.5
  flock.height = 14 + rng() * 6
  flock.progress = -SCENE_HALF
  flock.lateralOffset = (rng() - 0.5) * 8
  flock.delay = 8 + rng() * 12
}

// ── Component ────────────────────────────────────────────

export default function BirdsOverhead() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const rngRef = useRef(seededRandom(77))
  const flocks = useMemo(() => createFlocks(rngRef.current), [])
  const totalBirds = useMemo(() => flocks.reduce((s, f) => s + f.birdCount, 0), [flocks])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // V-shape geometry: two triangular wings forming a shallow V (like a seagull silhouette)
  const vGeo = useMemo(() => {
    const verts = new Float32Array([
      // Left wing (triangle)
      -1.2, 0, -0.1,
      0, 0, 0,
      -0.8, 0.12, -0.4,
      // Right wing (triangle)
      0, 0, 0,
      1.2, 0, -0.1,
      0.8, 0.12, -0.4,
    ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    const t = _state.clock.elapsedTime
    const timeOfDay = gameStore.getState().world.timeOfDay
    const isDay = timeOfDay >= 6 && timeOfDay <= 20

    let idx = 0

    for (const flock of flocks) {
      // Handle delay
      if (flock.delay > 0) {
        flock.delay -= delta
        for (let b = 0; b < flock.birdCount; b++) {
          dummy.position.set(0, -100, 0)
          dummy.scale.set(0, 0, 0)
          dummy.updateMatrix()
          meshRef.current.setMatrixAt(idx++, dummy.matrix)
        }
        continue
      }

      // Advance
      flock.progress += flock.speed * delta

      // Reset when crossing scene
      if (flock.progress > SCENE_HALF) {
        resetFlock(flock, rngRef.current)
        for (let b = 0; b < flock.birdCount; b++) {
          dummy.position.set(0, -100, 0)
          dummy.scale.set(0, 0, 0)
          dummy.updateMatrix()
          meshRef.current.setMatrixAt(idx++, dummy.matrix)
        }
        continue
      }

      const cosD = Math.cos(flock.direction)
      const sinD = Math.sin(flock.direction)

      for (let b = 0; b < flock.birdCount; b++) {
        if (!isDay) {
          dummy.position.set(0, -100, 0)
          dummy.scale.set(0, 0, 0)
          dummy.updateMatrix()
          meshRef.current.setMatrixAt(idx++, dummy.matrix)
          continue
        }

        const off = flock.offsets[b]
        const lx = off.x + flock.lateralOffset
        const lz = flock.progress + off.z
        const wx = cosD * lx - sinD * lz
        const wz = sinD * lx + cosD * lz
        const wy = flock.height + Math.sin(t * 0.3 + b * 0.5) * 0.4

        dummy.position.set(wx, wy, wz)
        dummy.rotation.set(
          Math.sin(t * 0.5 + b) * 0.05,        // gentle pitch
          flock.direction + Math.PI / 2,         // face travel direction
          Math.sin(t * 0.3 + b * 0.7) * 0.03,   // gentle roll
        )
        dummy.scale.set(0.5, 0.5, 0.5)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx++, dummy.matrix)
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[vGeo, undefined, totalBirds]}
      frustumCulled={false}
    >
      <meshBasicMaterial color="#1a1a1a" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}
