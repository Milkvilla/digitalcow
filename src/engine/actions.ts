import type {
  PlayerAction,
  CowState,
  WorldState,
  EngineEvent,
  FoodItem,
  Vec3,
  TaskState,
} from './types'
import {
  PET_HAPPINESS_BOOST,
  PET_TRUST_BOOST,
  FOOD_PROPERTIES,
  JUMP_DURATION,
  POND_DRINK_SPOT,
  GRASS_PATCH_CENTER,
  GRASS_PATCH_RADIUS,
  TRUST_TIER_WARY,
  TRUST_TIER_FAMILIAR,
  MILK_OVER_MILKING_THRESHOLD,
  MILK_OVER_MILKING_PENALTY,
  MILK_DRAIN_PER_MILKING,
} from './constants'
import { isPointWalkable, foodStopPosition } from './world-query'
import { getRelationshipTier } from './behaviors'

/**
 * Handle a player-initiated action, mutating cow/world state and pushing
 * events into the events array. Now includes trust-tier gating and task tracking.
 */
export function handlePlayerAction(
  action: PlayerAction,
  cow: CowState,
  world: WorldState,
  events: EngineEvent[],
  tasks?: TaskState,
): void {
  const tier = getRelationshipTier(cow.personality.trust)

  switch (action.type) {
    case 'place_food': {
      const props = FOOD_PROPERTIES[action.foodType]
      const pos = randomWalkableNearCow(cow.position, world)
      const food: FoodItem = {
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        position: pos,
        amount: props.amount,
        placedAt: world.simulationTime,
        foodType: action.foodType,
      }
      world.foods.push(food)

      events.push({ type: 'food_placed', food })

      // Only redirect cow if it's not already eating or going to food
      if (cow.activity.type !== 'eat_food' && cow.activity.type !== 'go_to_food') {
        // Wary cows hesitate — delay before going to food
        const hesitation = tier === 'wary' ? 2 : 0
        cow.activity = {
          type: 'go_to_food',
          targetId: food.id,
          destination: foodStopPosition(cow.position, food.position),
        }
        cow.activityStartedAt = world.simulationTime
        cow.nextDecisionAt = world.simulationTime + hesitation + 10

        const oldBehavior = cow.behavior
        cow.behavior = 'walking'
        if (oldBehavior !== 'walking') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
        }
        events.push({ type: 'activity_changed', activity: cow.activity })
      }

      // Track daily task
      if (tasks) {
        markTask(tasks, 'feed')
        // Achievement: first feed
        unlockAchievement(tasks, 'first_feed', events)
      }
      break
    }

    case 'play': {
      // Wary cows may refuse to play
      if (tier === 'wary' && Math.random() < 0.4) {
        // Cow refuses — slight happiness drop for player bothering it
        cow.needs.happiness = clamp(cow.needs.happiness - 2, 0, 100)
        return
      }

      const playTarget = randomWalkableNearCow(cow.position, world)
      const oldBehavior = cow.behavior
      cow.activity = { type: 'react_to_player', action: 'play', destination: playTarget }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'running'
      // Bonded cows play longer
      const playDuration = tier === 'bonded' ? 12 : tier === 'familiar' ? 8 : 5
      cow.nextDecisionAt = world.simulationTime + playDuration
      cow.needs.happiness = clamp(cow.needs.happiness + 10, 0, 100)

      events.push({ type: 'play_started' })
      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'running') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'running' })
      }
      break
    }

    case 'pet': {
      // Petting when cow is sleeping or eating can annoy it
      if (cow.behavior === 'sleeping' || cow.behavior === 'eating') {
        cow.needs.happiness = clamp(cow.needs.happiness - 2, 0, 100)
        // Still get tiny trust for trying
        cow.personality.trust = clamp(cow.personality.trust + 1, 0, 100)
      } else {
        cow.needs.happiness = clamp(cow.needs.happiness + PET_HAPPINESS_BOOST, 0, 100)
        cow.personality.trust = clamp(cow.personality.trust + PET_TRUST_BOOST, 0, 100)
      }

      events.push({ type: 'pet_received' })

      // Check for tier change
      const newTier = getRelationshipTier(cow.personality.trust)
      if (newTier !== tier) {
        events.push({ type: 'relationship_changed', tier: newTier })
      }

      // Track task and achievements
      if (tasks) {
        markTask(tasks, 'pet')
        unlockAchievement(tasks, 'first_pet', events)
        if (newTier === 'bonded') {
          unlockAchievement(tasks, 'bonded', events)
        }
      }
      break
    }

    case 'call': {
      // Wary cows may ignore the call
      if (tier === 'wary' && Math.random() < 0.5) {
        return  // ignored
      }

      const oldBehavior = cow.behavior
      cow.activity = { type: 'go_home' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'walking'
      cow.nextDecisionAt = world.simulationTime + 30
      cow.personality.trust = clamp(cow.personality.trust + 2, 0, 100)

      events.push({ type: 'cow_called' })
      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'walking') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
      }
      break
    }

    case 'jump': {
      // Calves jump more eagerly
      const oldBehavior = cow.behavior
      cow.activity = { type: 'jump' }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'jumping'
      cow.nextDecisionAt = world.simulationTime + JUMP_DURATION + 1

      events.push({ type: 'cow_jumped' })
      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'jumping') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'jumping' })
      }
      break
    }

    case 'drink': {
      const oldBehavior = cow.behavior
      cow.activity = { type: 'go_to_pond', destination: [...POND_DRINK_SPOT] as Vec3 }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'walking'
      cow.nextDecisionAt = world.simulationTime + 20

      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'walking') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
      }

      if (tasks) markTask(tasks, 'water')
      break
    }

    case 'milk': {
      // Can only milk if cow is adult
      if (cow.age > 0.5) {
        // Over-milking penalty
        if (cow.milkStorage < MILK_OVER_MILKING_THRESHOLD) {
          cow.needs.happiness = clamp(cow.needs.happiness - MILK_OVER_MILKING_PENALTY, 0, 100)
        }

        const milkSpot: Vec3 = [-3.2, 0, 3.5]
        const oldBehavior = cow.behavior
        cow.activity = { type: 'go_to_milk', destination: milkSpot }
        cow.activityStartedAt = world.simulationTime
        cow.behavior = 'walking'
        cow.nextDecisionAt = world.simulationTime + 30

        events.push({ type: 'activity_changed', activity: cow.activity })
        if (oldBehavior !== 'walking') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
        }

        if (tasks) {
          markTask(tasks, 'milk')
          unlockAchievement(tasks, 'first_milk', events)
        }
      }
      break
    }

    case 'graze_patch': {
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * GRASS_PATCH_RADIUS * 0.7
      const gx = GRASS_PATCH_CENTER[0] + Math.cos(angle) * r
      const gz = GRASS_PATCH_CENTER[2] + Math.sin(angle) * r
      const dest: Vec3 = [gx, 0, gz]

      const oldBehavior = cow.behavior
      cow.activity = { type: 'go_to_grass', destination: dest }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'walking'
      cow.nextDecisionAt = world.simulationTime + 20

      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'walking') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
      }
      break
    }

    case 'toggle_gate': {
      const gate = world.gates.find((g) => g.id === action.gateId)
      if (gate) {
        gate.isOpen = !gate.isOpen
        events.push({ type: 'gate_toggled', gateId: gate.id, isOpen: gate.isOpen })
      }
      break
    }
  }
}

// ── Task helpers ────────────────────────────────────────────

function markTask(tasks: TaskState, taskId: string): void {
  const task = tasks.dailyTasks.find((t) => t.id === taskId)
  if (task) task.completed = true
}

function unlockAchievement(
  tasks: TaskState,
  achievementId: string,
  events: EngineEvent[],
): void {
  const achievement = tasks.achievements.find((a) => a.id === achievementId)
  if (achievement && !achievement.unlocked) {
    achievement.unlocked = true
    events.push({ type: 'achievement_unlocked', id: achievementId })
  }
}

// ── helpers ────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Pick a random walkable position within a short radius of the cow.
 * Tries up to 10 times before falling back to the cow's own position.
 */
function randomWalkableNearCow(cowPos: Vec3, world: WorldState): Vec3 {
  const radius = 5
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 2.5 + Math.random() * (radius - 2.5)
    const x = cowPos[0] + Math.cos(angle) * dist
    const z = cowPos[2] + Math.sin(angle) * dist
    if (isPointWalkable(x, z, world.exclusionZones)) {
      return [x, 0, z]
    }
  }
  return [cowPos[0], 0, cowPos[2]]
}
