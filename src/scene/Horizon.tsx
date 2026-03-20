import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from '../engine/types.ts'
import { getTimePalette } from '../engine/palette.ts'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants.ts'

// ── Seeded pseudo-random ───────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Mountain profile generator ─────────────────────────

function mountainProfile(
  t: number,
  segIndex: number,
  seed: number,
  heightScale: number,
  jaggedness: number,
): number {
  const segSeed = segIndex * 37.13 + seed

  // Per-segment height modifiers for variety
  const peakMult = 0.4 + seededRandom(segSeed * 2.71) * 1.6
  const isTall = seededRandom(segSeed * 4.13) > 0.72
  const peakBoost = isTall ? 2.2 : 1.0
  const isValley = seededRandom(segSeed * 6.17) > 0.90
  const valleyFactor = isValley ? 0.12 : 1.0

  const effectiveScale = heightScale * peakMult * peakBoost * valleyFactor

  // Multi-frequency fractal
  let h = 0
  h += Math.sin(t * Math.PI + segSeed) * 1.0
  h += Math.sin(t * Math.PI * 2.3 + segSeed * 1.7) * 0.45
  h += Math.sin(t * Math.PI * 4.7 + segSeed * 3.1) * 0.22 * (1 + jaggedness)
  h += Math.sin(t * Math.PI * 0.5 + segSeed * 0.3) * 0.6
  // High-frequency jagged detail
  h += Math.sin(t * Math.PI * 9 + seed * 7.3) * 0.12 * jaggedness
  h += Math.sin(t * Math.PI * 17 + seed * 13.1) * 0.06 * jaggedness

  h = Math.max(h, 0.05)
  return h * effectiveScale
}

// ── Build a single merged ring geometry with vertical subdivisions ──

function buildMountainRing(
  radius: number,
  segments: number,
  vertDivs: number,
  baseY: number,
  heightScale: number,
  jaggedness: number,
  seed: number,
): { geometry: THREE.BufferGeometry; maxHeight: number } {
  const positions: number[] = []
  const indices: number[] = []
  const totalAngle = Math.PI * 2
  const totalAngularPts = segments * 4 + 1 // 4 sub-divisions per segment
  let maxHeight = 0

  // Generate vertices
  for (let ai = 0; ai <= totalAngularPts - 1; ai++) {
    const angT = ai / (totalAngularPts - 1)
    const angle = angT * totalAngle
    const segIdx = Math.floor(angT * segments)
    const localT = (angT * segments) - segIdx

    const peakH = mountainProfile(localT, segIdx, seed, heightScale, jaggedness)
    const absTop = baseY + peakH
    if (absTop > maxHeight) maxHeight = absTop

    for (let vi = 0; vi <= vertDivs; vi++) {
      const vt = vi / vertDivs
      const y = baseY + peakH * vt
      // Mountains lean very slightly inward at the top
      const r = radius - vt * 0.4

      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r)
    }
  }

  // Build triangle indices
  const stride = vertDivs + 1
  for (let ai = 0; ai < totalAngularPts - 1; ai++) {
    for (let vi = 0; vi < vertDivs; vi++) {
      const a = ai * stride + vi
      const b = (ai + 1) * stride + vi
      const c = ai * stride + vi + 1
      const d = (ai + 1) * stride + vi + 1
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  return { geometry: geo, maxHeight }
}

// ── GLSL shaders ───────────────────────────────────────

const mountainVertexShader = /* glsl */ `
  uniform float uBaseY;

  varying float vWorldY;
  varying float vDistance;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldY = worldPos.y;
    vDistance = length(worldPos.xz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const mountainFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uHazeColor;
  uniform float uHazeNear;
  uniform float uHazeFar;
  uniform float uSnowLine;     // world Y above which snow appears
  uniform float uMaxHeight;
  uniform float uBaseY;
  uniform float uAmbient;
  uniform float uTime;

  varying float vWorldY;
  varying float vDistance;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // Simple hash noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float heightRange = max(uMaxHeight - uBaseY, 0.1);
    float h = clamp((vWorldY - uBaseY) / heightRange, 0.0, 1.0);

    // Procedural noise for surface variation
    float surfNoise = noise2D(vWorldPos.xz * 0.8) * 0.15;
    float detailNoise = noise2D(vWorldPos.xz * 3.0) * 0.08;

    // ── Height-based biome coloring ──
    vec3 deepBase   = vec3(0.025, 0.045, 0.02);    // dark earth at very bottom
    vec3 forestLow  = vec3(0.05, 0.12, 0.035);     // dark conifer forest
    vec3 forestHigh = vec3(0.08, 0.17, 0.05);      // lighter forest
    vec3 treeline   = vec3(0.12, 0.14, 0.08);      // sparse tree/shrub zone
    vec3 rockLow    = vec3(0.18, 0.16, 0.14);      // gray-brown rock
    vec3 rockHigh   = vec3(0.30, 0.28, 0.26);      // lighter rock near peaks
    vec3 snow       = vec3(0.82, 0.85, 0.90);      // snow

    vec3 color;
    if (h < 0.08) {
      color = mix(deepBase, forestLow, h / 0.08);
    } else if (h < 0.30) {
      color = mix(forestLow, forestHigh, (h - 0.08) / 0.22);
    } else if (h < 0.50) {
      color = mix(forestHigh, treeline, (h - 0.30) / 0.20);
    } else if (h < 0.68) {
      color = mix(treeline, rockLow, (h - 0.50) / 0.18);
    } else if (h < 0.85) {
      color = mix(rockLow, rockHigh, (h - 0.68) / 0.17);
    } else {
      color = mix(rockHigh, snow, (h - 0.85) / 0.15);
    }

    // Snow accumulation above snow line with noise edge
    float snowH = (vWorldY - uSnowLine) / max(uMaxHeight - uSnowLine, 0.1);
    float snowNoise = noise2D(vWorldPos.xz * 2.5) * 0.25 - 0.1;
    float snowFactor = smoothstep(0.0, 0.35, snowH + snowNoise);
    // Snow prefers more horizontal surfaces (normals pointing up)
    float slopeFactor = smoothstep(0.3, 0.7, vNormal.y);
    color = mix(color, snow, snowFactor * slopeFactor * 0.9);

    // Surface noise variation (different rock/vegetation patches)
    color += (surfNoise - 0.075) * vec3(0.06, 0.05, 0.03);
    color += (detailNoise - 0.04) * vec3(0.03, 0.04, 0.02);

    // ── Lighting ──
    vec3 norm = normalize(vNormal);
    float NdotL = max(dot(norm, normalize(uSunDir)), 0.0);
    // Wrap diffuse for softer shadows
    float wrapDiffuse = NdotL * 0.6 + 0.4;
    // Slight rim light for depth
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(norm, viewDir), 0.0), 3.0) * 0.08;

    vec3 lit = color * (uAmbient + wrapDiffuse * (1.0 - uAmbient)) * uSunColor;
    lit += rim * uSunColor * 0.3;

    // ── Atmospheric haze ──
    float hazeFactor = smoothstep(uHazeNear, uHazeFar, vDistance);
    // Height-based haze: lower areas get more haze (valley fog)
    float valleyHaze = (1.0 - h) * 0.15;
    hazeFactor = min(hazeFactor + valleyHaze, 0.92);
    lit = mix(lit, uHazeColor, hazeFactor);

    gl_FragColor = vec4(lit, 1.0);
  }
`

// ── Tree silhouette shapes ──────────────────────────────

type TreeShape = 'pine' | 'deciduous' | 'tall'

interface TreeSilhouette {
  position: THREE.Vector3
  height: number
  width: number
  shape: TreeShape
}

const pineGeo = (() => {
  const geo = new THREE.ConeGeometry(0.35, 1.0, 4)
  geo.translate(0, 0.5, 0)
  return geo
})()

const deciduousGeo = (() => {
  const geo = new THREE.SphereGeometry(0.45, 6, 4)
  geo.translate(0, 0.7, 0)
  return geo
})()

const tallGeo = (() => {
  const geo = new THREE.CylinderGeometry(0.12, 0.15, 1.0, 4)
  geo.translate(0, 0.5, 0)
  return geo
})()

function getTreeGeometry(shape: TreeShape): THREE.BufferGeometry {
  switch (shape) {
    case 'pine': return pineGeo
    case 'deciduous': return deciduousGeo
    case 'tall': return tallGeo
  }
}

function generateTreeSilhouettes(
  radius: number,
  clusterCount: number,
  baseY: number,
): TreeSilhouette[] {
  const trees: TreeSilhouette[] = []
  const totalAngle = Math.PI * 2

  for (let c = 0; c < clusterCount; c++) {
    const clusterSeed = c * 51.7
    if (seededRandom(clusterSeed * 3.3) > 0.75) continue

    const clusterAngle = (c / clusterCount) * totalAngle + seededRandom(clusterSeed) * 0.3
    const treesInCluster = 2 + Math.floor(seededRandom(clusterSeed * 1.7) * 4)

    const shapeRoll = seededRandom(clusterSeed * 2.1)
    const clusterShape: TreeShape = shapeRoll < 0.4 ? 'pine' : shapeRoll < 0.75 ? 'deciduous' : 'tall'

    for (let t = 0; t < treesInCluster; t++) {
      const treeSeed = clusterSeed + t * 13.7
      const angleOffset = (seededRandom(treeSeed) - 0.5) * 0.08
      const angle = clusterAngle + angleOffset
      const r = radius + (seededRandom(treeSeed * 2.3) - 0.5) * 4

      const segmentIndex = Math.floor((angle / totalAngle) * 40) % 40
      const seed = segmentIndex * 37.13 + radius * 7.3
      const localT = (angle % (totalAngle / 40)) / (totalAngle / 40)
      const hillH = mountainProfile(localT, segmentIndex, seed, 2.5, 0.2)
      const y = baseY + hillH * 0.5

      let shape = clusterShape
      if (seededRandom(treeSeed * 4.1) > 0.7) {
        const shapes: TreeShape[] = ['pine', 'deciduous', 'tall']
        shape = shapes[Math.floor(seededRandom(treeSeed * 5.3) * 3)]
      }

      const heightBase = shape === 'tall' ? 2.5 : shape === 'pine' ? 1.8 : 1.5
      const heightVar = heightBase + seededRandom(treeSeed * 3.7) * 2.5

      trees.push({
        position: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
        height: heightVar,
        width: 0.4 + seededRandom(treeSeed * 6.1) * 0.8,
        shape,
      })
    }
  }
  return trees
}

// ── Farmstead silhouettes ──────────────────────────────

interface FarmBuilding {
  position: THREE.Vector3
  geometry: THREE.BufferGeometry
  scaleVec: [number, number, number]
}

function generateFarmstead(radius: number, baseY: number): FarmBuilding[] {
  const buildings: FarmBuilding[] = []
  const farmAngle = Math.PI * 0.35

  const farmX = Math.cos(farmAngle) * radius
  const farmZ = Math.sin(farmAngle) * radius

  const houseGeo = new THREE.BoxGeometry(1, 1, 1)
  houseGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(farmX, baseY + 0.3, farmZ),
    geometry: houseGeo,
    scaleVec: [2.5, 2.0, 1.8],
  })

  const roofGeo = new THREE.ConeGeometry(1.0, 0.8, 4)
  roofGeo.rotateY(Math.PI / 4)
  roofGeo.translate(0, 0.4, 0)
  buildings.push({
    position: new THREE.Vector3(farmX, baseY + 2.3, farmZ),
    geometry: roofGeo,
    scaleVec: [1.8, 1.5, 1.3],
  })

  const shedGeo = new THREE.BoxGeometry(1, 1, 1)
  shedGeo.translate(0, 0.5, 0)
  const shedOffset = 4.5
  buildings.push({
    position: new THREE.Vector3(
      farmX + Math.cos(farmAngle + 0.08) * shedOffset,
      baseY + 0.2,
      farmZ + Math.sin(farmAngle + 0.08) * shedOffset,
    ),
    geometry: shedGeo,
    scaleVec: [1.8, 1.5, 1.5],
  })

  const siloGeo = new THREE.CylinderGeometry(0.4, 0.4, 1, 8)
  siloGeo.translate(0, 0.5, 0)
  const siloOffset = 2.5
  buildings.push({
    position: new THREE.Vector3(
      farmX + Math.cos(farmAngle - 0.06) * siloOffset,
      baseY + 0.3,
      farmZ + Math.sin(farmAngle - 0.06) * siloOffset,
    ),
    geometry: siloGeo,
    scaleVec: [1.0, 4.5, 1.0],
  })

  const siloCapGeo = new THREE.SphereGeometry(0.45, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  buildings.push({
    position: new THREE.Vector3(
      farmX + Math.cos(farmAngle - 0.06) * siloOffset,
      baseY + 4.8,
      farmZ + Math.sin(farmAngle - 0.06) * siloOffset,
    ),
    geometry: siloCapGeo,
    scaleVec: [1.0, 0.8, 1.0],
  })

  return buildings
}

// ── Horizon component ──────────────────────────────────

interface HorizonProps {
  timeOfDay: number
  sunPosition: Vec3
}

export default function Horizon({ timeOfDay, sunPosition }: HorizonProps) {
  const nearMatRef = useRef<THREE.ShaderMaterial>(null!)
  const midMatRef = useRef<THREE.ShaderMaterial>(null!)
  const farMatRef = useRef<THREE.ShaderMaterial>(null!)
  const treeMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const farmMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)

  const {
    nearRing, midRing, farRing,
    nearMaxH, midMaxH, farMaxH,
    trees, farmstead,
  } = useMemo(() => {
    const near = buildMountainRing(45, 50, 5, -0.5, 3.0, 0.2, 1.0)
    const mid = buildMountainRing(60, 45, 5, -0.3, 5.0, 0.5, 2.0)
    const far = buildMountainRing(78, 40, 6, -0.2, 8.0, 0.8, 3.0)

    return {
      nearRing: near.geometry,
      midRing: mid.geometry,
      farRing: far.geometry,
      nearMaxH: near.maxHeight,
      midMaxH: mid.maxHeight,
      farMaxH: far.maxHeight,
      trees: generateTreeSilhouettes(45, 30, -0.5),
      farmstead: generateFarmstead(50, -0.3),
    }
  }, [])

  // Shared uniform objects (created once, mutated in useFrame)
  const nearUniforms = useMemo(() => ({
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Vector3(1, 1, 0.95) },
    uHazeColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uHazeNear: { value: 30.0 },
    uHazeFar: { value: 55.0 },
    uSnowLine: { value: 999.0 }, // no snow on near hills
    uMaxHeight: { value: nearMaxH },
    uBaseY: { value: -0.5 },
    uAmbient: { value: 0.4 },
    uTime: { value: 0.0 },
  }), [nearMaxH])

  const midUniforms = useMemo(() => ({
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Vector3(1, 1, 0.95) },
    uHazeColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uHazeNear: { value: 38.0 },
    uHazeFar: { value: 72.0 },
    uSnowLine: { value: midMaxH * 0.82 },
    uMaxHeight: { value: midMaxH },
    uBaseY: { value: -0.3 },
    uAmbient: { value: 0.4 },
    uTime: { value: 0.0 },
  }), [midMaxH])

  const farUniforms = useMemo(() => ({
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Vector3(1, 1, 0.95) },
    uHazeColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uHazeNear: { value: 48.0 },
    uHazeFar: { value: 90.0 },
    uSnowLine: { value: farMaxH * 0.55 },
    uMaxHeight: { value: farMaxH },
    uBaseY: { value: -0.2 },
    uAmbient: { value: 0.4 },
    uTime: { value: 0.0 },
  }), [farMaxH])

  useFrame((_state, delta) => {
    const palette = getTimePalette(timeOfDay)
    const [hr, hg, hb] = palette.horizonColor
    const [sr, sg, sb] = palette.sunColor

    const isDawnOrDusk =
      (timeOfDay > SUNRISE_HOUR - 1 && timeOfDay < SUNRISE_HOUR + 2) ||
      (timeOfDay > SUNSET_HOUR - 2 && timeOfDay < SUNSET_HOUR + 1)

    // Sun direction from sunPosition prop
    const sunDir = new THREE.Vector3(sunPosition[0], sunPosition[1], sunPosition[2]).normalize()

    // Ambient based on sun height (brighter midday, dim at night)
    const sunHeight = Math.max(sunDir.y, 0)
    const ambient = 0.18 + sunHeight * 0.52

    // Sun color for lighting (brighter during day)
    const dayFactor = Math.max(sunHeight * 1.5, 0.15)
    const litR = sr * dayFactor
    const litG = sg * dayFactor
    const litB = sb * dayFactor

    // Haze color: blend between horizon color and a warm tint at dawn/dusk
    const warmBoost = isDawnOrDusk ? 0.12 : 0.0
    const hazeR = hr * 0.85 + warmBoost * 0.5
    const hazeG = hg * 0.85 + warmBoost * 0.25
    const hazeB = hb * 0.85

    // Update all three ring materials
    for (const uniforms of [nearUniforms, midUniforms, farUniforms]) {
      uniforms.uSunDir.value.copy(sunDir)
      uniforms.uSunColor.value.set(litR, litG, litB)
      uniforms.uHazeColor.value.set(hazeR, hazeG, hazeB)
      uniforms.uAmbient.value = ambient
      uniforms.uTime.value += delta
    }

    // Trees and farmstead: silhouette color with atmospheric tint
    const treeR = hr * 0.06 + warmBoost * 0.3
    const treeG = hg * 0.06 + warmBoost * 0.15
    const treeB = hb * 0.09

    if (treeMaterialRef.current) {
      treeMaterialRef.current.color.setRGB(treeR, treeG, treeB)
    }
    if (farmMaterialRef.current) {
      farmMaterialRef.current.color.setRGB(
        treeR * 1.1 + 0.01,
        treeG * 1.1 + 0.005,
        treeB * 1.1,
      )
    }
  })

  return (
    <group>
      {/* Far mountain ring — dramatic peaks with snow */}
      <mesh geometry={farRing} renderOrder={-3}>
        <shaderMaterial
          ref={farMatRef}
          vertexShader={mountainVertexShader}
          fragmentShader={mountainFragmentShader}
          uniforms={farUniforms}
          side={THREE.FrontSide}
          fog={false}
        />
      </mesh>

      {/* Mid mountain ring */}
      <mesh geometry={midRing} renderOrder={-2}>
        <shaderMaterial
          ref={midMatRef}
          vertexShader={mountainVertexShader}
          fragmentShader={mountainFragmentShader}
          uniforms={midUniforms}
          side={THREE.FrontSide}
          fog={false}
        />
      </mesh>

      {/* Near foothills ring */}
      <mesh geometry={nearRing} renderOrder={-1}>
        <shaderMaterial
          ref={nearMatRef}
          vertexShader={mountainVertexShader}
          fragmentShader={mountainFragmentShader}
          uniforms={nearUniforms}
          side={THREE.FrontSide}
          fog={false}
        />
      </mesh>

      {/* Tree silhouettes on hilltops */}
      {trees.map((tree, i) => (
        <mesh
          key={`tree-${i}`}
          geometry={getTreeGeometry(tree.shape)}
          position={tree.position}
          scale={[tree.width, tree.height, tree.width]}
          rotation={[0, Math.atan2(tree.position.x, tree.position.z) + Math.PI, 0]}
        >
          <meshBasicMaterial
            ref={i === 0 ? treeMaterialRef : undefined}
            color="#060810"
            fog={false}
          />
        </mesh>
      ))}

      {/* Farmstead silhouettes */}
      {farmstead.map((building, i) => (
        <mesh
          key={`farm-${i}`}
          geometry={building.geometry}
          position={building.position}
          scale={building.scaleVec}
          rotation={[0, Math.atan2(building.position.x, building.position.z) + Math.PI, 0]}
        >
          <meshBasicMaterial
            ref={i === 0 ? farmMaterialRef : undefined}
            color="#060810"
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}
