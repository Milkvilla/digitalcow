import { useMemo } from 'react'
import * as THREE from 'three'
import { EXCLUSION_ZONES, GRASS_AREA } from '../engine/constants.ts'

// ── Helpers ─────────────────────────────────────────────

function isInExclusionZone(x: number, z: number): boolean {
  for (const zone of EXCLUSION_ZONES) {
    const dx = x - zone.center[0]
    const dz = z - zone.center[1]
    if (dx * dx + dz * dz < zone.radius * zone.radius) return true
  }
  return false
}

function randomScatter(count: number, area: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  let attempts = 0
  while (points.length < count && attempts < count * 5) {
    attempts++
    const x = (Math.random() - 0.5) * area * 2
    const z = (Math.random() - 0.5) * area * 2
    if (!isInExclusionZone(x, z)) {
      points.push(new THREE.Vector3(x, 0, z))
    }
  }
  return points
}

// ── Rocks ───────────────────────────────────────────────

function Rocks() {
  const rocks = useMemo(() => {
    const positions = randomScatter(20, GRASS_AREA - 3)
    return positions.map((pos) => ({
      position: pos,
      rotation: [
        Math.random() * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * 0.2,
      ] as [number, number, number],
      scale: [
        0.15 + Math.random() * 0.25,
        0.1 + Math.random() * 0.12,
        0.15 + Math.random() * 0.2,
      ] as [number, number, number],
      color: `hsl(30, ${5 + Math.random() * 10}%, ${35 + Math.random() * 20}%)`,
    }))
  }, [])

  return (
    <>
      {rocks.map((rock, i) => (
        <mesh
          key={i}
          position={[rock.position.x, rock.scale[1] * 0.4, rock.position.z]}
          rotation={rock.rotation}
          scale={rock.scale}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={rock.color} flatShading />
        </mesh>
      ))}
    </>
  )
}

// ── Bushes ──────────────────────────────────────────────

function Bushes() {
  const bushes = useMemo(() => {
    const positions = randomScatter(8, GRASS_AREA - 4)
    return positions.map((pos) => ({
      position: pos,
      scale: 0.2 + Math.random() * 0.25,
      color: `hsl(${110 + Math.random() * 20}, ${40 + Math.random() * 20}%, ${22 + Math.random() * 12}%)`,
    }))
  }, [])

  return (
    <>
      {bushes.map((bush, i) => (
        <mesh
          key={i}
          position={[bush.position.x, bush.scale * 0.5, bush.position.z]}
          scale={[bush.scale * 1.3, bush.scale, bush.scale * 1.1]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={bush.color} flatShading />
        </mesh>
      ))}
    </>
  )
}

// ── Main export ─────────────────────────────────────────

export default function Decorations() {
  return (
    <>
      <Rocks />
      <Bushes />
    </>
  )
}
