import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants.ts'

// ── Butterfly ───────────────────────────────────────────

const BUTTERFLY_COLORS = ['#ff8844', '#44aaff', '#ffee44', '#ff66aa', '#88ff66']

interface ButterflyDef {
  color: string
  phase: number
  speed: number
  radiusX: number
  radiusZ: number
  height: number
  centerX: number
  centerZ: number
}

function Butterfly({ def }: { def: ButterflyDef }) {
  const groupRef = useRef<THREE.Group>(null!)
  const wingLRef = useRef<THREE.Mesh>(null!)
  const wingRRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Lissajous flight path
    const x = def.centerX + Math.sin(t * def.speed + def.phase) * def.radiusX
    const z = def.centerZ + Math.cos(t * def.speed * 0.7 + def.phase * 1.3) * def.radiusZ
    const y = def.height + Math.sin(t * def.speed * 1.5 + def.phase) * 0.4

    groupRef.current.position.set(x, y, z)

    // Face direction of travel
    const nextX = def.centerX + Math.sin((t + 0.05) * def.speed + def.phase) * def.radiusX
    const nextZ = def.centerZ + Math.cos((t + 0.05) * def.speed * 0.7 + def.phase * 1.3) * def.radiusZ
    groupRef.current.rotation.y = Math.atan2(nextX - x, nextZ - z)

    // Wing flap
    const flapAngle = Math.sin(t * 15) * 0.8
    if (wingLRef.current) wingLRef.current.rotation.y = flapAngle
    if (wingRRef.current) wingRRef.current.rotation.y = -flapAngle
  })

  return (
    <group ref={groupRef} scale={0.08}>
      {/* Body */}
      <mesh>
        <cylinderGeometry args={[0.15, 0.1, 1.2, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Left wing */}
      <mesh ref={wingLRef} position={[0, 0.1, 0.3]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshBasicMaterial
          color={def.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Right wing */}
      <mesh ref={wingRRef} position={[0, 0.1, -0.3]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshBasicMaterial
          color={def.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

// ── Firefly ─────────────────────────────────────────────

interface FireflyDef {
  phase: number
  speed: number
  position: THREE.Vector3
  radius: number
}

function Fireflies({ defs }: { defs: FireflyDef[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime

    defs.forEach((def, i) => {
      const x = def.position.x + Math.sin(t * def.speed + def.phase) * def.radius
      const y = def.position.y + Math.sin(t * def.speed * 1.3 + def.phase * 2) * 0.8
      const z = def.position.z + Math.cos(t * def.speed * 0.8 + def.phase) * def.radius

      // Pulse scale for glow effect
      const pulse = 0.6 + Math.sin(t * 3 + def.phase) * 0.4
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.04 * pulse)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, defs.length]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#bbff44" toneMapped={false} />
    </instancedMesh>
  )
}

// ── Main export ─────────────────────────────────────────

export default function Creatures({ timeOfDay, showButterflies = true }: { timeOfDay: number; showButterflies?: boolean }) {
  const isDay = timeOfDay >= SUNRISE_HOUR && timeOfDay <= SUNSET_HOUR

  const butterflies = useMemo<ButterflyDef[]>(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        color: BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length],
        phase: i * 1.2,
        speed: 0.3 + Math.random() * 0.3,
        radiusX: 3 + Math.random() * 5,
        radiusZ: 2 + Math.random() * 4,
        height: 0.8 + Math.random() * 1.5,
        centerX: (Math.random() - 0.5) * 10,
        centerZ: (Math.random() - 0.5) * 10,
      })),
    [],
  )

  const fireflyDefs = useMemo<FireflyDef[]>(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        phase: i * 0.8,
        speed: 0.2 + Math.random() * 0.3,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          0.5 + Math.random() * 2,
          (Math.random() - 0.5) * 16,
        ),
        radius: 1 + Math.random() * 2,
      })),
    [],
  )

  return (
    <>
      {isDay && showButterflies &&
        butterflies.map((b, i) => <Butterfly key={i} def={b} />)}
      {!isDay && <Fireflies defs={fireflyDefs} />}
    </>
  )
}
