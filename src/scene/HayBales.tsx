import { useMemo } from 'react'

// ── Hay bale data ────────────────────────────────────────

interface BaleDesc {
  position: [number, number, number]
  rotation: [number, number, number]
  radius: number
  height: number
  color: string
}

const BALE_COLORS = ['#c4a840', '#d4b850', '#b89830']

export default function HayBales() {
  const bales = useMemo<BaleDesc[]>(
    () => [
      // Bottom row — lying on side
      {
        position: [0, 0.35, 0],
        rotation: [Math.PI / 2, 0, 0.1],
        radius: 0.35,
        height: 0.5,
        color: BALE_COLORS[0],
      },
      {
        position: [0.75, 0.35, -0.1],
        rotation: [Math.PI / 2, 0, -0.05],
        radius: 0.35,
        height: 0.5,
        color: BALE_COLORS[1],
      },
      {
        position: [0.35, 0.35, 0.65],
        rotation: [Math.PI / 2, 0.3, 0.15],
        radius: 0.32,
        height: 0.48,
        color: BALE_COLORS[2],
      },
      // Stacked on top — second layer
      {
        position: [0.35, 1.0, 0.05],
        rotation: [Math.PI / 2, 0.2, -0.08],
        radius: 0.33,
        height: 0.48,
        color: BALE_COLORS[0],
      },
      // Leaning bale against the stack
      {
        position: [-0.55, 0.3, 0.3],
        rotation: [Math.PI / 2, 0, 0.45],
        radius: 0.3,
        height: 0.45,
        color: BALE_COLORS[1],
      },
    ],
    [],
  )

  return (
    <group position={[-12, 0, 6]}>
      {bales.map((bale, i) => (
        <mesh
          key={i}
          position={bale.position}
          rotation={bale.rotation}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[bale.radius, bale.radius, bale.height, 8]} />
          <meshStandardMaterial color={bale.color} flatShading />
        </mesh>
      ))}

      {/* Loose straw on ground */}
      <mesh position={[0.2, 0.01, 0.3]} rotation={[0, 0.5, 0]} receiveShadow>
        <boxGeometry args={[1.8, 0.02, 1.4]} />
        <meshStandardMaterial color="#d4b850" flatShading opacity={0.7} transparent />
      </mesh>
    </group>
  )
}
