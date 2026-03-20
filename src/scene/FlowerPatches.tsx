import { useRef, useMemo } from 'react'
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

const FLOWERS_PER_PATCH = [22, 20, 24, 18]
const PATCH_RADIUS = 2.2

const FLOWER_COLORS = [
  new THREE.Color('#e03030'),   // red
  new THREE.Color('#e8c020'),   // yellow
  new THREE.Color('#8030a0'),   // purple
  new THREE.Color('#f0e8e0'),   // white
  new THREE.Color('#e06080'),   // pink
  new THREE.Color('#4060d0'),   // blue
  new THREE.Color('#ff6830'),   // orange
  new THREE.Color('#d0a0e0'),   // lavender
]

const STEM_COLOR = new THREE.Color('#2a7020')
const CENTER_COLORS = [
  new THREE.Color('#e8c820'),   // golden
  new THREE.Color('#f0d840'),   // bright yellow
  new THREE.Color('#c8a010'),   // deep gold
]

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

interface FlowerData {
  x: number
  y: number
  z: number
  stemHeight: number
  headSize: number
  colorIndex: number
  petalCount: number
  centerColorIndex: number
  phase: number
  type: 'daisy' | 'tulip' | 'wildflower'
}

function generateFlowers(): FlowerData[] {
  const rng = seededRandom(42)
  const flowers: FlowerData[] = []

  for (let p = 0; p < PATCH_CENTERS.length; p++) {
    const [cx, , cz] = PATCH_CENTERS[p]
    const count = FLOWERS_PER_PATCH[p]

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2
      const dist = Math.sqrt(rng()) * PATCH_RADIUS  // sqrt for even distribution
      const x = cx + Math.cos(angle) * dist
      const z = cz + Math.sin(angle) * dist
      const stemHeight = 0.14 + rng() * 0.18
      const headSize = 0.025 + rng() * 0.025
      const typeRoll = rng()

      flowers.push({
        x,
        y: 0,
        z,
        stemHeight,
        headSize,
        colorIndex: Math.floor(rng() * FLOWER_COLORS.length),
        petalCount: 5 + Math.floor(rng() * 4),  // 5-8 petals
        centerColorIndex: Math.floor(rng() * CENTER_COLORS.length),
        phase: rng() * Math.PI * 2,
        type: typeRoll < 0.5 ? 'daisy' : typeRoll < 0.8 ? 'tulip' : 'wildflower',
      })
    }
  }

  return flowers
}

// ── Petal geometry (elongated teardrop shape) ───────────

function createPetalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  // Teardrop petal
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(0.4, 0.3, 0.3, 0.8)
  shape.quadraticCurveTo(0, 1.0, -0.3, 0.8)
  shape.quadraticCurveTo(-0.4, 0.3, 0, 0)
  const geo = new THREE.ShapeGeometry(shape, 4)
  geo.scale(0.04, 0.05, 1)
  return geo
}

// ── Single flower component (low-poly but with actual petals) ──

function Flower({ data }: { data: FlowerData }) {
  const groupRef = useRef<THREE.Group>(null!)
  const petalGeo = useMemo(() => createPetalGeometry(), [])
  const petalColor = FLOWER_COLORS[data.colorIndex]
  const centerColor = CENTER_COLORS[data.centerColorIndex]

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const wind = gameStore.getState().world.windStrength
    const sway = Math.sin(t * 1.5 + data.phase) * wind * 0.12
    groupRef.current.rotation.x = sway
    groupRef.current.rotation.z = sway * 0.7
  })

  return (
    <group ref={groupRef} position={[data.x, 0, data.z]}>
      {/* Stem */}
      <mesh position={[0, data.stemHeight * 0.5, 0]}>
        <cylinderGeometry args={[0.006, 0.009, data.stemHeight, 4]} />
        <meshStandardMaterial color={STEM_COLOR} />
      </mesh>

      {/* Small leaf on stem */}
      <mesh
        position={[0.02, data.stemHeight * 0.35, 0]}
        rotation={[0.3, 0.5, 0.8]}
        scale={[0.6, 0.6, 0.6]}
      >
        <planeGeometry args={[0.03, 0.05]} />
        <meshStandardMaterial color="#2a8020" side={THREE.DoubleSide} />
      </mesh>

      {/* Flower head group */}
      <group position={[0, data.stemHeight, 0]}>
        {data.type === 'daisy' || data.type === 'wildflower' ? (
          <>
            {/* Petals arranged radially */}
            {Array.from({ length: data.petalCount }).map((_, i) => {
              const angle = (i / data.petalCount) * Math.PI * 2
              const tiltOut = 0.3 + (data.type === 'wildflower' ? 0.15 : 0)
              return (
                <mesh
                  key={i}
                  geometry={petalGeo}
                  position={[
                    Math.cos(angle) * data.headSize * 0.3,
                    0.005,
                    Math.sin(angle) * data.headSize * 0.3,
                  ]}
                  rotation={[
                    -Math.PI / 2 + tiltOut,
                    0,
                    angle,
                  ]}
                  scale={data.headSize / 0.025}
                >
                  <meshStandardMaterial color={petalColor} side={THREE.DoubleSide} roughness={0.5} />
                </mesh>
              )
            })}
            {/* Center pistil */}
            <mesh position={[0, 0.008, 0]}>
              <sphereGeometry args={[data.headSize * 0.35, 6, 6]} />
              <meshStandardMaterial color={centerColor} roughness={0.4} />
            </mesh>
          </>
        ) : (
          /* Tulip: cup shape with overlapping petals */
          <>
            {Array.from({ length: 5 }).map((_, i) => {
              const angle = (i / 5) * Math.PI * 2
              return (
                <mesh
                  key={i}
                  position={[
                    Math.cos(angle) * data.headSize * 0.15,
                    data.headSize * 0.4,
                    Math.sin(angle) * data.headSize * 0.15,
                  ]}
                  rotation={[-0.15, 0, angle]}
                  scale={data.headSize / 0.025}
                >
                  <coneGeometry args={[0.025, 0.06, 4]} />
                  <meshStandardMaterial color={petalColor} side={THREE.DoubleSide} roughness={0.4} />
                </mesh>
              )
            })}
          </>
        )}
      </group>
    </group>
  )
}

// ── Component ────────────────────────────────────────────

export default function FlowerPatches() {
  const flowers = useMemo(() => generateFlowers(), [])

  return (
    <>
      {flowers.map((f, i) => (
        <Flower key={i} data={f} />
      ))}
    </>
  )
}
