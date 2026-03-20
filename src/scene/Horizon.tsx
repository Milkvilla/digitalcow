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

  const peakMult = 0.4 + seededRandom(segSeed * 2.71) * 1.6
  const isTall = seededRandom(segSeed * 4.13) > 0.72
  const peakBoost = isTall ? 2.2 : 1.0
  const isValley = seededRandom(segSeed * 6.17) > 0.90
  const valleyFactor = isValley ? 0.12 : 1.0

  const effectiveScale = heightScale * peakMult * peakBoost * valleyFactor

  let h = 0
  h += Math.sin(t * Math.PI + segSeed) * 1.0
  h += Math.sin(t * Math.PI * 2.3 + segSeed * 1.7) * 0.45
  h += Math.sin(t * Math.PI * 4.7 + segSeed * 3.1) * 0.22 * (1 + jaggedness)
  h += Math.sin(t * Math.PI * 0.5 + segSeed * 0.3) * 0.6
  h += Math.sin(t * Math.PI * 9 + seed * 7.3) * 0.12 * jaggedness
  h += Math.sin(t * Math.PI * 17 + seed * 13.1) * 0.06 * jaggedness

  h = Math.max(h, 0.05)
  return h * effectiveScale
}

// ── Build mountain ring geometry ──────────────────────

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
  const totalAngularPts = segments * 4 + 1
  let maxHeight = 0

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
      const r = radius - vt * 0.4

      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r)
    }
  }

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

// ── GLSL — Mountain vertex shader ──────────────────────

const mountainVertexShader = /* glsl */ `
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

// ── GLSL — Mountain fragment shader (dramatically improved) ──

const mountainFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uHazeColor;
  uniform float uHazeNear;
  uniform float uHazeFar;
  uniform float uSnowLine;
  uniform float uMaxHeight;
  uniform float uBaseY;
  uniform float uAmbient;
  uniform float uTime;
  uniform float uRingIndex; // 0=near, 1=mid, 2=far

  varying float vWorldY;
  varying float vDistance;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

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

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      val += amp * noise2D(p);
      p *= 2.1;
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    float heightRange = max(uMaxHeight - uBaseY, 0.1);
    float h = clamp((vWorldY - uBaseY) / heightRange, 0.0, 1.0);

    // Multi-scale noise for surface variation
    float surfNoise = fbm(vWorldPos.xz * 0.6);
    float detailNoise = noise2D(vWorldPos.xz * 4.0);
    float microNoise = noise2D(vWorldPos.xz * 12.0);

    // Slope factor (0 = cliff, 1 = flat)
    vec3 norm = normalize(vNormal);
    float slope = norm.y;
    float isSteep = 1.0 - smoothstep(0.3, 0.65, slope);

    // ── Vibrant height-based biome coloring ──

    // Lush meadow greens at base
    vec3 meadowLight = vec3(0.22, 0.42, 0.08);
    vec3 meadowDark  = vec3(0.12, 0.30, 0.05);
    // Rich forest greens
    vec3 forestDark   = vec3(0.04, 0.18, 0.03);
    vec3 forestMid    = vec3(0.06, 0.22, 0.05);
    vec3 forestLight  = vec3(0.10, 0.28, 0.08);
    // Alpine meadow (yellow-green)
    vec3 alpineMeadow = vec3(0.28, 0.35, 0.10);
    // Warm rock tones
    vec3 rockWarm     = vec3(0.32, 0.26, 0.20);
    vec3 rockGrey     = vec3(0.38, 0.36, 0.33);
    vec3 rockDark     = vec3(0.22, 0.20, 0.18);
    // Snow
    vec3 snowClean    = vec3(0.88, 0.91, 0.96);
    vec3 snowShadow   = vec3(0.62, 0.68, 0.80);

    // Noise-modulated meadow
    vec3 meadow = mix(meadowLight, meadowDark, surfNoise);
    // Noise-modulated forest
    vec3 forest = mix(forestDark, forestLight, detailNoise * 0.6 + surfNoise * 0.4);
    // Noise-modulated rock
    vec3 rock = mix(rockWarm, rockGrey, surfNoise * 0.7 + microNoise * 0.3);
    rock = mix(rock, rockDark, isSteep * 0.5);

    vec3 color;
    if (h < 0.06) {
      // Valley floor — lush meadow
      color = meadow;
    } else if (h < 0.18) {
      // Meadow to forest transition
      float t = (h - 0.06) / 0.12;
      color = mix(meadow, forest, smoothstep(0.0, 1.0, t + (surfNoise - 0.5) * 0.3));
    } else if (h < 0.40) {
      // Dense forest zone
      float t = (h - 0.18) / 0.22;
      vec3 forestBand = mix(forest, forestMid, t);
      // Add variation: lighter patches as clearings
      float clearing = smoothstep(0.65, 0.75, surfNoise);
      forestBand = mix(forestBand, meadow * 0.8, clearing * 0.4);
      color = forestBand;
    } else if (h < 0.52) {
      // Treeline — forest to alpine meadow
      float t = (h - 0.40) / 0.12;
      color = mix(forestMid, alpineMeadow, smoothstep(0.0, 1.0, t + (surfNoise - 0.5) * 0.25));
    } else if (h < 0.65) {
      // Alpine meadow to rock
      float t = (h - 0.52) / 0.13;
      float rockMix = smoothstep(0.0, 1.0, t + isSteep * 0.3);
      color = mix(alpineMeadow, rock, rockMix);
    } else if (h < 0.82) {
      // Rock zone
      float t = (h - 0.65) / 0.17;
      color = mix(rock, rockGrey, t * 0.5);
      // Exposed cliff faces are darker
      color = mix(color, rockDark, isSteep * 0.6);
    } else {
      // High rock to snow transition
      float t = (h - 0.82) / 0.18;
      color = mix(rockGrey, snowClean, smoothstep(0.0, 1.0, t));
    }

    // ── Snow accumulation ──
    float snowH = (vWorldY - uSnowLine) / max(uMaxHeight - uSnowLine, 0.1);
    float snowEdgeNoise = fbm(vWorldPos.xz * 1.8) * 0.3 - 0.12;
    float snowFactor = smoothstep(-0.05, 0.4, snowH + snowEdgeNoise);
    // Snow on flatter surfaces, rock on steep
    float snowSlope = smoothstep(0.25, 0.7, slope);
    // Snow color varies: shadow snow in crevices
    float snowBrightness = 0.6 + slope * 0.4;
    vec3 snowColor = mix(snowShadow, snowClean, snowBrightness);
    color = mix(color, snowColor, snowFactor * snowSlope * 0.92);

    // Glacier-like blue tint in deep snow on steep areas
    float glacierFactor = snowFactor * isSteep * smoothstep(0.3, 0.7, snowH);
    color = mix(color, vec3(0.55, 0.65, 0.80), glacierFactor * 0.3);

    // ── Surface detail ──
    // Micro-detail noise adds subtle color shifts
    color += (microNoise - 0.5) * 0.025;
    // Vertical striations on cliffs
    float stria = noise2D(vec2(vWorldPos.y * 8.0, length(vWorldPos.xz) * 2.0)) * isSteep * 0.04;
    color += vec3(stria * 0.5, stria * 0.4, stria * 0.3);

    // ── Lighting ──
    float NdotL = max(dot(norm, normalize(uSunDir)), 0.0);
    // Wrap diffuse for softer mountain shadows
    float wrapDiffuse = NdotL * 0.55 + 0.45;
    // Ambient occlusion approximation: crevices are darker
    float ao = 0.7 + 0.3 * smoothstep(0.0, 0.3, h);

    // Subsurface scattering approximation for vegetation
    float sss = 0.0;
    if (h < 0.52) {
      vec3 backDir = normalize(uSunDir + norm * 0.4);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      sss = pow(max(dot(viewDir, -backDir), 0.0), 3.0) * 0.12 * (1.0 - h / 0.52);
    }

    // Rim light for depth
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(norm, viewDir), 0.0), 3.5) * 0.06;

    vec3 lit = color * (uAmbient * ao + wrapDiffuse * (1.0 - uAmbient)) * uSunColor;
    lit += rim * uSunColor * 0.25;
    lit += sss * uSunColor * vec3(0.2, 0.4, 0.1); // green SSS for vegetation

    // ── Atmospheric haze ──
    float hazeFactor = smoothstep(uHazeNear, uHazeFar, vDistance);
    // Valley fog — heavier in low areas
    float valleyHaze = (1.0 - h) * 0.12;
    hazeFactor = min(hazeFactor + valleyHaze, 0.90);

    // Far ring gets stronger haze for depth
    hazeFactor = min(hazeFactor + uRingIndex * 0.05, 0.92);

    lit = mix(lit, uHazeColor, hazeFactor);

    gl_FragColor = vec4(lit, 1.0);
  }
`

// ── Distant object shader (lit + haze, not flat black) ──

const distantObjectVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vDistance;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vDistance = length(worldPos.xz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const distantObjectFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uHazeColor;
  uniform float uHazeNear;
  uniform float uHazeFar;
  uniform float uAmbient;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vDistance;

  void main() {
    vec3 norm = normalize(vNormal);
    float NdotL = max(dot(norm, normalize(uSunDir)), 0.0);
    float wrapDiffuse = NdotL * 0.5 + 0.5;

    vec3 lit = uBaseColor * (uAmbient + wrapDiffuse * (1.0 - uAmbient)) * uSunColor;

    float hazeFactor = smoothstep(uHazeNear, uHazeFar, vDistance);
    lit = mix(lit, uHazeColor, min(hazeFactor, 0.88));

    gl_FragColor = vec4(lit, 1.0);
  }
`

// ── Tree geometry and generation ────────────────────────

type TreeShape = 'pine' | 'deciduous' | 'tall'

interface TreeSilhouette {
  position: THREE.Vector3
  height: number
  width: number
  shape: TreeShape
  baseColor: THREE.Color
}

const pineGeo = (() => {
  const geo = new THREE.ConeGeometry(0.35, 1.0, 5)
  geo.translate(0, 0.5, 0)
  return geo
})()

const deciduousGeo = (() => {
  const geo = new THREE.SphereGeometry(0.45, 6, 5)
  geo.translate(0, 0.7, 0)
  return geo
})()

const tallGeo = (() => {
  const geo = new THREE.ConeGeometry(0.22, 1.2, 5)
  geo.translate(0, 0.6, 0)
  return geo
})()

function getTreeGeometry(shape: TreeShape): THREE.BufferGeometry {
  switch (shape) {
    case 'pine': return pineGeo
    case 'deciduous': return deciduousGeo
    case 'tall': return tallGeo
  }
}

function getTreeColor(shape: TreeShape, seed: number): THREE.Color {
  const v = seededRandom(seed * 8.7)
  switch (shape) {
    case 'pine':
      return new THREE.Color().setRGB(
        0.03 + v * 0.04,
        0.14 + v * 0.10,
        0.02 + v * 0.03,
      )
    case 'deciduous':
      return new THREE.Color().setRGB(
        0.06 + v * 0.08,
        0.22 + v * 0.14,
        0.04 + v * 0.04,
      )
    case 'tall':
      return new THREE.Color().setRGB(
        0.04 + v * 0.05,
        0.18 + v * 0.12,
        0.03 + v * 0.03,
      )
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
    if (seededRandom(clusterSeed * 3.3) > 0.78) continue

    const clusterAngle = (c / clusterCount) * totalAngle + seededRandom(clusterSeed) * 0.3
    const treesInCluster = 3 + Math.floor(seededRandom(clusterSeed * 1.7) * 5)

    const shapeRoll = seededRandom(clusterSeed * 2.1)
    const clusterShape: TreeShape = shapeRoll < 0.45 ? 'pine' : shapeRoll < 0.78 ? 'deciduous' : 'tall'

    for (let t = 0; t < treesInCluster; t++) {
      const treeSeed = clusterSeed + t * 13.7
      const angleOffset = (seededRandom(treeSeed) - 0.5) * 0.1
      const angle = clusterAngle + angleOffset
      const r = radius + (seededRandom(treeSeed * 2.3) - 0.5) * 5

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

      const heightBase = shape === 'tall' ? 2.5 : shape === 'pine' ? 2.0 : 1.6
      const heightVar = heightBase + seededRandom(treeSeed * 3.7) * 2.5

      trees.push({
        position: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
        height: heightVar,
        width: 0.5 + seededRandom(treeSeed * 6.1) * 0.9,
        shape,
        baseColor: getTreeColor(shape, treeSeed),
      })
    }
  }
  return trees
}

// ── Village / farmstead generation ──────────────────────

interface DistantBuilding {
  position: THREE.Vector3
  geometry: THREE.BufferGeometry
  scaleVec: [number, number, number]
  baseColor: THREE.Color
  emissive: THREE.Color // for night windows
  emissiveIntensity: number
}

function generateVillage(radius: number, baseY: number): DistantBuilding[] {
  const buildings: DistantBuilding[] = []
  const off = new THREE.Color(0, 0, 0)
  const windowGlow = new THREE.Color(1, 0.7, 0.3)

  // --- Main farm cluster at angle ~63° ---
  const farmAngle = Math.PI * 0.35
  const farmR = radius
  const fx = Math.cos(farmAngle) * farmR
  const fz = Math.sin(farmAngle) * farmR

  // Farmhouse — cream/white
  const houseGeo = new THREE.BoxGeometry(1, 1, 1)
  houseGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(fx, baseY + 0.3, fz),
    geometry: houseGeo,
    scaleVec: [2.5, 2.2, 1.8],
    baseColor: new THREE.Color(0.85, 0.82, 0.72),
    emissive: windowGlow,
    emissiveIntensity: 0.0,
  })

  // Farmhouse roof — dark red/brown
  const roofGeo = new THREE.ConeGeometry(1.0, 0.8, 4)
  roofGeo.rotateY(Math.PI / 4)
  roofGeo.translate(0, 0.4, 0)
  buildings.push({
    position: new THREE.Vector3(fx, baseY + 2.5, fz),
    geometry: roofGeo,
    scaleVec: [1.8, 1.5, 1.3],
    baseColor: new THREE.Color(0.45, 0.15, 0.08),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Red barn
  const barnGeo = new THREE.BoxGeometry(1, 1, 1)
  barnGeo.translate(0, 0.5, 0)
  const barnOff = 4.5
  buildings.push({
    position: new THREE.Vector3(
      fx + Math.cos(farmAngle + 0.08) * barnOff,
      baseY + 0.2, fz + Math.sin(farmAngle + 0.08) * barnOff,
    ),
    geometry: barnGeo,
    scaleVec: [2.2, 1.8, 1.6],
    baseColor: new THREE.Color(0.55, 0.12, 0.06),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Barn roof
  buildings.push({
    position: new THREE.Vector3(
      fx + Math.cos(farmAngle + 0.08) * barnOff,
      baseY + 2.0, fz + Math.sin(farmAngle + 0.08) * barnOff,
    ),
    geometry: roofGeo,
    scaleVec: [1.6, 1.2, 1.2],
    baseColor: new THREE.Color(0.35, 0.10, 0.05),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Silver silo
  const siloGeo = new THREE.CylinderGeometry(0.4, 0.4, 1, 8)
  siloGeo.translate(0, 0.5, 0)
  const siloOff = 2.5
  buildings.push({
    position: new THREE.Vector3(
      fx + Math.cos(farmAngle - 0.06) * siloOff,
      baseY + 0.3, fz + Math.sin(farmAngle - 0.06) * siloOff,
    ),
    geometry: siloGeo,
    scaleVec: [1.0, 5.0, 1.0],
    baseColor: new THREE.Color(0.55, 0.55, 0.58),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Silo cap
  const siloCapGeo = new THREE.SphereGeometry(0.45, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  buildings.push({
    position: new THREE.Vector3(
      fx + Math.cos(farmAngle - 0.06) * siloOff,
      baseY + 5.3, fz + Math.sin(farmAngle - 0.06) * siloOff,
    ),
    geometry: siloCapGeo,
    scaleVec: [1.0, 0.8, 1.0],
    baseColor: new THREE.Color(0.50, 0.50, 0.55),
    emissive: off,
    emissiveIntensity: 0,
  })

  // --- Small village cluster at angle ~200° (behind, further) ---
  const villageAngle = Math.PI * 1.12
  const villageR = radius + 8
  const vx = Math.cos(villageAngle) * villageR
  const vz = Math.sin(villageAngle) * villageR

  // Church with steeple
  const churchGeo = new THREE.BoxGeometry(1, 1, 1)
  churchGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(vx, baseY + 0.4, vz),
    geometry: churchGeo,
    scaleVec: [2.0, 3.0, 1.5],
    baseColor: new THREE.Color(0.78, 0.76, 0.70),
    emissive: windowGlow,
    emissiveIntensity: 0,
  })

  // Church steeple
  const steepleGeo = new THREE.ConeGeometry(0.3, 1, 4)
  steepleGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(vx, baseY + 3.4, vz),
    geometry: steepleGeo,
    scaleVec: [1.0, 3.5, 1.0],
    baseColor: new THREE.Color(0.35, 0.35, 0.40),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Village houses (3 small houses)
  for (let i = 0; i < 3; i++) {
    const ha = villageAngle + (i - 1) * 0.04
    const hr = villageR + (i - 1) * 2.5
    const hx = Math.cos(ha) * hr
    const hz = Math.sin(ha) * hr
    const wallColor = i === 0
      ? new THREE.Color(0.82, 0.78, 0.65)
      : i === 1
        ? new THREE.Color(0.72, 0.70, 0.62)
        : new THREE.Color(0.80, 0.75, 0.60)
    const roofColor = i === 0
      ? new THREE.Color(0.42, 0.18, 0.08)
      : i === 1
        ? new THREE.Color(0.30, 0.28, 0.26)
        : new THREE.Color(0.50, 0.22, 0.10)

    buildings.push({
      position: new THREE.Vector3(hx, baseY + 0.2, hz),
      geometry: houseGeo,
      scaleVec: [1.8 + i * 0.3, 1.5 + i * 0.2, 1.4],
      baseColor: wallColor,
      emissive: windowGlow,
      emissiveIntensity: 0,
    })
    buildings.push({
      position: new THREE.Vector3(hx, baseY + 1.7 + i * 0.2, hz),
      geometry: roofGeo,
      scaleVec: [1.3 + i * 0.2, 1.0, 1.0],
      baseColor: roofColor,
      emissive: off,
      emissiveIntensity: 0,
    })
  }

  // --- Water tower at angle ~290° ---
  const wtAngle = Math.PI * 1.62
  const wtR = radius + 3
  const wtx = Math.cos(wtAngle) * wtR
  const wtz = Math.sin(wtAngle) * wtR

  // Tower legs (single cylinder for simplicity)
  const legGeo = new THREE.CylinderGeometry(0.15, 0.25, 1, 6)
  legGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(wtx, baseY + 0.2, wtz),
    geometry: legGeo,
    scaleVec: [1.0, 5.0, 1.0],
    baseColor: new THREE.Color(0.40, 0.38, 0.36),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Water tank
  const tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8)
  tankGeo.translate(0, 0.3, 0)
  buildings.push({
    position: new THREE.Vector3(wtx, baseY + 5.2, wtz),
    geometry: tankGeo,
    scaleVec: [1.8, 2.0, 1.8],
    baseColor: new THREE.Color(0.50, 0.50, 0.55),
    emissive: off,
    emissiveIntensity: 0,
  })

  // Tank roof
  buildings.push({
    position: new THREE.Vector3(wtx, baseY + 6.4, wtz),
    geometry: siloCapGeo,
    scaleVec: [2.0, 0.8, 2.0],
    baseColor: new THREE.Color(0.42, 0.42, 0.46),
    emissive: off,
    emissiveIntensity: 0,
  })

  // --- Distant windmill at angle ~130° ---
  const wmAngle = Math.PI * 0.72
  const wmR = radius + 5
  const wmx = Math.cos(wmAngle) * wmR
  const wmz = Math.sin(wmAngle) * wmR

  buildings.push({
    position: new THREE.Vector3(wmx, baseY + 0.3, wmz),
    geometry: siloGeo,
    scaleVec: [0.7, 5.5, 0.7],
    baseColor: new THREE.Color(0.60, 0.58, 0.52),
    emissive: off,
    emissiveIntensity: 0,
  })
  buildings.push({
    position: new THREE.Vector3(wmx, baseY + 5.8, wmz),
    geometry: siloCapGeo,
    scaleVec: [0.8, 0.5, 0.8],
    baseColor: new THREE.Color(0.45, 0.42, 0.38),
    emissive: off,
    emissiveIntensity: 0,
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

  const {
    nearRing, midRing, farRing,
    nearMaxH, midMaxH, farMaxH,
    nearTrees, midTrees,
    village, fields,
  } = useMemo(() => {
    const near = buildMountainRing(45, 50, 6, -0.5, 3.0, 0.2, 1.0)
    const mid = buildMountainRing(60, 45, 6, -0.3, 5.0, 0.5, 2.0)
    const far = buildMountainRing(78, 40, 7, -0.2, 8.0, 0.8, 3.0)

    return {
      nearRing: near.geometry,
      midRing: mid.geometry,
      farRing: far.geometry,
      nearMaxH: near.maxHeight,
      midMaxH: mid.maxHeight,
      farMaxH: far.maxHeight,
      nearTrees: generateTreeSilhouettes(45, 35, -0.5),
      midTrees: generateTreeSilhouettes(58, 20, -0.3),
      village: generateVillage(50, -0.3),
    }
  }, [])

  // Mountain ring uniforms
  const makeUniforms = (hazeNear: number, hazeFar: number, snowLine: number, maxH: number, baseY: number, ringIndex: number) => ({
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Vector3(1, 1, 0.95) },
    uHazeColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uHazeNear: { value: hazeNear },
    uHazeFar: { value: hazeFar },
    uSnowLine: { value: snowLine },
    uMaxHeight: { value: maxH },
    uBaseY: { value: baseY },
    uAmbient: { value: 0.4 },
    uTime: { value: 0.0 },
    uRingIndex: { value: ringIndex },
  })

  const nearUniforms = useMemo(() => makeUniforms(30, 55, 999, nearMaxH, -0.5, 0), [nearMaxH])
  const midUniforms = useMemo(() => makeUniforms(38, 72, midMaxH * 0.80, midMaxH, -0.3, 1), [midMaxH])
  const farUniforms = useMemo(() => makeUniforms(48, 92, farMaxH * 0.52, farMaxH, -0.2, 2), [farMaxH])

  // Shared dynamic uniforms — all distant objects reference the same value wrappers,
  // so updating these in useFrame propagates to every tree, trunk, and building.
  const sharedDynUniforms = useMemo(() => ({
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Vector3(1, 1, 0.95) },
    uHazeColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uAmbient: { value: 0.4 },
  }), [])

  // Shared distant object uniform template
  const makeObjUniforms = (baseColor: THREE.Color) => ({
    uBaseColor: { value: baseColor },
    uSunDir: sharedDynUniforms.uSunDir,
    uSunColor: sharedDynUniforms.uSunColor,
    uHazeColor: sharedDynUniforms.uHazeColor,
    uHazeNear: { value: 30.0 },
    uHazeFar: { value: 70.0 },
    uAmbient: sharedDynUniforms.uAmbient,
  })

  useFrame((_state, delta) => {
    const palette = getTimePalette(timeOfDay)
    const [hr, hg, hb] = palette.horizonColor
    const [sr, sg, sb] = palette.sunColor

    const isDawnOrDusk =
      (timeOfDay > SUNRISE_HOUR - 1 && timeOfDay < SUNRISE_HOUR + 2) ||
      (timeOfDay > SUNSET_HOUR - 2 && timeOfDay < SUNSET_HOUR + 1)

    const isNight = timeOfDay < SUNRISE_HOUR || timeOfDay > SUNSET_HOUR

    const sunDir = new THREE.Vector3(sunPosition[0], sunPosition[1], sunPosition[2]).normalize()
    const sunHeight = Math.max(sunDir.y, 0)
    const ambient = 0.18 + sunHeight * 0.52
    const dayFactor = Math.max(sunHeight * 1.5, 0.15)
    const litR = sr * dayFactor
    const litG = sg * dayFactor
    const litB = sb * dayFactor

    const warmBoost = isDawnOrDusk ? 0.12 : 0.0
    const hazeR = hr * 0.85 + warmBoost * 0.5
    const hazeG = hg * 0.85 + warmBoost * 0.25
    const hazeB = hb * 0.85

    // Update mountain ring uniforms
    for (const uniforms of [nearUniforms, midUniforms, farUniforms]) {
      uniforms.uSunDir.value.copy(sunDir)
      uniforms.uSunColor.value.set(litR, litG, litB)
      uniforms.uHazeColor.value.set(hazeR, hazeG, hazeB)
      uniforms.uAmbient.value = ambient
      uniforms.uTime.value += delta
    }

    // Update shared dynamic uniforms — propagates to ALL distant objects
    // (trees, trunks, mid-distance trees, buildings) automatically
    sharedDynUniforms.uSunDir.value.copy(sunDir)
    sharedDynUniforms.uSunColor.value.set(litR, litG, litB)
    sharedDynUniforms.uHazeColor.value.set(hazeR, hazeG, hazeB)
    sharedDynUniforms.uAmbient.value = ambient

    // Night glow for village buildings with windows
    for (let i = 0; i < village.length; i++) {
      const b = village[i]
      if (b.emissiveIntensity !== undefined) {
        b.emissiveIntensity = isNight ? 0.4 : 0
      }
    }
  })

  return (
    <group>
      {/* Far mountain ring — dramatic snow-capped peaks */}
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

      {/* Near foothills ring — lush green, detailed */}
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

      {/* Near trees — full color with lighting */}
      {nearTrees.map((tree, i) => (
        <group key={`ntree-${i}`}>
          {/* Trunk */}
          <mesh
            position={[tree.position.x, tree.position.y, tree.position.z]}
            scale={[tree.width * 0.15, tree.height * 0.4, tree.width * 0.15]}
          >
            <cylinderGeometry args={[0.2, 0.3, 1, 4]} />
            <shaderMaterial
              vertexShader={distantObjectVertexShader}
              fragmentShader={distantObjectFragmentShader}
              uniforms={makeObjUniforms(new THREE.Color(0.22, 0.14, 0.06))}
              fog={false}
            />
          </mesh>
          {/* Canopy */}
          <mesh
            geometry={getTreeGeometry(tree.shape)}
            position={tree.position}
            scale={[tree.width, tree.height, tree.width]}
            rotation={[0, Math.atan2(tree.position.x, tree.position.z) + Math.PI, 0]}
          >
            <shaderMaterial
              vertexShader={distantObjectVertexShader}
              fragmentShader={distantObjectFragmentShader}
              uniforms={makeObjUniforms(tree.baseColor)}
              fog={false}
            />
          </mesh>
        </group>
      ))}

      {/* Mid-distance trees — slightly hazier */}
      {midTrees.map((tree, i) => (
        <mesh
          key={`mtree-${i}`}
          geometry={getTreeGeometry(tree.shape)}
          position={tree.position}
          scale={[tree.width, tree.height, tree.width]}
          rotation={[0, Math.atan2(tree.position.x, tree.position.z) + Math.PI, 0]}
        >
          <shaderMaterial
            vertexShader={distantObjectVertexShader}
            fragmentShader={distantObjectFragmentShader}
            uniforms={makeObjUniforms(tree.baseColor)}
            fog={false}
          />
        </mesh>
      ))}

      {/* Village buildings — properly colored */}
      {village.map((building, i) => (
        <mesh
          key={`bld-${i}`}
          geometry={building.geometry}
          position={building.position}
          scale={building.scaleVec}
          rotation={[0, Math.atan2(building.position.x, building.position.z) + Math.PI, 0]}
        >
          <shaderMaterial
            vertexShader={distantObjectVertexShader}
            fragmentShader={distantObjectFragmentShader}
            uniforms={makeObjUniforms(building.baseColor)}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}
