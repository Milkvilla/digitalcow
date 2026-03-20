import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTimePalette } from '../engine/palette.ts'

// ── Cloud puff data ─────────────────────────────────────

interface CloudDef {
  position: THREE.Vector3
  puffs: { offset: THREE.Vector3; scale: number; brightness: number }[]
  speed: number
  phase: number
}

function generateClouds(count: number): CloudDef[] {
  const clouds: CloudDef[] = []

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const radius = 22 + Math.random() * 40

    const altitudeRoll = Math.random()
    let y: number
    if (altitudeRoll < 0.3) {
      y = 35 + Math.random() * 10
    } else if (altitudeRoll < 0.75) {
      y = 45 + Math.random() * 15
    } else {
      y = 60 + Math.random() * 15
    }

    const sizeRoll = Math.random()
    let sizeMultiplier: number
    let puffCount: number
    if (sizeRoll < 0.2) {
      sizeMultiplier = 1.8 + Math.random() * 0.8
      puffCount = 10 + Math.floor(Math.random() * 6) // more puffs for large
    } else if (sizeRoll < 0.5) {
      sizeMultiplier = 1.0 + Math.random() * 0.5
      puffCount = 7 + Math.floor(Math.random() * 4)
    } else {
      sizeMultiplier = 0.5 + Math.random() * 0.4
      puffCount = 4 + Math.floor(Math.random() * 3)
    }

    const puffs: { offset: THREE.Vector3; scale: number; brightness: number }[] = []

    const cloudBase = -0.3 * sizeMultiplier

    for (let j = 0; j < puffCount; j++) {
      const rawY = Math.random() * 2.0 * sizeMultiplier
      const puffY = Math.max(rawY, cloudBase + 0.2)
      const yPos = puffY - sizeMultiplier * 0.5
      // Bottom puffs are darker (self-shadowing), top puffs brighter
      const brightness = yPos < -0.2 * sizeMultiplier ? 0.65 : yPos > 0.3 * sizeMultiplier ? 1.1 : 1.0

      puffs.push({
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 5 * sizeMultiplier,
          yPos,
          (Math.random() - 0.5) * 3 * sizeMultiplier,
        ),
        scale: (1.2 + Math.random() * 2.0) * sizeMultiplier,
        brightness,
      })
    }

    clouds.push({
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius,
      ),
      puffs,
      speed: 0.06 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    })
  }

  return clouds
}

// ── Single cloud ────────────────────────────────────────

function Cloud({
  def,
  timeOfDay,
  sunDirection,
}: {
  def: CloudDef
  timeOfDay: number
  sunDirection: THREE.Vector3
}) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Drift slowly
    groupRef.current.position.x = def.position.x + Math.sin(t * def.speed + def.phase) * 8
    groupRef.current.position.z = def.position.z + Math.cos(t * def.speed * 0.7 + def.phase) * 5
  })

  const palette = getTimePalette(timeOfDay)
  const [cr, cg, cb] = palette.cloudTint

  // Cloud opacity: dimmer at night
  const nightFade = palette.starOpacity
  const opacity = 0.55 * (1 - nightFade * 0.7) + 0.08

  return (
    <group ref={groupRef} position={def.position}>
      {def.puffs.map((puff, i) => {
        // Sun-facing edges get slightly warmer tint
        const puffWorldDir = puff.offset.clone().normalize()
        const sunDot = Math.max(puffWorldDir.dot(sunDirection), 0)
        const warmth = sunDot * 0.12
        const b = puff.brightness

        return (
          <mesh key={i} position={puff.offset} scale={puff.scale}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={new THREE.Color(
                (cr * b + warmth) ,
                (cg * b + warmth * 0.5),
                (cb * b - warmth * 0.2),
              )}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ── Clouds collection ───────────────────────────────────

export default function Clouds({ timeOfDay }: { timeOfDay: number }) {
  const clouds = useMemo(() => generateClouds(22), [])

  const sunDirection = useMemo(() => {
    return new THREE.Vector3(0, 1, 0)
  }, [])

  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    const elevation = palette.sunIntensity / 1.5
    sunDirection.set(0.3, Math.max(elevation, 0.1), 0.2).normalize()
  })

  return (
    <>
      {clouds.map((cloud, i) => (
        <Cloud
          key={i}
          def={cloud}
          timeOfDay={timeOfDay}
          sunDirection={sunDirection}
        />
      ))}
    </>
  )
}
