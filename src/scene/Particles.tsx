import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EngineEvent, CowBehavior, Vec3 } from '../engine/types.ts'

// ── Types ────────────────────────────────────────────────

interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
  alpha: number
  life: number
  maxLife: number
}

export interface ParticlesProps {
  events: EngineEvent[]
  cowPosition: Vec3
  cowBehavior: CowBehavior
}

// ── Constants ────────────────────────────────────────────

const MAX_PARTICLES = 200
const HEART_COLOR = new THREE.Color('#ff69b4')
const DUST_COLOR = new THREE.Color('#8B7355')
const ZZZ_COLOR = new THREE.Color('#aabbff')
const LANDING_DUST_COLOR = new THREE.Color('#9B8765')
const SPARKLE_COLOR = new THREE.Color('#ffffcc')
const CONFETTI_COLORS = [
  new THREE.Color('#ff4466'),
  new THREE.Color('#44bbff'),
  new THREE.Color('#ffdd22'),
  new THREE.Color('#66ff88'),
  new THREE.Color('#dd66ff'),
  new THREE.Color('#ff8844'),
]

// ── Component ────────────────────────────────────────────

export default function Particles({ events, cowPosition, cowBehavior }: ParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!)
  const particles = useRef<Particle[]>([])
  const dustTimer = useRef(0)
  const zzzTimer = useRef(0)

  const { positions, colors, alphas } = useMemo(() => {
    const pos = new Float32Array(MAX_PARTICLES * 3)
    const col = new Float32Array(MAX_PARTICLES * 3)
    const alp = new Float32Array(MAX_PARTICLES)
    return { positions: pos, colors: col, alphas: alp }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    return geo
  }, [positions, colors, alphas])

  // Vertex/fragment shaders for point particles with per-particle alpha
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute float alpha;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            vAlpha = alpha;
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 8.0 * (5.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            // Circular point
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            gl_FragColor = vec4(vColor, vAlpha * (1.0 - dist * 2.0));
          }
        `,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
      }),
    [],
  )

  function spawnParticle(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    life: number,
  ) {
    if (particles.current.length >= MAX_PARTICLES) return
    particles.current.push({
      position: pos.clone(),
      velocity: vel.clone(),
      color: color.clone(),
      alpha: 1,
      life,
      maxLife: life,
    })
  }

  function spawnHearts() {
    for (let i = 0; i < 8; i++) {
      const pos = new THREE.Vector3(
        cowPosition[0] + (Math.random() - 0.5) * 0.5,
        cowPosition[1] + 1.2 + Math.random() * 0.3,
        cowPosition[2] + (Math.random() - 0.5) * 0.5,
      )
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        0.8 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.3,
      )
      spawnParticle(pos, vel, HEART_COLOR, 1.5 + Math.random() * 0.5)
    }
  }

  function spawnDust() {
    for (let i = 0; i < 2; i++) {
      const pos = new THREE.Vector3(
        cowPosition[0] + (Math.random() - 0.5) * 0.4,
        cowPosition[1] + 0.05,
        cowPosition[2] + (Math.random() - 0.5) * 0.4,
      )
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0.3 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.5,
      )
      spawnParticle(pos, vel, DUST_COLOR, 0.6 + Math.random() * 0.3)
    }
  }

  function spawnZzz() {
    const pos = new THREE.Vector3(
      cowPosition[0] + 0.3,
      cowPosition[1] + 1.0,
      cowPosition[2],
    )
    const vel = new THREE.Vector3(
      0.1 + Math.random() * 0.1,
      0.5 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.1,
    )
    spawnParticle(pos, vel, ZZZ_COLOR, 2.0 + Math.random() * 0.5)
  }

  function spawnLandingDust() {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2
      const outward = 0.3 + Math.random() * 0.4
      const pos = new THREE.Vector3(
        cowPosition[0] + (Math.random() - 0.5) * 0.3,
        cowPosition[1] + 0.05 + Math.random() * 0.1,
        cowPosition[2] + (Math.random() - 0.5) * 0.3,
      )
      const vel = new THREE.Vector3(
        Math.cos(angle) * outward,
        -0.1 + Math.random() * 0.2,
        Math.sin(angle) * outward,
      )
      spawnParticle(pos, vel, LANDING_DUST_COLOR, 0.5 + Math.random() * 0.3)
    }
  }

  function spawnSparkles() {
    for (let i = 0; i < 5; i++) {
      const pos = new THREE.Vector3(
        cowPosition[0] + (Math.random() - 0.5) * 0.4,
        cowPosition[1] + 0.5 + Math.random() * 0.6,
        cowPosition[2] + (Math.random() - 0.5) * 0.4,
      )
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        0.3 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.2,
      )
      spawnParticle(pos, vel, SPARKLE_COLOR, 0.6 + Math.random() * 0.4)
    }
  }

  function spawnConfetti() {
    for (let i = 0; i < 15; i++) {
      const pos = new THREE.Vector3(
        cowPosition[0] + (Math.random() - 0.5) * 0.5,
        cowPosition[1] + 0.8 + Math.random() * 0.3,
        cowPosition[2] + (Math.random() - 0.5) * 0.5,
      )
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.0,
        1.5 + Math.random() * 1.0,
        (Math.random() - 0.5) * 1.0,
      )
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      spawnParticle(pos, vel, color, 1.2 + Math.random() * 0.6)
    }
  }

  useFrame((_state, delta) => {
    // Process events for this frame
    for (const event of events) {
      if (event.type === 'pet_received') {
        spawnHearts()
      } else if (event.type === 'cow_jumped') {
        spawnLandingDust()
      } else if (event.type === 'food_placed') {
        spawnSparkles()
      } else if (event.type === 'play_started') {
        spawnConfetti()
      }
    }

    // Dust while moving
    if (cowBehavior === 'walking' || cowBehavior === 'running') {
      dustTimer.current += delta
      const dustInterval = cowBehavior === 'running' ? 0.08 : 0.15
      if (dustTimer.current >= dustInterval) {
        dustTimer.current = 0
        spawnDust()
      }
    } else {
      dustTimer.current = 0
    }

    // Zzz while sleeping
    if (cowBehavior === 'sleeping') {
      zzzTimer.current += delta
      if (zzzTimer.current >= 0.5) {
        zzzTimer.current = 0
        spawnZzz()
      }
    } else {
      zzzTimer.current = 0
    }

    // Update particles
    const alive: Particle[] = []
    for (const p of particles.current) {
      p.life -= delta
      if (p.life <= 0) continue

      p.position.add(p.velocity.clone().multiplyScalar(delta))
      p.velocity.y -= 0.3 * delta // slight gravity
      p.alpha = Math.max(0, p.life / p.maxLife)

      alive.push(p)
    }
    particles.current = alive

    // Update buffer attributes
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute
    const alpAttr = geometry.getAttribute('alpha') as THREE.BufferAttribute

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < alive.length) {
        const p = alive[i]
        posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z)
        colAttr.setXYZ(i, p.color.r, p.color.g, p.color.b)
        alpAttr.setX(i, p.alpha)
      } else {
        posAttr.setXYZ(i, 0, -100, 0) // hide off-screen
        alpAttr.setX(i, 0)
      }
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    alpAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  )
}
