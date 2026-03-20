import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Types ────────────────────────────────────────────────

type Mood = 'sleeping' | 'eating' | 'hungry' | 'thirsty' | 'cold' | 'lowEnergy' | 'stressed' | 'happy' | 'none'

// ── Pre-allocated objects ────────────────────────────────

const _cowPos = new THREE.Vector3()

// ── Mood priority resolution ─────────────────────────────

function resolveMood(
  behavior: string,
  hunger: number,
  energy: number,
  happiness: number,
  thirst: number,
  conditions: string[],
): Mood {
  if (behavior === 'sleeping') return 'sleeping'
  if (behavior === 'eating' || behavior === 'drinking') return 'eating'
  if (conditions.includes('cold')) return 'cold'
  if (hunger > 60) return 'hungry'
  if (thirst > 60) return 'thirsty'
  if (energy < 35) return 'lowEnergy'
  if (happiness < 20) return 'stressed'
  if (happiness > 60) return 'happy'
  return 'none'
}

// ── Bubble backdrop (white circle with pointer) ──────────

function BubbleBackdrop() {
  return (
    <group>
      {/* Main white circle */}
      <mesh>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* Subtle outline ring */}
      <mesh position={[0, 0, -0.001]}>
        <ringGeometry args={[0.48, 0.53, 24]} />
        <meshBasicMaterial color="#cccccc" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Small pointer triangle at bottom */}
      <mesh position={[0, -0.62, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.1, 0.18, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
      </mesh>
    </group>
  )
}

// ── Zzz icon (sleeping) ─────────────────────────────────

function ZzzIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.elapsedTime
    const children = groupRef.current.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as THREE.Mesh
      child.position.y = i * 0.13 - 0.1 + Math.sin(t * 2 + i * 0.8) * 0.04
      child.position.x = i * 0.06 - 0.06
      child.rotation.z = Math.sin(t * 1.2 + i) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      <mesh scale={0.13}>
        <boxGeometry args={[1, 1, 0.3]} />
        <meshBasicMaterial color="#6688cc" />
      </mesh>
      <mesh scale={0.17}>
        <boxGeometry args={[1, 1, 0.3]} />
        <meshBasicMaterial color="#5577bb" />
      </mesh>
      <mesh scale={0.22}>
        <boxGeometry args={[1, 1, 0.3]} />
        <meshBasicMaterial color="#4466aa" />
      </mesh>
    </group>
  )
}

// ── Apple icon (eating) ──────────────────────────────────

function EatingIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z = Math.sin(s.clock.elapsedTime * 1.5) * 0.1
  })

  return (
    <group ref={groupRef} position={[0, -0.02, 0.01]}>
      {/* Apple body */}
      <mesh>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshBasicMaterial color="#cc2222" />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.01, 0.1, 4]} />
        <meshBasicMaterial color="#5c3a1e" />
      </mesh>
      {/* Leaf */}
      <mesh position={[0.05, 0.22, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.04, 0.08, 3]} />
        <meshBasicMaterial color="#44aa22" />
      </mesh>
    </group>
  )
}

// ── Exclamation icon (hungry) ────────────────────────────

function HungryIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 4) * 0.1
    groupRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      {/* Vertical bar */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.28, 8]} />
        <meshBasicMaterial color="#ee8800" />
      </mesh>
      {/* Dot */}
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="#ee8800" />
      </mesh>
    </group>
  )
}

// ── Water droplet icon (thirsty) ─────────────────────────

function ThirstyIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.elapsedTime
    // Bob up and down
    groupRef.current.position.y = Math.sin(t * 2.5) * 0.06
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      {/* Droplet top (pointed cone) */}
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.2, 8]} />
        <meshBasicMaterial color="#1e88e5" />
      </mesh>
      {/* Droplet bottom (sphere) */}
      <mesh position={[0, -0.04, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshBasicMaterial color="#1e88e5" />
      </mesh>
    </group>
  )
}

// ── Snowflake icon (cold) ────────────────────────────────

function ColdIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    // Rotate slowly
    groupRef.current.rotation.z = s.clock.elapsedTime * 0.5
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      {/* Six arms of the snowflake */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <boxGeometry args={[0.04, 0.32, 0.02]} />
          <meshBasicMaterial color="#81d4fa" />
        </mesh>
      ))}
      {/* Small diamond accents on each arm */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={`accent-${i}`}
          position={[
            Math.sin((i * Math.PI) / 3) * 0.12,
            Math.cos((i * Math.PI) / 3) * 0.12,
            0.01,
          ]}
          rotation={[0, 0, (i * Math.PI) / 3 + Math.PI / 4]}
        >
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshBasicMaterial color="#81d4fa" />
        </mesh>
      ))}
      {/* Center circle */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[0.04, 6]} />
        <meshBasicMaterial color="#81d4fa" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Swirl icon (stressed) ────────────────────────────────

function StressedIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    // Pulse effect
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 3.5) * 0.12
    groupRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      {/* Spiral built from small spheres arranged in a spiral path */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 3 // 1.5 full turns
        const radius = 0.04 + i * 0.01
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        const size = 0.02 + i * 0.003
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshBasicMaterial color="#ff5722" />
          </mesh>
        )
      })}
    </group>
  )
}

// ── Battery icon (low energy) ────────────────────────────

function LowEnergyIcon() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((s) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.5 + Math.sin(s.clock.elapsedTime * 2) * 0.3
  })

  return (
    <group position={[0, 0, 0.01]}>
      {/* Battery outline */}
      <mesh>
        <boxGeometry args={[0.24, 0.34, 0.05]} />
        <meshBasicMaterial color="#556688" />
      </mesh>
      {/* Battery inner (empty area) */}
      <mesh position={[0, 0.02, 0.01]}>
        <boxGeometry args={[0.18, 0.24, 0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Battery fill (low — red bar at bottom) */}
      <mesh ref={meshRef} position={[0, -0.07, 0.02]}>
        <boxGeometry args={[0.16, 0.1, 0.05]} />
        <meshBasicMaterial color="#cc4444" transparent opacity={0.8} />
      </mesh>
      {/* Battery top cap */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.05]} />
        <meshBasicMaterial color="#556688" />
      </mesh>
    </group>
  )
}

// ── Heart icon (happy) ───────────────────────────────────

function HappyIcon() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.elapsedTime
    const beat = 1 + Math.sin(t * 3) * 0.08 + Math.sin(t * 6) * 0.04
    groupRef.current.scale.setScalar(beat)
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.01]}>
      {/* Two top lobes */}
      <mesh position={[-0.09, 0.06, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ff4488" />
      </mesh>
      <mesh position={[0.09, 0.06, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ff4488" />
      </mesh>
      {/* Bottom point */}
      <mesh position={[0, -0.06, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.18, 0.22, 4]} />
        <meshBasicMaterial color="#ff4488" />
      </mesh>
    </group>
  )
}

// ── Main component ───────────────────────────────────────

export default function MoodBubbles() {
  const groupRef = useRef<THREE.Group>(null!)
  const scaleRef = useRef(0)
  const [mood, setMood] = useState<Mood>('none')

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const cowState = gameStore.getState().cow
    const pos = cowState.position
    const resolved = resolveMood(
      cowState.behavior,
      cowState.needs.hunger,
      cowState.needs.energy,
      cowState.needs.happiness,
      cowState.needs.thirst,
      cowState.conditions,
    )

    // Only trigger re-render when mood actually changes
    if (resolved !== mood) {
      setMood(resolved)
      scaleRef.current = 0 // reset scale for fade-in
    }

    // Animate scale toward target
    const targetScale = resolved === 'none' ? 0 : 1
    scaleRef.current += (targetScale - scaleRef.current) * Math.min(1, delta * 5)

    // Position above cow (higher for visibility)
    const t = state.clock.elapsedTime
    _cowPos.set(pos[0], pos[1] + 3.2, pos[2])
    groupRef.current.position.copy(_cowPos)
    groupRef.current.position.y += Math.sin(t * 2) * 0.08

    // Scale for fade-in/out
    groupRef.current.scale.setScalar(scaleRef.current)

    // Face camera (billboard)
    groupRef.current.quaternion.copy(state.camera.quaternion)
  })

  return (
    <group ref={groupRef}>
      <BubbleBackdrop />
      {mood === 'sleeping' && <ZzzIcon />}
      {mood === 'eating' && <EatingIcon />}
      {mood === 'cold' && <ColdIcon />}
      {mood === 'hungry' && <HungryIcon />}
      {mood === 'thirsty' && <ThirstyIcon />}
      {mood === 'lowEnergy' && <LowEnergyIcon />}
      {mood === 'stressed' && <StressedIcon />}
      {mood === 'happy' && <HappyIcon />}
    </group>
  )
}
