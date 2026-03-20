import React, { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import type { CowBehavior, BreedId, Vec3 } from '../engine/types.ts'
import { useGameStore, gameStore } from '../ui/hooks.ts'
import { BREEDS } from '../engine/breeds.ts'

const EYE_COLOR = '#1a1008'
const BELL_COLOR = '#c8a832'

// Module-level pet wag timer (shared between Cow click handler and CowPlaceholder animation)
export const petWagRef = { current: 0 }

// Base positions for animated parts (must match JSX position props)
const HEAD_BASE: [number, number, number] = [0.58, 0.92, 0]
const NECK_BASE: [number, number, number] = [0.48, 0.78, 0]

// ── Procedural Cow ───────────────────────────────────────

export function CowPlaceholder({ behavior, breed: breedId = 'holstein', age = 1.0 }: {
  behavior: CowBehavior; breed?: BreedId; age?: number
}) {
  const breed = BREEDS[breedId]

  // Age-derived proportions
  const ageScale = 0.4 + age * 0.6                      // 0.4 (calf) to 1.0 (adult)
  const headRatio = 1.35 - age * 0.35                    // 1.35 (calf big head) to 1.0
  const hornGrowth = Math.max(0, (age - 0.3) / 0.7)     // 0 until age 0.3, then to 1
  const udderSize = Math.max(0.15, (age - 0.25) / 0.75)  // grows with age
  const legScale = 0.7 + age * 0.3                       // 0.7 to 1.0

  const legFLRef = useRef<THREE.Group>(null!)
  const legFRRef = useRef<THREE.Group>(null!)
  const legBLRef = useRef<THREE.Group>(null!)
  const legBRRef = useRef<THREE.Group>(null!)
  const tailRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Group>(null!)
  const chestRef = useRef<THREE.Mesh>(null!)
  const barrelRef = useRef<THREE.Mesh>(null!)
  const hipRef = useRef<THREE.Mesh>(null!)
  const jawRef = useRef<THREE.Mesh>(null!)
  const neckRef = useRef<THREE.Mesh>(null!)
  const earLeftRef = useRef<THREE.Mesh>(null!)
  const earRightRef = useRef<THREE.Mesh>(null!)

  const earFlickState = useRef({
    leftNext: Math.random() * 3 + 1,
    rightNext: Math.random() * 4 + 2,
    leftFlick: 0,
    rightFlick: 0,
  })

  // Smooth rest progress: 0 = fully active, 1 = fully resting
  const restProgressRef = useRef(0)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const isMoving = behavior === 'walking' || behavior === 'running'
    const isEating = behavior === 'eating'
    const isGrazing = behavior === 'grazing'
    const isDrinking = behavior === 'drinking'
    const isSleeping = behavior === 'sleeping'
    const isJumping = behavior === 'jumping'
    const isSettling = behavior === 'settling'
    const speed = behavior === 'running' ? 14 : 7

    // ═══ REST LAYER ═══
    let restTarget = 0
    if (isSleeping) {
      restTarget = 1
    } else if (isSettling) {
      const store = gameStore.getState()
      const elapsed = store.world.simulationTime - store.cow.activityStartedAt
      restTarget = Math.min(elapsed / 3, 1)
    }
    restProgressRef.current += (restTarget - restProgressRef.current) * Math.min(3 * delta, 1)
    const rest = restProgressRef.current
    const active = 1 - rest

    // ═══ AIRBORNE LAYER ═══
    let jumpY = 0
    let jumpProgress = -1
    if (isJumping) {
      const store = gameStore.getState()
      const startedAt = store.cow.activityStartedAt
      const simTime = store.world.simulationTime
      const elapsed = simTime - startedAt
      const jumpDuration = 0.8
      if (elapsed >= 0 && elapsed < jumpDuration) {
        jumpProgress = elapsed / jumpDuration
        jumpY = Math.sin(jumpProgress * Math.PI) * 0.6
      }
    }
    const inAir = jumpProgress >= 0
    const jumpAnticipation = jumpProgress >= 0 && jumpProgress < 0.15
    const jumpAirborne = jumpProgress >= 0.15 && jumpProgress < 0.85
    const jumpLanding = jumpProgress >= 0.85

    // ═══ LEG ANIMATION — layered ═══
    const swing = isMoving ? Math.sin(t * speed) * 0.4 * active : 0
    const restFL_z = -1.3
    const restFR_z = -1.2
    const restBL_z = 1.3
    const restBR_z = 1.2

    if (inAir) {
      let tuck = 0
      if (jumpAnticipation) {
        tuck = 0.25 * (jumpProgress / 0.15)
      } else if (jumpAirborne) {
        tuck = -0.35 * Math.max(0, jumpY / 0.6)
      } else if (jumpLanding) {
        const landFactor = (jumpProgress - 0.85) / 0.15
        tuck = 0.15 * (1 - landFactor)
      }
      if (legFLRef.current) { legFLRef.current.rotation.x = 0; legFLRef.current.rotation.z = tuck }
      if (legFRRef.current) { legFRRef.current.rotation.x = 0; legFRRef.current.rotation.z = tuck }
      if (legBLRef.current) { legBLRef.current.rotation.x = 0; legBLRef.current.rotation.z = tuck }
      if (legBRRef.current) { legBRRef.current.rotation.x = 0; legBRRef.current.rotation.z = tuck }
    } else {
      if (legFLRef.current) { legFLRef.current.rotation.x = 0; legFLRef.current.rotation.z = swing + restFL_z * rest }
      if (legFRRef.current) { legFRRef.current.rotation.x = 0; legFRRef.current.rotation.z = -swing + restFR_z * rest }
      if (legBLRef.current) { legBLRef.current.rotation.x = 0; legBLRef.current.rotation.z = -swing + restBL_z * rest }
      if (legBRRef.current) { legBRRef.current.rotation.x = 0; legBRRef.current.rotation.z = swing + restBR_z * rest }
    }

    // ═══ BODY — layered ═══
    if (bodyRef.current) {
      let bodyY = isMoving ? 0.025 * Math.sin(t * speed * 2) : 0
      const activePitch = ((isEating || isGrazing || isDrinking) ? 0.03 : 0) * active
      if (jumpAnticipation) {
        bodyY = -0.06 * (jumpProgress / 0.15)
      } else if (jumpLanding) {
        const landFactor = (jumpProgress - 0.85) / 0.15
        bodyY = -0.04 * (1 - landFactor) + jumpY
      } else if (inAir) {
        bodyY += jumpY
      }
      bodyRef.current.position.y = bodyY * active + (-0.28) * rest
      bodyRef.current.rotation.x = activePitch + 0.12 * rest
      bodyRef.current.rotation.z = 0.06 * rest
    }

    // ═══ BREATHING ═══
    const breatheRate = isSleeping ? 0.7 : (isEating || isDrinking) ? 1.6 : 1.2
    const breatheAmp = isSleeping ? 0.012 : isEating ? 0.015 : 0.01
    const breathe = 1.0 + Math.sin(t * breatheRate) * breatheAmp
    const barrelBreathe = 1.0 + Math.sin(t * breatheRate) * (breatheAmp * 1.5)
    if (chestRef.current) chestRef.current.scale.set(breathe, breathe, breathe)
    if (barrelRef.current) barrelRef.current.scale.set(barrelBreathe, barrelBreathe, barrelBreathe)
    if (hipRef.current) hipRef.current.scale.set(breathe, breathe, breathe)

    // ═══ NECK — layered ═══
    if (neckRef.current) {
      const headDown = isEating || isGrazing || isDrinking
      const activeNeckZ = headDown
        ? -0.45 - (isEating ? 0.55 : isDrinking ? 0.60 : 0.50)
        : -0.45
      const activeNeckOffsetX = headDown ? (isEating ? -0.02 : isDrinking ? 0.02 : -0.01) : 0
      const activeNeckOffsetY = headDown ? (isEating ? -0.16 : isDrinking ? -0.20 : -0.18) : 0
      neckRef.current.rotation.z = activeNeckZ * active + (-0.15) * rest
      neckRef.current.position.x = NECK_BASE[0] + activeNeckOffsetX * active + (-0.06) * rest
      neckRef.current.position.y = NECK_BASE[1] + activeNeckOffsetY * active + (-0.22) * rest
      const activeScaleY = headDown ? (isEating ? 1.15 : isDrinking ? 1.18 : 1.14) : 1.0
      neckRef.current.scale.set(1, activeScaleY * active + 0.8 * rest, 1)
    }

    // ═══ HEAD — layered ═══
    // Axis reminder: cow faces +X, so rotation.z = pitch (nose up/down),
    // rotation.x = roll (side tilt), rotation.y = yaw (look left/right)
    if (headRef.current) {
      let headPitch = 0, headYaw = 0, headRoll = 0  // pitch=rot.z, roll=rot.x, yaw=rot.y
      let offsetY = 0, offsetX = 0

      if (isEating && active > 0.01) {
        // Eating cycle: reach down → bite → chew (head up a bit) → pause → repeat
        // offsetX stays 0 — neck already extends forward, head goes straight down
        const cycleDuration = 5.0
        const cycleT = t % cycleDuration
        if (cycleT < 1.0) {
          // Phase 1: Reach down — smooth ease-out to food level
          const p = cycleT / 1.0
          const ease = p * (2 - p)
          headPitch = -0.55 * ease
          offsetY = -0.30 * ease
        } else if (cycleT < 2.0) {
          // Phase 2: Bite/grab — small quick nods, jaw working
          const biteP = (cycleT - 1.0) / 1.0
          const nibble = Math.sin(biteP * Math.PI * 3) * 0.06
          headPitch = -0.55 + nibble
          offsetY = -0.30 + nibble * 0.02
        } else if (cycleT < 3.8) {
          // Phase 3: Chew — head lifts partway, rhythmic jaw grinding
          const chewP = (cycleT - 2.0) / 1.8
          headPitch = -0.28
          offsetY = -0.16
          headYaw = Math.sin(chewP * Math.PI * 5) * 0.04
        } else {
          // Phase 4: Swallow/pause — head lifts, brief rest
          const pauseP = (cycleT - 3.8) / 1.2
          const ease = pauseP * pauseP
          headPitch = -0.28 + 0.28 * ease
          offsetY = -0.16 + 0.16 * ease
        }
      } else if (isDrinking && active > 0.01) {
        // Drinking: head stays low, periodic sipping motion
        const cycleDuration = 3.0
        const cycleT = t % cycleDuration
        if (cycleT < 0.8) {
          // Sip — head dips slightly
          const sipP = cycleT / 0.8
          const dip = Math.sin(sipP * Math.PI) * 0.08
          headPitch = -0.60 - dip
          offsetY = -0.34 - dip * 0.3
        } else if (cycleT < 1.6) {
          // Swallow — slight head lift
          const swallowP = (cycleT - 0.8) / 0.8
          headPitch = -0.55 + swallowP * 0.08
          offsetY = -0.30
        } else {
          // Pause — head steady at water level
          headPitch = -0.52
          offsetY = -0.28
          headYaw = Math.sin(t * 0.4) * 0.02
        }
      } else if (isGrazing && active > 0.01) {
        // Grazing: head low to ground, occasional lift to look around
        const grazeSweep = Math.sin(t * 0.6) * 0.06
        let headLift = 0
        const liftCycle = t % 8.0
        if (liftCycle > 6.0 && liftCycle < 7.5) {
          const liftProgress = (liftCycle - 6.0) / 1.5
          headLift = Math.sin(liftProgress * Math.PI)
        }
        headPitch = -0.50 + headLift * 0.45    // nose down, lifts briefly
        offsetY = -0.26 + headLift * 0.26       // head drops low, lifts when looking
        headYaw = headLift > 0.3 ? Math.sin(t * 1.5) * 0.15 : grazeSweep
      } else if (inAir) {
        if (jumpAnticipation) headPitch = -0.1
        else if (jumpLanding) headPitch = -0.05
        else headPitch = 0.2            // nose up in air
      } else if (active > 0.01) {
        // Idle — subtle look-around
        headPitch = Math.sin(t * 0.5) * 0.03
        headRoll = Math.sin(t * 0.8) * 0.03
        headYaw = Math.sin(t * 0.35) * 0.04
      }

      const sleepBreath = Math.sin(t * 0.5) * 0.02
      const restPitch = -0.08
      const restYaw = 0.12
      const restRoll = 0.35 + sleepBreath  // head rests on its side
      const restOffsetY = -0.35
      const restOffsetX = -0.10

      // ── Head wag on pet/click ──
      const timeSincePet = (performance.now() / 1000) - petWagRef.current
      if (timeSincePet < 2.0 && timeSincePet >= 0) {
        const wagIntensity = 1 - timeSincePet / 2.0
        headYaw += Math.sin(timeSincePet * 14) * 0.18 * wagIntensity
        headPitch += Math.sin(timeSincePet * 8) * 0.06 * wagIntensity
      }

      headRef.current.rotation.z = headPitch * active + restPitch * rest   // pitch
      headRef.current.rotation.y = headYaw * active + restYaw * rest       // yaw
      headRef.current.rotation.x = headRoll * active + restRoll * rest     // roll
      headRef.current.position.x = HEAD_BASE[0] + offsetX * active + restOffsetX * rest
      headRef.current.position.y = HEAD_BASE[1] + offsetY * active + restOffsetY * rest
    }

    // ═══ JAW ═══
    if (jawRef.current) {
      let jawOpen = 0
      if (isEating && active > 0.01) {
        const cycleDuration = 5.0
        const cycleT = t % cycleDuration
        if (cycleT < 1.0) {
          // Reaching down — mouth slightly open
          jawOpen = 0.02
        } else if (cycleT < 2.0) {
          // Biting — jaw opens/closes
          const biteP = (cycleT - 1.0) / 1.0
          jawOpen = Math.abs(Math.sin(biteP * Math.PI * 3)) * 0.06
        } else if (cycleT < 3.8) {
          // Chewing — rhythmic grinding
          const chewP = (cycleT - 2.0) / 1.8
          jawOpen = Math.abs(Math.sin(chewP * Math.PI * 5)) * 0.03
        }
      } else if (isGrazing && active > 0.01) {
        jawOpen = Math.abs(Math.sin(t * 2.0)) * 0.025
      }
      jawRef.current.position.y = -0.17 - jawOpen * active
    }

    // ═══ EARS ═══
    const ef = earFlickState.current
    ef.leftNext -= delta
    ef.rightNext -= delta
    if (ef.leftNext <= 0) { ef.leftFlick = 1.0; ef.leftNext = Math.random() * 4 + 1.5 }
    if (ef.rightNext <= 0) { ef.rightFlick = 1.0; ef.rightNext = Math.random() * 5 + 2 }
    ef.leftFlick = Math.max(0, ef.leftFlick - delta * 4)
    ef.rightFlick = Math.max(0, ef.rightFlick - delta * 4)

    const headLow = isEating || isGrazing || isDrinking
    if (earLeftRef.current) {
      let earBaseZ = headLow ? 0.5 : 0.7
      let flickAmp = ef.leftFlick * 0.3 * (headLow ? 0.5 : 1)
      earBaseZ = earBaseZ * active + 0.3 * rest
      flickAmp *= active
      earLeftRef.current.rotation.z = earBaseZ + flickAmp
      earLeftRef.current.rotation.x = 0.5 + ((headLow && active > 0.5) ? 0.15 : 0)
    }
    if (earRightRef.current) {
      let earBaseZ = headLow ? 0.5 : 0.7
      let flickAmp = ef.rightFlick * 0.3 * (headLow ? 0.5 : 1)
      earBaseZ = earBaseZ * active + 0.3 * rest
      flickAmp *= active
      earRightRef.current.rotation.z = earBaseZ + flickAmp
      earRightRef.current.rotation.x = -0.5 - ((headLow && active > 0.5) ? 0.15 : 0)
    }

    // ═══ TAIL — layered ═══
    if (tailRef.current) {
      let activeTailZ: number, activeTailX: number
      if (isEating) {
        activeTailZ = Math.sin(t * 3.5) * 0.35 + Math.sin(t * 7) * 0.1
        activeTailX = Math.sin(t * 4.5) * 0.15
      } else if (isGrazing) {
        activeTailZ = Math.sin(t * 2.0) * 0.2
        activeTailX = Math.sin(t * 2.8) * 0.08
      } else if (isMoving) {
        activeTailZ = Math.sin(t * speed * 0.8) * 0.3
        activeTailX = Math.sin(t * speed * 0.5) * 0.12
      } else {
        activeTailZ = Math.sin(t * 1.2) * 0.18
        activeTailX = Math.sin(t * 1.8) * 0.08
      }
      tailRef.current.rotation.z = activeTailZ * active + Math.sin(t * 0.2) * 0.03 * rest
      tailRef.current.rotation.x = activeTailX * active
    }
  })

  return (
    <group scale={ageScale}>
      <group ref={bodyRef}>
        {/* ═══ OUTLINES ═══ */}
        <mesh position={[0.34, 0.62, 0]} scale={[1.04, 1.04, 1.04]}>
          <sphereGeometry args={[0.28, 20, 16]} />
          <meshBasicMaterial color={breed.outlineColor} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0.05, 0.58, 0]} scale={[1.35, 1.04, 1.04]}>
          <sphereGeometry args={[0.34, 20, 16]} />
          <meshBasicMaterial color={breed.outlineColor} side={THREE.BackSide} />
        </mesh>
        <mesh position={[-0.28, 0.57, 0]} scale={[1.35, 1.04, 1.04]}>
          <sphereGeometry args={[0.32, 20, 16]} />
          <meshBasicMaterial color={breed.outlineColor} side={THREE.BackSide} />
        </mesh>
        <mesh position={[-0.52, 0.54, 0]} scale={[1.04, 1.04, 1.04]}>
          <sphereGeometry args={[0.28, 20, 16]} />
          <meshBasicMaterial color={breed.outlineColor} side={THREE.BackSide} />
        </mesh>

        {/* ═══ BODY — 4 overlapping spheres, elongated for realistic proportions ═══ */}
        {/* Chest (front shoulder area) */}
        <mesh ref={chestRef} position={[0.34, 0.62, 0]} castShadow>
          <sphereGeometry args={[0.27, 22, 18]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>
        {/* Front barrel (mid-body, stretched along X) */}
        <mesh ref={barrelRef} position={[0.05, 0.58, 0]} scale={[1.3, 1.0, 1.0]} castShadow>
          <sphereGeometry args={[0.33, 22, 18]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>
        {/* Rear barrel */}
        <mesh position={[-0.28, 0.57, 0]} scale={[1.3, 1.0, 1.0]} castShadow>
          <sphereGeometry args={[0.31, 22, 18]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>
        {/* Hip (rear) */}
        <mesh ref={hipRef} position={[-0.52, 0.54, 0]} castShadow>
          <sphereGeometry args={[0.27, 22, 18]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>

        {/* ═══ SPOTS — breed-driven, projected onto body surface ═══ */}
        {breed.spots.map((spot, i) => {
          // Ensure spot Z-scale is thick enough to merge with body
          const sz: [number, number, number] = [
            spot.scale[0],
            spot.scale[1],
            Math.max(spot.scale[2], 0.14),
          ]
          return (
            <mesh key={`spot-${i}`} position={spot.position} scale={sz}>
              <sphereGeometry args={[1, 8, 7]} />
              <meshStandardMaterial color={breed.spotColor} />
            </mesh>
          )
        })}

        {/* ═══ SPINE RIDGE (subtle, adds realism) ═══ */}
        <mesh position={[-0.08, 0.88, 0]} scale={[0.70, 0.04, 0.08]} rotation={[0, 0, 0.05]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>

        {/* ═══ NECK ═══ */}
        <mesh ref={neckRef} position={[0.48, 0.78, 0]} rotation={[0, 0, -0.45]} castShadow>
          <cylinderGeometry args={[0.12, 0.20, 0.28, 12]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
        </mesh>

        {/* ═══ DEWLAP (throat skin fold — characteristic of cattle) ═══ */}
        <mesh position={[0.46, 0.58, 0]} scale={[0.10, 0.14, 0.06]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
        </mesh>

        {/* ═══ BELL ═══ */}
        <group position={[0.50, 0.66, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 4]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color={BELL_COLOR} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.065, 0]}>
            <sphereGeometry args={[0.012, 5, 5]} />
            <meshStandardMaterial color="#8a7020" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>

        {/* ═══ HEAD GROUP ═══ */}
        <group ref={headRef} position={[0.58, 0.92, 0]} scale={headRatio}>
          {/* Main head — slightly elongated forward */}
          <mesh castShadow scale={[1.15, 1.0, 0.95]}>
            <sphereGeometry args={[0.20, 18, 14]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
          </mesh>

          {/* Forehead / brow ridge */}
          <mesh position={[0.06, 0.10, 0]} scale={[0.8, 0.35, 0.9]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
          </mesh>

          {/* Muzzle / snout — broad and flat, like a real cow */}
          <mesh position={[0.20, -0.08, 0]} scale={[0.9, 0.8, 1.1]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={breed.muzzleColor} roughness={0.6} />
          </mesh>

          {/* Nose pad (darker, slightly raised) */}
          <mesh position={[0.32, -0.05, 0]} scale={[0.5, 0.6, 1.0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color="#555050" />
          </mesh>

          {/* Nostrils */}
          <mesh position={[0.34, -0.06, 0.04]}>
            <sphereGeometry args={[0.022, 6, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.34, -0.06, -0.04]}>
            <sphereGeometry args={[0.022, 6, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>

          {/* Mouth line */}
          <mesh position={[0.28, -0.14, 0]} scale={[0.06, 0.006, 0.08]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#665050" />
          </mesh>

          {/* Lower jaw */}
          <mesh ref={jawRef} position={[0.20, -0.17, 0]}>
            <boxGeometry args={[0.12, 0.035, 0.10]} />
            <meshStandardMaterial color={breed.muzzleColor} roughness={0.6} />
          </mesh>

          {/* Left eye — set into head, not protruding */}
          <group position={[0.12, 0.04, 0.14]}>
            <mesh>
              <sphereGeometry args={[0.032, 8, 8]} />
              <meshStandardMaterial color="#f0f0e8" />
            </mesh>
            <mesh position={[0.018, 0, 0.01]}>
              <sphereGeometry args={[0.022, 7, 7]} />
              <meshStandardMaterial color={EYE_COLOR} />
            </mesh>
            <mesh position={[0.026, 0, 0.014]}>
              <sphereGeometry args={[0.012, 6, 6]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0.028, 0.008, 0.016]}>
              <sphereGeometry args={[0.005, 4, 4]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
            </mesh>
          </group>

          {/* Right eye */}
          <group position={[0.12, 0.04, -0.14]}>
            <mesh>
              <sphereGeometry args={[0.032, 8, 8]} />
              <meshStandardMaterial color="#f0f0e8" />
            </mesh>
            <mesh position={[0.018, 0, -0.01]}>
              <sphereGeometry args={[0.022, 7, 7]} />
              <meshStandardMaterial color={EYE_COLOR} />
            </mesh>
            <mesh position={[0.026, 0, -0.014]}>
              <sphereGeometry args={[0.012, 6, 6]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0.028, 0.008, -0.016]}>
              <sphereGeometry args={[0.005, 4, 4]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
            </mesh>
          </group>

          {/* Ears — wide, horizontal, leaf-shaped */}
          <mesh ref={earLeftRef} position={[-0.08, 0.10, 0.18]} rotation={[0.3, 0.15, 0.5]} scale={[1.3 * breed.earScale, 0.45 * breed.earScale, 1.2 * breed.earScale]}>
            <coneGeometry args={[0.10, 0.22, 6]} />
            <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
          </mesh>
          <mesh ref={earRightRef} position={[-0.08, 0.10, -0.18]} rotation={[-0.3, -0.15, 0.5]} scale={[1.3 * breed.earScale, 0.45 * breed.earScale, 1.2 * breed.earScale]}>
            <coneGeometry args={[0.10, 0.22, 6]} />
            <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
          </mesh>

          {/* Horns — breed-scaled, hidden on calves */}
          {hornGrowth > 0.01 && (
            <>
              <mesh position={[-0.04, 0.18, breed.hornSpread]} rotation={[0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <coneGeometry args={[0.03 * breed.hornLength, 0.20 * breed.hornLength, 6]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.55} metalness={0.08} />
              </mesh>
              <mesh position={[-0.04, 0.18, -breed.hornSpread]} rotation={[-0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <coneGeometry args={[0.03 * breed.hornLength, 0.20 * breed.hornLength, 6]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.55} metalness={0.08} />
              </mesh>
            </>
          )}

          {/* Head spot (forehead) — breed-driven */}
          {breed.headSpot && (
            <mesh position={breed.headSpot.position} scale={breed.headSpot.scale}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshStandardMaterial color={breed.spotColor} />
            </mesh>
          )}
        </group>

        {/* ═══ LEGS — longer, with subtle joint shaping ═══ */}

        {/* Front-left leg */}
        <group ref={legFLRef} position={[0.30, 0.36, 0.15]}>
          <mesh position={[0, -0.06 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.048, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          {/* Knee joint */}
          <mesh position={[0, -0.18 * legScale, 0]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.32 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.035, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.44 * legScale, 0]}>
            <cylinderGeometry args={[0.048, 0.052, 0.04, 12]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Front-right leg */}
        <group ref={legFRRef} position={[0.30, 0.36, -0.15]}>
          <mesh position={[0, -0.06 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.048, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.18 * legScale, 0]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.32 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.035, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.44 * legScale, 0]}>
            <cylinderGeometry args={[0.048, 0.052, 0.04, 12]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Back-left leg */}
        <group ref={legBLRef} position={[-0.48, 0.36, 0.15]}>
          <mesh position={[0, -0.06 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.05, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.18 * legScale, 0]}>
            <sphereGeometry args={[0.052, 6, 6]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.32 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.036, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.44 * legScale, 0]}>
            <cylinderGeometry args={[0.048, 0.052, 0.04, 12]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Back-right leg */}
        <group ref={legBRRef} position={[-0.48, 0.36, -0.15]}>
          <mesh position={[0, -0.06 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.05, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.18 * legScale, 0]}>
            <sphereGeometry args={[0.052, 6, 6]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.32 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.036, 0.22 * legScale, 12]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.44 * legScale, 0]}>
            <cylinderGeometry args={[0.048, 0.052, 0.04, 12]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* ═══ TAIL ═══ */}
        <group ref={tailRef} position={[-0.66, 0.62, 0]}>
          <mesh rotation={[0, 0, -0.5]} castShadow>
            <cylinderGeometry args={[0.020, 0.016, 0.24, 5]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
          </mesh>
          <mesh position={[-0.08, -0.22, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.014, 0.008, 0.22, 5]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.75} metalness={0} />
          </mesh>
          <mesh position={[-0.14, -0.40, 0]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color={breed.spotColor} />
          </mesh>
          <mesh position={[-0.14, -0.38, 0]} scale={[1.3, 0.4, 0.8]}>
            <sphereGeometry args={[0.028, 5, 5]} />
            <meshStandardMaterial color={breed.spotColor} />
          </mesh>
        </group>

        {/* ═══ UDDER — scales with age, positions stay fixed ═══ */}
        {udderSize > 0.05 && (
          <>
            <mesh position={[-0.36, 0.22, 0]} scale={udderSize}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={breed.udderColor} />
            </mesh>
            <mesh position={[-0.34, 0.18, 0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.013, 0.010, 0.04, 5]} />
              <meshStandardMaterial color={breed.udderColor} />
            </mesh>
            <mesh position={[-0.34, 0.18, -0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.013, 0.010, 0.04, 5]} />
              <meshStandardMaterial color={breed.udderColor} />
            </mesh>
            <mesh position={[-0.40, 0.18, 0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.013, 0.010, 0.04, 5]} />
              <meshStandardMaterial color={breed.udderColor} />
            </mesh>
            <mesh position={[-0.40, 0.18, -0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.013, 0.010, 0.04, 5]} />
              <meshStandardMaterial color={breed.udderColor} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

// ── GLTF cow (tries to load cow.glb) ────────────────────

function GltfCow({ behavior }: { behavior: CowBehavior }) {
  const gltf = useGLTF('/cow.glb')
  const groupRef = useRef<THREE.Group>(null!)
  const { actions } = useAnimations(gltf.animations, groupRef)

  const prevBehavior = useRef<CowBehavior>(behavior)

  useEffect(() => {
    if (prevBehavior.current === behavior) return

    const clipName = behaviorToClip(behavior)
    const prevClipName = behaviorToClip(prevBehavior.current)

    const nextAction = clipName ? actions[clipName] : null
    const prevAction = prevClipName ? actions[prevClipName] : null

    if (prevAction) {
      prevAction.fadeOut(0.3)
    }
    if (nextAction) {
      nextAction.reset().fadeIn(0.3).play()
    }

    prevBehavior.current = behavior
  }, [behavior, actions])

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
    </group>
  )
}

function behaviorToClip(behavior: CowBehavior): string | null {
  switch (behavior) {
    case 'idle':
      return 'Idle'
    case 'walking':
      return 'Walk'
    case 'running':
      return 'Run'
    case 'eating':
    case 'grazing':
      return 'Eat'
    case 'sleeping':
      return 'Sleep'
    case 'sitting':
      return 'Sit'
    case 'jumping':
      return 'Jump'
    case 'settling':
      return 'Sleep'
    case 'drinking':
      return 'Eat'
    default:
      return 'Idle'
  }
}

// ── Main Cow component ──────────────────────────────────

function CowModelLoader({ behavior, breed, age }: { behavior: CowBehavior; breed: BreedId; age: number }) {
  const [usePlaceholder, setUsePlaceholder] = useState(false)

  if (usePlaceholder) {
    return <CowPlaceholder behavior={behavior} breed={breed} age={age} />
  }

  return (
    <ErrorBoundary onError={() => setUsePlaceholder(true)}>
      <Suspense fallback={<CowPlaceholder behavior={behavior} breed={breed} age={age} />}>
        <GltfCow behavior={behavior} />
      </Suspense>
    </ErrorBoundary>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

export default function Cow() {
  const groupRef = useRef<THREE.Group>(null!)
  const position = useGameStore((s) => s.cow.position)
  const facingAngle = useGameStore((s) => s.cow.facingAngle)
  const behavior = useGameStore((s) => s.cow.behavior)
  const breed = useGameStore((s) => s.cow.breed)
  const age = useGameStore((s) => s.cow.age)

  const currentAngle = useRef(facingAngle)

  useFrame((_state, delta) => {
    if (!groupRef.current) return

    let diff = facingAngle - currentAngle.current
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    const lerpSpeed = 5 * delta
    currentAngle.current += diff * Math.min(lerpSpeed, 1)

    groupRef.current.position.set(position[0], position[1], position[2])
    groupRef.current.rotation.y = currentAngle.current - Math.PI / 2
  })

  const handleClick = () => {
    petWagRef.current = performance.now() / 1000
    gameStore.getState().playerAction({ type: 'pet' })
  }

  return (
    <group
      ref={groupRef}
      position={position as unknown as Vec3}
      onClick={handleClick}
      scale={1.8}
    >
      <CowModelLoader behavior={behavior} breed={breed} age={age} />
    </group>
  )
}
