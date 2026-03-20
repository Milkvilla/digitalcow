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

  // Each splash: position, age, maxAge
  const splashes = useRef<Array<{ x: number; z: number; age: number; maxAge: number }>>([])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_state, delta) => {
    if (!meshRef.current) return

    const arr = splashes.current

    // Spawn new splashes
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

    // Keep only up to splashCount active
    while (arr.length > splashCount) arr.shift()

    // Update and render
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

    // Remove dead splashes
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

    // Gentle vertex wave displacement
    vec3 pos = position;
    float wave1 = sin(pos.x * 3.0 + uTime * 1.2) * 0.02;
    float wave2 = cos(pos.y * 2.5 + uTime * 0.9) * 0.015;
    float wave3 = sin((pos.x + pos.y) * 4.0 + uTime * 1.5) * 0.01;
    pos.z += wave1 + wave2 + wave3;

    // Perturbed normal for Fresnel
    float dx = cos(pos.x * 3.0 + uTime * 1.2) * 3.0 * 0.02
             + cos((pos.x + pos.y) * 4.0 + uTime * 1.5) * 4.0 * 0.01;
    float dy = -sin(pos.y * 2.5 + uTime * 0.9) * 2.5 * 0.015
             + cos((pos.x + pos.y) * 4.0 + uTime * 1.5) * 4.0 * 0.01;
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
    // Deep water color
    vec3 deepColor = vec3(0.04, 0.18, 0.28);
    vec3 shallowColor = vec3(0.1, 0.35, 0.45);

    // Distance from center for depth gradient
    float dist = length(vUv - 0.5) * 2.0;
    vec3 waterColor = mix(deepColor, shallowColor, dist);

    // Tint water by time-of-day reflection
    waterColor = mix(waterColor, uWaterReflect, 0.25);

    // Fresnel — more reflective at glancing angles
    float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), 3.0);
    fresnel = clamp(fresnel, 0.05, 0.85);

    // Reflection color (sky + slight tint, scaled by sun intensity)
    float brightness = clamp(uSunIntensity, 0.0, 1.5);
    vec3 reflectionColor = uSkyColor * 0.8 + vec3(0.1, 0.15, 0.2) * brightness;

    // Mix water and reflection — reduce Fresnel at night
    float nightFresnel = fresnel * (0.3 + 0.7 * min(brightness, 1.0));
    vec3 color = mix(waterColor, reflectionColor, nightFresnel);

    // Specular highlight from sun — tinted by sun color, scaled by intensity
    vec3 halfVec = normalize(vViewDir + uSunDir);
    float specular = pow(max(dot(vNormal, halfVec), 0.0), 64.0);
    color += uSunColor * specular * 0.5 * brightness;

    // Subtle caustic shimmer
    float caustic = sin(vWorldPos.x * 8.0 + uTime * 2.0)
                  * cos(vWorldPos.z * 6.0 + uTime * 1.7)
                  * 0.04;
    color += vec3(caustic);

    // Edge fade
    float edgeFade = smoothstep(1.0, 0.85, dist);
    float alpha = 0.75 * edgeFade + 0.15;

    gl_FragColor = vec4(color, alpha);
  }
`

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

    // Update sun direction from actual sun position
    const [sx, sy, sz] = sunPosition
    materialRef.current.uniforms.uSunDir.value
      .set(sx, sy, sz)
      .normalize()

    // Update sky/sun/water colors from palette
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

    // Water level rises slightly when raining
    const targetLevel = rain ? 0.03 + rainIntensity * 0.08 : 0.03
    waterLevelRef.current += (targetLevel - waterLevelRef.current) * Math.min(0.5 * delta, 1)

    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = waterLevelRef.current
    }
  })

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Shore ring — darker dirt edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[radius - 0.1, radius + 0.4, 32]} />
        <meshStandardMaterial color="#5a4a30" />
      </mesh>

      {/* Water surface */}
      <mesh ref={waterMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[radius, 32]} />
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

      {/* Pond bed (darker underneath) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[radius - 0.2, 24]} />
        <meshStandardMaterial color="#1a3333" />
      </mesh>
    </group>
  )
}
