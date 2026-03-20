import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SCENE_LAYOUT, SUNRISE_HOUR, SUNSET_HOUR, outdoorLightFactor } from '../engine/constants.ts'

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

// ── Wood plank texture (procedural) ──────────────────────

function useWoodTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Base red-brown
    ctx.fillStyle = '#7a2010'
    ctx.fillRect(0, 0, size, size)

    // Horizontal planks
    const plankHeight = 32
    for (let y = 0; y < size; y += plankHeight) {
      // Plank gap line
      ctx.fillStyle = 'rgba(30, 10, 5, 0.6)'
      ctx.fillRect(0, y, size, 2)

      // Wood grain within each plank
      for (let g = 0; g < 12; g++) {
        const gy = y + 4 + Math.random() * (plankHeight - 8)
        ctx.strokeStyle = `rgba(${50 + Math.random() * 40}, ${15 + Math.random() * 15}, ${5 + Math.random() * 10}, ${0.15 + Math.random() * 0.15})`
        ctx.lineWidth = 0.5 + Math.random() * 1.5
        ctx.beginPath()
        ctx.moveTo(0, gy)
        // Wavy grain
        for (let x = 0; x < size; x += 8) {
          ctx.lineTo(x, gy + Math.sin(x * 0.03 + g) * 2)
        }
        ctx.stroke()
      }

      // Subtle color variation per plank
      const variation = Math.random() * 0.15
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 160 : 40}, ${Math.random() > 0.5 ? 50 : 15}, 10, ${variation})`
      ctx.fillRect(0, y + 2, size, plankHeight - 2)
    }

    // Weathering — darker patches
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 10 + Math.random() * 30
      ctx.fillStyle = `rgba(20, 8, 3, ${0.05 + Math.random() * 0.1})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

function GateSpotlight({ intensity }: { intensity: number }) {
  const spotRef = useRef<THREE.SpotLight>(null!)
  const targetRef = useRef<THREE.Object3D>(null!)

  useFrame(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current
    }
  })

  return (
    <group>
      {/* Target: outward from door in local +X direction */}
      <object3D ref={targetRef} position={[8, 0, 0]} />
      <spotLight
        ref={spotRef}
        position={[2.9, 3.1, 0]}
        color="#ffcc66"
        intensity={intensity}
        distance={20}
        angle={0.9}
        penumbra={0.5}
        decay={1.2}
        castShadow
      />
    </group>
  )
}

export default function Barn({ timeOfDay }: { timeOfDay: number }) {
  const { position, rotation } = SCENE_LAYOUT.barn
  const roofGeo = useRoofGeometry()
  const woodTex = useWoodTexture()

  const isNight = timeOfDay < SUNRISE_HOUR || timeOfDay > SUNSET_HOUR
  const isEvening = timeOfDay >= SUNSET_HOUR - 2 && timeOfDay <= SUNSET_HOUR
  // Interior light: off during day, gradual on from 18:30, dimmer than before
  const interiorFactor = outdoorLightFactor(timeOfDay)
  const lightIntensity = interiorFactor * 2.0
  const extFactor = outdoorLightFactor(timeOfDay)

  return (
    <group position={position} rotation={rotation} scale={1.3}>
      {/* Back wall */}
      <mesh position={[-2.45, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, 3, 4]} />
        <meshStandardMaterial map={woodTex} roughness={0.88} metalness={0} />
      </mesh>

      {/* Left wall */}
      <mesh position={[0, 1.5, 1.95]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 0.1]} />
        <meshStandardMaterial map={woodTex} roughness={0.88} metalness={0} />
      </mesh>

      {/* Right wall */}
      <mesh position={[0, 1.5, -1.95]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 0.1]} />
        <meshStandardMaterial map={woodTex} roughness={0.88} metalness={0} />
      </mesh>

      {/* Wall trim (lighter band at top) */}
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[5.05, 0.14, 4.05]} />
        <meshStandardMaterial color="#a83818" roughness={0.75} />
      </mesh>

      {/* Wall trim (base) */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[5.05, 0.14, 4.05]} />
        <meshStandardMaterial color="#5a2a10" roughness={0.9} />
      </mesh>

      {/* ── Interior ─────────────────────────────────── */}

      {/* Straw floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 3.8]} />
        <meshStandardMaterial color="#b89838" roughness={0.95} />
      </mesh>

      {/* Hay bed (sleeping area — back-left corner) */}
      <mesh position={[-1.5, 0.12, -0.8]} castShadow>
        <boxGeometry args={[1.8, 0.24, 1.6]} />
        <meshStandardMaterial color="#c4a840" roughness={0.92} />
      </mesh>
      {/* Loose hay on top of bed */}
      <mesh position={[-1.5, 0.26, -0.8]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[1.6, 0.06, 1.3]} />
        <meshStandardMaterial color="#d4b850" roughness={0.95} />
      </mesh>
      {/* Hay pillow bump */}
      <mesh position={[-2.0, 0.18, -0.8]} castShadow>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#d0b448" flatShading roughness={0.9} />
      </mesh>
      {/* Second hay bump */}
      <mesh position={[-1.3, 0.16, -0.5]} castShadow>
        <sphereGeometry args={[0.2, 6, 5]} />
        <meshStandardMaterial color="#c8a838" flatShading roughness={0.9} />
      </mesh>

      {/* Water bucket (right side) */}
      <mesh position={[1.2, 0.22, 1.2]} castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.4, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Bucket metal bands */}
      <mesh position={[1.2, 0.28, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.008, 4, 12]} />
        <meshStandardMaterial color="#777" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Water surface */}
      <mesh position={[1.2, 0.38, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 12]} />
        <meshStandardMaterial
          color="#3a7090"
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>

      {/* Feed trough (wooden, detailed) */}
      <mesh position={[1.2, 0.18, -1.0]} castShadow>
        <boxGeometry args={[0.9, 0.35, 0.4]} />
        <meshStandardMaterial color="#4a2a15" roughness={0.9} />
      </mesh>
      {/* Trough metal rim */}
      <mesh position={[1.2, 0.36, -1.0]}>
        <boxGeometry args={[0.92, 0.02, 0.42]} />
        <meshStandardMaterial color="#666" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Hay in trough */}
      <mesh position={[1.2, 0.32, -1.0]}>
        <boxGeometry args={[0.75, 0.1, 0.3]} />
        <meshStandardMaterial color="#c8b040" roughness={0.95} />
      </mesh>

      {/* Support beams — darker aged wood */}
      <mesh position={[0, 1.5, 1.85]} castShadow>
        <boxGeometry args={[0.14, 3, 0.14]} />
        <meshStandardMaterial color="#3a1808" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.5, -1.85]} castShadow>
        <boxGeometry args={[0.14, 3, 0.14]} />
        <meshStandardMaterial color="#3a1808" roughness={0.92} />
      </mesh>
      {/* Back support beams */}
      <mesh position={[-2.35, 1.5, 1.85]} castShadow>
        <boxGeometry args={[0.12, 3, 0.12]} />
        <meshStandardMaterial color="#3a1808" roughness={0.92} />
      </mesh>
      <mesh position={[-2.35, 1.5, -1.85]} castShadow>
        <boxGeometry args={[0.12, 3, 0.12]} />
        <meshStandardMaterial color="#3a1808" roughness={0.92} />
      </mesh>

      {/* Cross beams (horizontal, under roof) */}
      <mesh position={[0, 2.9, 0]}>
        <boxGeometry args={[0.1, 0.12, 3.8]} />
        <meshStandardMaterial color="#3a1808" roughness={0.9} />
      </mesh>
      <mesh position={[-1.2, 2.9, 0]}>
        <boxGeometry args={[0.08, 0.10, 3.8]} />
        <meshStandardMaterial color="#3a1808" roughness={0.9} />
      </mesh>

      {/* ── Barn lantern light ───────────────────────── */}

      {/* Lantern body (hangs from cross beam) */}
      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[0.14, 0.22, 0.14]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Lantern glass panels */}
      <mesh position={[0, 2.52, 0]}>
        <boxGeometry args={[0.10, 0.16, 0.10]} />
        <meshStandardMaterial
          color="#ffcc44"
          emissive="#ffaa22"
          emissiveIntensity={lightIntensity * 1.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* Lantern cap */}
      <mesh position={[0, 2.68, 0]}>
        <coneGeometry args={[0.09, 0.06, 4]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lantern rope */}
      <mesh position={[0, 2.76, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.20, 4]} />
        <meshStandardMaterial color="#7a6030" />
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

      {/* Side window (left) — glass pane */}
      <mesh position={[0, 2.2, 2.01]}>
        <boxGeometry args={[0.8, 0.6, 0.04]} />
        <meshStandardMaterial color="#6688aa" metalness={0.3} roughness={0.08} />
      </mesh>
      {/* Window frame — cross pattern */}
      <mesh position={[0, 2.2, 2.03]}>
        <boxGeometry args={[0.88, 0.06, 0.02]} />
        <meshStandardMaterial color="#3a1505" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.2, 2.03]}>
        <boxGeometry args={[0.06, 0.68, 0.02]} />
        <meshStandardMaterial color="#3a1505" roughness={0.85} />
      </mesh>
      {/* Frame border */}
      <mesh position={[0, 2.2, 2.025]}>
        <boxGeometry args={[0.90, 0.68, 0.015]} />
        <meshStandardMaterial color="#3a1505" roughness={0.85} side={THREE.BackSide} />
      </mesh>

      {/* Side window (right) — glass pane */}
      <mesh position={[0, 2.2, -2.01]}>
        <boxGeometry args={[0.8, 0.6, 0.04]} />
        <meshStandardMaterial color="#6688aa" metalness={0.3} roughness={0.08} />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 2.2, -2.03]}>
        <boxGeometry args={[0.88, 0.06, 0.02]} />
        <meshStandardMaterial color="#3a1505" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.2, -2.03]}>
        <boxGeometry args={[0.06, 0.68, 0.02]} />
        <meshStandardMaterial color="#3a1505" roughness={0.85} />
      </mesh>

      {/* Roof with dark weathered wood */}
      <mesh
        geometry={roofGeo}
        position={[0, 3, 0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color="#3a1205" roughness={0.92} />
      </mesh>

      {/* Roof overhang */}
      <mesh position={[0, 3.0, 0]} castShadow>
        <boxGeometry args={[5.6, 0.12, 4.6]} />
        <meshStandardMaterial color="#3a1205" roughness={0.92} />
      </mesh>

      {/* ── Solar panels on roof ─────────────────────── */}

      {/* Left roof slope panels (z > 0 side) */}
      {[0, 1, 2].map(i => {
        const px = -0.8 + i * 1.2
        // Roof slope: rises from z=2 at y=3 to z=0 at y=5.2
        // Panel center at ~60% up the slope
        const py = 3.55 + 0.65
        const pz = 1.0 - i * 0.05
        const slopeAngle = Math.atan2(2.2, 3.2) // roof pitch
        return (
          <group key={`solar-l-${i}`} position={[px, py, pz]} rotation={[slopeAngle, 0, 0]}>
            {/* Panel frame */}
            <mesh castShadow>
              <boxGeometry args={[1.0, 0.04, 0.7]} />
              <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.2} />
            </mesh>
            {/* Glass surface */}
            <mesh position={[0, 0.025, 0]}>
              <boxGeometry args={[0.92, 0.01, 0.62]} />
              <meshStandardMaterial color="#1a2744" metalness={0.8} roughness={0.1} />
            </mesh>
            {/* Grid lines (horizontal) */}
            {[-0.2, 0, 0.2].map(gz => (
              <mesh key={gz} position={[0, 0.032, gz]}>
                <boxGeometry args={[0.92, 0.003, 0.008]} />
                <meshStandardMaterial color="#aabbcc" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
            {/* Grid lines (vertical) */}
            {[-0.3, -0.1, 0.1, 0.3].map(gx => (
              <mesh key={gx} position={[gx, 0.032, 0]}>
                <boxGeometry args={[0.008, 0.003, 0.62]} />
                <meshStandardMaterial color="#aabbcc" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* Hay bale near door */}
      <mesh position={[3.5, 0.3, 1.2]} rotation={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.5, 10]} />
        <meshStandardMaterial color="#c4a840" roughness={0.92} />
      </mesh>
      <mesh position={[3.8, 0.3, 0.4]} rotation={[Math.PI / 2, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.45, 10]} />
        <meshStandardMaterial color="#b89830" roughness={0.92} />
      </mesh>

      {/* Foundation stones — more detailed */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[5.2, 0.1, 4.2]} />
        <meshStandardMaterial color="#5a5550" roughness={0.95} />
      </mesh>
      {/* Foundation edge stones */}
      <mesh position={[2.55, 0.12, 0]}>
        <boxGeometry args={[0.12, 0.24, 4.0]} />
        <meshStandardMaterial color="#4a4540" roughness={0.95} flatShading />
      </mesh>

      {/* Door frame */}
      <mesh position={[2.5, 1.5, 0.85]}>
        <boxGeometry args={[0.08, 3, 0.08]} />
        <meshStandardMaterial color="#3a1505" roughness={0.88} />
      </mesh>
      <mesh position={[2.5, 1.5, -0.85]}>
        <boxGeometry args={[0.08, 3, 0.08]} />
        <meshStandardMaterial color="#3a1505" roughness={0.88} />
      </mesh>
      <mesh position={[2.5, 2.95, 0]}>
        <boxGeometry args={[0.08, 0.08, 1.78]} />
        <meshStandardMaterial color="#3a1505" roughness={0.88} />
      </mesh>

      {/* Horseshoe above door (good luck!) */}
      <mesh position={[2.52, 2.7, 0]} rotation={[0, Math.PI / 2, Math.PI]}>
        <torusGeometry args={[0.08, 0.012, 6, 10, Math.PI]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Exterior gate light ─────────────────────── */}

      {/* Wall mount bracket */}
      <mesh position={[2.56, 3.15, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Short arm pointing outward */}
      <mesh position={[2.72, 3.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.03, 0.25, 6]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Lamp housing — tilted 60° upward outward */}
      <group position={[2.85, 3.15, 0]} rotation={[0, 0, 1.05]}>
        {/* Housing */}
        <mesh>
          <boxGeometry args={[0.22, 0.07, 0.18]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Glass lens */}
        <mesh position={[0, -0.045, 0]}>
          <boxGeometry args={[0.18, 0.012, 0.14]} />
          <meshStandardMaterial
            color={extFactor > 0 ? '#fff8e0' : '#aaa'}
            emissive={extFactor > 0 ? '#ffcc44' : '#000'}
            emissiveIntensity={extFactor * 3.5}
          />
        </mesh>
      </group>

      {/* Gate spotlight — points outward (+X local = northeast world) */}
      {extFactor > 0 && (
        <GateSpotlight intensity={extFactor * 5.0} />
      )}
    </group>
  )
}
