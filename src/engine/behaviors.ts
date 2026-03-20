import type {
  CowState,
  WorldState,
  Activity,
  CowBehavior,
  Vec3,
  RelationshipTier,
} from './types'
import {
  BEHAVIOR_STICKINESS,
  SCORE_NOISE,
  HUNGER_CRITICAL,
  ENERGY_CRITICAL,
  THIRST_CRITICAL,
  SUNRISE_HOUR,
  SUNSET_HOUR,
  HOME_ANCHOR,
  HOME_RADIUS,
  POND_DRINK_SPOT,
  GRASS_PATCH_CENTER,
  GRASS_PATCH_RADIUS,
  BARN_ENTRANCE,
  ROUTINE,
  TRUST_TIER_WARY,
  TRUST_TIER_FAMILIAR,
  DOG_EXCITEMENT_BONUS,
} from './constants'
import { findNearestFood, sampleRoamTarget, distanceXZ, foodStopPosition } from './world-query'

// ── Relationship tier helper ─────────────────────────────

export function getRelationshipTier(trust: number): RelationshipTier {
  if (trust <= TRUST_TIER_WARY) return 'wary'
  if (trust <= TRUST_TIER_FAMILIAR) return 'familiar'
  return 'bonded'
}

// ── Score each possible activity ──────────────────────────

/**
 * Produce a utility score for each candidate activity based on the cow's
 * current needs, personality, time of day, available world resources,
 * weather, health, thirst, age, relationship tier, and daily routine.
 */
export function scoreActivities(
  cow: CowState,
  world: WorldState,
  rain: boolean = false,
  rainIntensity: number = 0,
): Record<string, number> {
  const { hunger, energy, happiness, thirst } = cow.needs
  const { trust, curiosity } = cow.personality
  const hasFood = world.foods.some((f) => f.amount > 0)
  const tod = world.timeOfDay
  const tier = getRelationshipTier(trust)
  const healthPenalty = cow.health < 50 ? 0.5 : 1.0  // halve certain scores when unhealthy

  // Time-of-day modifiers
  const isNight = tod < SUNRISE_HOUR || tod > SUNSET_HOUR
  const isDawn = tod >= SUNRISE_HOUR && tod < SUNRISE_HOUR + 2
  const isMorning = tod >= SUNRISE_HOUR + 2 && tod < 12
  const isMidday = tod >= 12 && tod < 14
  const isAfternoon = tod >= 14 && tod < SUNSET_HOUR - 2
  const isEvening = tod >= SUNSET_HOUR - 2 && tod <= SUNSET_HOUR

  // Routine-based time checks
  const inMorningExplore = tod >= ROUTINE.morningExplore.start && tod < ROUTINE.morningExplore.end
  const inMorningGraze = tod >= ROUTINE.morningGraze.start && tod < ROUTINE.morningGraze.end
  const inMiddayRest = tod >= ROUTINE.middayRest.start && tod < ROUTINE.middayRest.end
  const inAfternoonGraze = tod >= ROUTINE.afternoonGraze.start && tod < ROUTINE.afternoonGraze.end
  const inEveningReturn = tod >= ROUTINE.eveningReturn.start && tod < ROUTINE.eveningReturn.end

  // Distance from barn
  const distHome = distanceXZ(cow.position, HOME_ANCHOR)
  const farFromHome = distHome > HOME_RADIUS
  const isInBarn = distHome < HOME_RADIUS + 2.0

  // Age modifiers
  const isCalf = cow.age < 0.3
  const isYoung = cow.age >= 0.3 && cow.age < 0.7

  const scores: Record<string, number> = {}

  // ── Eating placed food ──
  scores['go_to_food'] = hasFood
    ? 40 + hunger * 1.0 + (hunger >= HUNGER_CRITICAL ? 30 : 0)
    : 0

  // ── Grazing ──
  scores['graze'] = hunger * 0.6
  if (inMorningGraze || inAfternoonGraze) scores['graze'] += 20
  if (isMorning || isAfternoon) scores['graze'] += 15
  if (isDawn) scores['graze'] += 10
  // Rain discourages outdoor grazing
  if (rain) scores['graze'] -= rainIntensity * 15

  // ── Sleep ──
  scores['sleep'] = (100 - energy) * 0.9 + (energy <= ENERGY_CRITICAL ? 40 : 0)
  if (isEvening) scores['sleep'] += 20
  if (isMorning || isAfternoon) scores['sleep'] -= 20
  if (isNight && farFromHome) {
    scores['sleep'] -= 60  // don't sleep in field at night
  } else if (isNight) {
    scores['sleep'] += 50  // inside barn at night — sleep is great
  }

  // ── Rest ──
  scores['rest'] = (100 - energy) * 0.4
  if (inMiddayRest) scores['rest'] += 25
  if (isMidday) scores['rest'] += 20
  if (isNight) scores['rest'] += 10

  // ── Wander ──
  scores['wander'] = 20 + curiosity * 0.3 + happiness * 0.1
  if (inMorningExplore) scores['wander'] += 20  // morning explore routine
  if (isMorning || isAfternoon) scores['wander'] += 10
  if (isNight) scores['wander'] -= 15
  // Calves stay closer to home
  if (isCalf && farFromHome) scores['wander'] -= 15
  // Rain reduces wandering
  if (rain) scores['wander'] -= rainIntensity * 30
  // Dog nearby encourages wandering
  scores['wander'] += DOG_EXCITEMENT_BONUS
  // Health penalty
  scores['wander'] *= healthPenalty

  // ── Idle ──
  scores['idle'] = 10
  if (isNight) scores['idle'] += 15

  // ── Go home ──
  const tiredness = 100 - energy
  if (isNight && farFromHome) {
    scores['go_home'] = 60 + tiredness * 0.5
  } else if (inEveningReturn && farFromHome) {
    scores['go_home'] = 40 + tiredness * 0.4  // routine: return at dusk
  } else if (isEvening && farFromHome) {
    scores['go_home'] = 30 + tiredness * 0.3
  } else {
    scores['go_home'] = 0
  }
  // Calves want to be home more
  if (isCalf && farFromHome) scores['go_home'] += 20

  // ── React to player ──
  scores['react_to_player'] = trust * 0.2 + happiness * 0.1
  if (isNight) scores['react_to_player'] -= 10
  // Calves are more playful
  if (isCalf || isYoung) scores['react_to_player'] += 15
  // Health penalty
  scores['react_to_player'] *= healthPenalty

  // ── Drink at pond ── (NOW DRIVEN BY THIRST)
  scores['go_to_pond'] = 8 + thirst * 0.8  // thirst is primary driver
  if (thirst >= THIRST_CRITICAL) scores['go_to_pond'] += 40  // urgently thirsty
  if (isMorning || isAfternoon) scores['go_to_pond'] += 5
  if (hunger < 40) scores['go_to_pond'] += 5  // more likely after eating
  // Rain slightly reduces urgency (rain slows thirst)
  if (rain) scores['go_to_pond'] -= rainIntensity * 5

  // ── Graze at grass patch ──
  scores['go_to_grass'] = hunger * 0.4
  if (inMorningGraze || inAfternoonGraze) scores['go_to_grass'] += 15
  if (isMorning || isAfternoon) scores['go_to_grass'] += 10
  if (rain) scores['go_to_grass'] -= rainIntensity * 10

  // ── Seek shelter (rain-driven) ──
  if (rain && !isInBarn) {
    const shelterScore = rainIntensity * 50  // heavy rain = strong urge
    if (rainIntensity > 0.7) {
      scores['seek_shelter'] = shelterScore + 30  // very heavy rain forces shelter
    } else {
      scores['seek_shelter'] = shelterScore
    }
    // Already going home? boost that instead
    if (scores['go_home'] > 0) scores['go_home'] += rainIntensity * 20
  } else {
    scores['seek_shelter'] = 0
  }

  // ── Season-based adjustments ──
  if (world.season === 3) {
    // Winter: prefer staying warm, rest more
    scores['rest'] += 10
    scores['go_home'] += 10
    scores['wander'] -= 10
  } else if (world.season === 1) {
    // Summer: more active, explore more
    scores['wander'] += 5
    scores['go_to_pond'] += 5  // drink more in summer
  }

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

    case 'seek_shelter': {
      // Head to barn entrance for shelter
      return { type: 'seek_shelter', destination: [...BARN_ENTRANCE] as Vec3 }
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
    case 'seek_shelter':
      return 'walking'
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
