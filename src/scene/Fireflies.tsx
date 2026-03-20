import { useRef, useMemo, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Constants ────────────────────────────────────────────

const FIREFLY_COUNT = 40

/** Field bounds */
const FIELD_MIN_X = -14
const FIELD_MAX_X = 14
const FIELD_MIN_Z = -12
const FIELD_MAX_Z = 14

/** Pond location — fireflies avoid this area */
const POND_X = -8
const POND_Z = -5
const POND_RADIUS = 3.5

// ── Types ────────────────────────────────────────────────

interface FireflyDef {
  x: number
  y: number
  z: number
  /** Velocity components for wandering */
  vx: number
  vy: number
  vz: number
  /** Blink cycle speed (radians/sec) */
  blinkSpeed: number
  /** Blink phase offset */
  blinkPhase: number
  /** Base size */
  size: number
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

function isInPond(x: number, z: number): boolean {
  const dx = x - POND_X
  const dz = z - POND_Z
  return dx * dx + dz * dz < POND_RADIUS * POND_RADIUS
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function createFireflies(): FireflyDef[] {
  const rng = seededRandom(123)
  const fireflies: FireflyDef[] = []

  let placed = 0
  while (placed < FIREFLY_COUNT) {
    const x = FIELD_MIN_X + rng() * (FIELD_MAX_X - FIELD_MIN_X)
    const z = FIELD_MIN_Z + rng() * (FIELD_MAX_Z - FIELD_MIN_Z)
    if (isInPond(x, z)) continue

    fireflies.push({
      x,
      y: 0.3 + rng() * 1.7,
      z,
      vx: (rng() - 0.5) * 0.4,
      vy: (rng() - 0.5) * 0.2,
      vz: (rng() - 0.5) * 0.4,
      blinkSpeed: (Math.PI * 2) / (2 + rng() * 3), // 2-5 second cycle
      blinkPhase: rng() * Math.PI * 2,
      size: 0.015 + rng() * 0.01,
    })
    placed++
  }

  return fireflies
}

// ── Component ────────────────────────────────────────────

export default function Fireflies({ timeOfDay }: { timeOfDay: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const fireflies = useMemo(() => createFireflies(), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 5, 4), [])

  // Compute visibility opacity based on time of day
  // Visible when timeOfDay < 6 or > 19
  // Fade in 19-20, fade out 5-6
  function getOpacity(tod: number): number {
    if (tod >= 20 || tod <= 5) return 1
    if (tod > 19 && tod < 20) return tod - 19 // 0..1
    if (tod > 5 && tod < 6) return 6 - tod // 1..0
    return 0
  }

  // Hide all initially
  useLayoutEffect(() => {
    if (!meshRef.current) return
    dummy.position.set(0, -100, 0)
    dummy.scale.set(0, 0, 0)
    dummy.updateMatrix()
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const t = state.clock.elapsedTime
    const opacity = getOpacity(timeOfDay)

    // Skip updates entirely during daytime
    if (opacity <= 0) {
      // Ensure hidden
      dummy.position.set(0, -100, 0)
      dummy.scale.set(0, 0, 0)
      dummy.updateMatrix()
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
      meshRef.current.instanceMatrix.needsUpdate = true
      return
    }

    // Update material opacity for fade transitions
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 2 + Math.sin(t * 0.5) * 1.5 // pulse between 0.5 and 3.5

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const f = fireflies[i]

      // Wander: change velocity slightly each frame
      f.vx += (Math.sin(t * 0.7 + i * 3.1) * 0.1 - f.vx * 0.02) * delta * 2
      f.vy += (Math.sin(t * 0.5 + i * 2.3) * 0.05 - f.vy * 0.02) * delta * 2
      f.vz += (Math.cos(t * 0.6 + i * 1.7) * 0.1 - f.vz * 0.02) * delta * 2

      f.x += f.vx * delta
      f.y += f.vy * delta
      f.z += f.vz * delta

      // Clamp to field bounds and height range
      f.x = clamp(f.x, FIELD_MIN_X, FIELD_MAX_X)
      f.z = clamp(f.z, FIELD_MIN_Z, FIELD_MAX_Z)
      f.y = clamp(f.y, 0.3, 2.0)

      // Push away from pond
      if (isInPond(f.x, f.z)) {
        const dx = f.x - POND_X
        const dz = f.z - POND_Z
        const dist = Math.sqrt(dx * dx + dz * dz)
        f.x += (dx / dist) * 0.1
        f.z += (dz / dist) * 0.1
      }

      // Blink pattern
      const brightness = Math.max(0, Math.sin(t * f.blinkSpeed + f.blinkPhase))
      const isOn = brightness > 0.3

      if (isOn) {
        const scaledSize = f.size * opacity
        dummy.position.set(f.x, f.y, f.z)
        dummy.scale.set(scaledSize, scaledSize, scaledSize)
      } else {
        dummy.position.set(f.x, f.y, f.z)
        dummy.scale.set(0, 0, 0)
      }

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, FIREFLY_COUNT]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color="#ffee44"
        emissive="#ffee44"
        emissiveIntensity={3}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  )
}
