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
  varying vec3 vWorldPos;

  void main() {
    // Position in local blade space: y goes from 0 (base) to bladeHeight (tip)
    vHeight = position.y / aBladeHeight;
    vOffset = aOffset;

    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // Wind sway: quadratic falloff from base, multi-frequency
    float tipFactor = vHeight * vHeight;
    float sway1 = sin(uTime * 1.5 + worldPos.x * 0.5 + worldPos.z * 0.3 + aOffset)
               * tipFactor * uWindStrength * 0.18;
    float sway2 = sin(uTime * 2.8 + worldPos.x * 1.2 + worldPos.z * 0.8 + aOffset * 2.0)
               * tipFactor * uWindStrength * 0.06;

    worldPos.x += (sway1 + sway2) * uWindDirection.x;
    worldPos.z += (sway1 + sway2) * uWindDirection.y;
    // Slight vertical compression when swaying
    worldPos.y -= abs(sway1) * 0.15;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  varying float vHeight;
  varying float vOffset;
  varying vec3 vWorldPos;

  void main() {
    // Rich green gradient: dark earthy base → bright sunlit tips
    vec3 baseColor = vec3(0.06, 0.14, 0.02);   // dark forest floor
    vec3 midColor  = vec3(0.12, 0.28, 0.05);   // mid green
    vec3 tipColor  = vec3(0.28, 0.52, 0.12);   // bright sunlit tip

    // Two-stage gradient: base→mid (lower 40%), mid→tip (upper 60%)
    vec3 color;
    if (vHeight < 0.4) {
      color = mix(baseColor, midColor, vHeight / 0.4);
    } else {
      color = mix(midColor, tipColor, (vHeight - 0.4) / 0.6);
    }

    // Per-blade color variation (hue shift and brightness)
    float variation = sin(vOffset * 6.28) * 0.06;
    float variation2 = cos(vOffset * 3.14 + 1.0) * 0.04;
    color.g += variation;
    color.r += variation * 0.3 + variation2 * 0.2;
    color.b += variation2 * 0.15;

    // Yellowish-green tip highlights (sun-bleached look)
    float tipHighlight = smoothstep(0.7, 1.0, vHeight);
    color += vec3(0.08, 0.06, 0.0) * tipHighlight * (0.5 + sin(vOffset * 12.56) * 0.5);

    // Ambient occlusion at base (ground shadow)
    float ao = smoothstep(0.0, 0.25, vHeight);
    color *= 0.45 + ao * 0.55;

    // Subtle distance-based color variation (patches of different grass species)
    float patchNoise = sin(vWorldPos.x * 0.4 + vWorldPos.z * 0.3) * 0.5 + 0.5;
    color = mix(color, color * vec3(1.05, 0.95, 0.9), patchNoise * 0.15);

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
  // Wider quad blade with taper — 4 vertices (2 triangles)
  const w = 0.022
  const positions = new Float32Array([
    // Triangle 1: base-left, base-right, mid-right
    -w / 2, 0, 0,
     w / 2, 0, 0,
     w / 3, height * 0.55, 0,
    // Triangle 2: base-left, mid-right, tip
    -w / 2, 0, 0,
     w / 3, height * 0.55, 0,
     0, height, 0.003,  // slight z-offset for natural curve
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
