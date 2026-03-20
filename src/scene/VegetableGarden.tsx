import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'

// ── Constants ────────────────────────────────────────────

const GARDEN_POS: [number, number, number] = [-5, 0, 12.5]
const ROWS = 3
const COLS = 4
const PLOT_SPACING = 0.8
const STAGE_DURATION = 60 // sim-seconds per growth stage
const PLANT_TYPES = ['tomato', 'lettuce', 'pumpkin'] as const

type PlantType = (typeof PLANT_TYPES)[number]

// ── Plot state ───────────────────────────────────────────

interface PlotState {
  phase: number // 0-4 (0=empty, 1=sprouting, 2=growing, 3=ready, wraps to 0)
  type: PlantType
  growthTimer: number
}

// ── Fence helper (instanced posts + rails) ───────────────

function GardenFence() {
  const totalWidth = (COLS - 1) * PLOT_SPACING + 0.8
  const totalDepth = (ROWS - 1) * PLOT_SPACING + 0.8
  const hw = totalWidth / 2
  const hd = totalDepth / 2

  // Fence posts at corners and midpoints
  const postPositions: [number, number, number][] = [
    [-hw, 0.15, -hd],
    [hw, 0.15, -hd],
    [hw, 0.15, hd],
    [-hw, 0.15, hd],
    [0, 0.15, -hd],
    [0, 0.15, hd],
    [-hw, 0.15, 0],
    [hw, 0.15, 0],
  ]

  // Rails: horizontal bars between posts
  const rails: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = [
    // Front rail (z = -hd)
    { pos: [0, 0.18, -hd], rot: [0, 0, 0], len: totalWidth },
    { pos: [0, 0.08, -hd], rot: [0, 0, 0], len: totalWidth },
    // Back rail (z = +hd)
    { pos: [0, 0.18, hd], rot: [0, 0, 0], len: totalWidth },
    { pos: [0, 0.08, hd], rot: [0, 0, 0], len: totalWidth },
    // Left rail (x = -hw)
    { pos: [-hw, 0.18, 0], rot: [0, Math.PI / 2, 0], len: totalDepth },
    { pos: [-hw, 0.08, 0], rot: [0, Math.PI / 2, 0], len: totalDepth },
    // Right rail (x = +hw)
    { pos: [hw, 0.18, 0], rot: [0, Math.PI / 2, 0], len: totalDepth },
    { pos: [hw, 0.08, 0], rot: [0, Math.PI / 2, 0], len: totalDepth },
  ]

  return (
    <group>
      {/* Posts */}
      {postPositions.map((pos, i) => (
        <mesh key={`post-${i}`} position={pos} castShadow>
          <boxGeometry args={[0.05, 0.35, 0.05]} />
          <meshStandardMaterial color="#6b4226" flatShading />
        </mesh>
      ))}
      {/* Rails */}
      {rails.map((r, i) => (
        <mesh key={`rail-${i}`} position={r.pos} rotation={r.rot} castShadow>
          <boxGeometry args={[r.len, 0.025, 0.03]} />
          <meshStandardMaterial color="#7a5030" flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ── Individual plant renderers ───────────────────────────

function TomatoPlant({ stage }: { stage: number }) {
  if (stage === 0) return null

  return (
    <group>
      {/* Stem — grows with stage */}
      <mesh position={[0, stage * 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.015, stage * 0.16, 4]} />
        <meshStandardMaterial color="#3a7a22" flatShading />
      </mesh>

      {stage >= 2 && (
        <>
          {/* Leaves */}
          <mesh position={[0.04, 0.12, 0]} rotation={[0, 0, 0.6]}>
            <coneGeometry args={[0.03, 0.06, 3]} />
            <meshStandardMaterial color="#44aa22" flatShading />
          </mesh>
          <mesh position={[-0.04, 0.1, 0.02]} rotation={[0, 1.2, -0.5]}>
            <coneGeometry args={[0.025, 0.05, 3]} />
            <meshStandardMaterial color="#3d9920" flatShading />
          </mesh>
        </>
      )}

      {stage >= 3 && (
        /* Red tomato fruit */
        <mesh position={[0, stage * 0.16, 0]} castShadow>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#cc2222" flatShading />
        </mesh>
      )}
    </group>
  )
}

function LettucePlant({ stage }: { stage: number }) {
  if (stage === 0) return null

  const layers = stage
  return (
    <group>
      {Array.from({ length: layers }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.02 + i * 0.025, 0]}
          castShadow
          scale={[0.8 + i * 0.15, 0.6, 0.8 + i * 0.15]}
        >
          <sphereGeometry args={[0.06, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#55bb33' : '#44aa22'}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

function PumpkinPlant({ stage }: { stage: number }) {
  if (stage === 0) return null

  return (
    <group>
      {/* Vine/stem */}
      <mesh position={[0, 0.015, 0]} rotation={[0, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.008, 0.01, stage * 0.06, 4]} />
        <meshStandardMaterial color="#3a7a22" flatShading />
      </mesh>

      {stage >= 2 && (
        /* Leaf */
        <mesh position={[0.05, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0.4]}>
          <coneGeometry args={[0.04, 0.06, 5]} />
          <meshStandardMaterial color="#44aa22" flatShading />
        </mesh>
      )}

      {stage >= 3 && (
        /* Pumpkin fruit — partially in ground */
        <mesh position={[0.03, 0.04, 0.02]} castShadow>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshStandardMaterial color="#dd8822" flatShading />
        </mesh>
      )}
    </group>
  )
}

function Plant({ type, stage }: { type: PlantType; stage: number }) {
  switch (type) {
    case 'tomato':
      return <TomatoPlant stage={stage} />
    case 'lettuce':
      return <LettucePlant stage={stage} />
    case 'pumpkin':
      return <PumpkinPlant stage={stage} />
  }
}

// ── Main component ───────────────────────────────────────

export default function VegetableGarden() {
  // Initialize plot states with random phases and types
  const plots = useRef<PlotState[]>(
    Array.from({ length: ROWS * COLS }, (_, i) => ({
      phase: Math.floor(((i * 37 + 11) % 13) / 13 * 4), // pseudo-random 0-3
      type: PLANT_TYPES[i % PLANT_TYPES.length],
      growthTimer: ((i * 23 + 7) % STAGE_DURATION), // stagger start times
    })),
  )

  // Counter to force re-render when any plot changes stage
  const [, setGrowthTick] = useState(0)

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1)
    let changed = false

    for (let i = 0; i < plots.current.length; i++) {
      const plot = plots.current[i]
      plot.growthTimer += dt

      if (plot.growthTimer >= STAGE_DURATION) {
        plot.growthTimer -= STAGE_DURATION
        plot.phase = (plot.phase + 1) % 4
        changed = true
      }
    }

    if (changed) {
      setGrowthTick((t) => t + 1)
    }
  })

  // Compute plot positions
  const plotPositions = useMemo(() => {
    const positions: [number, number][] = []
    const startX = -((COLS - 1) * PLOT_SPACING) / 2
    const startZ = -((ROWS - 1) * PLOT_SPACING) / 2
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        positions.push([startX + col * PLOT_SPACING, startZ + row * PLOT_SPACING])
      }
    }
    return positions
  }, [])

  return (
    <group position={GARDEN_POS}>
      {/* Garden fence */}
      <GardenFence />

      {/* Dirt base */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[(COLS - 1) * PLOT_SPACING + 0.6, (ROWS - 1) * PLOT_SPACING + 0.6]} />
        <meshStandardMaterial color="#6b4a2a" flatShading />
      </mesh>

      {/* Individual plots */}
      {plotPositions.map(([px, pz], i) => {
        const plot = plots.current[i]
        return (
          <group key={i} position={[px, 0, pz]}>
            {/* Dirt mound */}
            <mesh position={[0, 0.025, 0]} receiveShadow>
              <boxGeometry args={[0.4, 0.05, 0.4]} />
              <meshStandardMaterial color="#8a6a3a" flatShading />
            </mesh>

            {/* Furrow lines */}
            <mesh position={[0, 0.015, -0.1]}>
              <boxGeometry args={[0.35, 0.01, 0.03]} />
              <meshStandardMaterial color="#7a5a2a" flatShading />
            </mesh>
            <mesh position={[0, 0.015, 0.1]}>
              <boxGeometry args={[0.35, 0.01, 0.03]} />
              <meshStandardMaterial color="#7a5a2a" flatShading />
            </mesh>

            {/* Plant */}
            <group position={[0, 0.05, 0]}>
              <Plant type={plot.type} stage={plot.phase} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
