import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTimePalette } from '../engine/palette.ts'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants.ts'

// ── Seeded pseudo-random for deterministic generation ────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Fractal noise height for natural hill profiles ──────

function fractalHillHeight(t: number, seed: number): number {
  // Multiple octaves of sine with different frequencies/amplitudes
  let h = 0
  h += Math.sin(t * Math.PI + seed) * 1.0                        // base bump
  h += Math.sin(t * Math.PI * 2.3 + seed * 1.7) * 0.45          // secondary
  h += Math.sin(t * Math.PI * 4.7 + seed * 3.1) * 0.2           // detail
  h += Math.sin(t * Math.PI * 0.5 + seed * 0.3) * 0.6           // broad variation
  h += Math.sin(t * Math.PI * 7.1 + seed * 5.9) * 0.08          // fine detail
  return Math.max(h, 0) // clamp to non-negative
}

// ── Hill silhouette ring ─────────────────────────────────

interface HillSegment {
  geometry: THREE.BufferGeometry
}

function generateHillRing(
  radius: number,
  segments: number,
  baseY: number,
  heightScale: number,
  subDivisions: number,
): HillSegment[] {
  const hills: HillSegment[] = []
  const angleStep = (Math.PI * 2) / segments

  for (let i = 0; i < segments; i++) {
    const angle0 = i * angleStep
    const angle1 = (i + 1) * angleStep

    // Vary hill height dramatically — some tall ridges, gentle rolls, flat stretches
    const seed = i * 37.13 + radius * 7.3
    const peakMultiplier = 0.4 + seededRandom(seed * 2.71) * 1.8 // 0.4 to 2.2

    // Occasional tall peaks
    const isTallPeak = seededRandom(seed * 4.13) > 0.82
    const peakBoost = isTallPeak ? 1.8 : 1.0

    // Occasional flat stretches
    const isFlat = seededRandom(seed * 6.17) > 0.88
    const flatFactor = isFlat ? 0.2 : 1.0

    const effectiveHeight = heightScale * peakMultiplier * peakBoost * flatFactor

    const vertices: number[] = []
    const indices: number[] = []

    for (let s = 0; s <= subDivisions; s++) {
      const t = s / subDivisions
      const angle = angle0 + (angle1 - angle0) * t

      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      // Fractal noise height profile
      const h = baseY + effectiveHeight * fractalHillHeight(t, seed)

      // Bottom vertex
      vertices.push(x, baseY - 0.5, z)
      // Top vertex
      vertices.push(x, h, z)
    }

    // Build triangle strip
    for (let s = 0; s < subDivisions; s++) {
      const bl = s * 2
      const br = (s + 1) * 2
      const tl = s * 2 + 1
      const tr = (s + 1) * 2 + 1

      indices.push(bl, br, tl)
      indices.push(br, tr, tl)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    )
    geo.setIndex(indices)
    geo.computeVertexNormals()

    hills.push({ geometry: geo })
  }

  return hills
}

// ── Tree silhouette shapes ──────────────────────────────

type TreeShape = 'pine' | 'deciduous' | 'tall'

interface TreeSilhouette {
  position: THREE.Vector3
  height: number
  width: number
  shape: TreeShape
}

// Pine tree — triangular (cone)
const pineGeo = (() => {
  const geo = new THREE.ConeGeometry(0.35, 1.0, 4)
  geo.translate(0, 0.5, 0) // base at origin
  return geo
})()

// Deciduous tree — round (sphere on stick)
const deciduousGeo = (() => {
  const geo = new THREE.SphereGeometry(0.45, 6, 4)
  geo.translate(0, 0.7, 0)
  return geo
})()

// Tall thin tree — narrow cylinder topped with small sphere
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

// ── Generate clustered trees with varied shapes ─────────

function generateTreeSilhouettes(
  radius: number,
  clusterCount: number,
  baseY: number,
): TreeSilhouette[] {
  const trees: TreeSilhouette[] = []
  const totalAngle = Math.PI * 2

  // Create clusters with gaps
  for (let c = 0; c < clusterCount; c++) {
    const clusterSeed = c * 51.7
    // Skip some positions to create gaps
    if (seededRandom(clusterSeed * 3.3) > 0.75) continue

    const clusterAngle = (c / clusterCount) * totalAngle + seededRandom(clusterSeed) * 0.3
    const treesInCluster = 2 + Math.floor(seededRandom(clusterSeed * 1.7) * 4) // 2-5 trees

    // Pick a shape tendency for the cluster
    const shapeRoll = seededRandom(clusterSeed * 2.1)
    const clusterShape: TreeShape = shapeRoll < 0.4 ? 'pine' : shapeRoll < 0.75 ? 'deciduous' : 'tall'

    for (let t = 0; t < treesInCluster; t++) {
      const treeSeed = clusterSeed + t * 13.7
      const angleOffset = (seededRandom(treeSeed) - 0.5) * 0.08
      const angle = clusterAngle + angleOffset
      const r = radius + (seededRandom(treeSeed * 2.3) - 0.5) * 4

      // Approximate hill height at this position
      const segmentIndex = Math.floor((angle / totalAngle) * 40) % 40
      const seed = segmentIndex * 37.13 + radius * 7.3
      const localT = (angle % (totalAngle / 40)) / (totalAngle / 40)
      const hillH = fractalHillHeight(localT, seed)
      const y = baseY + hillH * 0.5

      // Vary shape within cluster (mostly cluster shape, some variation)
      let shape = clusterShape
      if (seededRandom(treeSeed * 4.1) > 0.7) {
        const shapes: TreeShape[] = ['pine', 'deciduous', 'tall']
        shape = shapes[Math.floor(seededRandom(treeSeed * 5.3) * 3)]
      }

      // Significantly vary height
      const heightBase = shape === 'tall' ? 2.5 : shape === 'pine' ? 1.8 : 1.5
      const heightVar = heightBase + seededRandom(treeSeed * 3.7) * 2.5

      trees.push({
        position: new THREE.Vector3(
          Math.cos(angle) * r,
          y,
          Math.sin(angle) * r,
        ),
        height: heightVar,
        width: 0.4 + seededRandom(treeSeed * 6.1) * 0.8,
        shape,
      })
    }
  }
  return trees
}

// ── Farmstead silhouette (distant farmhouse + silo) ──────

interface FarmBuilding {
  position: THREE.Vector3
  geometry: THREE.BufferGeometry
  scaleVec: [number, number, number]
}

function generateFarmstead(radius: number, baseY: number): FarmBuilding[] {
  const buildings: FarmBuilding[] = []
  const farmAngle = Math.PI * 0.35 // place farmstead on one side

  const farmX = Math.cos(farmAngle) * radius
  const farmZ = Math.sin(farmAngle) * radius

  // Main farmhouse — rectangular box with triangular roof
  const houseGeo = new THREE.BoxGeometry(1, 1, 1)
  houseGeo.translate(0, 0.5, 0)
  buildings.push({
    position: new THREE.Vector3(farmX, baseY + 0.3, farmZ),
    geometry: houseGeo,
    scaleVec: [2.5, 2.0, 1.8],
  })

  // Roof — triangular prism (cone with 4 sides stretched)
  const roofGeo = new THREE.ConeGeometry(1.0, 0.8, 4)
  roofGeo.rotateY(Math.PI / 4)
  roofGeo.translate(0, 0.4, 0)
  buildings.push({
    position: new THREE.Vector3(farmX, baseY + 2.3, farmZ),
    geometry: roofGeo,
    scaleVec: [1.8, 1.5, 1.3],
  })

  // Small barn/shed next to farmhouse
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

  // Silo — tall cylinder
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

  // Silo cap (dome)
  const siloCapGeo = new THREE.SphereGeometry(0.45, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  siloCapGeo.translate(0, 0, 0)
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

// ── Horizon component ────────────────────────────────────

export default function Horizon({ timeOfDay }: { timeOfDay: number }) {
  const nearMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const farMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const veryFarMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const treeMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const farmMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)

  // Generate hill rings at three distances for depth
  const { nearHills, farHills, veryFarHills, trees, farmstead } = useMemo(() => {
    return {
      nearHills: generateHillRing(48, 40, -0.5, 2.5, 8),
      farHills: generateHillRing(58, 35, -0.3, 3.0, 7),
      veryFarHills: generateHillRing(70, 30, -0.2, 4.5, 6), // 3rd distant ring
      trees: generateTreeSilhouettes(48, 30, -0.5),
      farmstead: generateFarmstead(50, -0.3),
    }
  }, [])

  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    const [hr, hg, hb] = palette.horizonColor

    // Time-of-day coloring: hills closer to sun direction get warmer
    const isDawnOrDusk =
      (timeOfDay > SUNRISE_HOUR - 1 && timeOfDay < SUNRISE_HOUR + 2) ||
      (timeOfDay > SUNSET_HOUR - 2 && timeOfDay < SUNSET_HOUR + 1)
    const warmBoost = isDawnOrDusk ? 0.08 : 0.0

    // Near hills — dark silhouettes with subtle horizon tint
    if (nearMaterialRef.current) {
      nearMaterialRef.current.color.setRGB(
        hr * 0.08 + warmBoost * 0.5,
        hg * 0.08 + warmBoost * 0.25,
        hb * 0.10,
      )
    }

    // Far hills — slightly lighter, more atmospheric
    if (farMaterialRef.current) {
      farMaterialRef.current.color.setRGB(
        hr * 0.12 + warmBoost * 0.3,
        hg * 0.12 + warmBoost * 0.15,
        hb * 0.15,
      )
    }

    // Very far hills — hazier but still dark
    if (veryFarMaterialRef.current) {
      veryFarMaterialRef.current.color.setRGB(
        hr * 0.16 + warmBoost * 0.2,
        hg * 0.16 + warmBoost * 0.1,
        hb * 0.20,
      )
    }

    // Trees slightly darker than near hills
    if (treeMaterialRef.current) {
      treeMaterialRef.current.color.setRGB(
        hr * 0.05,
        hg * 0.05,
        hb * 0.08,
      )
    }

    // Farmstead — same as trees
    if (farmMaterialRef.current) {
      farmMaterialRef.current.color.setRGB(
        hr * 0.06,
        hg * 0.06,
        hb * 0.09,
      )
    }
  })

  return (
    <group>
      {/* Very far hills (deepest backdrop) */}
      {veryFarHills.map((hill, i) => (
        <mesh key={`vfar-${i}`} geometry={hill.geometry} renderOrder={-3}>
          <meshBasicMaterial
            ref={i === 0 ? veryFarMaterialRef : undefined}
            color="#121828"
            fog
          />
        </mesh>
      ))}

      {/* Far hills (mid-depth silhouettes) */}
      {farHills.map((hill, i) => (
        <mesh key={`far-${i}`} geometry={hill.geometry} renderOrder={-2}>
          <meshBasicMaterial
            ref={i === 0 ? farMaterialRef : undefined}
            color="#0e1220"
            fog
          />
        </mesh>
      ))}

      {/* Near hills (sharper silhouettes) */}
      {nearHills.map((hill, i) => (
        <mesh key={`near-${i}`} geometry={hill.geometry}>
          <meshBasicMaterial
            ref={i === 0 ? nearMaterialRef : undefined}
            color="#0a0c12"
            fog
          />
        </mesh>
      ))}

      {/* Tree silhouettes on hilltops — varied shapes */}
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
            fog
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
            fog
          />
        </mesh>
      ))}
    </group>
  )
}
