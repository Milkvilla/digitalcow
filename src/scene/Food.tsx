import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { FoodItem } from '../engine/types'

interface FoodProps {
  item: FoodItem
}

// ── Hay pile — scattered straw strands ──────────────────

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }
}

function HayPile({ item }: FoodProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const amountFrac = Math.min(item.amount, 300) / 300
  const s = 0.5 + amountFrac * 0.5  // 0.5–1.0

  // Generate stable random strands from item id
  const strands = useMemo(() => {
    const seed = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rng = seededRandom(seed)
    const count = 30 + Math.floor(rng() * 15)
    const result: Array<{
      pos: [number, number, number]
      rot: [number, number, number]
      len: number
      thick: number
      color: string
    }> = []
    const colors = ['#c4a840', '#d4b850', '#b89830', '#dcc060', '#a88828', '#c8b040']
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2
      const radius = rng() * 0.5
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = rng() * 0.1
      const rx = (rng() - 0.5) * 1.6
      const ry = rng() * Math.PI * 2
      const rz = (rng() - 0.5) * 1.6
      const len = 0.2 + rng() * 0.35
      const thick = 0.008 + rng() * 0.01
      const color = colors[Math.floor(rng() * colors.length)]
      result.push({ pos: [x, y, z], rot: [rx, ry, rz], len, thick, color })
    }
    return result
  }, [item.id])

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.position.y =
      0.02 + Math.sin(state.clock.elapsedTime * 1.5 + item.position[0]) * 0.008
  })

  return (
    <group ref={groupRef} position={[item.position[0], 0.02, item.position[2]]} scale={s}>
      {/* Base mound */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <sphereGeometry args={[0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#b89830" flatShading />
      </mesh>
      {/* Scattered strands on top */}
      {strands.map((st, i) => (
        <mesh key={i} position={st.pos} rotation={st.rot} castShadow>
          <cylinderGeometry args={[st.thick, st.thick * 0.6, st.len, 3]} />
          <meshStandardMaterial color={st.color} flatShading />
        </mesh>
      ))}
      {/* Thick clumps */}
      <mesh position={[0.08, 0.04, -0.1]} rotation={[0.4, 0.8, 0.2]} castShadow>
        <boxGeometry args={[0.15, 0.04, 0.1]} />
        <meshStandardMaterial color="#c4a840" flatShading />
      </mesh>
      <mesh position={[-0.1, 0.03, 0.06]} rotation={[-0.3, 1.2, -0.1]} castShadow>
        <boxGeometry args={[0.12, 0.035, 0.08]} />
        <meshStandardMaterial color="#d4b850" flatShading />
      </mesh>
      <mesh position={[0.02, 0.05, 0.12]} rotation={[0.6, 0.3, 0.5]} castShadow>
        <boxGeometry args={[0.13, 0.03, 0.09]} />
        <meshStandardMaterial color="#dcc060" flatShading />
      </mesh>
    </group>
  )
}

// ── Apple ───────────────────────────────────────────────

function Apple({ item }: FoodProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const s = 0.5 + (item.amount / 60) * 0.5

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.position.y =
      0.1 + Math.sin(state.clock.elapsedTime * 1.8 + item.position[2]) * 0.015
  })

  return (
    <group ref={groupRef} position={[item.position[0], 0.1, item.position[2]]}>
      {/* Apple body */}
      <mesh castShadow scale={s}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#cc2222" flatShading />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.12 * s, 0]} scale={s}>
        <cylinderGeometry args={[0.008, 0.005, 0.05, 4]} />
        <meshStandardMaterial color="#5c3a1e" />
      </mesh>
      {/* Leaf */}
      <mesh position={[0.02 * s, 0.13 * s, 0]} rotation={[0, 0, 0.5]} scale={s * 0.7}>
        <coneGeometry args={[0.02, 0.04, 3]} />
        <meshStandardMaterial color="#44aa22" flatShading />
      </mesh>
      {/* Highlight */}
      <mesh position={[0.04 * s, 0.04 * s, 0.05 * s]} scale={s * 0.4}>
        <sphereGeometry args={[0.04, 5, 5]} />
        <meshStandardMaterial color="#ff6644" flatShading />
      </mesh>
    </group>
  )
}

// ── Carrot ──────────────────────────────────────────────

function Carrot({ item }: FoodProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const s = 0.5 + (item.amount / 70) * 0.5

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.position.y =
      0.06 + Math.sin(state.clock.elapsedTime * 1.6 + item.position[0] * 2) * 0.012
  })

  return (
    <group
      ref={groupRef}
      position={[item.position[0], 0.06, item.position[2]]}
      rotation={[0.15, 0, 0.3]}
    >
      {/* Carrot body */}
      <mesh castShadow scale={s} rotation={[0, 0, Math.PI * 0.6]}>
        <coneGeometry args={[0.05, 0.28, 6]} />
        <meshStandardMaterial color="#ee8833" flatShading />
      </mesh>
      {/* Carrot top / greens */}
      <mesh position={[0.1 * s, 0.06 * s, 0]} scale={s * 0.8}>
        <coneGeometry args={[0.03, 0.1, 4]} />
        <meshStandardMaterial color="#44aa22" flatShading />
      </mesh>
      <mesh position={[0.12 * s, 0.08 * s, 0.02]} rotation={[0, 0, 0.3]} scale={s * 0.6}>
        <coneGeometry args={[0.02, 0.08, 3]} />
        <meshStandardMaterial color="#55bb33" flatShading />
      </mesh>
    </group>
  )
}

// ── Food renderer ───────────────────────────────────────

function FoodPile({ item }: FoodProps) {
  switch (item.foodType) {
    case 'apple':
      return <Apple item={item} />
    case 'carrot':
      return <Carrot item={item} />
    case 'hay':
    default:
      return <HayPile item={item} />
  }
}

interface FoodItemsProps {
  foods: FoodItem[]
}

export default function FoodItems({ foods }: FoodItemsProps) {
  return (
    <>
      {foods.map((food) => (
        <FoodPile key={food.id} item={food} />
      ))}
    </>
  )
}
