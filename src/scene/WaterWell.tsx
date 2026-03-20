import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function WaterWell() {
  const bucketRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (!bucketRef.current) return
    const t = state.clock.elapsedTime
    // Gentle sway
    bucketRef.current.rotation.z = Math.sin(t * 0.8) * 0.06
    bucketRef.current.rotation.x = Math.cos(t * 0.6) * 0.04
  })

  return (
    <group position={[3, 0, 7]}>
      {/* ── Stone base (circular wall) ── */}
      {/* Outer wall */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.8, 8]} />
        <meshStandardMaterial color="#8a8078" flatShading />
      </mesh>
      {/* Inner hollow (darker, slightly smaller) */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.42, 0.45, 0.82, 8]} />
        <meshStandardMaterial color="#3a3530" flatShading />
      </mesh>
      {/* Water surface inside */}
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 8]} />
        <meshStandardMaterial color="#4a6a8a" metalness={0.3} roughness={0.2} />
      </mesh>
      {/* Stone rim on top */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <torusGeometry args={[0.52, 0.06, 4, 8]} />
        <meshStandardMaterial color="#7a7068" flatShading />
      </mesh>

      {/* ── Foundation stones ── */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.75, 0.04, 8]} />
        <meshStandardMaterial color="#6a6258" flatShading />
      </mesh>

      {/* ── Wooden frame (A-frame with crossbeam) ── */}
      {/* Left post */}
      <mesh position={[-0.4, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.8, 6]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>
      {/* Right post */}
      <mesh position={[0.4, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.8, 6]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>
      {/* Horizontal beam */}
      <mesh position={[0, 2.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 6]} />
        <meshStandardMaterial color="#4a2e15" flatShading />
      </mesh>

      {/* ── Crank handle ── */}
      <mesh position={[0.55, 2.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 4]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.62, 2.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 4]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── Rope (thin cylinder from beam down to bucket) ── */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 1.3, 4]} />
        <meshStandardMaterial color="#8a7a5a" flatShading />
      </mesh>

      {/* ── Bucket (hanging from rope) ── */}
      <group ref={bucketRef} position={[0, 0.85, 0]}>
        {/* Bucket body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.18, 6]} />
          <meshStandardMaterial color="#6a5a3a" flatShading />
        </mesh>
        {/* Bucket rim */}
        <mesh position={[0, 0.09, 0]}>
          <torusGeometry args={[0.1, 0.012, 4, 6]} />
          <meshStandardMaterial color="#555" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Bucket handle */}
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.08, 0.008, 4, 8, Math.PI]} />
          <meshStandardMaterial color="#555" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* ── Small roof over the well ── */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <coneGeometry args={[0.65, 0.35, 4]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>
    </group>
  )
}
