import { createStore } from 'zustand/vanilla'
import type {
  GameStore,
  CowState,
  WorldState,
  EngineEvent,
  PlayerAction,
  FirstPersonIntent,
  Vec3,
  TaskState,
  MilkStats,
  RelationshipTier,
  CowCondition,
  CameraMode,
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
  THIRST_CRITICAL,
  HEALTH_CRITICAL,
  JUMP_DURATION,
  HOME_ANCHOR,
  HOME_RADIUS,
  SETTLE_DURATION,
  DRINK_DURATION,
  GRAZE_PATCH_DURATION,
  BARN_ENTRANCE,
  HEALTH_LOW_SPEED_PENALTY,
  MUD_SPEED_PENALTY,
  MILK_DRAIN_PER_MILKING,
  MILK_MAX_STORAGE,
  AGE_PER_SIM_DAY,
  AGE_NUTRITION_BONUS,
  DEFAULT_GATES,
  AUTOSAVE_INTERVAL,
} from './constants'
import { updateTime } from './time'
import {
  decayNeeds,
  applyActivityEffects,
  updateHealth,
  updateMilkProduction,
  deriveConditions,
  progressAge,
} from './needs'
import { distanceXZ, sampleRoamTarget, findNearestFood, foodStopPosition } from './world-query'
import {
  scoreActivities,
  buildActivity,
  behaviorFromActivity,
  pickHighestWithNoise,
  getRelationshipTier,
} from './behaviors'
import { handlePlayerAction } from './actions'
import {
  loadGame,
  saveGame,
  computeOfflineDecay,
  createDefaultTasks,
  startAutosave,
} from './persistence'

// ── Initial State ─────────────────────────────────────────

function createInitialCow(): CowState {
  return {
    needs: {
      hunger: 20,
      energy: 80,
      happiness: 60,
      thirst: 15,
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
    health: 100,
    milkStorage: 0,
    lastMilkedAt: 0,
    conditions: ['healthy'],
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
    dayCount: 0,
    lastDayChangeHour: 8,
    gates: DEFAULT_GATES.map((g) => ({ ...g, position: [...g.position] as Vec3 })),
  }
}

function createInitialMilkStats(): MilkStats {
  return {
    totalProduced: 0,
    todayProduced: 0,
    lastProductionDay: 0,
  }
}

// ── Load saved game ──────────────────────────────────────

function loadInitialState(): {
  cow: CowState
  world: WorldState
  tasks: TaskState
  milkStats: MilkStats
  rain: boolean
  rainIntensity: number
} {
  const saved = loadGame()
  if (saved) {
    // Apply offline time decay
    computeOfflineDecay(saved.savedAt, saved.cow)
    return {
      cow: saved.cow,
      world: saved.world,
      tasks: saved.tasks,
      milkStats: saved.milkStats,
      rain: saved.rain,
      rainIntensity: saved.rainIntensity,
    }
  }
  return {
    cow: createInitialCow(),
    world: createInitialWorld(),
    tasks: createDefaultTasks(),
    milkStats: createInitialMilkStats(),
    rain: false,
    rainIntensity: 0.5,
  }
}

// ── Store ─────────────────────────────────────────────────

// Track whether each critical need has already fired its event (edge-triggered)
let hungerWasCritical = false
let energyWasCritical = false
let thirstWasCritical = false
let healthWasCritical = false
let wanderCount = 0

const initial = loadInitialState()

export const gameStore = createStore<GameStore>()((set, get) => {
  // Start autosave
  setTimeout(() => {
    startAutosave(() => {
      const s = get()
      return {
        cow: s.cow,
        world: s.world,
        tasks: s.tasks,
        milkStats: s.milkStats,
        rain: s.rain,
        rainIntensity: s.rainIntensity,
      }
    }, AUTOSAVE_INTERVAL)
  }, 1000)

  return {
    cow: initial.cow,
    world: initial.world,
    events: [] as EngineEvent[],
    cameraMode: 'cinematic' as const,
    cinematicView: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cinema') === 'true',
    _prevCameraMode: 'cinematic' as CameraMode,
    rain: initial.rain,
    rainIntensity: initial.rainIntensity,
    firstPersonIntent: null as FirstPersonIntent | null,
    tasks: initial.tasks,
    milkStats: initial.milkStats,

    tick(dt: number) {
      const state = get()
      if (state.world.isPaused) return

      const cow = {
        ...state.cow,
        needs: { ...state.cow.needs },
        personality: { ...state.cow.personality },
        conditions: [...state.cow.conditions],
      }
      const world = {
        ...state.world,
        foods: state.world.foods.map((f) => ({ ...f })),
        gates: state.world.gates.map((g) => ({ ...g, position: [...g.position] as Vec3 })),
      }
      const events: EngineEvent[] = [...state.events]
      const tasks = {
        ...state.tasks,
        dailyTasks: state.tasks.dailyTasks.map((t) => ({ ...t })),
        achievements: state.tasks.achievements.map((a) => ({ ...a })),
      }
      const milkStats = { ...state.milkStats }

      // 1. Advance time
      const prevHour = world.timeOfDay
      world.timeOfDay = updateTime(world.timeOfDay, dt)
      world.simulationTime += dt

      // Day transition detection (crossing midnight)
      const crossed6AM = prevHour < 6 && world.timeOfDay >= 6
      const crossedMidnight = prevHour > 22 && world.timeOfDay < 2
      if (crossed6AM || crossedMidnight) {
        world.dayCount++
        events.push({ type: 'day_passed', dayCount: world.dayCount })

        // Age progression
        progressAge(cow, AGE_PER_SIM_DAY, AGE_NUTRITION_BONUS)

        // Check growth achievement
        if (cow.age >= 1.0) {
          const growAch = tasks.achievements.find((a) => a.id === 'grow_up')
          if (growAch && !growAch.unlocked) {
            growAch.unlocked = true
            events.push({ type: 'achievement_unlocked', id: 'grow_up' })
          }
        }

        // Reset daily tasks
        if (world.dayCount > tasks.dailyTaskResetDay) {
          tasks.dailyTaskResetDay = world.dayCount
          for (const task of tasks.dailyTasks) {
            task.completed = false
          }
        }

        // Track consecutive milk days
        if (milkStats.todayProduced > 0) {
          milkStats.lastProductionDay = world.dayCount
          tasks.consecutiveMilkDays++
          if (tasks.consecutiveMilkDays >= 3) {
            const milkAch = tasks.achievements.find((a) => a.id === 'milk_streak')
            if (milkAch && !milkAch.unlocked) {
              milkAch.unlocked = true
              events.push({ type: 'achievement_unlocked', id: 'milk_streak' })
            }
          }
        } else {
          tasks.consecutiveMilkDays = 0
        }
        milkStats.todayProduced = 0

        // Track happy day
        if (cow.needs.happiness > 60) {
          tasks.happyDayCount++
          if (tasks.happyDayCount >= 1) {
            const happyAch = tasks.achievements.find((a) => a.id === 'happy_day')
            if (happyAch && !happyAch.unlocked) {
              happyAch.unlocked = true
              events.push({ type: 'achievement_unlocked', id: 'happy_day' })
            }
          }
        } else {
          tasks.happyDayCount = 0
        }
      }

      // Wind variation — slow random walk
      world.windStrength += (Math.random() - 0.5) * 0.002
      world.windStrength = Math.max(0.1, Math.min(0.6, world.windStrength))

      // 2. Decay needs (now includes thirst, seasonal, weather effects)
      decayNeeds(cow, dt, world, state.rain, state.rainIntensity)

      // 3. Apply activity effects
      applyActivityEffects(cow, dt, world)

      // 4. Update health
      updateHealth(cow, dt, state.rain, state.rainIntensity)

      // 5. Update milk production
      const milkProduced = updateMilkProduction(cow, dt)
      if (milkProduced > 0) {
        milkStats.totalProduced += milkProduced
        milkStats.todayProduced += milkProduced
        tasks.totalMilkProduced += milkProduced
      }

      // 6. Derive conditions
      cow.conditions = deriveConditions(cow, world, state.rain)

      // 7. Check rainy night achievement
      if (state.rain && (world.timeOfDay > 20 || world.timeOfDay < 6)) {
        const isInBarn = distanceXZ(cow.position, HOME_ANCHOR) < HOME_RADIUS + 2.0
        if (isInBarn && cow.health > 50) {
          const rainyAch = tasks.achievements.find((a) => a.id === 'rainy_night')
          if (rainyAch && !rainyAch.unlocked) {
            rainyAch.unlocked = true
            events.push({ type: 'achievement_unlocked', id: 'rainy_night' })
          }
        }
      }

      // 8. Check peak condition achievement
      if (
        cow.health >= 100 &&
        cow.needs.hunger < 20 &&
        cow.needs.thirst < 20 &&
        cow.needs.energy > 80 &&
        cow.needs.happiness > 80
      ) {
        const peakAch = tasks.achievements.find((a) => a.id === 'full_health')
        if (peakAch && !peakAch.unlocked) {
          peakAch.unlocked = true
          events.push({ type: 'achievement_unlocked', id: 'full_health' })
        }
      }

      // 9. Apply first-person input (inside the engine, not from the render loop)
      const fpIntent = state.firstPersonIntent
      if (state.cameraMode === 'firstPerson' && fpIntent) {
        applyFirstPersonMovement(cow, fpIntent, dt, world)
      }

      // 10. Move cow towards destination (AI movement — skipped when player is driving)
      if (!(state.cameraMode === 'firstPerson' && fpIntent && (fpIntent.forward !== 0 || fpIntent.turn !== 0))) {
        moveCow(cow, dt, world, events, state.rain, state.rainIntensity)
      }

      // 11. Check activity completion
      checkActivityCompletion(cow, world, events, tasks, milkStats)

      // 12. Re-evaluate behavior if decision time elapsed or activity completed
      const needsDecision =
        world.simulationTime >= cow.nextDecisionAt ||
        cow.activity.type === 'idle'

      if (needsDecision) {
        reevaluateBehavior(cow, world, events, state.rain, state.rainIntensity)
      }

      // 13. Clean up consumed foods
      world.foods = world.foods.filter((f) => f.amount > 0)

      // 14. Update exclusion zones based on gate state
      updateGateExclusionZones(world)

      // 15. Check critical needs — edge-triggered (fire once on entry)
      const hungerIsCritical = cow.needs.hunger >= HUNGER_CRITICAL
      const energyIsCritical = cow.needs.energy <= ENERGY_CRITICAL
      const thirstIsCritical = cow.needs.thirst >= THIRST_CRITICAL
      const healthIsCriticalNow = cow.health <= HEALTH_CRITICAL

      if (hungerIsCritical && !hungerWasCritical) {
        events.push({ type: 'need_critical', need: 'hunger', value: cow.needs.hunger })
      }
      if (energyIsCritical && !energyWasCritical) {
        events.push({ type: 'need_critical', need: 'energy', value: cow.needs.energy })
      }
      if (thirstIsCritical && !thirstWasCritical) {
        events.push({ type: 'need_critical', need: 'thirst', value: cow.needs.thirst })
      }
      if (healthIsCriticalNow && !healthWasCritical) {
        events.push({ type: 'need_critical', need: 'health', value: cow.health })
      }
      hungerWasCritical = hungerIsCritical
      energyWasCritical = energyIsCritical
      thirstWasCritical = thirstIsCritical
      healthWasCritical = healthIsCriticalNow

      // Track rest daily task
      if (cow.behavior === 'sleeping' || cow.behavior === 'sitting') {
        const restTask = tasks.dailyTasks.find((t) => t.id === 'rest')
        if (restTask) restTask.completed = true
      }

      set({ cow, world, events, tasks, milkStats })
    },

    playerAction(action: PlayerAction) {
      const state = get()
      const cow = {
        ...state.cow,
        needs: { ...state.cow.needs },
        personality: { ...state.cow.personality },
        conditions: [...state.cow.conditions],
      }
      const world = {
        ...state.world,
        foods: [...state.world.foods],
        gates: state.world.gates.map((g) => ({ ...g, position: [...g.position] as Vec3 })),
      }
      const events = [...state.events]
      const tasks = {
        ...state.tasks,
        dailyTasks: state.tasks.dailyTasks.map((t) => ({ ...t })),
        achievements: state.tasks.achievements.map((a) => ({ ...a })),
      }

      handlePlayerAction(action, cow, world, events, tasks)

      set({ cow, world, events, tasks })
    },

    setFirstPersonIntent(intent: FirstPersonIntent | null) {
      set({ firstPersonIntent: intent })
    },

    setTimeOfDay(time: number) {
      set((s) => ({ world: { ...s.world, timeOfDay: Math.max(0, Math.min(23.999, time)) } }))
    },

    setTimeSpeed(speed: number) {
      set((s) => ({ world: { ...s.world, timeSpeed: speed } }))
    },

    togglePause() {
      const state = get()
      const newPaused = !state.world.isPaused
      set((s) => ({ world: { ...s.world, isPaused: newPaused } }))
      // Save on pause
      if (newPaused) {
        saveGame({
          cow: state.cow,
          world: state.world,
          tasks: state.tasks,
          milkStats: state.milkStats,
          rain: state.rain,
          rainIntensity: state.rainIntensity,
        })
      }
    },

    toggleButterflies() {
      set((s) => ({ world: { ...s.world, showButterflies: !s.world.showButterflies } }))
    },

    setCameraMode(mode) {
      set({ cameraMode: mode })
    },

    toggleCinematicView() {
      const state = get()
      if (state.cinematicView) {
        // Exit cinematic view — restore previous camera mode
        set({ cinematicView: false, cameraMode: (state as any)._prevCameraMode || 'manual' })
      } else {
        // Enter cinematic view — save current camera mode, switch to cinematic
        set({ cinematicView: true, _prevCameraMode: state.cameraMode, cameraMode: 'cinematic' } as any)
      }
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

    getRelationshipTier(): RelationshipTier {
      return getRelationshipTier(get().cow.personality.trust)
    },

    getConditions(): CowCondition[] {
      return get().cow.conditions
    },
  }
})

// ── Gate Exclusion Zone Management ───────────────────────

function updateGateExclusionZones(world: WorldState): void {
  // Rebuild exclusion zones: base zones + closed gate zones
  const baseZones = [...EXCLUSION_ZONES]
  for (const gate of world.gates) {
    if (!gate.isOpen) {
      baseZones.push({
        center: [gate.position[0], gate.position[2]],
        radius: gate.exclusionRadius,
      })
    }
  }
  world.exclusionZones = baseZones
}

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

function moveCow(
  cow: CowState,
  dt: number,
  world: WorldState,
  _events: EngineEvent[],
  rain: boolean,
  rainIntensity: number,
): void {
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
  } else if (activity.type === 'seek_shelter') {
    destination = activity.destination
  }

  if (!destination) return

  const dist = distanceXZ(cow.position, destination)
  if (dist < ARRIVAL_THRESHOLD) return

  // Purposeful activities use full walk speed
  const purposeful = activity.type === 'go_to_food' || activity.type === 'go_to_pond'
    || activity.type === 'go_to_grass' || activity.type === 'go_to_milk'
    || activity.type === 'go_home' || activity.type === 'leave_barn'
    || activity.type === 'react_to_player' || activity.type === 'seek_shelter'

  let speed = cow.behavior === 'running' ? RUN_SPEED : purposeful ? WALK_SPEED : WALK_SPEED * 0.5

  // Health penalty on speed
  if (cow.health < 50) {
    speed *= (1 - HEALTH_LOW_SPEED_PENALTY)
  }

  // Mud penalty during rain (only outdoors)
  const isInBarn = distanceXZ(cow.position, HOME_ANCHOR) < HOME_RADIUS + 2.0
  if (rain && !isInBarn) {
    speed *= (1 - MUD_SPEED_PENALTY * rainIntensity)
  }

  const step = Math.min(speed * dt, dist)

  const dx = destination[0] - cow.position[0]
  const dz = destination[2] - cow.position[2]

  let newX = cow.position[0] + (dx / dist) * step
  let newZ = cow.position[2] + (dz / dist) * step

  // Push cow out of exclusion zones (except when going home/leaving barn)
  if (activity.type !== 'go_home' && activity.type !== 'settle_for_sleep' && activity.type !== 'leave_barn' && activity.type !== 'seek_shelter') {
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
  tasks: TaskState,
  milkStats: MilkStats,
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
      wanderCount++
      // Explorer achievement
      if (wanderCount >= 50) {
        const explorerAch = tasks.achievements.find((a) => a.id === 'explorer')
        if (explorerAch && !explorerAch.unlocked) {
          explorerAch.unlocked = true
          events.push({ type: 'achievement_unlocked', id: 'explorer' })
        }
      }
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
      // Drain milk from cow
      const drained = Math.min(cow.milkStorage, MILK_DRAIN_PER_MILKING)
      cow.milkStorage = Math.max(0, cow.milkStorage - drained)
      cow.lastMilkedAt = world.simulationTime
      cow.needs.happiness = Math.max(0, cow.needs.happiness - 5)

      if (drained > 0) {
        events.push({ type: 'milk_produced', amount: drained })
      }

      cow.activity = { type: 'idle' }
      const oldBehavior = cow.behavior
      cow.behavior = 'idle'
      if (oldBehavior !== 'idle') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'idle' })
      }
    }
  } else if (activity.type === 'seek_shelter') {
    const dist = distanceXZ(cow.position, activity.destination)
    if (dist < ARRIVAL_THRESHOLD) {
      // Arrived at shelter entrance — now go inside
      const oldBehavior = cow.behavior
      cow.activity = { type: 'go_home' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'walking'
      cow.nextDecisionAt = world.simulationTime + 20

      if (oldBehavior !== 'walking') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
      }
      events.push({ type: 'activity_changed', activity: cow.activity })
    }
  }
}

// ── Behavior Reevaluation ─────────────────────────────────

function reevaluateBehavior(
  cow: CowState,
  world: WorldState,
  events: EngineEvent[],
  rain: boolean,
  rainIntensity: number,
): void {
  // If cow is inside the barn and not choosing to stay (sleep/rest/go_home),
  // it must walk out through the entrance first
  const distFromHome = distanceXZ(cow.position, HOME_ANCHOR)
  const wasInsideBarn = distFromHome < HOME_RADIUS + 2.0

  const scores = scoreActivities(cow, world, rain, rainIntensity)
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
