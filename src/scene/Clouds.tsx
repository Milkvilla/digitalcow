import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTimePalette } from '../engine/palette.ts'

// ── Cloud puff data ─────────────────────────────────────

interface CloudDef {
  position: THREE.Vector3
  puffs: { offset: THREE.Vector3; scale: number }[]
  speed: number
  phase: number
}

function generateClouds(count: number): CloudDef[] {
  const clouds: CloudDef[] = []

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const radius = 22 + Math.random() * 40

    // Height variation — clouds well above camera (camera is at y=12)
    const altitudeRoll = Math.random()
    let y: number
    if (altitudeRoll < 0.3) {
      // Lower clouds (still well above camera)
      y = 35 + Math.random() * 10
    } else if (altitudeRoll < 0.75) {
      // Mid-altitude
      y = 45 + Math.random() * 15
    } else {
      // High clouds
      y = 60 + Math.random() * 15
    }

    // Size variation — some big cumulus, some small wisps
    const sizeRoll = Math.random()
    let sizeMultiplier: number
    let puffCount: number
    if (sizeRoll < 0.2) {
      // Large cumulus
      sizeMultiplier = 1.8 + Math.random() * 0.8
      puffCount = 8 + Math.floor(Math.random() * 5) // 8-12 puffs
    } else if (sizeRoll < 0.5) {
      // Medium clouds
      sizeMultiplier = 1.0 + Math.random() * 0.5
      puffCount = 5 + Math.floor(Math.random() * 4) // 5-8 puffs
    } else {
      // Small wisps
      sizeMultiplier = 0.5 + Math.random() * 0.4
      puffCount = 3 + Math.floor(Math.random() * 3) // 3-5 puffs
    }

    const puffs: { offset: THREE.Vector3; scale: number }[] = []

    // Determine flat bottom baseline (cloud base)
    const cloudBase = -0.3 * sizeMultiplier // bottom edge

    for (let j = 0; j < puffCount; j++) {
      // Puffs positioned with flat bottom — y offset clamped so bottoms align
      const rawY = Math.random() * 2.0 * sizeMultiplier
      const puffY = Math.max(rawY, cloudBase + 0.2) // keep above the base

      puffs.push({
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 5 * sizeMultiplier,
          puffY - sizeMultiplier * 0.5, // shift down so base is near cloudBase
          (Math.random() - 0.5) * 3 * sizeMultiplier,
        ),
        scale: (1.2 + Math.random() * 2.0) * sizeMultiplier,
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
  const nightFade = palette.starOpacity // 0 during day, 0.9 at night
  const opacity = 0.55 * (1 - nightFade * 0.7) + 0.05

  return (
    <group ref={groupRef} position={def.position}>
      {def.puffs.map((puff, i) => {
        // Sun-facing edges get slightly warmer tint
        const puffWorldDir = puff.offset.clone().normalize()
        const sunDot = Math.max(puffWorldDir.dot(sunDirection), 0)
        const warmth = sunDot * 0.15

        return (
          <mesh key={i} position={puff.offset} scale={puff.scale}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshBasicMaterial
              color={new THREE.Color(
                cr + warmth,
                cg + warmth * 0.6,
                cb - warmth * 0.3,
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
  const clouds = useMemo(() => generateClouds(18), [])

  // Compute sun direction from time for cloud warming
  const sunDirection = useMemo(() => {
    return new THREE.Vector3(0, 1, 0)
  }, [])

  // Update sun direction each frame based on time
  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    // Approximate sun direction from zenith brightness
    // During day the sun is roughly overhead, dawn/dusk near horizon
    const elevation = palette.sunIntensity / 1.5 // rough 0-1
    sunDirection.set(0, elevation, 0).normalize()
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
