import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from '../engine/types.ts'
import { SCENE_LAYOUT } from '../engine/constants.ts'
import { getTimePalette } from '../engine/palette.ts'

// ── Rain splash rings on pond surface ────────────────────

function PondSplashes({ radius, intensity }: { radius: number; intensity: number }) {
  const splashCount = Math.floor(8 + intensity * 24)
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const splashes = useRef<Array<{ x: number; z: number; age: number; maxAge: number }>>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_state, delta) => {
    if (!meshRef.current) return

    const arr = splashes.current

    const spawnRate = (4 + intensity * 16) * delta
    const toSpawn = Math.floor(spawnRate) + (Math.random() < (spawnRate % 1) ? 1 : 0)
    for (let s = 0; s < toSpawn; s++) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius * 0.9
      arr.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        age: 0,
        maxAge: 0.3 + Math.random() * 0.3,
      })
    }

    while (arr.length > splashCount) arr.shift()

    for (let i = 0; i < splashCount; i++) {
      if (i < arr.length) {
        const sp = arr[i]
        sp.age += delta
        const progress = Math.min(sp.age / sp.maxAge, 1)
        const ringScale = 0.02 + progress * 0.15
        const opacity = 1 - progress

        dummy.position.set(sp.x, 0.06, sp.z)
        dummy.scale.set(ringScale, 0.005 * opacity, ringScale)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
    }

    splashes.current = arr.filter(sp => sp.age < sp.maxAge)
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, splashCount]}>
      <torusGeometry args={[1, 0.3, 4, 12]} />
      <meshBasicMaterial color="#c8dde8" transparent opacity={0.5} />
    </instancedMesh>
  )
}

// ── Water shaders ───────────────────────────────────────

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;

    vec3 pos = position;
    // Multi-frequency waves for organic feel
    float wave1 = sin(pos.x * 3.0 + uTime * 1.2) * 0.025;
    float wave2 = cos(pos.y * 2.5 + uTime * 0.9) * 0.018;
    float wave3 = sin((pos.x + pos.y) * 4.0 + uTime * 1.5) * 0.012;
    float wave4 = sin(pos.x * 7.0 - uTime * 2.0) * 0.006;
    float wave5 = cos(pos.y * 8.0 + uTime * 1.8) * 0.005;
    pos.z += wave1 + wave2 + wave3 + wave4 + wave5;

    // Perturbed normal for realistic Fresnel
    float dx = cos(pos.x * 3.0 + uTime * 1.2) * 3.0 * 0.025
             + cos((pos.x + pos.y) * 4.0 + uTime * 1.5) * 4.0 * 0.012
             + cos(pos.x * 7.0 - uTime * 2.0) * 7.0 * 0.006;
    float dy = -sin(pos.y * 2.5 + uTime * 0.9) * 2.5 * 0.018
             + cos((pos.x + pos.y) * 4.0 + uTime * 1.5) * 4.0 * 0.012
             - sin(pos.y * 8.0 + uTime * 1.8) * 8.0 * 0.005;
    vec3 perturbedNormal = normalize(vec3(-dx, -dy, 1.0));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize((modelMatrix * vec4(perturbedNormal, 0.0)).xyz);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uWaterReflect;
  uniform float uSunIntensity;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Rich depth-based water colors
    vec3 deepColor = vec3(0.02, 0.12, 0.22);
    vec3 midColor = vec3(0.05, 0.22, 0.32);
    vec3 shallowColor = vec3(0.12, 0.38, 0.48);
    vec3 shoreColor = vec3(0.20, 0.42, 0.38);

    // Distance from center for depth gradient (smooth multi-stop)
    float dist = length(vUv - 0.5) * 2.0;
    float deepToMid = smoothstep(0.0, 0.5, dist);
    float midToShallow = smoothstep(0.5, 0.8, dist);
    float shallowToShore = smoothstep(0.8, 1.0, dist);
    vec3 waterColor = mix(deepColor, midColor, deepToMid);
    waterColor = mix(waterColor, shallowColor, midToShallow);
    waterColor = mix(waterColor, shoreColor, shallowToShore);

    // Time-of-day water tint
    waterColor = mix(waterColor, uWaterReflect, 0.2);

    // Fresnel — more reflective at glancing angles
    float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), 4.0);
    fresnel = clamp(fresnel, 0.04, 0.9);

    // Reflection color (sky + sun tint)
    float brightness = clamp(uSunIntensity, 0.0, 1.5);
    vec3 reflectionColor = uSkyColor * 0.7 + vec3(0.12, 0.18, 0.25) * brightness;

    // Reduce Fresnel at night
    float nightFresnel = fresnel * (0.3 + 0.7 * min(brightness, 1.0));
    vec3 color = mix(waterColor, reflectionColor, nightFresnel);

    // Specular highlight — tighter and brighter
    vec3 halfVec = normalize(vViewDir + uSunDir);
    float specular = pow(max(dot(vNormal, halfVec), 0.0), 96.0);
    color += uSunColor * specular * 0.7 * brightness;

    // Secondary broad specular for soft sheen
    float specBroad = pow(max(dot(vNormal, halfVec), 0.0), 16.0);
    color += uSunColor * specBroad * 0.08 * brightness;

    // Multi-frequency caustic shimmer
    float caustic1 = sin(vWorldPos.x * 8.0 + uTime * 2.0)
                   * cos(vWorldPos.z * 6.0 + uTime * 1.7);
    float caustic2 = sin(vWorldPos.x * 14.0 - uTime * 3.0)
                   * cos(vWorldPos.z * 11.0 + uTime * 2.3);
    float caustic = caustic1 * 0.04 + caustic2 * 0.02;
    color += vec3(caustic * 0.8, caustic, caustic * 1.2);

    // Edge fade
    float edgeFade = smoothstep(1.0, 0.82, dist);
    float alpha = 0.78 * edgeFade + 0.18;

    gl_FragColor = vec4(color, alpha);
  }
`

// ── Lily pad ────────────────────────────────────────────

function LilyPad({ x, z, size, rotation }: { x: number; z: number; size: number; rotation: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.position.y = 0.06 + Math.sin(t * 0.8 + phase) * 0.008
    groupRef.current.rotation.y = rotation + Math.sin(t * 0.3 + phase) * 0.05
  })

  // Lily pad shape: circle with a wedge cut out
  const padGeo = useMemo(() => {
    const shape = new THREE.Shape()
    const r = size
    const segments = 20
    const gapAngle = 0.3 // radians for the notch
    // Start from notch edge, arc around, back to notch
    for (let i = 0; i <= segments; i++) {
      const angle = gapAngle + (i / segments) * (Math.PI * 2 - gapAngle * 2)
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.lineTo(0, 0) // back to center for notch
    shape.closePath()
    return new THREE.ShapeGeometry(shape, 1)
  }, [size])

  return (
    <group ref={groupRef} position={[x, 0.06, z]}>
      <mesh geometry={padGeo} rotation={[-Math.PI / 2, 0, rotation]}>
        <meshStandardMaterial
          color="#1a6b18"
          roughness={0.6}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Slight rim highlight */}
      <mesh rotation={[-Math.PI / 2, 0, rotation]} position={[0, 0.003, 0]}>
        <ringGeometry args={[size * 0.85, size * 0.98, 16]} />
        <meshStandardMaterial
          color="#2a8a25"
          roughness={0.5}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// ── Lily flower ────────────────────────────────────────

function LilyFlower({ x, z }: { x: number; z: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.position.y = 0.12 + Math.sin(t * 0.8 + phase) * 0.008
  })

  return (
    <group ref={groupRef} position={[x, 0.12, z]}>
      {/* Petals */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, 0, 0]} rotation={[-Math.PI / 2.5, 0, (i / 5) * Math.PI * 2]}>
          <coneGeometry args={[0.05, 0.12, 4]} />
          <meshStandardMaterial color="#f0e8f0" roughness={0.4} />
        </mesh>
      ))}
      {/* Center */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#e8c820" roughness={0.3} />
      </mesh>
    </group>
  )
}

// ── Shore pebbles ────────────────────────────────────────

function ShorePebbles({ radius }: { radius: number }) {
  const pebbles = useMemo(() => {
    const result: { x: number; z: number; s: number; color: string }[] = []
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      const r = radius + 0.1 + Math.random() * 0.35
      result.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        s: 0.04 + Math.random() * 0.06,
        color: `hsl(30, ${5 + Math.random() * 8}%, ${30 + Math.random() * 25}%)`,
      })
    }
    return result
  }, [radius])

  return (
    <>
      {pebbles.map((p, i) => (
        <mesh key={i} position={[p.x, 0.01, p.z]} scale={[p.s * 1.3, p.s * 0.5, p.s]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={p.color} flatShading roughness={0.85} />
        </mesh>
      ))}
    </>
  )
}

// ── Component ───────────────────────────────────────────

interface PondProps {
  timeOfDay: number
  sunPosition: Vec3
  rain?: boolean
  rainIntensity?: number
}

export default function Pond({ timeOfDay, sunPosition, rain = false, rainIntensity = 0 }: PondProps) {
  const { position, radius } = SCENE_LAYOUT.pond
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const waterMeshRef = useRef<THREE.Mesh>(null!)
  const waterLevelRef = useRef(0.03)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSkyColor: { value: new THREE.Color(0x87ceeb) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(1, 1, 0.95) },
      uWaterReflect: { value: new THREE.Color(0.4, 0.6, 0.75) },
      uSunIntensity: { value: 1.0 },
    }),
    [],
  )

  useFrame((_state, delta) => {
    if (!materialRef.current) return

    materialRef.current.uniforms.uTime.value += delta

    const [sx, sy, sz] = sunPosition
    materialRef.current.uniforms.uSunDir.value
      .set(sx, sy, sz)
      .normalize()

    const palette = getTimePalette(timeOfDay)
    materialRef.current.uniforms.uSkyColor.value.setRGB(
      ...palette.zenithColor,
    )
    materialRef.current.uniforms.uSunColor.value.setRGB(
      ...palette.sunColor,
    )
    materialRef.current.uniforms.uWaterReflect.value.setRGB(
      ...palette.waterReflect,
    )
    materialRef.current.uniforms.uSunIntensity.value = palette.sunIntensity

    const targetLevel = rain ? 0.03 + rainIntensity * 0.08 : 0.03
    waterLevelRef.current += (targetLevel - waterLevelRef.current) * Math.min(0.5 * delta, 1)

    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = waterLevelRef.current
    }
  })

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Shore ring — organic dirt/mud edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[radius - 0.15, radius + 0.5, 32]} />
        <meshStandardMaterial color="#4a3a22" roughness={0.95} />
      </mesh>

      {/* Inner muddy shore ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[radius - 0.2, radius + 0.1, 32]} />
        <meshStandardMaterial color="#3a3020" roughness={0.9} />
      </mesh>

      {/* Shore pebbles */}
      <ShorePebbles radius={radius} />

      {/* Water surface */}
      <mesh ref={waterMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[radius, 48]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={waterVertexShader}
          fragmentShader={waterFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rain splashes */}
      {rain && <PondSplashes radius={radius} intensity={rainIntensity} />}

      {/* Pond bed (darker underneath, gradient) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <circleGeometry args={[radius - 0.2, 32]} />
        <meshStandardMaterial color="#0f2828" roughness={1} />
      </mesh>

      {/* Lily pads */}
      <LilyPad x={-1.2} z={0.8} size={0.28} rotation={0.5} />
      <LilyPad x={0.9} z={-1.0} size={0.22} rotation={1.8} />
      <LilyPad x={-0.5} z={-1.5} size={0.25} rotation={3.2} />
      <LilyPad x={1.5} z={0.3} size={0.18} rotation={4.5} />

      {/* Lily flower */}
      <LilyFlower x={-1.0} z={0.5} />

      {/* Reeds at water edge */}
      {[0, 1, 2, 3].map(i => {
        const angle = 0.8 + i * 0.5
        const r = radius - 0.3
        return (
          <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.008, 0.012, 0.5, 4]} />
              <meshStandardMaterial color="#4a6830" />
            </mesh>
            <mesh position={[0.03, 0.22, 0.02]}>
              <cylinderGeometry args={[0.006, 0.01, 0.44, 4]} />
              <meshStandardMaterial color="#3a5828" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
