import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from '../engine/types.ts'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants.ts'
import { getTimePalette } from '../engine/palette.ts'

export interface SkySceneProps {
  sunPosition: Vec3
  timeOfDay: number
  visible: boolean
}

// ── Sky dome shaders ─────────────────────────────────────

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vViewDir = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uHazeStrength;
  uniform vec3 uWarmBandColor;

  varying vec3 vWorldPosition;
  varying vec3 vViewDir;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = dir.y;

    // Below horizon — ground fog color
    if (h < 0.0) {
      gl_FragColor = vec4(uHorizonColor, 1.0);
      return;
    }

    // ── Base sky gradient with pow curves for atmospheric falloff ──
    // Use a smooth power curve for the entire range instead of hard boundary
    float t = pow(h, 0.55); // atmospheric density falloff — more color near horizon
    vec3 color = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.35, t));
    color = mix(color, uTopColor, smoothstep(0.15, 0.85, t));

    // ── Subtle warm band just above the horizon ─────────────
    // A thin warm-colored band for color depth
    float warmBand = exp(-pow((h - 0.06) * 18.0, 2.0)); // gaussian centered at h=0.06
    color = mix(color, uWarmBandColor, warmBand * 0.25 * uHazeStrength);

    // ── Horizon haze band ─────────────────
    // Warm atmospheric scattering near horizon, stronger at dawn/dusk
    float hazeFalloff = exp(-h * 10.0);
    vec3 hazeColor = mix(uHorizonColor, uSunColor, 0.35);
    color = mix(color, hazeColor, hazeFalloff * uHazeStrength * 0.55);

    // ── Sun glow in sky ───────────────────
    // Soft atmospheric glow around the sun direction (no disc — SunSprite handles it)
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);

    // Wide atmospheric scatter (Mie-like)
    float scatter = pow(sunDot, 4.0) * 0.15;
    color += uSunColor * scatter;

    // Tighter glow ring
    float glow = pow(sunDot, 16.0) * 0.2;
    color += uSunColor * glow;

    gl_FragColor = vec4(color, 1.0);
  }
`

// ── Star field with twinkling, color variation, bright stars, Milky Way ──

const starVertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aBrightness;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uOpacity;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec3 dir = normalize(position);
    float elevation = dir.y;

    // Stars near horizon are dimmer
    float horizonDim = smoothstep(0.0, 0.25, elevation);

    // Twinkling: each star has its own frequency and phase
    float twinkle = sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 43.0) * 0.3 + 0.7;
    twinkle *= sin(uTime * (0.7 + aSeed * 1.3) + aSeed * 17.0) * 0.2 + 0.8;

    vAlpha = aBrightness * horizonDim * twinkle * uOpacity;
    vColor = aColor;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    // Bright stars get bigger point size
    gl_PointSize = (1.0 + aBrightness * 2.5) * (0.7 + twinkle * 0.3);
  }
`

const starFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Soft circular point
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`

function Stars({ opacity }: { opacity: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { positions, seeds, brightnesses, colors } = useMemo(() => {
    const count = 700
    const pos = new Float32Array(count * 3)
    const sd = new Float32Array(count)
    const br = new Float32Array(count)
    const col = new Float32Array(count * 3)

    // Define a Milky Way band direction (a stripe across the sky)
    const milkyWayAxis = new THREE.Vector3(0.6, 0.3, 0.8).normalize()

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.48 // upper hemisphere
      const r = 150
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi) + 5
      const z = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      sd[i] = Math.random()

      // Check proximity to Milky Way band for brightness boost
      const starDir = new THREE.Vector3(x, y, z).normalize()
      const milkyDist = Math.abs(starDir.dot(milkyWayAxis))
      const inMilkyWay = milkyDist < 0.15 // close to the band
      const milkyBoost = inMilkyWay ? 0.3 + Math.random() * 0.2 : 0

      // First 10 stars are designated "bright" stars
      if (i < 10) {
        br[i] = 0.85 + Math.random() * 0.15
      } else if (Math.random() < 0.15) {
        // Some regular bright stars
        br[i] = 0.6 + Math.random() * 0.3 + milkyBoost
      } else {
        br[i] = 0.15 + Math.random() * 0.35 + milkyBoost
      }

      // Star color variation — most white, some warm, some blue
      if (i < 4) {
        // Warm tinted stars (amber/orange)
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.85 + Math.random() * 0.1
        col[i * 3 + 2] = 0.7 + Math.random() * 0.1
      } else if (i < 8) {
        // Blue tinted stars
        col[i * 3] = 0.8 + Math.random() * 0.1
        col[i * 3 + 1] = 0.85 + Math.random() * 0.1
        col[i * 3 + 2] = 1.0
      } else {
        // White/near-white (slight random variation)
        const warmth = (Math.random() - 0.5) * 0.08
        col[i * 3] = 1.0 + warmth
        col[i * 3 + 1] = 1.0
        col[i * 3 + 2] = 0.98 - warmth
      }
    }
    return { positions: pos, seeds: sd, brightnesses: br, colors: col }
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  )

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uOpacity.value = opacity
  })

  const count = 700

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[seeds, 1]}
          count={count}
        />
        <bufferAttribute
          attach="attributes-aBrightness"
          args={[brightnesses, 1]}
          count={count}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[colors, 3]}
          count={count}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  )
}

// Milky Way visual handled by star density clustering (no plane needed)

// ── Moon position (arcs across the night sky) ────────────

function getMoonPosition(timeOfDay: number): Vec3 {
  const nightLength = 24 - (SUNSET_HOUR - SUNRISE_HOUR)
  let nightProgress: number

  if (timeOfDay >= SUNSET_HOUR) {
    nightProgress = (timeOfDay - SUNSET_HOUR) / nightLength
  } else {
    nightProgress = (timeOfDay + 24 - SUNSET_HOUR) / nightLength
  }

  const angle = nightProgress * Math.PI
  const dist = 120
  return [
    Math.cos(angle) * dist,
    Math.sin(angle) * dist * 0.8 + 10,
    -40,
  ]
}

// ── Sun billboard sprite with god-rays ───────────────────

function SunSprite({
  position,
  palette,
  timeOfDay,
}: {
  position: Vec3
  palette: { sunColor: [number, number, number]; hazeStrength: number }
  timeOfDay: number
}) {
  const groupRef = useRef<THREE.Group>(null!)

  // Billboard — always face the camera
  useFrame(({ camera }) => {
    if (!groupRef.current) return
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  // Golden hour detection — god rays are visible near sunrise/sunset
  const isGoldenHour =
    (timeOfDay > SUNRISE_HOUR - 0.5 && timeOfDay < SUNRISE_HOUR + 1.5) ||
    (timeOfDay > SUNSET_HOUR - 1.5 && timeOfDay < SUNSET_HOUR + 0.5)

  // Halo warmth: warmer at dawn/dusk, whiter at noon
  const warmFactor = palette.hazeStrength // higher at dawn/dusk
  const haloColor = new THREE.Color(
    1.0,
    0.95 - warmFactor * 0.2,
    0.85 - warmFactor * 0.35,
  )

  const sunCol = new THREE.Color(...palette.sunColor)

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Wide soft outer halo — warmer at dawn/dusk */}
        <mesh>
          <planeGeometry args={[50, 50]} />
          <meshBasicMaterial
            color={haloColor}
            transparent
            opacity={0.04}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Medium glow */}
        <mesh>
          <planeGeometry args={[32, 32]} />
          <meshBasicMaterial
            color={sunCol}
            transparent
            opacity={0.08}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner glow */}
        <mesh>
          <planeGeometry args={[18, 18]} />
          <meshBasicMaterial
            color="#fff8e0"
            transparent
            opacity={0.18}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Sun core */}
        <mesh>
          <circleGeometry args={[1.5, 24]} />
          <meshBasicMaterial
            color="#ffffee"
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* God-ray streaks during golden hour */}
        {isGoldenHour && (
          <>
            {/* Ray 1 — angled up-right */}
            <mesh rotation={[0, 0, 0.4]} position={[0, 0, -0.1]}>
              <planeGeometry args={[1.2, 18]} />
              <meshBasicMaterial
                color={sunCol}
                transparent
                opacity={0.03}
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Ray 2 — angled opposite */}
            <mesh rotation={[0, 0, -0.5]} position={[0, 0, -0.1]}>
              <planeGeometry args={[1.0, 16]} />
              <meshBasicMaterial
                color={sunCol}
                transparent
                opacity={0.025}
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Ray 3 — near-vertical */}
            <mesh rotation={[0, 0, 0.1]} position={[0, 0, -0.1]}>
              <planeGeometry args={[0.8, 20]} />
              <meshBasicMaterial
                color={sunCol}
                transparent
                opacity={0.02}
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

// ── Moon with crescent shadow and moonlight ──────────────

function MoonWithPhase({
  position,
  timeOfDay,
}: {
  position: Vec3
  timeOfDay: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const moonLightRef = useRef<THREE.DirectionalLight>(null!)

  // Billboard — face the camera
  useFrame(({ camera }) => {
    if (!groupRef.current) return
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  // Simple phase: offset a dark sphere to create crescent
  // Phase cycles over the month, here we use a simple time-based approximation
  const phase = ((timeOfDay / 24) * 0.3 + 0.3) // just gives a nice crescent offset
  const shadowOffsetX = 0.6 * Math.cos(phase * Math.PI * 2)
  const shadowOffsetY = 0.2 * Math.sin(phase * Math.PI * 2)

  return (
    <group position={position}>
      {/* Pale blue moonlight */}
      <directionalLight
        ref={moonLightRef}
        color="#8899cc"
        intensity={0.08}
        position={[0, 0, 0]}
      />

      <group ref={groupRef}>
        {/* Outer glow halo */}
        <mesh>
          <planeGeometry args={[30, 30]} />
          <meshBasicMaterial
            color="#8899bb"
            transparent
            opacity={0.03}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner glow */}
        <mesh>
          <planeGeometry args={[18, 18]} />
          <meshBasicMaterial
            color="#aabbdd"
            transparent
            opacity={0.05}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Moon disc */}
        <mesh>
          <circleGeometry args={[5, 24]} />
          <meshBasicMaterial
            color="#dde4f0"
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Crescent shadow — dark circle offset to create phase shape */}
        <mesh position={[shadowOffsetX * 3, shadowOffsetY * 3, 0.1]}>
          <circleGeometry args={[4.5, 24]} />
          <meshBasicMaterial
            color="#111122"
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  )
}

// ── Main sky component ───────────────────────────────────

export default function SkyScene({ sunPosition, timeOfDay, visible }: SkySceneProps) {
  if (!visible) return null

  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const dirLightRef = useRef<THREE.DirectionalLight>(null!)
  const ambientRef = useRef<THREE.AmbientLight>(null!)
  const hemiRef = useRef<THREE.HemisphereLight>(null!)

  const [sx, sy, sz] = sunPosition
  const isDay = sy > 0

  const uniforms = useMemo(
    () => ({
      uTopColor: { value: new THREE.Color(0x2266bb) },
      uMidColor: { value: new THREE.Color(0x88ccee) },
      uHorizonColor: { value: new THREE.Color(0xbbddee) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 0.95) },
      uHazeStrength: { value: 0.1 },
      uWarmBandColor: { value: new THREE.Color(1.0, 0.7, 0.4) },
    }),
    [],
  )

  // Palette-driven color/light each frame
  const paletteRef = useRef(getTimePalette(timeOfDay))

  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    paletteRef.current = palette

    // Update sky dome
    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTopColor.value.setRGB(...palette.zenithColor)
      u.uMidColor.value.setRGB(
        (palette.zenithColor[0] + palette.horizonColor[0]) * 0.5,
        (palette.zenithColor[1] + palette.horizonColor[1]) * 0.5,
        (palette.zenithColor[2] + palette.horizonColor[2]) * 0.5,
      )
      u.uHorizonColor.value.setRGB(...palette.horizonColor)
      u.uSunDir.value.set(sx, sy, sz).normalize()
      u.uSunColor.value.setRGB(...palette.sunColor)
      u.uHazeStrength.value = palette.hazeStrength

      // Warm band color: blend between sun and horizon color
      const [sr, sg, sb] = palette.sunColor
      const [hr, hg, hb] = palette.horizonColor
      u.uWarmBandColor.value.setRGB(
        sr * 0.6 + hr * 0.4,
        sg * 0.5 + hg * 0.3,
        sb * 0.3 + hb * 0.2,
      )
    }

    // Update directional light
    if (dirLightRef.current) {
      dirLightRef.current.color.setRGB(...palette.sunColor)
      dirLightRef.current.intensity = palette.sunIntensity
    }

    // Update ambient light
    if (ambientRef.current) {
      ambientRef.current.color.setRGB(...palette.ambientColor)
      ambientRef.current.intensity = palette.ambientIntensity
    }

    // Update hemisphere light
    if (hemiRef.current) {
      hemiRef.current.color.setRGB(...palette.zenithColor)
      hemiRef.current.groundColor.setRGB(...palette.groundBounce)
      hemiRef.current.intensity = palette.hemiIntensity
    }
  })

  const palette = paletteRef.current

  // Visual sun/moon at a distance the camera can actually see
  const sunDir = new THREE.Vector3(sx, sy, sz).normalize()
  const visualDist = 120
  const visualSunPos: Vec3 = [
    sunDir.x * visualDist,
    sunDir.y * visualDist,
    sunDir.z * visualDist,
  ]

  const moonPos = getMoonPosition(timeOfDay)

  return (
    <>
      {/* Sky dome — large inverted sphere */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[200, 32, 32]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sun billboard sprite with god-rays (visible during day) */}
      {isDay && (
        <SunSprite
          position={visualSunPos}
          palette={palette}
          timeOfDay={timeOfDay}
        />
      )}

      {/* Moon with crescent phase shadow (visible at night) */}
      {!isDay && (
        <MoonWithPhase
          position={moonPos}
          timeOfDay={timeOfDay}
        />
      )}

      {/* Stars — always rendered, opacity controlled by palette */}
      <Stars opacity={palette.starOpacity} />

      {/* Milky Way band — faint stripe across the night sky */}
      {/* Milky Way effect handled by star density clustering */}

      {/* Directional light from sun direction */}
      <directionalLight
        ref={dirLightRef}
        position={[sx, Math.max(sy, 2), sz]}
        intensity={palette.sunIntensity}
        color={new THREE.Color(...palette.sunColor)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Ambient fill */}
      <ambientLight
        ref={ambientRef}
        intensity={palette.ambientIntensity}
        color={new THREE.Color(...palette.ambientColor)}
      />

      {/* Hemisphere light: sky vs ground */}
      <hemisphereLight
        ref={hemiRef}
        args={[
          new THREE.Color(...palette.zenithColor),
          new THREE.Color(...palette.groundBounce),
          palette.hemiIntensity,
        ]}
      />
    </>
  )
}
