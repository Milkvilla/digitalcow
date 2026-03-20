import type {
  PlayerAction,
  CowState,
  WorldState,
  EngineEvent,
  FoodItem,
  Vec3,
} from './types'
import {
  PET_HAPPINESS_BOOST,
  PET_TRUST_BOOST,
  FOOD_PROPERTIES,
  JUMP_DURATION,
  POND_DRINK_SPOT,
  GRASS_PATCH_CENTER,
  GRASS_PATCH_RADIUS,
} from './constants'
import { isPointWalkable, foodStopPosition } from './world-query'

/**
 * Handle a player-initiated action, mutating cow/world state and pushing
 * events into the events array.
 */
export function handlePlayerAction(
  action: PlayerAction,
  cow: CowState,
  world: WorldState,
  events: EngineEvent[],
): void {
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
        cow.activity = {
          type: 'go_to_food',
          targetId: food.id,
          destination: foodStopPosition(cow.position, food.position),
        }
        cow.activityStartedAt = world.simulationTime

        const oldBehavior = cow.behavior
        cow.behavior = 'walking'
        if (oldBehavior !== 'walking') {
          events.push({ type: 'behavior_changed', from: oldBehavior, to: 'walking' })
        }
        events.push({ type: 'activity_changed', activity: cow.activity })
      }
      break
    }

    case 'play': {
      const playTarget = randomWalkableNearCow(cow.position, world)
      const oldBehavior = cow.behavior
      cow.activity = { type: 'react_to_player', action: 'play', destination: playTarget }
      cow.activityStartedAt = world.simulationTime
      cow.behavior = 'running'
      cow.nextDecisionAt = world.simulationTime + 8
      cow.needs.happiness = clamp(cow.needs.happiness + 10, 0, 100)

      events.push({ type: 'play_started' })
      events.push({ type: 'activity_changed', activity: cow.activity })
      if (oldBehavior !== 'running') {
        events.push({ type: 'behavior_changed', from: oldBehavior, to: 'running' })
      }
      break
    }

    case 'pet': {
      cow.needs.happiness = clamp(cow.needs.happiness + PET_HAPPINESS_BOOST, 0, 100)
      cow.personality.trust = clamp(cow.personality.trust + PET_TRUST_BOOST, 0, 100)

      events.push({ type: 'pet_received' })
      break
    }

    case 'call': {
      // Send cow home to barn
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
      break
    }

    case 'milk': {
      // Can only milk if cow is adult
      if (cow.age > 0.5) {
        // Cow walks to position next to the milk bucket (outside exclusion zones)
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
