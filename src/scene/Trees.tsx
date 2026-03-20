import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Vec3 } from '../engine/types.ts'
import { SCENE_LAYOUT } from '../engine/constants.ts'

// ── Shared merged material (one per tree, uses vertex colors) ──

const mergedMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.82,
  metalness: 0,
  envMapIntensity: 0.4,
})

// ── Color constants ──

const TRUNK_COLOR = new THREE.Color('#5c3a1e')
const TRUNK_DARK_COLOR = new THREE.Color('#4a2e15')
const ROOT_COLOR = new THREE.Color('#3d2510')
const STEM_COLOR = new THREE.Color('#4a3018')

const DECIDUOUS_LEAF_COLORS = [
  '#2d7a1e', '#3a8f28', '#4a9e35', '#55a840', '#66b34a',
  '#3d9430', '#7aad3a', '#8fb83e', '#a5b840',
].map((c) => new THREE.Color(c))

const PINE_LEAF_COLORS = [
  '#1a4f14', '#205a1a', '#276520', '#2e7028', '#1a5530', '#244a2e',
].map((c) => new THREE.Color(c))

const MANGO_CANOPY_COLORS = [
  '#1a5c14', '#226818', '#1e6016', '#2a7820', '#1d5812',
].map((c) => new THREE.Color(c))

const MANGO_FRUIT_COLORS = [
  '#e8a820', '#e09018', '#d87810', '#f0b830', '#cc6c08',
].map((c) => new THREE.Color(c))

// ── Seeded random for deterministic per-tree variation ───────

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Helper: assign vertex colors to a geometry ──

function prepareGeo(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  // Convert to non-indexed + strip UV so ALL geometries have identical attribute layout
  // (CylinderGeometry has uv, DodecahedronGeometry does not — mismatch causes mergeGeometries to return null)
  let g = geo.index ? geo.toNonIndexed() : geo
  g.deleteAttribute('uv')
  // Ensure only position, normal, color remain
  const attrNames = Object.keys(g.attributes)
  for (const name of attrNames) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  }
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return g
}

// ── Single low-poly tree (merged geometry) ───────────────────

interface TreeProps {
  position: Vec3
  phaseOffset: number
  seed: number
}

function Tree({ position, phaseOffset, seed }: TreeProps) {
  const groupRef = useRef<THREE.Group>(null!)

  const { mergedGeo, windSpeed, windAmount, leanX, leanZ, yRotation } =
    useMemo(() => {
      const rng = seededRng(seed)

      const isDeciduous = rng() < 0.5
      const scale = 0.5 + rng() * 0.7
      const trunkH =
        (isDeciduous ? 0.8 + rng() * 0.8 : 1.0 + rng() * 1.0) * scale
      const trunkR =
        (isDeciduous ? 0.08 + rng() * 0.06 : 0.05 + rng() * 0.05) * scale
      const yRot = rng() * Math.PI * 2

      const lnX = (rng() - 0.5) * 0.12
      const lnZ = (rng() - 0.5) * 0.12

      const trunkTaper = 0.5 + rng() * 0.35

      const rootH = 0.15 * scale
      const rootR = trunkR * (1.8 + rng() * 0.8)

      const wSpeed = 0.25 + (1.0 - (scale - 0.4) / 1.2) * 0.35
      const wAmount = 0.008 + (1.0 - (scale - 0.4) / 1.2) * 0.016

      const geos: THREE.BufferGeometry[] = []

      // ── Root flare ──
      const rootGeo = new THREE.CylinderGeometry(trunkR * 1.3, rootR, rootH, 6)
      rootGeo.translate(0, rootH * 0.4, 0)
      geos.push(prepareGeo(rootGeo, ROOT_COLOR))

      // ── Main trunk ──
      const trunkGeo = new THREE.CylinderGeometry(
        trunkR * trunkTaper,
        trunkR,
        trunkH,
        6,
      )
      trunkGeo.translate(0, trunkH / 2 + rootH * 0.5, 0)
      geos.push(prepareGeo(trunkGeo, TRUNK_COLOR))

      if (isDeciduous) {
        // ── Deciduous: trunk splits into 2-5 branches ──
        const branchRoll = rng()
        const branchCount =
          branchRoll < 0.15
            ? 2
            : branchRoll < 0.45
              ? 3
              : branchRoll < 0.75
                ? 4
                : 5

        const dominantLeafIdx = Math.floor(rng() * DECIDUOUS_LEAF_COLORS.length)

        for (let i = 0; i < branchCount; i++) {
          const angle = (i / branchCount) * Math.PI * 2 + rng() * 1.0
          const spread = 0.15 + rng() * 0.8
          const branchLen = (0.4 + rng() * 0.8) * scale
          const tipX = Math.sin(angle) * spread * scale
          const tipZ = Math.cos(angle) * spread * scale
          const tipY =
            trunkH + branchLen * (0.5 + rng() * 0.4) + rng() * 0.4 * scale

          const leafDetail = rng() < 0.3 ? 0 : 1
          const leafMatIndex =
            rng() < 0.55
              ? dominantLeafIdx
              : Math.floor(rng() * DECIDUOUS_LEAF_COLORS.length)

          const baseY = trunkH * (0.5 + rng() * 0.35)
          const thickness = trunkR * (0.35 + rng() * 0.4)
          const leafRadius = (0.3 + rng() * 0.7) * scale

          // Branch cylinder
          const dx = tipX
          const dy = tipY - baseY
          const dz = tipZ
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const midX = tipX * 0.5
          const midY = (baseY + tipY) * 0.5
          const midZ = tipZ * 0.5

          const branchGeo = new THREE.CylinderGeometry(
            thickness * 0.6,
            thickness,
            len,
            5,
          )
          const dir = new THREE.Vector3(dx, dy, dz).normalize()
          const up = new THREE.Vector3(0, 1, 0)
          const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
          const mat4 = new THREE.Matrix4().makeRotationFromQuaternion(quat)
          mat4.setPosition(midX, midY, midZ)
          branchGeo.applyMatrix4(mat4)
          geos.push(prepareGeo(branchGeo, TRUNK_DARK_COLOR))

          // Leaf cluster at branch tip
          const leafGeo = new THREE.DodecahedronGeometry(leafRadius, leafDetail)
          leafGeo.translate(tipX, tipY, tipZ)
          geos.push(prepareGeo(leafGeo, DECIDUOUS_LEAF_COLORS[leafMatIndex]))
        }

        // ── Extra filler leaf clusters ──
        const centerY = trunkH + 0.7 * scale
        const extraCount = Math.floor(rng() * 5)
        for (let i = 0; i < extraCount; i++) {
          const a = rng() * Math.PI * 2
          const dist = 0.1 + rng() * 0.35
          const cx = Math.sin(a) * dist * scale
          const cy = centerY + (rng() - 0.3) * 0.7 * scale
          const cz = Math.cos(a) * dist * scale
          const cr = (0.25 + rng() * 0.55) * scale
          const cMatIdx =
            rng() < 0.55
              ? dominantLeafIdx
              : Math.floor(rng() * DECIDUOUS_LEAF_COLORS.length)
          const cDetail = rng() < 0.3 ? 0 : 1

          const extraGeo = new THREE.DodecahedronGeometry(cr, cDetail)
          extraGeo.translate(cx, cy, cz)
          geos.push(prepareGeo(extraGeo, DECIDUOUS_LEAF_COLORS[cMatIdx]))
        }
      } else {
        // ── Pine / conifer ──
        const coneCount = 3 + Math.floor(rng() * 4)

        const shapeRoll = rng()
        const widthMult = shapeRoll < 0.3 ? 0.65 : shapeRoll < 0.7 ? 1.0 : 1.3
        const heightMult =
          shapeRoll < 0.3 ? 1.3 : shapeRoll < 0.7 ? 1.0 : 0.75

        const totalFoliageH = (1.5 + rng() * 1.5) * scale * heightMult
        const overlapFactor = 0.6 + rng() * 0.5

        const dominantPineIdx = Math.floor(rng() * PINE_LEAF_COLORS.length)

        for (let i = 0; i < coneCount; i++) {
          const t = i / (coneCount - 1)
          const coneRadius =
            (0.9 - t * 0.55) * scale * (0.75 + rng() * 0.5) * widthMult
          const coneHeight =
            (0.8 - t * 0.15) * scale * (0.75 + rng() * 0.5) * heightMult
          const cy = trunkH + t * totalFoliageH * overlapFactor
          const matIdx =
            rng() < 0.5
              ? dominantPineIdx
              : Math.floor(rng() * PINE_LEAF_COLORS.length)
          const segments = 5 + Math.floor(rng() * 3)

          const coneGeo = new THREE.ConeGeometry(
            coneRadius,
            coneHeight,
            segments,
          )
          coneGeo.translate(0, cy + coneHeight * 0.35, 0)
          geos.push(prepareGeo(coneGeo, PINE_LEAF_COLORS[matIdx]))
        }
      }

      const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry()
      // Dispose source geometries
      for (const g of geos) g.dispose()

      return {
        mergedGeo: merged,
        windSpeed: wSpeed,
        windAmount: wAmount,
        leanX: lnX,
        leanZ: lnZ,
        yRotation: yRot,
      }
    }, [seed])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z =
      leanZ + Math.sin(t * windSpeed + phaseOffset) * windAmount
    groupRef.current.rotation.x =
      leanX +
      Math.cos(t * windSpeed * 0.88 + phaseOffset * 1.3) * windAmount * 0.7
  })

  return (
    <group ref={groupRef} position={position} rotation={[0, yRotation, 0]}>
      <mesh geometry={mergedGeo} material={mergedMat} castShadow />
    </group>
  )
}

// ── Mango tree — wide canopy with hanging ripe mangoes (merged) ───

function MangoTree({ position }: { position: Vec3 }) {
  const groupRef = useRef<THREE.Group>(null!)

  const mergedGeo = useMemo(() => {
    const rng = seededRng(42)
    const geos: THREE.BufferGeometry[] = []

    // ── Trunk root flare ──
    const rootGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.25, 6)
    rootGeo.translate(0, 0.12, 0)
    geos.push(prepareGeo(rootGeo, ROOT_COLOR))

    // ── Main trunk ──
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 1.5, 6)
    trunkGeo.translate(0, 0.9, 0)
    geos.push(prepareGeo(trunkGeo, TRUNK_COLOR))

    // ── Branch splits ──
    const branch1 = new THREE.CylinderGeometry(0.04, 0.07, 0.8, 5)
    const b1Mat = new THREE.Matrix4()
    b1Mat.makeRotationFromEuler(new THREE.Euler(0.15, 0, -0.4))
    b1Mat.setPosition(0.15, 1.6, 0.1)
    branch1.applyMatrix4(b1Mat)
    geos.push(prepareGeo(branch1, TRUNK_DARK_COLOR))

    const branch2 = new THREE.CylinderGeometry(0.035, 0.06, 0.7, 5)
    const b2Mat = new THREE.Matrix4()
    b2Mat.makeRotationFromEuler(new THREE.Euler(-0.1, 0, 0.35))
    b2Mat.setPosition(-0.12, 1.5, -0.08)
    branch2.applyMatrix4(b2Mat)
    geos.push(prepareGeo(branch2, TRUNK_DARK_COLOR))

    // ── Dense canopy ──
    const canopyDefs: Array<{
      pos: [number, number, number]
      r: number
      colorIdx: number
    }> = [
      { pos: [0, 2.6, 0], r: 1.4, colorIdx: 0 },
      { pos: [0.5, 2.9, 0.3], r: 1.0, colorIdx: 1 },
      { pos: [-0.4, 2.7, -0.4], r: 0.9, colorIdx: 2 },
      { pos: [0.1, 3.2, 0.2], r: 0.8, colorIdx: 3 },
      { pos: [-0.3, 2.4, 0.5], r: 0.7, colorIdx: 4 },
    ]

    for (const c of canopyDefs) {
      const canopyGeo = new THREE.DodecahedronGeometry(c.r, 1)
      canopyGeo.translate(c.pos[0], c.pos[1], c.pos[2])
      geos.push(prepareGeo(canopyGeo, MANGO_CANOPY_COLORS[c.colorIdx]))
    }

    // ── Mangoes ──
    const fruitColors = ['#e8a820', '#e09018', '#d87810', '#f0b830', '#cc6c08']
    for (let i = 0; i < 18; i++) {
      const angle = rng() * Math.PI * 2
      const r = 0.4 + rng() * 1.2
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const y = 2.2 + rng() * 1.2
      const s = 0.06 + rng() * 0.04
      const colorIdx = Math.floor(rng() * fruitColors.length)

      // Mango fruit — elongated sphere with non-uniform scale
      const fruitGeo = new THREE.SphereGeometry(1, 7, 6)
      fruitGeo.scale(s, s * 1.4, s)
      fruitGeo.translate(x, y, z)
      geos.push(prepareGeo(fruitGeo, MANGO_FRUIT_COLORS[colorIdx]))

      // Tiny stem
      const stemGeo = new THREE.CylinderGeometry(0.004, 0.003, 0.04, 3)
      stemGeo.translate(x, y + s * 1.3, z)
      geos.push(prepareGeo(stemGeo, STEM_COLOR))
    }

    const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry()
    for (const g of geos) g.dispose()
    return merged
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(t * 0.3) * 0.006
    groupRef.current.rotation.x = Math.cos(t * 0.22) * 0.005
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={mergedGeo} material={mergedMat} castShadow />
    </group>
  )
}

// ── Trees collection ────────────────────────────────────

export default function Trees() {
  const treeData = useMemo(
    () =>
      SCENE_LAYOUT.trees.map((t, i) => ({
        position: t.position,
        phaseOffset: i * 2.1 + Math.random() * Math.PI,
        seed: (i + 1) * 7919,
      })),
    [],
  )

  return (
    <>
      {treeData.map((t, i) => (
        <Tree
          key={i}
          position={t.position}
          phaseOffset={t.phaseOffset}
          seed={t.seed}
        />
      ))}
      <MangoTree position={[12, 0, 12]} />
    </>
  )
}
