import * as THREE from 'three'
import { useMemo } from 'react'
import { SCENE_LAYOUT, SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants.ts'

// ── Triangular prism roof geometry ──────────────────────

function useRoofGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape()
    const halfWidth = 3.2
    const roofHeight = 2.2
    shape.moveTo(-halfWidth, 0)
    shape.lineTo(halfWidth, 0)
    shape.lineTo(0, roofHeight)
    shape.closePath()

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 4.8,
      bevelEnabled: false,
    }

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geo.translate(0, 0, -2.4)
    return geo
  }, [])
}

export default function Barn({ timeOfDay }: { timeOfDay: number }) {
  const { position, rotation } = SCENE_LAYOUT.barn
  const roofGeo = useRoofGeometry()

  const isNight = timeOfDay < SUNRISE_HOUR || timeOfDay > SUNSET_HOUR
  const isEvening = timeOfDay >= SUNSET_HOUR - 2 && timeOfDay <= SUNSET_HOUR
  const lightIntensity = isNight ? 1.8 : isEvening ? 0.8 : 0.15

  return (
    <group position={position} rotation={rotation} scale={1.3}>
      {/* Back wall */}
      <mesh position={[-2.45, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, 3, 4]} />
        <meshStandardMaterial color="#8B2500" />
      </mesh>

      {/* Left wall */}
      <mesh position={[0, 1.5, 1.95]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 0.1]} />
        <meshStandardMaterial color="#8B2500" />
      </mesh>

      {/* Right wall */}
      <mesh position={[0, 1.5, -1.95]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 0.1]} />
        <meshStandardMaterial color="#8B2500" />
      </mesh>

      {/* Wall trim (lighter band at top) */}
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[5.05, 0.12, 4.05]} />
        <meshStandardMaterial color="#a03010" />
      </mesh>

      {/* ── Interior ─────────────────────────────────── */}

      {/* Straw floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 3.8]} />
        <meshStandardMaterial color="#c4a840" />
      </mesh>

      {/* Hay bed (sleeping area — back-left corner) */}
      <mesh position={[-1.5, 0.12, -0.8]} castShadow>
        <boxGeometry args={[1.8, 0.24, 1.6]} />
        <meshStandardMaterial color="#d4b850" />
      </mesh>
      {/* Loose hay on top of bed */}
      <mesh position={[-1.5, 0.26, -0.8]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[1.6, 0.06, 1.3]} />
        <meshStandardMaterial color="#dac060" />
      </mesh>
      {/* Hay pillow bump */}
      <mesh position={[-2.0, 0.18, -0.8]} castShadow>
        <sphereGeometry args={[0.3, 6, 4]} />
        <meshStandardMaterial color="#d8bc55" flatShading />
      </mesh>

      {/* Water bucket (right side) */}
      <mesh position={[1.2, 0.22, 1.2]} castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.4, 8]} />
        <meshStandardMaterial color="#5a4030" />
      </mesh>
      {/* Water surface */}
      <mesh position={[1.2, 0.38, 1.2]}>
        <circleGeometry args={[0.2, 8]} />
        <meshStandardMaterial
          color="#4488aa"
          metalness={0.3}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Feed trough (small, inside barn) */}
      <mesh position={[1.2, 0.18, -1.0]} castShadow>
        <boxGeometry args={[0.9, 0.35, 0.4]} />
        <meshStandardMaterial color="#5a3a20" />
      </mesh>
      {/* Hay in trough */}
      <mesh position={[1.2, 0.32, -1.0]}>
        <boxGeometry args={[0.75, 0.1, 0.3]} />
        <meshStandardMaterial color="#c8b040" />
      </mesh>

      {/* Support beam — left */}
      <mesh position={[0, 1.5, 1.85]} castShadow>
        <boxGeometry args={[0.12, 3, 0.12]} />
        <meshStandardMaterial color="#4a2000" />
      </mesh>
      {/* Support beam — right */}
      <mesh position={[0, 1.5, -1.85]} castShadow>
        <boxGeometry args={[0.12, 3, 0.12]} />
        <meshStandardMaterial color="#4a2000" />
      </mesh>
      {/* Cross beam (horizontal, under roof) */}
      <mesh position={[0, 2.9, 0]}>
        <boxGeometry args={[0.1, 0.1, 3.8]} />
        <meshStandardMaterial color="#4a2000" />
      </mesh>

      {/* ── Barn lantern light ───────────────────────── */}

      {/* Lantern body (hangs from cross beam) */}
      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[0.12, 0.2, 0.12]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lantern glow */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial
          color="#ffcc44"
          emissive="#ffaa22"
          emissiveIntensity={lightIntensity * 1.5}
        />
      </mesh>
      {/* Lantern rope */}
      <mesh position={[0, 2.72, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.24, 4]} />
        <meshStandardMaterial color="#8a7040" />
      </mesh>

      {/* Warm point light */}
      <pointLight
        position={[0, 2.4, 0]}
        color="#ffaa44"
        intensity={lightIntensity}
        distance={8}
        decay={2}
      />

      {/* ── Exterior details ─────────────────────────── */}

      {/* Side window (left) */}
      <mesh position={[0, 2.2, 2.01]}>
        <boxGeometry args={[0.8, 0.6, 0.04]} />
        <meshStandardMaterial color="#88aacc" metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Window frame */}
      <mesh position={[0, 2.2, 2.02]}>
        <boxGeometry args={[0.85, 0.05, 0.03]} />
        <meshStandardMaterial color="#4a1800" />
      </mesh>
      <mesh position={[0, 2.2, 2.02]}>
        <boxGeometry args={[0.05, 0.65, 0.03]} />
        <meshStandardMaterial color="#4a1800" />
      </mesh>

      {/* Side window (right) */}
      <mesh position={[0, 2.2, -2.01]}>
        <boxGeometry args={[0.8, 0.6, 0.04]} />
        <meshStandardMaterial color="#88aacc" metalness={0.2} roughness={0.1} />
      </mesh>

      {/* Roof */}
      <mesh
        geometry={roofGeo}
        position={[0, 3, 0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color="#4a1505" />
      </mesh>

      {/* Roof overhang */}
      <mesh position={[0, 3.0, 0]} castShadow>
        <boxGeometry args={[5.6, 0.1, 4.6]} />
        <meshStandardMaterial color="#4a1505" />
      </mesh>

      {/* Hay bale near door */}
      <mesh position={[3.5, 0.3, 1.2]} rotation={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.5, 8]} />
        <meshStandardMaterial color="#c4a840" flatShading />
      </mesh>
      <mesh position={[3.8, 0.3, 0.4]} rotation={[Math.PI / 2, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.45, 8]} />
        <meshStandardMaterial color="#b89830" flatShading />
      </mesh>

      {/* Foundation stones */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[5.2, 0.1, 4.2]} />
        <meshStandardMaterial color="#666" flatShading />
      </mesh>
    </group>
  )
}
