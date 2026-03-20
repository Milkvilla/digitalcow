import { createStore } from 'zustand/vanilla'
import type {
  GameStore,
  CowState,
  WorldState,
  EngineEvent,
  PlayerAction,
  FirstPersonIntent,
  Vec3,
} from './types'
import {
  EXCLUSION_ZONES,
  SCENE_LAYOUT,
  WALK_SPEED,
  RUN_SPEED,
  ARRIVAL_THRESHOLD,
  MIN_DECISION_INTERVAL,
  MAX_DECISION_INTERVAL,
  HUNGER_CRITICAL,
  ENERGY_CRITICAL,
  JUMP_DURATION,
  HOME_ANCHOR,
  HOME_RADIUS,
  SETTLE_DURATION,
  DRINK_DURATION,
  GRAZE_PATCH_DURATION,
  BARN_ENTRANCE,
} from './constants'
import { updateTime } from './time'
import { decayNeeds, applyActivityEffects } from './needs'
import { distanceXZ, sampleRoamTarget, findNearestFood, foodStopPosition } from './world-query'
import {
  scoreActivities,
  buildActivity,
  behaviorFromActivity,
  pickHighestWithNoise,
} from './behaviors'
import { handlePlayerAction } from './actions'

// ── Initial State ─────────────────────────────────────────

function createInitialCow(): CowState {
  return {
    needs: {
      hunger: 20,
      energy: 80,
      happiness: 60,
    },
    personality: {
      trust: 30,
      curiosity: 50,
    },
    behavior: 'idle',
    activity: { type: 'idle' },
    activityStartedAt: 0,
    nextDecisionAt: 0,
    position: [...SCENE_LAYOUT.cowSpawn.position] as Vec3,
    facingAngle: 0,
    breed: 'holstein',
    age: 1.0,
  }
}

function createInitialWorld(): WorldState {
  return {
    timeOfDay: 8,
    timeSpeed: 1,
    simulationTime: 0,
    isPaused: false,
    windStrength: 0.3,
    windDirection: 0,
    foods: [],
    exclusionZones: [...EXCLUSION_ZONES],
    showButterflies: false,
    season: 1, // default summer
  }
}

// ── Store ─────────────────────────────────────────────────

// Track whether each critical need has already fired its event (edge-triggered)
let hungerWasCritical = false
let energyWasCritical = false

export const gameStore = createStore<GameStore>()((set, get) => ({
  cow: createInitialCow(),
  world: createInitialWorld(),
  events: [] as EngineEvent[],
  cameraMode: 'cinematic' as const,
  rain: false,
  rainIntensity: 0.5,
  firstPersonIntent: null as FirstPersonIntent | null,

  tick(dt: number) {
    const state = get()
    if (state.world.isPaused) return

    const cow = { ...state.cow, needs: { ...state.cow.needs }, personality: { ...state.cow.personality } }
    const world = {
      ...state.world,
      foods: state.world.foods.map((f) => ({ ...f })),
    }
    const events: EngineEvent[] = [...state.events]

    // 1. Advance time
    world.timeOfDay = updateTime(world.timeOfDay, dt)
    world.simulationTime += dt

    // Wind variation — slow random walk
    world.windStrength += (Math.random() - 0.5) * 0.002
    world.windStrength = Math.max(0.1, Math.min(0.6, world.windStrength))

    // 2. Decay needs
    decayNeeds(cow.needs, dt)

    // 3. Apply activity effects
    applyActivityEffects(cow, dt, world)

    // 4. Apply first-person input (inside the engine, not from the render loop)
    const fpIntent = state.firstPersonIntent
    if (state.cameraMode === 'firstPerson' && fpIntent) {
      applyFirstPersonMovement(cow, fpIntent, dt, world)
    }

    // 5. Move cow towards destination (AI movement — skipped when player is driving)
    if (!(state.cameraMode === 'firstPerson' && fpIntent && (fpIntent.forward !== 0 || fpIntent.turn !== 0))) {
      moveCow(cow, dt, world, events)
    }

    // 6. Check activity completion
    checkActivityCompletion(cow, world, events)

    // 7. Re-evaluate behavior if decision time elapsed or activity completed
    const needsDecision =
      world.simulationTime >= cow.nextDecisionAt ||
      cow.activity.type === 'idle'

    if (needsDecision) {
      reevaluateBehavior(cow, world, events)
    }

    // 8. Clean up consumed foods
    world.foods = world.foods.filter((f) => f.amount > 0)

    // 9. Check critical needs — edge-triggered (fire once on entry)
    const hungerIsCritical = cow.needs.hunger >= HUNGER_CRITICAL
    const energyIsCritical = cow.needs.energy <= ENERGY_CRITICAL

    if (hungerIsCritical && !hungerWasCritical) {
      events.push({ type: 'need_critical', need: 'hunger', value: cow.needs.hunger })
    }
    if (energyIsCritical && !energyWasCritical) {
      events.push({ type: 'need_critical', need: 'energy', value: cow.needs.energy })
    }
    hungerWasCritical = hungerIsCritical
    energyWasCritical = energyIsCritical

    set({ cow, world, events })
  },

  playerAction(action: PlayerAction) {
    const state = get()
    const cow = { ...state.cow, needs: { ...state.cow.needs }, personality: { ...state.cow.personality } }
    const world = {
      ...state.world,
      foods: [...state.world.foods],
    }
    const events = [...state.events]

    handlePlayerAction(action, cow, world, events)

    set({ cow, world, events })
  },

  setFirstPersonIntent(intent: FirstPersonIntent | null) {
    set({ firstPersonIntent: intent })
  },

  setTimeOfDay(time: number) {
    // Clamp to [0, 24) — avoids jump-back when slider hits 24
    set((s) => ({ world: { ...s.world, timeOfDay: Math.max(0, Math.min(23.999, time)) } }))
  },

  setTimeSpeed(speed: number) {
    set((s) => ({ world: { ...s.world, timeSpeed: speed } }))
  },

  togglePause() {
    set((s) => ({ world: { ...s.world, isPaused: !s.world.isPaused } }))
  },

  toggleButterflies() {
    set((s) => ({ world: { ...s.world, showButterflies: !s.world.showButterflies } }))
  },

  setCameraMode(mode) {
    set({ cameraMode: mode })
  },

  toggleRain() {
    set((s) => ({ rain: !s.rain }))
  },

  setRainIntensity(intensity: number) {
    set({ rainIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  setBreed(breed) {
    set((s) => ({ cow: { ...s.cow, breed } }))
  },

  setAge(age) {
    set((s) => ({ cow: { ...s.cow, age: Math.max(0, Math.min(1, age)) } }))
  },

  setSeason(season: number) {
    set((s) => ({ world: { ...s.world, season: season % 4 } }))
  },

  flushEvents() {
    set({ events: [] })
  },
}))

// ── Movement ──────────────────────────────────────────────

// ── First-person movement (consumed inside tick) ─────────

const FP_WALK_SPEED = 2.0
const FP_RUN_SPEED = 4.5
const FP_TURN_SPEED = 2.2
const FP_BOUNDS = { minX: -13, maxX: 13, minZ: -11, maxZ: 13 }

function applyFirstPersonMovement(
  cow: CowState,
  intent: FirstPersonIntent,
  dt: number,
  world: WorldState,
): void {
  let angle = cow.facingAngle
  let cx = cow.position[0]
  let cz = cow.position[2]

  const speed = intent.sprint ? FP_RUN_SPEED : FP_WALK_SPEED
  angle += intent.turn * FP_TURN_SPEED * dt
  cx += Math.sin(angle) * intent.forward * speed * dt
  cz += Math.cos(angle) * intent.forward * speed * dt

  // Boundaries
  cx = Math.max(FP_BOUNDS.minX, Math.min(FP_BOUNDS.maxX, cx))
  cz = Math.max(FP_BOUNDS.minZ, Math.min(FP_BOUNDS.maxZ, cz))

  // Push out of exclusion zones
  for (const zone of world.exclusionZones) {
    const zdx = cx - zone.center[0]
    const zdz = cz - zone.center[1]
    const zDist = Math.sqrt(zdx * zdx + zdz * zdz)
    if (zDist < zone.radius && zDist > 0.01) {
      cx = zone.center[0] + (zdx / zDist) * zone.radius
      cz = zone.center[1] + (zdz / zDist) * zone.radius
    }
  }

  cow.position = [cx, 0, cz]
  cow.facingAngle = angle
}

// ── AI Movement ──────────────────────────────────────────

function moveCow(cow: CowState, dt: number, world: WorldState, _events: EngineEvent[]): void {
  const activity = cow.activity

  let destination: Vec3 | null = null
  if (activity.type === 'wander') {
    destination = activity.destination
  } else if (activity.type === 'go_to_food') {
    destination = activity.destination
  } else if (activity.type === 'go_home') {
    // Route through barn entrance first, then to HOME_ANCHOR (one-way latch)
    if (activity.reachedEntrance) {
      destination = HOME_ANCHOR
    } else {
      const entranceDist = distanceXZ(cow.position, BARN_ENTRANCE)
      if (entranceDist < 2.0) {
        activity.reachedEntrance = true
        destination = HOME_ANCHOR
      } else {
        destination = BARN_ENTRANCE
      }
    }
  } else if (activity.type === 'react_to_player' && activity.destination) {
    destination = activity.destination
  } else if (activity.type === 'go_to_pond') {
    destination = activity.destination
  } else if (activity.type === 'go_to_grass') {
    destination = activity.destination
  } else if (activity.type === 'go_to_milk') {
    destination = activity.destination
  } else if (activity.type === 'leave_barn') {
    destination = BARN_ENTRANCE
  }

  if (!destination) return

  const dist = distanceXZ(cow.position, destination)
  if (dist < ARRIVAL_THRESHOLD) return

  // Purposeful activities (going to food, pond, grass, milk, home) use full walk speed.
  // Idle wandering uses half speed for a more natural amble.
  const purposeful = activity.type === 'go_to_food' || activity.type === 'go_to_pond'
    || activity.type === 'go_to_grass' || activity.type === 'go_to_milk'
    || activity.type === 'go_home' || activity.type === 'leave_barn'
    || activity.type === 'react_to_player'
  const speed = cow.behavior === 'running' ? RUN_SPEED : purposeful ? WALK_SPEED : WALK_SPEED * 0.5
  const step = Math.min(speed * dt, dist)

  const dx = destination[0] - cow.position[0]
  const dz = destination[2] - cow.position[2]

  let newX = cow.position[0] + (dx / dist) * step
  let newZ = cow.position[2] + (dz / dist) * step

  // Push cow out of exclusion zones (except when going home/leaving barn)
  if (activity.type !== 'go_home' && activity.type !== 'settle_for_sleep' && activity.type !== 'leave_barn') {
    for (const zone of world.exclusionZones) {
      const zdx = newX - zone.center[0]
      const zdz = newZ - zone.center[1]
      const zDist = Math.sqrt(zdx * zdx + zdz * zdz)
      if (zDist < zone.radius && zDist > 0.01) {
        newX = zone.center[0] + (zdx / zDist) * zone.radius
        newZ = zone.center[1] + (zdz / zDist) * zone.radius
      }
    }
  }

  // Derive facing from actual displacement (after collision correction)
  const actualDx = newX - cow.position[0]
  const actualDz = newZ - cow.position[2]
  const actualDist = Math.sqrt(actualDx * actualDx + actualDz * actualDz)
  if (actualDist > 0.001) {
    cow.facingAngle = Math.atan2(actualDx, actualDz)
  }

  cow.position = [newX, 0, newZ]
}

// ── Activity Completion ───────────────────────────────────

function checkActivityCompletion(
  cow: CowState,
  world: WorldState,
  events: EngineEvent[],
): void {
  const activity = cow.activity

  if (activity.type === 'go_to_food') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      events.push({ type: 'arrived_at_target' })

      const oldBehavior = cow.behavior
      cow.activity = { type: 'eat_food', targetId: activity.targetId }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'eating'
      cow.nextDecisionAt =
        world.simulationTime +
        MIN_DECISION_INTERVAL +
        Math.random() * (MAX_DECISION_INTERVAL - MIN_DECISION_INTERVAL)

      if (oldBehavior !== 'eating') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'eating' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'wander') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      events.push({ type: 'arrived_at_target' })
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'react_to_player' && activity.destination) {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      if (activity.action === 'play') {
        // Pick a new target to keep running
        const newTarget = sampleRoamTarget(world)
        cow.activity = { ...activity, destination: newTarget }
      } else {
        // Call completed — go idle
        cow.activity = { type: 'idle' }
        const oldBehavior = cow.behavior
        cow.behavior = 'idle'
        if (oldBehavior !== 'idle') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
        }
      }
    }
  } else if (activity.type === 'eat_food') {
    const food = world.foods.find((f) => f.id === activity.targetId)
    if (!food || food.amount <= 0) {
      events.push({ type: 'food_consumed', foodId: activity.targetId })

      // Check for more food nearby — chain to next food
      const nextFood = findNearestFood(cow.position, world.foods.filter((f) => f.id !== activity.targetId))
      if (nextFood) {
        cow.activity = {
          type: 'go_to_food',
          targetId: nextFood.id,
          destination: foodStopPosition(cow.position, nextFood.position),
        }
        cow.activityStartedAt = world.simulationTime
        const oldBehavior = cow.behavior
        cow.behavior = 'walking'
        if (oldBehavior !== 'walking') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
        }
        events.push({ type: 'activity_changed', activity: cow.activity })
      } else {
        cow.activity = { type: 'idle' }
        const oldBehavior = cow.behavior
        cow.behavior = 'idle'
        if (oldBehavior !== 'idle') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
        }
      }
    }
  } else if (activity.type === 'go_home') {
    const dist = distanceXZ(cow.position, HOME_ANCHOR)
    if (dist < HOME_RADIUS) {
      events.push({ type: 'cow_went_home' })

      const oldBehavior = cow.behavior
      cow.activity = { type: 'settle_for_sleep' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'settling'
      cow.nextDecisionAt = world.simulationTime + SETTLE_DURATION + 1

      // Don't snap facingAngle — let the visual rotation interpolate smoothly in Cow.tsx

      if (oldBehavior !== 'settling') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'settling' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'settle_for_sleep') {
    const elapsed = world.simulationTime - cow.activityStartedAt
    if (elapsed >= SETTLE_DURATION) {
      events.push({ type: 'cow_settled' })

      const oldBehavior = cow.behavior
      cow.activity = { type: 'sleep' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'sleeping'
      cow.nextDecisionAt =
        world.simulationTime +
        MIN_DECISION_INTERVAL +
        Math.random() * (MAX_DECISION_INTERVAL - MIN_DECISION_INTERVAL)

      if (oldBehavior !== 'sleeping') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'sleeping' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'jump') {
    const elapsed = world.simulationTime - cow.activityStartedAt
    if (elapsed >= JUMP_DURATION) {
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'go_to_pond') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      events.push({ type: 'arrived_at_target' })
      events.push({ type: 'cow_drinking' })

      const oldBehavior = cow.behavior
      cow.activity = { type: 'drink' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'drinking'
      cow.nextDecisionAt = world.simulationTime + DRINK_DURATION + 1

      // Face the pond center
      const pondPos = SCENE_LAYOUT.pond.position
      const dx = pondPos[0] - cow.position[0]
      const dz = pondPos[2] - cow.position[2]
      cow.facingAngle = Math.atan2(dx, dz)

      if (oldBehavior !== 'drinking') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'drinking' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'drink') {
    const elapsed = world.simulationTime - cow.activityStartedAt
    if (elapsed >= DRINK_DURATION) {
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'go_to_grass') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      events.push({ type: 'arrived_at_target' })
      events.push({ type: 'cow_grazing_patch' })

      const oldBehavior = cow.behavior
      cow.activity = { type: 'graze_patch' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'grazing'
      cow.nextDecisionAt = world.simulationTime + GRAZE_PATCH_DURATION + 1

      if (oldBehavior !== 'grazing') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'grazing' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'graze_patch') {
    const elapsed = world.simulationTime - cow.activityStartedAt
    if (elapsed >= GRAZE_PATCH_DURATION) {
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'leave_barn') {
    const dist = distanceXZ(cow.position, BARN_ENTRANCE)
    if (dist < ARRIVAL_THRESHOLD) {
      // Cow has walked out of the barn — go idle for next decision
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'go_to_milk') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      const oldBehavior = cow.behavior
      cow.activity = { type: 'milking' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'idle'
      cow.nextDecisionAt = world.simulationTime + 12

      events.push({ type: 'cow_milked' })
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  } else if (activity.type === 'milking') {
    const elapsed = world.simulationTime - cow.activityStartedAt
    if (elapsed >= 10) {
      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      cow.needs.happiness = Math.max(0, cow.needs.happiness - 5)
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  }
}

// ── Behavior Reevaluation ─────────────────────────────────

function reevaluateBehavior(
  cow: CowState,
  world: WorldState,
  events: EngineEvent[],
): void {
  // If cow is inside the barn and not choosing to stay (sleep/rest/go_home),
  // it must walk out through the entrance first
  const distFromHome = distanceXZ(cow.position, HOME_ANCHOR)
  const wasInsideBarn = distFromHome < HOME_RADIUS + 2.0

  const scores = scoreActivities(cow, world)
  const chosen = pickHighestWithNoise(scores, undefined, cow.activity.type)
  const newActivity = buildActivity(chosen, cow, world)

  // Intercept: if cow is in/near barn and new activity goes elsewhere, leave barn first
  const staysInBarn = newActivity.type === 'sleep' || newActivity.type === 'rest'
    || newActivity.type === 'go_home' || newActivity.type === 'settle_for_sleep'
  if (wasInsideBarn && !staysInBarn) {
    const oldBehavior = cow.behavior
    cow.activity = { type: 'leave_barn' }
    cow.activityStartedAt = world.simulationTime
    cow.behavior = 'walking'
    cow.nextDecisionAt = world.simulationTime + 15

    if (oldBehavior !== 'walking') {
      events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
    }
    events.push({ type: 'activity_changed', activity: cow.activity })
    return
  }

  const newBehavior = behaviorFromActivity(newActivity)
  const oldBehavior = cow.behavior

  cow.activity = newActivity
  cow.activityStartedAt = world.simulationTime
  cow.behavior = newBehavior
  cow.nextDecisionAt =
    world.simulationTime +
    MIN_DECISION_INTERVAL +
    Math.random() * (MAX_DECISION_INTERVAL - MIN_DECISION_INTERVAL)

  if (oldBehavior !== newBehavior) {
    events.push({ type: 'behavior_changed', from: oldBehavior, to: newBehavior })
  }
  events.push({ type: 'activity_changed', activity: newActivity })
}
