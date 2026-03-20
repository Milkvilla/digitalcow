import { useMemo } from 'react'
import * as THREE from 'three'

// ── Seeded PRNG for deterministic terrain ─────────────────
function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Simplex-like noise (value noise with smooth interpolation) ──
function makeNoise(seed: number) {
  const rng = seededRng(seed)
  const grid = 64
  const table = new Float32Array(grid * grid)
  for (let i = 0; i < grid * grid; i++) table[i] = rng()

  return (x: number, y: number) => {
    const fx = ((x % grid) + grid) % grid
    const fy = ((y % grid) + grid) % grid
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const tx = fx - ix
    const ty = fy - iy
    const sx = tx * tx * (3 - 2 * tx) // smoothstep
    const sy = ty * ty * (3 - 2 * ty)
    const i00 = table[(iy % grid) * grid + (ix % grid)]
    const i10 = table[(iy % grid) * grid + ((ix + 1) % grid)]
    const i01 = table[((iy + 1) % grid) * grid + (ix % grid)]
    const i11 = table[((iy + 1) % grid) * grid + ((ix + 1) % grid)]
    return i00 * (1 - sx) * (1 - sy) + i10 * sx * (1 - sy) + i01 * (1 - sx) * sy + i11 * sx * sy
  }
}

function createGroundTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const noise1 = makeNoise(42)
  const noise2 = makeNoise(137)
  const noise3 = makeNoise(271)

  // Paint pixel by pixel for rich organic detail
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size

      // Multi-octave noise for base color
      const n1 = noise1(u * 12, v * 12)         // large patches
      const n2 = noise2(u * 28, v * 28)         // medium detail
      const n3 = noise3(u * 60, v * 60)         // fine grain

      const combined = n1 * 0.5 + n2 * 0.3 + n3 * 0.2

      // Base green with rich variation
      let r = 45 + combined * 50
      let g = 100 + combined * 80
      let b = 28 + combined * 30

      // Warm dry patches (yellowish-brown)
      const dryNoise = noise2(u * 8 + 5, v * 8 + 5)
      if (dryNoise > 0.65) {
        const dryAmount = (dryNoise - 0.65) / 0.35
        r += dryAmount * 40
        g += dryAmount * 15
        b -= dryAmount * 10
      }

      // Dark earth spots
      const earthNoise = noise3(u * 15 + 10, v * 15 + 10)
      if (earthNoise > 0.75) {
        const earthAmount = (earthNoise - 0.75) / 0.25
        r = r * (1 - earthAmount * 0.4) + 70 * earthAmount * 0.4
        g = g * (1 - earthAmount * 0.5) + 55 * earthAmount * 0.5
        b = b * (1 - earthAmount * 0.3) + 30 * earthAmount * 0.3
      }

      // Clover patches (darker green, slightly bluish)
      const cloverNoise = noise1(u * 20 + 3, v * 20 + 7)
      if (cloverNoise > 0.6) {
        const cloverAmount = (cloverNoise - 0.6) / 0.4
        r -= cloverAmount * 15
        g += cloverAmount * 20
        b += cloverAmount * 8
      }

      // Tiny wildflower dots
      const flowerNoise = noise3(u * 80, v * 80)
      if (flowerNoise > 0.92) {
        const rng = seededRng(Math.floor(u * 200) * 1000 + Math.floor(v * 200))
        const roll = rng()
        if (roll < 0.3) { r = 220; g = 200; b = 100 }       // yellow
        else if (roll < 0.55) { r = 230; g = 230; b = 220 }  // white
        else if (roll < 0.7) { r = 180; g = 100; b = 180 }   // purple
        else { r += 10; g += 15; b += 5 }                    // just brighter
      }

      // Radial darkening at edges
      const dx = u - 0.5
      const dy = v - 0.5
      const distFromCenter = Math.sqrt(dx * dx + dy * dy) * 2
      const edgeDarken = Math.max(0, 1 - distFromCenter * 0.4)
      r *= 0.7 + edgeDarken * 0.3
      g *= 0.7 + edgeDarken * 0.3
      b *= 0.7 + edgeDarken * 0.3

      const idx = (y * size + x) * 4
      data[idx] = Math.max(0, Math.min(255, r))
      data[idx + 1] = Math.max(0, Math.min(255, g))
      data[idx + 2] = Math.max(0, Math.min(255, b))
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // Dirt paths (painted over the noise)
  ctx.strokeStyle = 'rgba(95, 75, 45, 0.35)'
  ctx.lineWidth = 16
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Main path: barn area to center
  ctx.beginPath()
  ctx.moveTo(size * 0.28, size * 0.72)
  ctx.quadraticCurveTo(size * 0.38, size * 0.58, size * 0.48, size * 0.50)
  ctx.quadraticCurveTo(size * 0.58, size * 0.44, size * 0.65, size * 0.38)
  ctx.stroke()

  // Secondary path: toward pond
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.25)'
  ctx.beginPath()
  ctx.moveTo(size * 0.48, size * 0.50)
  ctx.quadraticCurveTo(size * 0.40, size * 0.58, size * 0.35, size * 0.68)
  ctx.stroke()

  // Worn area around trough
  ctx.fillStyle = 'rgba(85, 70, 40, 0.18)'
  ctx.beginPath()
  ctx.ellipse(size * 0.38, size * 0.58, 30, 25, 0.2, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// ── Subtle terrain bump map ───────────────────────────────
function createBumpTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const noise = makeNoise(999)
  const noise2 = makeNoise(888)
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const n = noise(u * 20, v * 20) * 0.5 + noise2(u * 50, v * 50) * 0.3 + noise(u * 100, v * 100) * 0.2
      const val = Math.floor(n * 255)
      const idx = (y * size + x) * 4
      data[idx] = val
      data[idx + 1] = val
      data[idx + 2] = val
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// ── Undulating ground geometry ────────────────────────────
function createUndulatingPlane(width: number, depth: number, segX: number, segZ: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ)
  const pos = geo.attributes.position
  const noise = makeNoise(77)
  const noise2 = makeNoise(333)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i) // in plane space, this is the "depth" direction
    // Map to 0..1 space
    const u = (x / width + 0.5)
    const v = (y / depth + 0.5)
    // Gentle rolling hills
    const hill = noise(u * 6, v * 6) * 0.18 + noise2(u * 14, v * 14) * 0.06
    // Flatten center more (where cow walks)
    const distFromCenter = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2
    const flattenFactor = Math.max(0, 1 - (1 - distFromCenter) * 0.6)
    pos.setZ(i, hill * flattenFactor)
  }

  geo.computeVertexNormals()
  return geo
}

export default function Ground() {
  const texture = useMemo(() => createGroundTexture(), [])
  const bumpMap = useMemo(() => createBumpTexture(), [])
  const mainGeo = useMemo(() => createUndulatingPlane(50, 50, 64, 64), [])

  return (
    <>
      {/* Main textured ground with gentle undulation */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        geometry={mainGeo}
        receiveShadow
      >
        <meshStandardMaterial
          map={texture}
          bumpMap={bumpMap}
          bumpScale={0.08}
          roughness={0.92}
          metalness={0}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* Outer ground ring — extends to fog distance */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
      >
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial
          color="#2a5a1a"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}
