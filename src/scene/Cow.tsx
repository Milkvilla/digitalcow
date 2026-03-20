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
    const isWalking = behavior === 'walking'
    const isRunning = behavior === 'running'
    const isMoving = isWalking || isRunning
    const isEating = behavior === 'eating'
    const isGrazing = behavior === 'grazing'
    const isDrinking = behavior === 'drinking'
    const isSleeping = behavior === 'sleeping'
    const isJumping = behavior === 'jumping'
    const isSettling = behavior === 'settling'
    const isIdle = behavior === 'idle'
    const speed = isRunning ? 14 : 7

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

    // ═══ GAIT CYCLE — proper quadruped diagonal pairs ═══
    // Walk: diagonal pairs move together (FL+BR, FR+BL) with phase offset
    // Run: front pair slightly ahead of back pair (bounding gait)
    const gaitPhase = t * speed
    const walkAmp = 0.4 * active
    const runExtra = isRunning ? 0.15 : 0

    // Diagonal pairing: FL & BR are in phase, FR & BL are in antiphase
    const flSwing = isMoving ? Math.sin(gaitPhase) * (walkAmp + runExtra) : 0
    const frSwing = isMoving ? Math.sin(gaitPhase + Math.PI) * (walkAmp + runExtra) : 0
    const blSwing = isMoving ? Math.sin(gaitPhase + Math.PI + 0.15) * (walkAmp + runExtra * 0.8) : 0
    const brSwing = isMoving ? Math.sin(gaitPhase + 0.15) * (walkAmp + runExtra * 0.8) : 0

    // Lateral splay — legs splay outward slightly at peak extension
    const flSplay = isMoving ? Math.abs(Math.sin(gaitPhase)) * 0.04 : 0
    const frSplay = isMoving ? Math.abs(Math.sin(gaitPhase + Math.PI)) * -0.04 : 0
    const blSplay = isMoving ? Math.abs(Math.sin(gaitPhase + Math.PI)) * 0.04 : 0
    const brSplay = isMoving ? Math.abs(Math.sin(gaitPhase)) * -0.04 : 0

    // Idle weight shift — cow shifts weight side to side slowly
    const idleWeightShift = isIdle ? Math.sin(t * 0.3) * 0.015 : 0
    const idleLegAdjust = isIdle ? Math.sin(t * 0.3) * 0.03 : 0

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
      if (legFLRef.current) { legFLRef.current.rotation.z = flSwing + idleLegAdjust + restFL_z * rest; legFLRef.current.rotation.x = flSplay }
      if (legFRRef.current) { legFRRef.current.rotation.z = frSwing - idleLegAdjust + restFR_z * rest; legFRRef.current.rotation.x = frSplay }
      if (legBLRef.current) { legBLRef.current.rotation.z = blSwing - idleLegAdjust + restBL_z * rest; legBLRef.current.rotation.x = blSplay }
      if (legBRRef.current) { legBRRef.current.rotation.z = brSwing + idleLegAdjust + restBR_z * rest; legBRRef.current.rotation.x = brSplay }
    }

    // ═══ BODY — layered with lateral sway and shoulder roll ═══
    if (bodyRef.current) {
      // Vertical bob: double-frequency of leg cycle
      let bodyY = isMoving ? 0.025 * Math.sin(gaitPhase * 2) : 0
      // Lateral body sway — weight shifts side to side with each step
      const bodySway = isMoving
        ? Math.sin(gaitPhase) * (isRunning ? 0.03 : 0.02)
        : idleWeightShift
      // Shoulder roll — body pitches slightly with gait
      const shoulderRoll = isMoving ? Math.sin(gaitPhase) * 0.015 : 0
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
      bodyRef.current.position.z = bodySway * active
      bodyRef.current.rotation.x = (activePitch + shoulderRoll) * active + 0.12 * rest
      bodyRef.current.rotation.z = 0.06 * rest
      // Subtle yaw oscillation during movement (body snakes)
      bodyRef.current.rotation.y = isMoving ? Math.sin(gaitPhase * 0.5) * 0.008 : 0
    }

    // ═══ BREATHING — with barrel expansion and rib movement ═══
    const breatheRate = isSleeping ? 0.7 : (isEating || isDrinking) ? 1.6 : isMoving ? 2.0 : 1.2
    const breatheAmp = isSleeping ? 0.014 : isMoving ? 0.018 : isEating ? 0.015 : 0.01
    const breathePhase = Math.sin(t * breatheRate)
    const breathe = 1.0 + breathePhase * breatheAmp
    const barrelBreathe = 1.0 + breathePhase * (breatheAmp * 1.8)
    // Barrel expands more laterally (Z) than vertically during heavy breathing
    const barrelZ = isMoving ? 1.0 + breathePhase * breatheAmp * 2.2 : barrelBreathe
    if (chestRef.current) chestRef.current.scale.set(breathe, breathe, breathe)
    if (barrelRef.current) barrelRef.current.scale.set(barrelBreathe, barrelBreathe, barrelZ)
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
    if (headRef.current) {
      let headPitch = 0, headYaw = 0, headRoll = 0
      let offsetY = 0, offsetX = 0

      if (isEating && active > 0.01) {
        const cycleDuration = 5.0
        const cycleT = t % cycleDuration
        if (cycleT < 1.0) {
          const p = cycleT / 1.0
          const ease = p * (2 - p)
          headPitch = -0.55 * ease
          offsetY = -0.30 * ease
        } else if (cycleT < 2.0) {
          const biteP = (cycleT - 1.0) / 1.0
          const nibble = Math.sin(biteP * Math.PI * 3) * 0.06
          headPitch = -0.55 + nibble
          offsetY = -0.30 + nibble * 0.02
        } else if (cycleT < 3.8) {
          const chewP = (cycleT - 2.0) / 1.8
          headPitch = -0.28
          offsetY = -0.16
          headYaw = Math.sin(chewP * Math.PI * 5) * 0.04
        } else {
          const pauseP = (cycleT - 3.8) / 1.2
          const ease = pauseP * pauseP
          headPitch = -0.28 + 0.28 * ease
          offsetY = -0.16 + 0.16 * ease
        }
      } else if (isDrinking && active > 0.01) {
        const cycleDuration = 3.0
        const cycleT = t % cycleDuration
        if (cycleT < 0.8) {
          const sipP = cycleT / 0.8
          const dip = Math.sin(sipP * Math.PI) * 0.08
          headPitch = -0.60 - dip
          offsetY = -0.34 - dip * 0.3
        } else if (cycleT < 1.6) {
          const swallowP = (cycleT - 0.8) / 0.8
          headPitch = -0.55 + swallowP * 0.08
          offsetY = -0.30
        } else {
          headPitch = -0.52
          offsetY = -0.28
          headYaw = Math.sin(t * 0.4) * 0.02
        }
      } else if (isGrazing && active > 0.01) {
        const grazeSweep = Math.sin(t * 0.6) * 0.06
        let headLift = 0
        const liftCycle = t % 8.0
        if (liftCycle > 6.0 && liftCycle < 7.5) {
          const liftProgress = (liftCycle - 6.0) / 1.5
          headLift = Math.sin(liftProgress * Math.PI)
        }
        headPitch = -0.50 + headLift * 0.45
        offsetY = -0.26 + headLift * 0.26
        headYaw = headLift > 0.3 ? Math.sin(t * 1.5) * 0.15 : grazeSweep
      } else if (inAir) {
        if (jumpAnticipation) headPitch = -0.1
        else if (jumpLanding) headPitch = -0.05
        else headPitch = 0.2
      } else if (active > 0.01) {
        headPitch = Math.sin(t * 0.5) * 0.03
        headRoll = Math.sin(t * 0.8) * 0.03
        headYaw = Math.sin(t * 0.35) * 0.04
      }

      const sleepBreath = Math.sin(t * 0.5) * 0.02
      const restPitch = -0.08
      const restYaw = 0.12
      const restRoll = 0.35 + sleepBreath
      const restOffsetY = -0.35
      const restOffsetX = -0.10

      // ── Head wag on pet/click ──
      const timeSincePet = (performance.now() / 1000) - petWagRef.current
      if (timeSincePet < 2.0 && timeSincePet >= 0) {
        const wagIntensity = 1 - timeSincePet / 2.0
        headYaw += Math.sin(timeSincePet * 14) * 0.18 * wagIntensity
        headPitch += Math.sin(timeSincePet * 8) * 0.06 * wagIntensity
      }

      headRef.current.rotation.z = headPitch * active + restPitch * rest
      headRef.current.rotation.y = headYaw * active + restYaw * rest
      headRef.current.rotation.x = headRoll * active + restRoll * rest
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
          jawOpen = 0.02
        } else if (cycleT < 2.0) {
          const biteP = (cycleT - 1.0) / 1.0
          jawOpen = Math.abs(Math.sin(biteP * Math.PI * 3)) * 0.06
        } else if (cycleT < 3.8) {
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

  // Slightly darker body variant for shading
  const bodyDark = new THREE.Color(breed.bodyColor).multiplyScalar(0.88).getStyle()
  const bodyLight = new THREE.Color(breed.bodyColor).multiplyScalar(1.06).getStyle()

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
          <sphereGeometry args={[0.27, 24, 20]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} metalness={0} />
        </mesh>
        {/* Front barrel (mid-body, stretched along X) */}
        <mesh ref={barrelRef} position={[0.05, 0.58, 0]} scale={[1.3, 1.0, 1.0]} castShadow>
          <sphereGeometry args={[0.33, 24, 20]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} metalness={0} />
        </mesh>
        {/* Rear barrel */}
        <mesh position={[-0.28, 0.57, 0]} scale={[1.3, 1.0, 1.0]} castShadow>
          <sphereGeometry args={[0.31, 24, 20]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} metalness={0} />
        </mesh>
        {/* Hip (rear) */}
        <mesh ref={hipRef} position={[-0.52, 0.54, 0]} castShadow>
          <sphereGeometry args={[0.27, 24, 20]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} metalness={0} />
        </mesh>

        {/* ═══ WITHERS HUMP (shoulder ridge — distinctive cattle feature) ═══ */}
        <mesh position={[0.22, 0.88, 0]} scale={[0.22, 0.10, 0.16]} rotation={[0, 0, 0.15]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.80} />
        </mesh>

        {/* ═══ SHOULDER BLADE definitions (subtle bumps) ═══ */}
        <mesh position={[0.28, 0.72, 0.18]} scale={[0.12, 0.08, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyLight} roughness={0.76} />
        </mesh>
        <mesh position={[0.28, 0.72, -0.18]} scale={[0.12, 0.08, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyLight} roughness={0.76} />
        </mesh>

        {/* ═══ HAUNCH / HIP BONES (rear muscle definition) ═══ */}
        <mesh position={[-0.48, 0.68, 0.16]} scale={[0.10, 0.08, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyLight} roughness={0.76} />
        </mesh>
        <mesh position={[-0.48, 0.68, -0.16]} scale={[0.10, 0.08, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyLight} roughness={0.76} />
        </mesh>

        {/* ═══ BELLY CONTOUR (underside rounding) ═══ */}
        <mesh position={[-0.08, 0.38, 0]} scale={[0.55, 0.12, 0.22]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={bodyDark} roughness={0.82} />
        </mesh>
        {/* Front brisket (chest underside) */}
        <mesh position={[0.30, 0.42, 0]} scale={[0.14, 0.10, 0.18]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={bodyDark} roughness={0.82} />
        </mesh>

        {/* ═══ RIBCAGE HINTS (subtle side contours) ═══ */}
        <mesh position={[0.12, 0.54, 0.28]} scale={[0.20, 0.12, 0.04]} rotation={[0, 0, 0.1]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyDark} roughness={0.80} />
        </mesh>
        <mesh position={[0.12, 0.54, -0.28]} scale={[0.20, 0.12, 0.04]} rotation={[0, 0, 0.1]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={bodyDark} roughness={0.80} />
        </mesh>

        {/* ═══ SPINE RIDGE (subtle, adds realism) ═══ */}
        <mesh position={[-0.08, 0.88, 0]} scale={[0.70, 0.04, 0.08]} rotation={[0, 0, 0.05]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
        </mesh>

        {/* ═══ SPOTS — breed-driven, projected onto body surface ═══ */}
        {breed.spots.map((spot, i) => {
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

        {/* ═══ NECK — thicker with muscle taper ═══ */}
        <mesh ref={neckRef} position={[0.48, 0.78, 0]} rotation={[0, 0, -0.45]} castShadow>
          <cylinderGeometry args={[0.13, 0.22, 0.30, 14]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
        </mesh>
        {/* Neck muscle bulge (front) */}
        <mesh position={[0.52, 0.72, 0]} scale={[0.08, 0.10, 0.14]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
        </mesh>

        {/* ═══ DEWLAP (throat skin fold — characteristic of cattle) ═══ */}
        <mesh position={[0.46, 0.56, 0]} scale={[0.12, 0.16, 0.07]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
        </mesh>
        {/* Dewlap lower fold */}
        <mesh position={[0.50, 0.50, 0]} scale={[0.06, 0.08, 0.05]}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
        </mesh>

        {/* ═══ BELL ═══ */}
        <group position={[0.50, 0.66, 0]}>
          {/* Collar strap */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.008, 6, 16]} />
            <meshStandardMaterial color="#5a3010" roughness={0.85} />
          </mesh>
          {/* Bell rope */}
          <mesh>
            <cylinderGeometry args={[0.005, 0.005, 0.10, 4]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Bell body */}
          <mesh position={[0, -0.06, 0]}>
            <sphereGeometry args={[0.038, 10, 8]} />
            <meshStandardMaterial color={BELL_COLOR} metalness={0.7} roughness={0.25} />
          </mesh>
          {/* Bell clapper */}
          <mesh position={[0, -0.085, 0]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshStandardMaterial color="#8a7020" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>

        {/* ═══ HEAD GROUP ═══ */}
        <group ref={headRef} position={[0.58, 0.92, 0]} scale={headRatio}>
          {/* Main head — slightly elongated forward */}
          <mesh castShadow scale={[1.15, 1.0, 0.95]}>
            <sphereGeometry args={[0.20, 20, 16]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>

          {/* Forehead / brow ridge — more defined */}
          <mesh position={[0.06, 0.10, 0]} scale={[0.8, 0.38, 0.92]}>
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>

          {/* Temporal / cheek bulges */}
          <mesh position={[0.02, 0.0, 0.14]} scale={[0.7, 0.6, 0.3]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>
          <mesh position={[0.02, 0.0, -0.14]} scale={[0.7, 0.6, 0.3]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>

          {/* Muzzle / snout — broad and flat */}
          <mesh position={[0.20, -0.08, 0]} scale={[0.9, 0.8, 1.1]}>
            <sphereGeometry args={[0.14, 14, 12]} />
            <meshStandardMaterial color={breed.muzzleColor} roughness={0.55} />
          </mesh>

          {/* Nose pad (darker, slightly raised) */}
          <mesh position={[0.32, -0.05, 0]} scale={[0.5, 0.6, 1.0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color="#555050" roughness={0.4} />
          </mesh>

          {/* Nostrils — more detailed */}
          <mesh position={[0.34, -0.06, 0.04]} scale={[0.7, 0.9, 1.0]}>
            <sphereGeometry args={[0.024, 8, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.34, -0.06, -0.04]} scale={[0.7, 0.9, 1.0]}>
            <sphereGeometry args={[0.024, 8, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Nostril rims */}
          <mesh position={[0.345, -0.058, 0.04]} scale={[0.5, 0.6, 0.8]}>
            <torusGeometry args={[0.018, 0.004, 6, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[0.345, -0.058, -0.04]} scale={[0.5, 0.6, 0.8]}>
            <torusGeometry args={[0.018, 0.004, 6, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>

          {/* Mouth line */}
          <mesh position={[0.28, -0.14, 0]} scale={[0.06, 0.006, 0.08]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#665050" />
          </mesh>

          {/* Chin */}
          <mesh position={[0.22, -0.18, 0]} scale={[0.6, 0.5, 0.8]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial color={breed.muzzleColor} roughness={0.6} />
          </mesh>

          {/* Lower jaw */}
          <mesh ref={jawRef} position={[0.20, -0.17, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.10]} />
            <meshStandardMaterial color={breed.muzzleColor} roughness={0.6} />
          </mesh>

          {/* ═══ EYES — more detailed with eyelids ═══ */}

          {/* Left eye */}
          <group position={[0.12, 0.04, 0.14]}>
            {/* Eye socket indent (dark ring) */}
            <mesh scale={[1.2, 1.2, 0.8]}>
              <sphereGeometry args={[0.036, 10, 8]} />
              <meshStandardMaterial color={bodyDark} roughness={0.8} />
            </mesh>
            {/* Sclera (whites) */}
            <mesh>
              <sphereGeometry args={[0.034, 10, 10]} />
              <meshStandardMaterial color="#f0f0e8" roughness={0.3} />
            </mesh>
            {/* Iris */}
            <mesh position={[0.018, 0, 0.01]}>
              <sphereGeometry args={[0.024, 9, 9]} />
              <meshStandardMaterial color={EYE_COLOR} roughness={0.2} />
            </mesh>
            {/* Pupil */}
            <mesh position={[0.026, 0, 0.014]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshStandardMaterial color="#000000" roughness={0.1} />
            </mesh>
            {/* Eye highlight */}
            <mesh position={[0.028, 0.008, 0.016]}>
              <sphereGeometry args={[0.006, 6, 6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
            </mesh>
            {/* Upper eyelid */}
            <mesh position={[0.01, 0.025, 0.005]} rotation={[0, 0, -0.2]} scale={[1.0, 0.4, 1.1]}>
              <sphereGeometry args={[0.032, 8, 6]} />
              <meshStandardMaterial color={breed.bodyColor} roughness={0.8} />
            </mesh>
            {/* Lower eyelid */}
            <mesh position={[0.01, -0.022, 0.005]} rotation={[0, 0, 0.15]} scale={[0.9, 0.3, 1.0]}>
              <sphereGeometry args={[0.030, 8, 6]} />
              <meshStandardMaterial color={breed.bodyColor} roughness={0.8} />
            </mesh>
          </group>

          {/* Right eye */}
          <group position={[0.12, 0.04, -0.14]}>
            <mesh scale={[1.2, 1.2, 0.8]}>
              <sphereGeometry args={[0.036, 10, 8]} />
              <meshStandardMaterial color={bodyDark} roughness={0.8} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.034, 10, 10]} />
              <meshStandardMaterial color="#f0f0e8" roughness={0.3} />
            </mesh>
            <mesh position={[0.018, 0, -0.01]}>
              <sphereGeometry args={[0.024, 9, 9]} />
              <meshStandardMaterial color={EYE_COLOR} roughness={0.2} />
            </mesh>
            <mesh position={[0.026, 0, -0.014]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshStandardMaterial color="#000000" roughness={0.1} />
            </mesh>
            <mesh position={[0.028, 0.008, -0.016]}>
              <sphereGeometry args={[0.006, 6, 6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0.01, 0.025, -0.005]} rotation={[0, 0, -0.2]} scale={[1.0, 0.4, 1.1]}>
              <sphereGeometry args={[0.032, 8, 6]} />
              <meshStandardMaterial color={breed.bodyColor} roughness={0.8} />
            </mesh>
            <mesh position={[0.01, -0.022, -0.005]} rotation={[0, 0, 0.15]} scale={[0.9, 0.3, 1.0]}>
              <sphereGeometry args={[0.030, 8, 6]} />
              <meshStandardMaterial color={breed.bodyColor} roughness={0.8} />
            </mesh>
          </group>

          {/* Ears — wide, horizontal, leaf-shaped */}
          <mesh ref={earLeftRef} position={[-0.08, 0.10, 0.18]} rotation={[0.3, 0.15, 0.5]} scale={[1.3 * breed.earScale, 0.45 * breed.earScale, 1.2 * breed.earScale]}>
            <coneGeometry args={[0.10, 0.22, 6]} />
            <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
          </mesh>
          {/* Inner ear (pink) */}
          <mesh position={[-0.06, 0.10, 0.19]} rotation={[0.3, 0.15, 0.5]} scale={[0.8 * breed.earScale, 0.3 * breed.earScale, 0.8 * breed.earScale]}>
            <coneGeometry args={[0.08, 0.16, 5]} />
            <meshStandardMaterial color="#daa0a0" roughness={0.6} />
          </mesh>
          <mesh ref={earRightRef} position={[-0.08, 0.10, -0.18]} rotation={[-0.3, -0.15, 0.5]} scale={[1.3 * breed.earScale, 0.45 * breed.earScale, 1.2 * breed.earScale]}>
            <coneGeometry args={[0.10, 0.22, 6]} />
            <meshStandardMaterial color={breed.skinColor} roughness={0.65} />
          </mesh>
          <mesh position={[-0.06, 0.10, -0.19]} rotation={[-0.3, -0.15, 0.5]} scale={[0.8 * breed.earScale, 0.3 * breed.earScale, 0.8 * breed.earScale]}>
            <coneGeometry args={[0.08, 0.16, 5]} />
            <meshStandardMaterial color="#daa0a0" roughness={0.6} />
          </mesh>

          {/* Horns — breed-scaled, hidden on calves */}
          {hornGrowth > 0.01 && (
            <>
              {/* Horn base rings */}
              <mesh position={[-0.04, 0.17, breed.hornSpread]} rotation={[0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <torusGeometry args={[0.032 * breed.hornLength, 0.006, 6, 8]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.5} metalness={0.1} />
              </mesh>
              <mesh position={[-0.04, 0.18, breed.hornSpread]} rotation={[0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <coneGeometry args={[0.03 * breed.hornLength, 0.20 * breed.hornLength, 8]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.50} metalness={0.08} />
              </mesh>
              {/* Horn tip (lighter) */}
              <mesh position={[-0.04, 0.28 * hornGrowth, breed.hornSpread * 1.1]} rotation={[0.3, 0, breed.hornCurve]} scale={hornGrowth * 0.5}>
                <sphereGeometry args={[0.015 * breed.hornLength, 6, 5]} />
                <meshStandardMaterial color="#e8e0d0" roughness={0.45} metalness={0.1} />
              </mesh>
              <mesh position={[-0.04, 0.17, -breed.hornSpread]} rotation={[-0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <torusGeometry args={[0.032 * breed.hornLength, 0.006, 6, 8]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.5} metalness={0.1} />
              </mesh>
              <mesh position={[-0.04, 0.18, -breed.hornSpread]} rotation={[-0.3, 0, breed.hornCurve]} scale={hornGrowth}>
                <coneGeometry args={[0.03 * breed.hornLength, 0.20 * breed.hornLength, 8]} />
                <meshStandardMaterial color={breed.hornColor} roughness={0.50} metalness={0.08} />
              </mesh>
              <mesh position={[-0.04, 0.28 * hornGrowth, -breed.hornSpread * 1.1]} rotation={[-0.3, 0, breed.hornCurve]} scale={hornGrowth * 0.5}>
                <sphereGeometry args={[0.015 * breed.hornLength, 6, 5]} />
                <meshStandardMaterial color="#e8e0d0" roughness={0.45} metalness={0.1} />
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

        {/* ═══ LEGS — with fetlock joints and cloven hooves ═══ */}

        {/* Front-left leg */}
        <group ref={legFLRef} position={[0.30, 0.36, 0.15]}>
          {/* Upper leg (thigh) */}
          <mesh position={[0, -0.04 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.058, 0.050, 0.20 * legScale, 14]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          {/* Knee joint */}
          <mesh position={[0, -0.16 * legScale, 0]}>
            <sphereGeometry args={[0.052, 8, 8]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          {/* Lower leg (cannon) */}
          <mesh position={[0, -0.30 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.036, 0.22 * legScale, 14]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          {/* Fetlock joint */}
          <mesh position={[0, -0.42 * legScale, 0]}>
            <sphereGeometry args={[0.038, 6, 6]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          {/* Cloven hoof — two parts */}
          <mesh position={[0.008, -0.46 * legScale, 0.016]}>
            <boxGeometry args={[0.038, 0.05, 0.032]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, -0.016]}>
            <boxGeometry args={[0.038, 0.05, 0.032]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Front-right leg */}
        <group ref={legFRRef} position={[0.30, 0.36, -0.15]}>
          <mesh position={[0, -0.04 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.058, 0.050, 0.20 * legScale, 14]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.16 * legScale, 0]}>
            <sphereGeometry args={[0.052, 8, 8]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.30 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.036, 0.22 * legScale, 14]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.42 * legScale, 0]}>
            <sphereGeometry args={[0.038, 6, 6]} />
            <meshStandardMaterial color={breed.legFrontColor} roughness={0.78} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, 0.016]}>
            <boxGeometry args={[0.038, 0.05, 0.032]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, -0.016]}>
            <boxGeometry args={[0.038, 0.05, 0.032]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Back-left leg */}
        <group ref={legBLRef} position={[-0.48, 0.36, 0.15]}>
          <mesh position={[0, -0.04 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.064, 0.052, 0.20 * legScale, 14]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.16 * legScale, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.30 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.044, 0.038, 0.22 * legScale, 14]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.42 * legScale, 0]}>
            <sphereGeometry args={[0.040, 6, 6]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, 0.016]}>
            <boxGeometry args={[0.040, 0.05, 0.034]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, -0.016]}>
            <boxGeometry args={[0.040, 0.05, 0.034]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* Back-right leg */}
        <group ref={legBRRef} position={[-0.48, 0.36, -0.15]}>
          <mesh position={[0, -0.04 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.064, 0.052, 0.20 * legScale, 14]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.16 * legScale, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.30 * legScale, 0]} castShadow>
            <cylinderGeometry args={[0.044, 0.038, 0.22 * legScale, 14]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.42 * legScale, 0]}>
            <sphereGeometry args={[0.040, 6, 6]} />
            <meshStandardMaterial color={breed.legBackColor} roughness={0.78} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, 0.016]}>
            <boxGeometry args={[0.040, 0.05, 0.034]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0.008, -0.46 * legScale, -0.016]}>
            <boxGeometry args={[0.040, 0.05, 0.034]} />
            <meshStandardMaterial color={breed.hoofColor} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>

        {/* ═══ TAIL — multi-segment with tuft ═══ */}
        <group ref={tailRef} position={[-0.66, 0.62, 0]}>
          {/* Tail root (thicker) */}
          <mesh rotation={[0, 0, -0.4]} castShadow>
            <cylinderGeometry args={[0.024, 0.018, 0.18, 6]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>
          {/* Mid tail */}
          <mesh position={[-0.06, -0.16, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.016, 0.012, 0.20, 6]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>
          {/* Lower tail */}
          <mesh position={[-0.10, -0.32, 0]} rotation={[0, 0, -0.15]}>
            <cylinderGeometry args={[0.010, 0.007, 0.18, 5]} />
            <meshStandardMaterial color={breed.bodyColor} roughness={0.78} />
          </mesh>
          {/* Tail tuft — multi-strand */}
          <mesh position={[-0.12, -0.42, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color={breed.spotColor} roughness={0.85} />
          </mesh>
          <mesh position={[-0.11, -0.40, 0.015]} scale={[1.4, 0.5, 0.9]}>
            <sphereGeometry args={[0.025, 6, 5]} />
            <meshStandardMaterial color={breed.spotColor} roughness={0.85} />
          </mesh>
          <mesh position={[-0.13, -0.40, -0.015]} scale={[1.4, 0.5, 0.9]}>
            <sphereGeometry args={[0.025, 6, 5]} />
            <meshStandardMaterial color={breed.spotColor} roughness={0.85} />
          </mesh>
          <mesh position={[-0.12, -0.44, 0]} scale={[1.0, 0.6, 0.7]}>
            <sphereGeometry args={[0.022, 5, 5]} />
            <meshStandardMaterial color={breed.spotColor} roughness={0.85} />
          </mesh>
        </group>

        {/* ═══ UDDER — more anatomically detailed ═══ */}
        {udderSize > 0.05 && (
          <>
            {/* Main udder body */}
            <mesh position={[-0.36, 0.22, 0]} scale={[udderSize * 1.1, udderSize, udderSize]}>
              <sphereGeometry args={[0.10, 12, 10]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.55} />
            </mesh>
            {/* Udder quarters (4 visible lobes) */}
            <mesh position={[-0.33, 0.20, 0.04]} scale={[udderSize * 0.7, udderSize * 0.6, udderSize * 0.7]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.55} />
            </mesh>
            <mesh position={[-0.33, 0.20, -0.04]} scale={[udderSize * 0.7, udderSize * 0.6, udderSize * 0.7]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.55} />
            </mesh>
            <mesh position={[-0.39, 0.20, 0.04]} scale={[udderSize * 0.7, udderSize * 0.6, udderSize * 0.7]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.55} />
            </mesh>
            <mesh position={[-0.39, 0.20, -0.04]} scale={[udderSize * 0.7, udderSize * 0.6, udderSize * 0.7]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.55} />
            </mesh>
            {/* Teats (4) */}
            <mesh position={[-0.34, 0.16, 0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.012, 0.008, 0.05, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.5} />
            </mesh>
            <mesh position={[-0.34, 0.16, -0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.012, 0.008, 0.05, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.5} />
            </mesh>
            <mesh position={[-0.40, 0.16, 0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.012, 0.008, 0.05, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.5} />
            </mesh>
            <mesh position={[-0.40, 0.16, -0.035]} scale={[udderSize, udderSize, udderSize]}>
              <cylinderGeometry args={[0.012, 0.008, 0.05, 6]} />
              <meshStandardMaterial color={breed.udderColor} roughness={0.5} />
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
  // No cow.glb available — use the procedural cow directly
  return <CowPlaceholder behavior={behavior} breed={breed} age={age} />
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
