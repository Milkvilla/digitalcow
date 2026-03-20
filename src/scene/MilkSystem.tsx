import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameStore } from '../ui/hooks.ts'

// ── Constants ────────────────────────────────────────────

const BUCKET_POS: [number, number, number] = [-4, 0, 4]
const VAN_PARK_POS: [number, number, number] = [12, 0, 0]
const VAN_OFFSCREEN_X = 28
const VAN_SPEED = 3
const LOAD_WAIT = 6 // seconds for person to collect milk
const MILK_DURATION = 10 // must match milking activity duration in store.ts
const FILL_RATE = 100 / MILK_DURATION // fills bucket in one milking session
const GATE_X = 14 // gate position — van must pass through here

// ── Van state machine ────────────────────────────────────

type VanPhase = 'hidden' | 'arriving' | 'loading' | 'departing'

// ── Milkvilla text texture ───────────────────────────────

function useMilkvillaTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2255aa'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('MILKVILLA', 128, 32)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

// ── Milk Bucket (scaled up) ──────────────────────────────

function MilkBucket({ milkLevel }: { milkLevel: React.RefObject<number> }) {
  const fillRef = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    if (!fillRef.current) return
    const level = milkLevel.current
    const fillHeight = (level / 100) * 0.5
    fillRef.current.scale.y = Math.max(0.001, fillHeight)
    fillRef.current.position.y = 0.08 + fillHeight * 0.5
    fillRef.current.visible = level > 0.5
  })

  return (
    <group position={BUCKET_POS}>
      {/* Bucket outer wall */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.6, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.4} roughness={0.5} flatShading />
      </mesh>

      {/* Bucket rim */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.34, 0.32, 0.05, 10]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.5} roughness={0.4} flatShading />
      </mesh>

      {/* Handle */}
      <mesh position={[0, 0.75, 0]}>
        <torusGeometry args={[0.22, 0.015, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.6} roughness={0.3} flatShading />
      </mesh>

      {/* Milk fill (white cylinder, scales with level) */}
      <mesh ref={fillRef} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.28, 0.24, 1, 10]} />
        <meshStandardMaterial color="#f8f8ff" />
      </mesh>

      {/* Small stool / platform */}
      <mesh position={[0.5, 0.1, 0]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.4]} />
        <meshStandardMaterial color="#8B6914" flatShading />
      </mesh>
    </group>
  )
}

// ── Milk Collector Person ────────────────────────────────

function MilkCollector({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.visible = visible
    if (!visible) return
    // Small bob animation
    const t = state.clock.elapsedTime
    groupRef.current.position.y = Math.sin(t * 2) * 0.02
  })

  return (
    <group ref={groupRef} position={[BUCKET_POS[0] + 0.8, 0, BUCKET_POS[2] - 0.5]}>
      {/* Legs */}
      <mesh position={[-0.08, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.7, 6]} />
        <meshStandardMaterial color="#334466" />
      </mesh>
      <mesh position={[0.08, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.7, 6]} />
        <meshStandardMaterial color="#334466" />
      </mesh>

      {/* Body / torso */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.35, 0.5, 0.2]} />
        <meshStandardMaterial color="#4488aa" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color="#dbb588" />
      </mesh>

      {/* Cap */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.08, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.22, 0.85, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.04, 0.03, 0.35, 5]} />
        <meshStandardMaterial color="#4488aa" />
      </mesh>
      <mesh position={[0.22, 0.85, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.04, 0.03, 0.35, 5]} />
        <meshStandardMaterial color="#4488aa" />
      </mesh>
    </group>
  )
}

// ── Milk Van ─────────────────────────────────────────────

function MilkVan({ vanRef }: { vanRef: React.RefObject<THREE.Group> }) {
  const labelTex = useMilkvillaTexture()

  return (
    <group ref={vanRef} position={[VAN_OFFSCREEN_X, 0, VAN_PARK_POS[2]]}>
      {/* Cargo tank (cylindrical milk tanker) */}
      <mesh position={[-0.3, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 3.0, 12]} />
        <meshStandardMaterial color="#f0f0f0" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Tank end caps */}
      <mesh position={[-1.8, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.9, 12]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[1.2, 1.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <circleGeometry args={[0.9, 12]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* MILKVILLA label — left side */}
      <mesh position={[-0.3, 1.4, 0.92]}>
        <planeGeometry args={[2.4, 0.5]} />
        <meshBasicMaterial map={labelTex} transparent />
      </mesh>
      {/* MILKVILLA label — right side */}
      <mesh position={[-0.3, 1.4, -0.92]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.4, 0.5]} />
        <meshBasicMaterial map={labelTex} transparent />
      </mesh>

      {/* Chassis / flatbed under tank */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[4.5, 0.2, 1.6]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {/* Cab */}
      <mesh position={[2.6, 1.0, 0]} castShadow>
        <boxGeometry args={[1.4, 1.5, 1.7]} />
        <meshStandardMaterial color="#e8e8e8" flatShading />
      </mesh>

      {/* Cab windshield */}
      <mesh position={[3.31, 1.2, 0]}>
        <boxGeometry args={[0.02, 0.8, 1.2]} />
        <meshStandardMaterial color="#88aacc" metalness={0.3} roughness={0.1} />
      </mesh>

      {/* Cab roof */}
      <mesh position={[2.6, 1.78, 0]}>
        <boxGeometry args={[1.5, 0.06, 1.8]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>

      {/* Front bumper */}
      <mesh position={[3.35, 0.35, 0]}>
        <boxGeometry args={[0.1, 0.3, 1.8]} />
        <meshStandardMaterial color="#888888" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Headlights */}
      <mesh position={[3.36, 0.6, 0.6]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffff88" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[3.36, 0.6, -0.6]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffff88" emissiveIntensity={0.3} />
      </mesh>

      {/* Front wheels */}
      <mesh position={[2.2, 0.3, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.2, 10]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[2.2, 0.3, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.2, 10]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Rear wheels */}
      <mesh position={[-1.2, 0.3, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.25, 10]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[-1.2, 0.3, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.25, 10]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Wheel hubs */}
      {[2.2, -1.2].map((wx) =>
        [0.95, -0.95].map((wz) => (
          <mesh key={`hub-${wx}-${wz}`} position={[wx, 0.3, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 6]} />
            <meshStandardMaterial color="#999999" metalness={0.6} roughness={0.3} />
          </mesh>
        )),
      )}

      {/* Filler hose cap on tank */}
      <mesh position={[0.8, 2.3, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.1, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  )
}

// ── Main component ───────────────────────────────────────

export default function MilkSystem() {
  const milkLevel = useRef(0)
  const vanRef = useRef<THREE.Group>(null!)
  const vanPhase = useRef<VanPhase>('hidden')
  const vanTimer = useRef(0)
  const vanX = useRef(VAN_OFFSCREEN_X)
  const showCollector = useRef(false)
  const wasMilking = useRef(false)
  const vanOpenedGate = useRef(false) // tracks whether the van auto-opened the gate

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const cowState = gameStore.getState().cow
    const isMilking = cowState.activity.type === 'milking'

    // ── Milk bucket filling logic ──
    if (isMilking) {
      milkLevel.current = Math.min(100, milkLevel.current + FILL_RATE * dt)
    }

    // Milking just finished — ensure bucket is full so the van triggers every time
    if (wasMilking.current && !isMilking && milkLevel.current > 0) {
      milkLevel.current = 100
    }
    wasMilking.current = isMilking

    // ── Van state machine ──
    switch (vanPhase.current) {
      case 'hidden':
        // Van appears once bucket is full
        if (milkLevel.current >= 100) {
          vanPhase.current = 'arriving'
          vanX.current = VAN_OFFSCREEN_X
        }
        break

      case 'arriving': {
        // Auto-open gate when van reaches it
        const gates = gameStore.getState().world.gates
        const gate = gates.find((g) => g.id === 'gate_right')
        if (gate && !gate.isOpen && vanX.current <= GATE_X + 3) {
          gameStore.getState().playerAction({ type: 'toggle_gate', gateId: 'gate_right' })
          vanOpenedGate.current = true
        }
        vanX.current -= VAN_SPEED * dt
        if (vanX.current <= VAN_PARK_POS[0]) {
          vanX.current = VAN_PARK_POS[0]
          vanPhase.current = 'loading'
          vanTimer.current = LOAD_WAIT
          showCollector.current = true
        }
        break
      }

      case 'loading':
        vanTimer.current -= dt
        // Person collects milk — drain bucket
        milkLevel.current = Math.max(0, milkLevel.current - (100 / LOAD_WAIT) * dt)
        if (vanTimer.current <= 0) {
          milkLevel.current = 0
          showCollector.current = false
          vanPhase.current = 'departing'
        }
        break

      case 'departing': {
        vanX.current += VAN_SPEED * dt
        // Auto-close gate after van clears it
        if (vanOpenedGate.current && vanX.current >= GATE_X + 3) {
          const g = gameStore.getState().world.gates.find((g) => g.id === 'gate_right')
          if (g && g.isOpen) {
            gameStore.getState().playerAction({ type: 'toggle_gate', gateId: 'gate_right' })
          }
          vanOpenedGate.current = false
        }
        if (vanX.current >= VAN_OFFSCREEN_X) {
          vanX.current = VAN_OFFSCREEN_X
          vanPhase.current = 'hidden'
        }
        break
      }
    }

    // ── Update van position & visibility ──
    if (vanRef.current) {
      vanRef.current.position.x = vanX.current
      vanRef.current.position.z = VAN_PARK_POS[2]
      vanRef.current.visible = vanPhase.current !== 'hidden'
    }
  })

  return (
    <group>
      <MilkBucket milkLevel={milkLevel} />
      <MilkVan vanRef={vanRef} />
      <MilkCollector visible={showCollector.current} />
    </group>
  )
}
