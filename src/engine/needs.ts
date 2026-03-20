import type { CowState, WorldState } from './types'
import {
  HUNGER_DECAY_PER_SEC,
  ENERGY_DECAY_PER_SEC,
  HAPPINESS_DECAY_PER_SEC,
  EATING_FOOD_CONSUMPTION,
  GRAZING_HUNGER_REDUCTION,
  SLEEPING_ENERGY_GAIN,
  PLAYING_HAPPINESS_GAIN,
  PLAYING_ENERGY_COST,
  FOOD_PROPERTIES,
  JUMP_HAPPINESS_BOOST,
  JUMP_ENERGY_COST,
  DRINKING_HAPPINESS_BOOST,
} from './constants'

/**
 * Apply passive need decay over dt sim-seconds.
 * Hunger increases, energy and happiness decrease.
 * All values are clamped to 0–100.
 */
export function decayNeeds(needs: CowState['needs'], dt: number): void {
  needs.hunger = clamp(needs.hunger + HUNGER_DECAY_PER_SEC * dt, 0, 100)
  needs.energy = clamp(needs.energy - ENERGY_DECAY_PER_SEC * dt, 0, 100)
  needs.happiness = clamp(needs.happiness - HAPPINESS_DECAY_PER_SEC * dt, 0, 100)
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

  switch (activity.type) {
    case 'eat_food': {
      // Find the food to get its type-specific properties
      const food = world.foods.find((f) => f.id === activity.targetId)
      if (food) {
        const props = FOOD_PROPERTIES[food.foodType]
        needs.hunger = clamp(needs.hunger - props.hungerReduction * dt, 0, 100)
        needs.happiness = clamp(needs.happiness + props.happinessBoost * dt, 0, 100)
        needs.energy = clamp(needs.energy + props.energyBoost * dt, 0, 100)
        food.amount = clamp(food.amount - EATING_FOOD_CONSUMPTION * dt, 0, 100)
      }
      break
    }

    case 'graze': {
      needs.hunger = clamp(needs.hunger - GRAZING_HUNGER_REDUCTION * dt, 0, 100)
      break
    }

    case 'sleep': {
      needs.energy = clamp(needs.energy + SLEEPING_ENERGY_GAIN * dt, 0, 100)
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
      }
      break
    }

    case 'go_to_food': {
      // Walking towards food — same cost as regular movement (handled by movement)
      break
    }

    case 'go_home': {
      // Walking home — same cost as regular movement (handled by movement)
      break
    }

    case 'settle_for_sleep': {
      // Cow is calming down — slightly reduced energy drain
      needs.energy = clamp(needs.energy + SLEEPING_ENERGY_GAIN * 0.15 * dt, 0, 100)
      break
    }

    case 'rest': {
      // Light energy recovery while resting (less than sleeping)
      needs.energy = clamp(needs.energy + SLEEPING_ENERGY_GAIN * 0.3 * dt, 0, 100)
      break
    }

    case 'jump': {
      needs.happiness = clamp(needs.happiness + JUMP_HAPPINESS_BOOST * dt, 0, 100)
      needs.energy = clamp(needs.energy - JUMP_ENERGY_COST * dt, 0, 100)
      break
    }

    case 'drink': {
      needs.happiness = clamp(needs.happiness + DRINKING_HAPPINESS_BOOST * dt, 0, 100)
      break
    }

    case 'graze_patch': {
      needs.hunger = clamp(needs.hunger - GRAZING_HUNGER_REDUCTION * dt, 0, 100)
      break
    }

    case 'idle':
    default:
      break
  }
}

// ── helpers ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
