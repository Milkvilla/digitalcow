import type {
  CowState,
  WorldState,
  Activity,
  CowBehavior,
  Vec3,
} from './types'
import {
  BEHAVIOR_STICKINESS,
  SCORE_NOISE,
  HUNGER_CRITICAL,
  ENERGY_CRITICAL,
  SUNRISE_HOUR,
  SUNSET_HOUR,
  HOME_ANCHOR,
  HOME_RADIUS,
  POND_DRINK_SPOT,
  GRASS_PATCH_CENTER,
  GRASS_PATCH_RADIUS,
} from './constants'
import { findNearestFood, sampleRoamTarget, distanceXZ, foodStopPosition } from './world-query'

// ── Score each possible activity ──────────────────────────

/**
 * Produce a utility score for each candidate activity based on the cow's
 * current needs, personality, time of day, and available world resources.
 */
export function scoreActivities(
  cow: CowState,
  world: WorldState,
): Record<string, number> {
  const { hunger, energy, happiness } = cow.needs
  const { trust, curiosity } = cow.personality
  const hasFood = world.foods.some((f) => f.amount > 0)
  const tod = world.timeOfDay

  // Time-of-day modifiers
  const isNight = tod < SUNRISE_HOUR || tod > SUNSET_HOUR
  const isDawn = tod >= SUNRISE_HOUR && tod < SUNRISE_HOUR + 2
  const isMorning = tod >= SUNRISE_HOUR + 2 && tod < 12
  const isMidday = tod >= 12 && tod < 14
  const isAfternoon = tod >= 14 && tod < SUNSET_HOUR - 2
  const isEvening = tod >= SUNSET_HOUR - 2 && tod <= SUNSET_HOUR

  const scores: Record<string, number> = {}

  // Eating placed food — always go eat if food exists, boosted when hungry
  scores['go_to_food'] = hasFood
    ? 40 + hunger * 1.0 + (hunger >= HUNGER_CRITICAL ? 30 : 0)
    : 0

  // Grazing — morning and afternoon are prime grazing time
  scores['graze'] = hunger * 0.6
  if (isMorning || isAfternoon) scores['graze'] += 15
  if (isDawn) scores['graze'] += 10

  // Sleep — strongly favored at night, penalized during day
  // At night, cow should go to barn first (go_home), not sleep in the field
  scores['sleep'] = (100 - energy) * 0.9 + (energy <= ENERGY_CRITICAL ? 40 : 0)
  if (isEvening) scores['sleep'] += 20
  if (isMorning || isAfternoon) scores['sleep'] -= 20
  const distHome = distanceXZ(cow.position, HOME_ANCHOR)
  if (isNight && distHome > HOME_RADIUS) {
    // Far from barn at night — strongly discourage sleeping in the field
    scores['sleep'] -= 60
  } else if (isNight) {
    // Inside barn at night — sleep is great
    scores['sleep'] += 50
  }

  // Rest — midday siesta, or when tired
  scores['rest'] = (100 - energy) * 0.4
  if (isMidday) scores['rest'] += 20
  if (isNight) scores['rest'] += 10

  // Wander — curiosity-driven, more active in morning/afternoon
  scores['wander'] = 20 + curiosity * 0.3 + happiness * 0.1
  if (isMorning || isAfternoon) scores['wander'] += 10
  if (isNight) scores['wander'] -= 15

  // Idle — low baseline
  scores['idle'] = 10
  if (isNight) scores['idle'] += 15

  // Go home — walk toward barn before sleeping
  const tiredness = 100 - energy
  const distFromHome = distanceXZ(cow.position, HOME_ANCHOR)
  const farFromHome = distFromHome > HOME_RADIUS
  if (isNight && farFromHome) {
    scores['go_home'] = 60 + tiredness * 0.5
  } else if (isEvening && farFromHome) {
    scores['go_home'] = 30 + tiredness * 0.3
  } else {
    scores['go_home'] = 0
  }

  // React to player
  scores['react_to_player'] = trust * 0.2 + happiness * 0.1
  if (isNight) scores['react_to_player'] -= 10

  // Drink at pond — occasional, boosted when grazing or eating nearby
  scores['go_to_pond'] = 8
  if (isMorning || isAfternoon) scores['go_to_pond'] += 5
  if (hunger < 40) scores['go_to_pond'] += 5  // more likely to drink after eating

  // Graze at grass patch — like regular grazing but destination-based
  scores['go_to_grass'] = hunger * 0.4
  if (isMorning || isAfternoon) scores['go_to_grass'] += 10

  return scores
}

// ── Build a concrete Activity from a key ──────────────────

/**
 * Given the winning activity key, build a full Activity object
 * with any required targets / destinations.
 */
export function buildActivity(
  key: string,
  cow: CowState,
  world: WorldState,
): Activity {
  switch (key) {
    case 'go_to_food': {
      const food = findNearestFood(cow.position, world.foods)
      if (food) {
        return {
          type: 'go_to_food',
          targetId: food.id,
          destination: foodStopPosition(cow.position, food.position),
        }
      }
      // Fallback to grazing if food disappeared between scoring and building
      return { type: 'graze' }
    }

    case 'graze':
      return { type: 'graze' }

    case 'sleep': {
      // If far from barn, go home first — don't sleep in the field
      const sleepDist = distanceXZ(cow.position, HOME_ANCHOR)
      if (sleepDist > HOME_RADIUS) {
        return { type: 'go_home' }
      }
      return { type: 'sleep' }
    }

    case 'rest':
      return { type: 'rest' }

    case 'wander': {
      const dest = sampleRoamTarget(world)
      return { type: 'wander', destination: dest }
    }

    case 'go_home':
      return { type: 'go_home' }

    case 'react_to_player':
      return { type: 'react_to_player', action: 'play' }

    case 'go_to_pond':
      return { type: 'go_to_pond', destination: [...POND_DRINK_SPOT] as Vec3 }

    case 'go_to_grass': {
      // Pick a random spot within the grass patch
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * GRASS_PATCH_RADIUS * 0.7
      const gx = GRASS_PATCH_CENTER[0] + Math.cos(angle) * r
      const gz = GRASS_PATCH_CENTER[2] + Math.sin(angle) * r
      return { type: 'go_to_grass', destination: [gx, 0, gz] as Vec3 }
    }

    case 'idle':
    default:
      return { type: 'idle' }
  }
}

// ── Map Activity → CowBehavior (animation state) ─────────

/**
 * Derive the visible CowBehavior from the current Activity.
 */
export function behaviorFromActivity(activity: Activity): CowBehavior {
  switch (activity.type) {
    case 'idle':
      return 'idle'
    case 'wander':
      return 'walking'
    case 'go_to_food':
      return 'walking'
    case 'eat_food':
      return 'eating'
    case 'graze':
      return 'grazing'
    case 'sleep':
      return 'sleeping'
    case 'rest':
      return 'sitting'
    case 'jump':
      return 'jumping'
    case 'go_home':
      return 'walking'
    case 'settle_for_sleep':
      return 'settling'
    case 'react_to_player':
      return 'running'
    case 'go_to_pond':
      return 'walking'
    case 'drink':
      return 'drinking'
    case 'go_to_grass':
      return 'walking'
    case 'graze_patch':
      return 'grazing'
    case 'leave_barn':
      return 'walking'
    case 'go_to_milk':
      return 'walking'
    case 'milking':
      return 'idle'
    default:
      return 'idle'
  }
}

// ── Pick highest-scoring key with noise + stickiness ──────

/**
 * Add random noise to each score, give a stickiness bonus to the current
 * activity type, and return the key with the highest adjusted score.
 */
export function pickHighestWithNoise(
  scores: Record<string, number>,
  noise: number = SCORE_NOISE,
  currentType?: string,
): string {
  let bestKey = 'idle'
  let bestScore = -Infinity

  for (const key of Object.keys(scores)) {
    let adjusted = scores[key] + (Math.random() * 2 - 1) * noise
    if (currentType && key === currentType) {
      adjusted += BEHAVIOR_STICKINESS
    }
    if (adjusted > bestScore) {
      bestScore = adjusted
      bestKey = key
    }
  }

  return bestKey
}
