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
    const positions = randomScatter(25, GRASS_AREA - 3)
    return positions.map((pos) => {
      const sizeRoll = Math.random()
      const isLarge = sizeRoll > 0.85
      return {
        position: pos,
        rotation: [
          Math.random() * 0.4,
          Math.random() * Math.PI * 2,
          Math.random() * 0.3,
        ] as [number, number, number],
        scale: isLarge
          ? [0.25 + Math.random() * 0.3, 0.15 + Math.random() * 0.12, 0.2 + Math.random() * 0.25] as [number, number, number]
          : [0.12 + Math.random() * 0.2, 0.08 + Math.random() * 0.1, 0.12 + Math.random() * 0.15] as [number, number, number],
        color: `hsl(${25 + Math.random() * 15}, ${4 + Math.random() * 12}%, ${28 + Math.random() * 25}%)`,
        detail: isLarge ? 1 : 0, // Higher detail for larger rocks
        mossy: Math.random() > 0.7,
      }
    })
  }, [])

  return (
    <>
      {rocks.map((rock, i) => (
        <group key={i} position={[rock.position.x, rock.scale[1] * 0.35, rock.position.z]}>
          <mesh
            rotation={rock.rotation}
            scale={rock.scale}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[1, rock.detail]} />
            <meshStandardMaterial
              color={rock.color}
              flatShading
              roughness={0.92}
              metalness={0}
            />
          </mesh>
          {/* Moss patch on some rocks */}
          {rock.mossy && (
            <mesh
              position={[0, rock.scale[1] * 0.3, 0]}
              rotation={[-Math.PI / 2 + 0.2, 0, rock.rotation[1]]}
              scale={[rock.scale[0] * 0.6, rock.scale[2] * 0.6, 1]}
            >
              <circleGeometry args={[0.5, 6]} />
              <meshStandardMaterial
                color="#3a6a25"
                roughness={0.95}
                transparent
                opacity={0.7}
              />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}

// ── Bushes ──────────────────────────────────────────────

function Bushes() {
  const bushes = useMemo(() => {
    const positions = randomScatter(10, GRASS_AREA - 4)
    return positions.map((pos) => ({
      position: pos,
      scale: 0.2 + Math.random() * 0.3,
      color: `hsl(${108 + Math.random() * 22}, ${35 + Math.random() * 25}%, ${18 + Math.random() * 14}%)`,
      puffCount: 2 + Math.floor(Math.random() * 3), // 2-4 overlapping puffs
      rotation: Math.random() * Math.PI * 2,
    }))
  }, [])

  return (
    <>
      {bushes.map((bush, i) => (
        <group
          key={i}
          position={[bush.position.x, 0, bush.position.z]}
          rotation={[0, bush.rotation, 0]}
        >
          {/* Main body */}
          <mesh
            position={[0, bush.scale * 0.5, 0]}
            scale={[bush.scale * 1.3, bush.scale, bush.scale * 1.1]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={bush.color} flatShading roughness={0.88} />
          </mesh>
          {/* Additional puffs for volume */}
          {Array.from({ length: bush.puffCount }).map((_, j) => {
            const angle = (j / bush.puffCount) * Math.PI * 2
            const dist = bush.scale * 0.35
            const puffScale = bush.scale * (0.5 + Math.random() * 0.3)
            // Slightly different shade
            const shade = `hsl(${110 + Math.random() * 20}, ${35 + Math.random() * 20}%, ${16 + Math.random() * 12}%)`
            return (
              <mesh
                key={j}
                position={[
                  Math.cos(angle) * dist,
                  puffScale * 0.45,
                  Math.sin(angle) * dist,
                ]}
                scale={[puffScale * 1.1, puffScale * 0.8, puffScale]}
                castShadow
              >
                <dodecahedronGeometry args={[1, 1]} />
                <meshStandardMaterial color={shade} flatShading roughness={0.88} />
              </mesh>
            )
          })}
        </group>
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
