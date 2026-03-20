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
    float t = pow(h, 0.55);
    vec3 color = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.35, t));
    color = mix(color, uTopColor, smoothstep(0.15, 0.85, t));

    // ── Subtle warm band just above the horizon ─────────────
    float warmBand = exp(-pow((h - 0.06) * 18.0, 2.0));
    color = mix(color, uWarmBandColor, warmBand * 0.25 * uHazeStrength);

    // ── Horizon haze band ─────────────────
    float hazeFalloff = exp(-h * 10.0);
    vec3 hazeColor = mix(uHorizonColor, uSunColor, 0.35);
    color = mix(color, hazeColor, hazeFalloff * uHazeStrength * 0.55);

    // ── Sun glow in sky ───────────────────
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

    // Twinkling
    float twinkle = sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 43.0) * 0.3 + 0.7;
    twinkle *= sin(uTime * (0.7 + aSeed * 1.3) + aSeed * 17.0) * 0.2 + 0.8;

    vAlpha = aBrightness * horizonDim * twinkle * uOpacity;
    vColor = aColor;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    gl_PointSize = (1.0 + aBrightness * 2.5) * (0.7 + twinkle * 0.3);
  }
`

const starFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`

function Stars({ opacity }: { opacity: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { positions, seeds, brightnesses, colors } = useMemo(() => {
    const count = 1200
    const pos = new Float32Array(count * 3)
    const sd = new Float32Array(count)
    const br = new Float32Array(count)
    const col = new Float32Array(count * 3)

    const milkyWayAxis = new THREE.Vector3(0.6, 0.3, 0.8).normalize()

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.48
      const r = 150
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi) + 5
      const z = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      sd[i] = Math.random()

      const starDir = new THREE.Vector3(x, y, z).normalize()
      const milkyDist = Math.abs(starDir.dot(milkyWayAxis))
      const inMilkyWay = milkyDist < 0.15
      const milkyBoost = inMilkyWay ? 0.3 + Math.random() * 0.2 : 0

      if (i < 10) {
        br[i] = 0.85 + Math.random() * 0.15
      } else if (Math.random() < 0.15) {
        br[i] = 0.6 + Math.random() * 0.3 + milkyBoost
      } else {
        br[i] = 0.15 + Math.random() * 0.35 + milkyBoost
      }

      if (i < 4) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.85 + Math.random() * 0.1
        col[i * 3 + 2] = 0.7 + Math.random() * 0.1
      } else if (i < 8) {
        col[i * 3] = 0.8 + Math.random() * 0.1
        col[i * 3 + 1] = 0.85 + Math.random() * 0.1
        col[i * 3 + 2] = 1.0
      } else {
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
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} count={count} />
        <bufferAttribute attach="attributes-aBrightness" args={[brightnesses, 1]} count={count} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} count={count} />
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

// ── Sun shader — radial gradient with corona, limb darkening, rays ──

const sunVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const sunFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunColor;
  uniform float uHaze;

  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;

    // Core disc with limb darkening
    float disc = 1.0 - smoothstep(0.0, 0.32, dist);
    float limbDark = 1.0 - pow(dist / 0.32, 2.0) * 0.3;
    vec3 coreColor = vec3(1.0, 0.98, 0.92) * disc * limbDark;

    // Inner corona — bright warm glow around disc
    float corona1 = exp(-dist * 6.0) * 0.8;

    // Outer soft corona
    float corona2 = exp(-dist * 2.5) * 0.25;

    // Spiky ray pattern (procedural) — 8 major rays + 4 minor
    float angle = atan(center.y, center.x);
    float rays8 = pow(abs(cos(angle * 4.0)), 12.0);
    float rays4 = pow(abs(sin(angle * 2.0 + 0.5)), 16.0);
    float rayMask = (rays8 * 0.6 + rays4 * 0.3) * exp(-dist * 3.0);

    // Animated shimmer on rays
    float shimmer = sin(uTime * 2.0 + angle * 3.0) * 0.1 + 0.9;
    rayMask *= shimmer;

    // Combine
    vec3 warmWhite = vec3(1.0, 0.97, 0.88);
    vec3 warmGold = mix(uSunColor, vec3(1.0, 0.85, 0.5), uHaze * 0.6);

    vec3 color = coreColor * warmWhite;
    color += corona1 * warmGold;
    color += corona2 * mix(warmGold, vec3(1.0, 0.6, 0.3), uHaze);
    color += rayMask * warmGold * 0.5;

    float alpha = disc + corona1 + corona2 * 0.6 + rayMask * 0.3;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`

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
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunColor: { value: new THREE.Color(...palette.sunColor) },
      uHaze: { value: palette.hazeStrength },
    }),
    [],
  )

  useFrame(({ camera, clock }) => {
    if (!groupRef.current) return
    groupRef.current.quaternion.copy(camera.quaternion)

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uSunColor.value.setRGB(...palette.sunColor)
      materialRef.current.uniforms.uHaze.value = palette.hazeStrength
    }
  })

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Sun rendered via shader on a quad */}
        <mesh>
          <planeGeometry args={[40, 40]} />
          <shaderMaterial
            ref={materialRef}
            vertexShader={sunVertexShader}
            fragmentShader={sunFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  )
}

// ── Moon shader — craters, glow, phase shadow ──────────────

const moonVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const moonFragmentShader = /* glsl */ `
  uniform float uPhaseOffset;
  uniform float uTime;

  varying vec2 vUv;

  // Simple hash for crater placement
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;

    // Outer glow
    float outerGlow = exp(-dist * 2.0) * 0.12;
    float midGlow = exp(-dist * 4.0) * 0.15;

    // Moon disc
    float disc = 1.0 - smoothstep(0.28, 0.32, dist);

    // Surface color with subtle variation
    vec2 surfUv = center * 3.5;
    float n1 = hash(floor(surfUv * 4.0));
    float n2 = hash(floor(surfUv * 8.0 + 3.7));
    float surfaceNoise = n1 * 0.12 + n2 * 0.06;

    // Crater dark spots — several fixed craters
    float crater = 0.0;
    // Large mare
    float c1 = smoothstep(0.12, 0.08, length(center - vec2(-0.04, 0.03)));
    float c2 = smoothstep(0.08, 0.05, length(center - vec2(0.06, -0.05)));
    float c3 = smoothstep(0.06, 0.03, length(center - vec2(-0.08, -0.06)));
    float c4 = smoothstep(0.04, 0.02, length(center - vec2(0.02, 0.08)));
    float c5 = smoothstep(0.05, 0.02, length(center - vec2(-0.02, -0.01)));
    crater = max(max(max(c1, c2), max(c3, c4)), c5);

    // Moon base color: silvery white
    vec3 moonColor = vec3(0.88, 0.90, 0.95);
    // Darken craters to grey
    moonColor = mix(moonColor, vec3(0.55, 0.58, 0.62), crater * 0.6);
    // Surface noise variation
    moonColor -= surfaceNoise * 0.3;
    // Limb darkening
    float limbDark = 1.0 - pow(dist / 0.3, 3.0) * 0.2;
    moonColor *= limbDark;

    // Phase shadow — dark circle offset to create crescent
    float shadowDist = length(center - vec2(uPhaseOffset * 0.18, 0.0));
    float shadow = smoothstep(0.26, 0.29, shadowDist);
    moonColor *= shadow;

    // Glow color
    vec3 glowColor = vec3(0.55, 0.60, 0.78);

    vec3 color = moonColor * disc;
    color += glowColor * outerGlow;
    color += glowColor * midGlow;

    float alpha = disc + outerGlow + midGlow * 0.5;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`

function MoonWithPhase({
  position,
  timeOfDay,
}: {
  position: Vec3
  timeOfDay: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const moonLightRef = useRef<THREE.DirectionalLight>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  // Phase: slow cycle based on day count approximation
  const phase = ((timeOfDay / 24) * 0.3 + 0.3)
  const phaseOffset = Math.cos(phase * Math.PI * 2)

  const uniforms = useMemo(
    () => ({
      uPhaseOffset: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame(({ camera, clock }) => {
    if (!groupRef.current) return
    groupRef.current.quaternion.copy(camera.quaternion)

    if (materialRef.current) {
      materialRef.current.uniforms.uPhaseOffset.value = phaseOffset
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

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
        {/* Moon rendered via shader on a quad */}
        <mesh>
          <planeGeometry args={[36, 36]} />
          <shaderMaterial
            ref={materialRef}
            vertexShader={moonVertexShader}
            fragmentShader={moonFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
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

  const paletteRef = useRef(getTimePalette(timeOfDay))

  useFrame(() => {
    const palette = getTimePalette(timeOfDay)
    paletteRef.current = palette

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

      const [sr, sg, sb] = palette.sunColor
      const [hr, hg, hb] = palette.horizonColor
      u.uWarmBandColor.value.setRGB(
        sr * 0.6 + hr * 0.4,
        sg * 0.5 + hg * 0.3,
        sb * 0.3 + hb * 0.2,
      )
    }

    if (dirLightRef.current) {
      dirLightRef.current.color.setRGB(...palette.sunColor)
      dirLightRef.current.intensity = palette.sunIntensity
    }

    if (ambientRef.current) {
      ambientRef.current.color.setRGB(...palette.ambientColor)
      ambientRef.current.intensity = palette.ambientIntensity
    }

    if (hemiRef.current) {
      hemiRef.current.color.setRGB(...palette.zenithColor)
      hemiRef.current.groundColor.setRGB(...palette.groundBounce)
      hemiRef.current.intensity = palette.hemiIntensity
    }
  })

  const palette = paletteRef.current

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
      {/* Sky dome */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[200, 48, 48]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sun with shader-based corona, limb darkening, rays */}
      {isDay && (
        <SunSprite
          position={visualSunPos}
          palette={palette}
          timeOfDay={timeOfDay}
        />
      )}

      {/* Moon with shader-based craters, glow, phase shadow */}
      {!isDay && (
        <MoonWithPhase
          position={moonPos}
          timeOfDay={timeOfDay}
        />
      )}

      {/* Stars */}
      <Stars opacity={palette.starOpacity} />

      {/* Directional light from sun */}
      <directionalLight
        ref={dirLightRef}
        position={[sx, Math.max(sy, 2), sz]}
        intensity={palette.sunIntensity}
        color={new THREE.Color(...palette.sunColor)}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      {/* Ambient fill */}
      <ambientLight
        ref={ambientRef}
        intensity={palette.ambientIntensity}
        color={new THREE.Color(...palette.ambientColor)}
      />

      {/* Hemisphere light */}
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
