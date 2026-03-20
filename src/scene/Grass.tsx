import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  GRASS_COUNT,
  GRASS_AREA,
  GRASS_MIN_HEIGHT,
  GRASS_MAX_HEIGHT,
  EXCLUSION_ZONES,
} from '../engine/constants.ts'
import { useGameStore } from '../ui/hooks.ts'

// ── Shaders ──────────────────────────────────────────────

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;

  attribute float aOffset;
  attribute float aBladeHeight;

  varying float vHeight;
  varying float vOffset;

  void main() {
    // Position in local blade space: y goes from 0 (base) to bladeHeight (tip)
    vHeight = position.y / aBladeHeight;
    vOffset = aOffset;

    vec4 worldPos = instanceMatrix * vec4(position, 1.0);

    // Wind sway: only affects the tip (vHeight factor)
    float tipFactor = vHeight * vHeight; // quadratic falloff from base
    float sway = sin(uTime * 1.5 + worldPos.x * 0.5 + worldPos.z * 0.3 + aOffset)
               * tipFactor * uWindStrength * 0.15;

    worldPos.x += sway * uWindDirection.x;
    worldPos.z += sway * uWindDirection.y;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  varying float vHeight;
  varying float vOffset;

  void main() {
    // Green gradient: darker at base, subtler tip
    vec3 baseColor = vec3(0.10, 0.22, 0.04);
    vec3 tipColor  = vec3(0.18, 0.38, 0.08);
    vec3 color = mix(baseColor, tipColor, vHeight);

    // Per-blade color variation using offset (subtle)
    float variation = sin(vOffset * 6.28) * 0.04;
    color.g += variation;
    color.r += variation * 0.2;

    gl_FragColor = vec4(color, 1.0);
  }
`

// ── Helpers ──────────────────────────────────────────────

function isInExclusionZone(x: number, z: number): boolean {
  for (const zone of EXCLUSION_ZONES) {
    const dx = x - zone.center[0]
    const dz = z - zone.center[1]
    if (dx * dx + dz * dz < zone.radius * zone.radius) return true
  }
  return false
}

function makeBladeGeometry(height: number): THREE.BufferGeometry {
  const w = 0.015
  // Simple triangle: base-left, base-right, tip
  const positions = new Float32Array([
    -w / 2, 0, 0,
     w / 2, 0, 0,
     0, height, 0,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

// ── Component ────────────────────────────────────────────

export default function Grass() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const windStrength = useGameStore((s) => s.world.windStrength)

  const { geometry, offsets, heights, matrices } = useMemo(() => {
    // We use a single blade geometry with max height; actual height is passed as attribute
    const avgHeight = (GRASS_MIN_HEIGHT + GRASS_MAX_HEIGHT) / 2
    const geo = makeBladeGeometry(avgHeight)

    const offsetArr = new Float32Array(GRASS_COUNT)
    const heightArr = new Float32Array(GRASS_COUNT)
    const mats: THREE.Matrix4[] = []
    const dummy = new THREE.Object3D()

    let placed = 0
    while (placed < GRASS_COUNT) {
      const x = (Math.random() - 0.5) * GRASS_AREA * 2
      const z = (Math.random() - 0.5) * GRASS_AREA * 2

      if (isInExclusionZone(x, z)) continue

      const bladeHeight =
        GRASS_MIN_HEIGHT + Math.random() * (GRASS_MAX_HEIGHT - GRASS_MIN_HEIGHT)

      // Scale Y to get varying blade heights relative to the avg geometry
      const yScale = bladeHeight / avgHeight

      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0)
      dummy.scale.set(1, yScale, 1)
      dummy.updateMatrix()

      mats.push(dummy.matrix.clone())
      offsetArr[placed] = Math.random() * Math.PI * 2
      heightArr[placed] = bladeHeight
      placed++
    }

    return { geometry: geo, offsets: offsetArr, heights: heightArr, matrices: mats }
  }, [])

  // Set up instanced mesh and per-instance attributes
  const instancedMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(geometry, undefined, GRASS_COUNT)
    for (let i = 0; i < GRASS_COUNT; i++) {
      mesh.setMatrixAt(i, matrices[i])
    }
    mesh.instanceMatrix.needsUpdate = true

    // Per-instance attributes
    const offsetAttr = new THREE.InstancedBufferAttribute(offsets, 1)
    const heightAttr = new THREE.InstancedBufferAttribute(heights, 1)
    mesh.geometry.setAttribute('aOffset', offsetAttr)
    mesh.geometry.setAttribute('aBladeHeight', heightAttr)

    return mesh
  }, [geometry, matrices, offsets, heights])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindStrength: { value: 0.4 },
      uWindDirection: { value: new THREE.Vector2(1, 0.3).normalize() },
    }),
    [],
  )

  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta
      materialRef.current.uniforms.uWindStrength.value = windStrength
    }
  })

  return (
    <primitive object={instancedMesh} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </primitive>
  )
}
