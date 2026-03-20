import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../ui/hooks.ts'
import { outdoorLightFactor } from '../engine/constants.ts'

// ── Windmill blade geometry (flat quad with taper) ──────

function useBladeGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape()
    // Blade: narrow at hub, wider in middle, tapered at tip
    shape.moveTo(0, 0)
    shape.lineTo(0.08, 0.3)
    shape.lineTo(0.12, 0.8)
    shape.lineTo(0.08, 1.6)
    shape.lineTo(0, 1.8)
    shape.lineTo(-0.08, 1.6)
    shape.lineTo(-0.12, 0.8)
    shape.lineTo(-0.08, 0.3)
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: false,
    })
    geo.translate(0, 0, -0.015)
    return geo
  }, [])
}

// ── Street light spotlight target ──────────────────────

function StreetLight({ on, intensity }: { on: boolean; intensity: number }) {
  const targetRef = useRef<THREE.Object3D>(null!)
  const spotRef = useRef<THREE.SpotLight>(null!)

  useFrame(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current
    }
  })

  return (
    <group>
      {/* Target point on the ground north of the windmill, toward farm center */}
      <object3D ref={targetRef} position={[2, 0, 2]} />

      {/* Street light — flush on north wall of windmill tower */}
      <group position={[8, 3.1, 12.5]}>
        {/* Short bracket arm from tower wall */}
        <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.035, 0.3, 6]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Lamp head — 60° upward tilt */}
        <group position={[0, 0, -0.3]} rotation={[1.05, 0, 0]}>
          {/* Housing top */}
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[0.24, 0.04, 0.32]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Housing body */}
          <mesh>
            <boxGeometry args={[0.22, 0.07, 0.30]} />
            <meshStandardMaterial color="#333" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Glass lens (bottom face) */}
          <mesh position={[0, -0.045, 0]}>
            <boxGeometry args={[0.18, 0.012, 0.24]} />
            <meshStandardMaterial
              color={on ? '#fff8e0' : '#aaa'}
              emissive={on ? '#ffcc44' : '#000'}
              emissiveIntensity={on ? 3.5 : 0}
            />
          </mesh>
        </group>
      </group>

      {/* Spotlight — in world space, shining down and north toward the farm */}
      {on && (
        <spotLight
          ref={spotRef}
          position={[8, 3.0, 11.95]}
          color="#ffcc66"
          intensity={intensity}
          distance={25}
          angle={0.9}
          penumbra={0.5}
          decay={1.2}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
      )}
    </group>
  )
}

export default function Windmill({ timeOfDay }: { timeOfDay: number }) {
  const bladesRef = useRef<THREE.Group>(null!)
  const towerRef = useRef<THREE.Group>(null!)
  const bladeGeo = useBladeGeometry()
  const windStrength = useGameStore((s) => s.world.windStrength)

  const factor = outdoorLightFactor(timeOfDay)
  const lightOn = factor > 0
  const lightIntensity = factor * 6.0

  // Persistent rotation value stored in a ref
  const rotationRef = useRef(0)

  useFrame((_, delta) => {
    if (!bladesRef.current) return

    // Spin blades proportional to wind
    rotationRef.current += delta * windStrength * 2
    bladesRef.current.rotation.z = rotationRef.current

    // Slight tower sway in wind
    if (towerRef.current) {
      const t = performance.now() * 0.001
      towerRef.current.rotation.x = Math.sin(t * 0.5) * windStrength * 0.008
      towerRef.current.rotation.z = Math.cos(t * 0.4) * windStrength * 0.006
    }
  })

  const bladeColors = useMemo(
    () => ['#8b6f47', '#7a6040', '#9a7f55', '#8b6f47'],
    [],
  )

  return (
    <group>
      {/* Street light — world space, independent of windmill rotation */}
      <StreetLight on={lightOn} intensity={lightIntensity} />

      {/* Windmill structure */}
      <group position={[8, 0, 13]} rotation={[0, -Math.PI / 2, 0]}>
        <group ref={towerRef}>
          {/* ── Stone base tower (tapered cylinder) ── */}
          <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.8, 3, 8]} />
            <meshStandardMaterial color="#7a7268" flatShading />
          </mesh>

          {/* Tower cap / top ring */}
          <mesh position={[0, 3.05, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.52, 0.15, 8]} />
            <meshStandardMaterial color="#5c4a32" flatShading />
          </mesh>

          {/* ── Door ── */}
          <mesh position={[0.81, 0.5, 0]}>
            <boxGeometry args={[0.04, 1.0, 0.5]} />
            <meshStandardMaterial color="#4a3220" flatShading />
          </mesh>
          {/* Door frame */}
          <mesh position={[0.82, 0.5, 0]}>
            <boxGeometry args={[0.02, 1.05, 0.55]} />
            <meshStandardMaterial color="#3a2515" flatShading />
          </mesh>

          {/* ── Window ── */}
          <mesh position={[0, 2.2, 0.52]}>
            <boxGeometry args={[0.3, 0.35, 0.04]} />
            <meshStandardMaterial color="#88aacc" metalness={0.2} roughness={0.1} />
          </mesh>
          {/* Window frame */}
          <mesh position={[0, 2.2, 0.53]}>
            <boxGeometry args={[0.35, 0.03, 0.02]} />
            <meshStandardMaterial color="#4a3220" flatShading />
          </mesh>
          <mesh position={[0, 2.2, 0.53]}>
            <boxGeometry args={[0.03, 0.4, 0.02]} />
            <meshStandardMaterial color="#4a3220" flatShading />
          </mesh>

          {/* ── Hub + blades ── */}
          <group position={[0.55, 3.0, 0]}>
            {/* Hub axle */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 0.2, 6]} />
              <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
            </mesh>

            {/* Hub center cap */}
            <mesh position={[0.12, 0, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color="#666" metalness={0.5} roughness={0.4} />
            </mesh>

            {/* Rotating blade group */}
            <group ref={bladesRef} position={[0.15, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              {bladeColors.map((color, i) => (
                <mesh
                  key={i}
                  geometry={bladeGeo}
                  rotation={[0, 0, (Math.PI / 2) * i]}
                  castShadow
                >
                  <meshStandardMaterial color={color} flatShading />
                </mesh>
              ))}
            </group>
          </group>

          {/* ── Foundation stones ── */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.9, 1.0, 0.08, 8]} />
            <meshStandardMaterial color="#6a6258" flatShading />
          </mesh>
        </group>
      </group>
    </group>
  )
}
