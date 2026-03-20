import type { CowState, WorldState, CowCondition } from './types'
import {
  HUNGER_DECAY_PER_SEC,
  ENERGY_DECAY_PER_SEC,
  HAPPINESS_DECAY_PER_SEC,
  THIRST_DECAY_PER_SEC,
  EATING_FOOD_CONSUMPTION,
  GRAZING_HUNGER_REDUCTION,
  SLEEPING_ENERGY_GAIN,
  PLAYING_HAPPINESS_GAIN,
  PLAYING_ENERGY_COST,
  FOOD_PROPERTIES,
  JUMP_HAPPINESS_BOOST,
  JUMP_ENERGY_COST,
  DRINKING_HAPPINESS_BOOST,
  DRINKING_THIRST_REDUCTION,
  RAIN_THIRST_SLOW_FACTOR,
  HEALTH_HUNGER_PENALTY,
  HEALTH_THIRST_PENALTY,
  HEALTH_ENERGY_PENALTY,
  HEALTH_WEATHER_PENALTY,
  HEALTH_RECOVERY_RATE,
  HEALTH_LOW_HAPPINESS_PENALTY,
  MILK_BASE_RATE,
  MILK_MAX_STORAGE,
  MILK_FULL_COMFORT_PENALTY,
  MILK_MIN_AGE,
  SEASON_MODIFIERS,
  SOCIAL_HAPPINESS_BONUS,
  BARN_ENERGY_BONUS,
  HOME_ANCHOR,
  HOME_RADIUS,
} from './constants'
import { distanceXZ } from './world-query'

/**
 * Apply passive need decay over dt sim-seconds.
 * Hunger and thirst increase, energy and happiness decrease.
 * All values are clamped to 0–100.
 * Now includes seasonal modifiers, rain thirst effect, and health penalties.
 */
export function decayNeeds(
  cow: CowState,
  dt: number,
  world: WorldState,
  rain: boolean,
  rainIntensity: number,
): void {
  const needs = cow.needs
  const season = SEASON_MODIFIERS[world.season] || SEASON_MODIFIERS[0]
  const isSleeping = cow.behavior === 'sleeping'
  const sleepSlowdown = isSleeping ? 0.15 : 1 // ~7x slower decay while sleeping

  // Base decay with seasonal modifiers
  needs.hunger = clamp(needs.hunger + HUNGER_DECAY_PER_SEC * season.hungerMultiplier * sleepSlowdown * dt, 0, 100)
  needs.energy = clamp(needs.energy - ENERGY_DECAY_PER_SEC * season.energyCostMultiplier * dt, 0, 100)

  // Happiness decay — extra penalty when health is low
  let happinessDecay = HAPPINESS_DECAY_PER_SEC
  if (cow.health < 50) {
    happinessDecay *= (1 + HEALTH_LOW_HAPPINESS_PENALTY)
  }
  needs.happiness = clamp(needs.happiness - happinessDecay * dt, 0, 100)

  // Thirst decay — rain slows it down
  let thirstRate = THIRST_DECAY_PER_SEC * sleepSlowdown
  if (rain) {
    thirstRate *= (1 - RAIN_THIRST_SLOW_FACTOR * rainIntensity)
  }
  needs.thirst = clamp(needs.thirst + thirstRate * dt, 0, 100)

  // Wind affects comfort — high wind reduces happiness slightly
  if (world.windStrength > 0.4) {
    const windPenalty = (world.windStrength - 0.4) * 0.1  // 0-0.02/sec
    needs.happiness = clamp(needs.happiness - windPenalty * dt, 0, 100)
  }

  // Social animal proximity bonus (passive happiness from being on the farm)
  needs.happiness = clamp(needs.happiness + SOCIAL_HAPPINESS_BONUS * dt, 0, 100)

  // Milk storage comfort penalty — full udder is uncomfortable
  if (cow.milkStorage > 90) {
    needs.happiness = clamp(needs.happiness - MILK_FULL_COMFORT_PENALTY * dt, 0, 100)
  }
}

/**
 * Apply effects of the cow's current activity on its needs and the world.
 * Mutates cow.needs and world.foods in place.
 */
export function applyActivityEffects(
  cow: CowState,
  dt: number,
  world: WorldState,
): void {
  const { activity, needs } = cow
  const isInBarn = distanceXZ(cow.position, HOME_ANCHOR) < HOME_RADIUS + 2.0

  switch (activity.type) {
    case 'eat_food': {
      // Find the food to get its type-specific properties
      const food = world.foods.find((f) => f.id === activity.targetId)
      if (food) {
        const props = FOOD_PROPERTIES[food.foodType]
        needs.hunger = clamp(needs.hunger - props.hungerReduction * dt, 0, 100)
        needs.happiness = clamp(needs.happiness + props.happinessBoost * dt, 0, 100)
        needs.energy = clamp(needs.energy + props.energyBoost * dt, 0, 100)
        // Food-specific thirst effect (hay makes thirsty, apple quenches)
        needs.thirst = clamp(needs.thirst + props.thirstEffect * dt, 0, 100)
        food.amount = clamp(food.amount - EATING_FOOD_CONSUMPTION * dt, 0, 100)
      }
      break
    }

    case 'graze': {
      needs.hunger = clamp(needs.hunger - GRAZING_HUNGER_REDUCTION * dt, 0, 100)
      // Grazing slightly increases thirst
      needs.thirst = clamp(needs.thirst + 0.1 * dt, 0, 100)
      break
    }

    case 'sleep': {
      const energyGain = isInBarn ? SLEEPING_ENERGY_GAIN * BARN_ENERGY_BONUS : SLEEPING_ENERGY_GAIN
      needs.energy = clamp(needs.energy + energyGain * dt, 0, 100)
      break
    }

    case 'wander': {
      // Walking uses a little energy but is mostly neutral
      break
    }

    case 'react_to_player': {
      if (activity.action === 'play') {
        needs.happiness = clamp(needs.happiness + PLAYING_HAPPINESS_GAIN * dt, 0, 100)
        needs.energy = clamp(needs.energy - PLAYING_ENERGY_COST * dt, 0, 100)
        // Playing makes thirsty
        needs.thirst = clamp(needs.thirst + 0.2 * dt, 0, 100)
      }
      break
    }

    case 'go_to_food': {
      break
    }

    case 'go_home': {
      break
    }

    case 'settle_for_sleep': {
      const settleGain = isInBarn ? SLEEPING_ENERGY_GAIN * 0.15 * BARN_ENERGY_BONUS : SLEEPING_ENERGY_GAIN * 0.15
      needs.energy = clamp(needs.energy + settleGain * dt, 0, 100)
      break
    }

    case 'rest': {
      const restGain = isInBarn ? SLEEPING_ENERGY_GAIN * 0.3 * BARN_ENERGY_BONUS : SLEEPING_ENERGY_GAIN * 0.3
      needs.energy = clamp(needs.energy + restGain * dt, 0, 100)
      break
    }

    case 'jump': {
      needs.happiness = clamp(needs.happiness + JUMP_HAPPINESS_BOOST * dt, 0, 100)
      needs.energy = clamp(needs.energy - JUMP_ENERGY_COST * dt, 0, 100)
      break
    }

    case 'drink': {
      needs.happiness = clamp(needs.happiness + DRINKING_HAPPINESS_BOOST * dt, 0, 100)
      needs.thirst = clamp(needs.thirst - DRINKING_THIRST_REDUCTION * dt, 0, 100)
      break
    }

    case 'graze_patch': {
      needs.hunger = clamp(needs.hunger - GRAZING_HUNGER_REDUCTION * dt, 0, 100)
      needs.thirst = clamp(needs.thirst + 0.1 * dt, 0, 100)
      break
    }

    case 'seek_shelter': {
      // Walking to shelter — no special effect beyond movement
      break
    }

    case 'idle':
    default:
      break
  }
}

/**
 * Update health based on current needs and weather exposure.
 * Health decays when needs are critical, recovers when conditions are good.
 */
export function updateHealth(
  cow: CowState,
  dt: number,
  rain: boolean,
  rainIntensity: number,
): void {
  const { needs } = cow
  const isInBarn = distanceXZ(cow.position, HOME_ANCHOR) < HOME_RADIUS + 2.0
  let healthDelta = 0

  // Penalties for poor condition
  if (needs.hunger > 70) healthDelta -= HEALTH_HUNGER_PENALTY * dt
  if (needs.thirst > 70) healthDelta -= HEALTH_THIRST_PENALTY * dt
  if (needs.energy < 20) healthDelta -= HEALTH_ENERGY_PENALTY * dt

  // Weather exposure (rain while not sheltered)
  if (rain && !isInBarn) {
    healthDelta -= HEALTH_WEATHER_PENALTY * rainIntensity * dt
  }

  // Recovery when conditions are good
  const isWellFed = needs.hunger < 30 && needs.thirst < 30
  const isRested = needs.energy > 50
  if (isWellFed && isRested) {
    healthDelta += HEALTH_RECOVERY_RATE * 2 * dt
  }

  // Passive recovery — health slowly recovers when no penalties are active
  if (healthDelta <= 0 && needs.hunger <= 70 && needs.thirst <= 70 && needs.energy >= 20) {
    healthDelta = HEALTH_RECOVERY_RATE * dt
  }

  cow.health = clamp(cow.health + healthDelta, 0, 100)
}

/**
 * Produce milk based on cow's condition.
 * Returns amount produced this tick (for tracking).
 */
export function updateMilkProduction(
  cow: CowState,
  dt: number,
): number {
  if (cow.age < MILK_MIN_AGE) return 0

  // Production rate depends on multiple factors
  const ageFactor = Math.min(1, (cow.age - MILK_MIN_AGE) / 0.5)  // 0 at 0.5, 1.0 at 1.0
  const healthFactor = cow.health / 100
  const hydrationFactor = (100 - cow.needs.thirst) / 100
  const hungerFactor = (100 - cow.needs.hunger) / 100

  const rate = MILK_BASE_RATE * ageFactor * healthFactor * hydrationFactor * hungerFactor
  // Convert hourly rate to per-second: rate / 3600
  const produced = (rate / 3600) * dt

  if (produced > 0 && cow.milkStorage < MILK_MAX_STORAGE) {
    const added = Math.min(produced, MILK_MAX_STORAGE - cow.milkStorage)
    cow.milkStorage = clamp(cow.milkStorage + added, 0, MILK_MAX_STORAGE)
    return added
  }
  return 0
}

/**
 * Derive current conditions from cow state (computed each tick, not stored).
 */
export function deriveConditions(
  cow: CowState,
  world: WorldState,
  rain: boolean,
): CowCondition[] {
  const conditions: CowCondition[] = []
  const { needs } = cow
  const isInBarn = distanceXZ(cow.position, HOME_ANCHOR) < HOME_RADIUS + 2.0

  if (needs.energy < 25) conditions.push('tired')
  if (needs.happiness < 20) conditions.push('stressed')
  if (needs.hunger > 70) conditions.push('hungry')
  if (needs.thirst > 70) conditions.push('thirsty')

  // Cold: rain + not sheltered + winter
  if (rain && !isInBarn && world.season === 3) {
    conditions.push('cold')
  }

  // Overheated: summer + midday + not sheltered
  const tod = world.timeOfDay
  if (world.season === 1 && tod >= 11 && tod <= 14 && !isInBarn) {
    conditions.push('overheated')
  }

  if (conditions.length === 0) conditions.push('healthy')
  return conditions
}

/**
 * Progress cow age based on nutrition quality.
 * Called once per sim-day transition.
 */
export function progressAge(cow: CowState, agePerDay: number, nutritionBonus: number): void {
  if (cow.age >= 1.0) return

  let rate = agePerDay
  // Well-fed cow grows faster
  if (cow.needs.hunger < 40 && cow.needs.thirst < 40 && cow.health > 60) {
    rate *= nutritionBonus
  }

  cow.age = clamp(cow.age + rate, 0, 1.0)
}

// ── helpers ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
