import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../ui/hooks.ts'

export default function Scarecrow() {
  const groupRef = useRef<THREE.Group>(null!)
  const shirtLeftRef = useRef<THREE.Mesh>(null!)
  const shirtRightRef = useRef<THREE.Mesh>(null!)
  const arrowRef = useRef<THREE.Group>(null!)
  const windStrength = useGameStore((s) => s.world.windStrength)
  const windDirection = useGameStore((s) => s.world.windDirection)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // Slight body sway in wind
    if (groupRef.current) {
      groupRef.current.rotation.z =
        Math.sin(t * 0.6) * windStrength * 0.03
      groupRef.current.rotation.x =
        Math.cos(t * 0.45) * windStrength * 0.02
    }

    // Tattered shirt flapping
    if (shirtLeftRef.current) {
      shirtLeftRef.current.rotation.y =
        Math.sin(t * 2.5 + 1.0) * windStrength * 0.3
      shirtLeftRef.current.rotation.z =
        0.15 + Math.sin(t * 1.8) * windStrength * 0.1
    }
    if (shirtRightRef.current) {
      shirtRightRef.current.rotation.y =
        Math.sin(t * 2.2 + 2.5) * windStrength * -0.3
      shirtRightRef.current.rotation.z =
        -0.15 + Math.cos(t * 1.6) * windStrength * -0.1
    }

    // Weathervane arrow smoothly tracks wind direction
    if (arrowRef.current) {
      const target = windDirection + Math.sin(t * 1.2) * windStrength * 0.08
      const curr = arrowRef.current.rotation.y
      arrowRef.current.rotation.y += (target - curr) * 0.04
    }
  })

  return (
    <group position={[4, 0, 3]} ref={groupRef}>
      {/* ── Vertical post ── */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 2.0, 6]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>

      {/* Post base (in ground) */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.04, 6]} />
        <meshStandardMaterial color="#3d2510" flatShading />
      </mesh>

      {/* ── Horizontal crossbar (arms) ── */}
      <mesh position={[0, 1.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 1.4, 6]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>

      {/* ── Head (pumpkin-like) ── */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshStandardMaterial color="#c47a30" flatShading />
      </mesh>
      {/* Vertical pumpkin ridges */}
      <mesh position={[0.08, 2.15, 0.15]} scale={[0.6, 0.9, 0.6]}>
        <sphereGeometry args={[0.18, 5, 5]} />
        <meshStandardMaterial color="#b06a28" flatShading />
      </mesh>

      {/* Eyes (dark indentations) */}
      <mesh position={[0.08, 2.18, 0.16]}>
        <boxGeometry args={[0.04, 0.04, 0.02]} />
        <meshStandardMaterial color="#2a1a08" flatShading />
      </mesh>
      <mesh position={[-0.08, 2.18, 0.16]}>
        <boxGeometry args={[0.04, 0.04, 0.02]} />
        <meshStandardMaterial color="#2a1a08" flatShading />
      </mesh>
      {/* Mouth */}
      <mesh position={[0, 2.1, 0.17]}>
        <boxGeometry args={[0.1, 0.02, 0.02]} />
        <meshStandardMaterial color="#2a1a08" flatShading />
      </mesh>

      {/* ── Hat (cone) ── */}
      <mesh position={[0, 2.42, 0]} castShadow>
        <coneGeometry args={[0.2, 0.3, 6]} />
        <meshStandardMaterial color="#3a2815" flatShading />
      </mesh>
      {/* Hat brim */}
      <mesh position={[0, 2.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 6]} />
        <meshStandardMaterial color="#3a2815" flatShading side={THREE.DoubleSide} />
      </mesh>

      {/* ── Tattered shirt panels ── */}
      {/* Left shirt panel */}
      <mesh
        ref={shirtLeftRef}
        position={[0.2, 1.4, 0]}
        castShadow
      >
        <planeGeometry args={[0.35, 0.5]} />
        <meshStandardMaterial
          color="#7a4a3a"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Right shirt panel */}
      <mesh
        ref={shirtRightRef}
        position={[-0.2, 1.4, 0]}
        castShadow
      >
        <planeGeometry args={[0.35, 0.5]} />
        <meshStandardMaterial
          color="#8a5a40"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Center shirt body */}
      <mesh position={[0, 1.45, 0.01]}>
        <planeGeometry args={[0.3, 0.55]} />
        <meshStandardMaterial
          color="#6a3a2a"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Straw tufts sticking out ── */}
      {/* From sleeves */}
      <mesh position={[0.72, 1.65, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.005, 0.01, 0.15, 3]} />
        <meshStandardMaterial color="#d4b850" flatShading />
      </mesh>
      <mesh position={[0.7, 1.68, 0.03]} rotation={[0.2, 0, -0.5]}>
        <cylinderGeometry args={[0.005, 0.01, 0.12, 3]} />
        <meshStandardMaterial color="#c4a840" flatShading />
      </mesh>
      <mesh position={[-0.72, 1.65, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.005, 0.01, 0.15, 3]} />
        <meshStandardMaterial color="#d4b850" flatShading />
      </mesh>
      <mesh position={[-0.7, 1.68, -0.03]} rotation={[-0.2, 0, 0.4]}>
        <cylinderGeometry args={[0.005, 0.01, 0.12, 3]} />
        <meshStandardMaterial color="#c4a840" flatShading />
      </mesh>
      {/* From neck */}
      <mesh position={[0.05, 1.95, 0.05]} rotation={[0.3, 0, 0.15]}>
        <cylinderGeometry args={[0.005, 0.008, 0.1, 3]} />
        <meshStandardMaterial color="#d4b850" flatShading />
      </mesh>
      <mesh position={[-0.04, 1.93, 0.04]} rotation={[-0.2, 0, -0.2]}>
        <cylinderGeometry args={[0.005, 0.008, 0.1, 3]} />
        <meshStandardMaterial color="#c4a840" flatShading />
      </mesh>

      {/* ── Weathervane ── */}
      {/* Vertical rod above hat */}
      <mesh position={[0, 2.85, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.015, 0.7, 6]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Decorative finial ball at top */}
      <mesh position={[0, 3.25, 0]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#b8860b" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Fixed compass cross arms — N-S axis */}
      <mesh position={[0, 3.05, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
        <meshStandardMaterial color="#5a5a5a" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Fixed compass cross arms — E-W axis */}
      <mesh position={[0, 3.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
        <meshStandardMaterial color="#5a5a5a" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Direction labels — N (toward -Z) */}
      <Text
        position={[0, 3.05, -0.38]}
        fontSize={0.1}
        color="#e8d44d"
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>

      {/* S (toward +Z) */}
      <Text
        position={[0, 3.05, 0.38]}
        fontSize={0.08}
        color="#cccccc"
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI, 0]}
      >
        S
      </Text>

      {/* E (toward +X) */}
      <Text
        position={[0.38, 3.05, 0]}
        fontSize={0.08}
        color="#cccccc"
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
        rotation={[0, -Math.PI / 2, 0]}
      >
        E
      </Text>

      {/* W (toward -X) */}
      <Text
        position={[-0.38, 3.05, 0]}
        fontSize={0.08}
        color="#cccccc"
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        W
      </Text>

      {/* Rotating arrow — tracks wind direction */}
      <group ref={arrowRef} position={[0, 3.15, 0]}>
        {/* Arrow shaft */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
          <meshStandardMaterial color="#b8860b" metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Arrow head (pointing +X, which rotates with windDirection) */}
        <mesh position={[0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.03, 0.08, 4]} />
          <meshStandardMaterial color="#b8860b" metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Arrow tail fin */}
        <mesh position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.005]} />
          <meshStandardMaterial color="#b8860b" metalness={0.6} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}
