import type { Vec3, FoodItem, ExclusionZone, WorldState } from './types'
import { SCENE_LAYOUT, EXCLUSION_ZONES } from './constants'

/**
 * Find the nearest food item with amount > 0 to the cow's position.
 * Returns null if no food is available.
 */
export function findNearestFood(
  cowPos: Vec3,
  foods: FoodItem[],
): FoodItem | null {
  let nearest: FoodItem | null = null
  let nearestDist = Infinity

  for (const food of foods) {
    if (food.amount <= 0) continue
    const d = distanceXZ(cowPos, food.position)
    if (d < nearestDist) {
      nearestDist = d
      nearest = food
    }
  }

  return nearest
}

/**
 * Check whether a point (x, z) is walkable — i.e. not inside any exclusion zone.
 */
export function isPointWalkable(
  x: number,
  z: number,
  zones: ExclusionZone[],
): boolean {
  for (const zone of zones) {
    const dx = x - zone.center[0]
    const dz = z - zone.center[1]
    if (dx * dx + dz * dz < zone.radius * zone.radius) {
      return false
    }
  }
  return true
}

/**
 * Sample a random walkable point within the cow roam bounds.
 * Retries up to 10 times if the point falls in an exclusion zone.
 */
export function sampleRoamTarget(world: WorldState): Vec3 {
  const bounds = SCENE_LAYOUT.cowRoamBounds
  const zones = world.exclusionZones.length > 0
    ? world.exclusionZones
    : EXCLUSION_ZONES

  for (let i = 0; i < 10; i++) {
    const x = bounds.min[0] + Math.random() * (bounds.max[0] - bounds.min[0])
    const z = bounds.min[1] + Math.random() * (bounds.max[1] - bounds.min[1])
    if (isPointWalkable(x, z, zones)) {
      return [x, 0, z]
    }
  }

  // Fallback: return center if no walkable point found
  return [0, 0, 0]
}

/**
 * Distance between two Vec3 points in the XZ plane (ignoring Y).
 */
export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Compute the position where the cow body should stop so its mouth
 * is over the food. Offsets 0.6 units back from food toward the cow.
 */
export function foodStopPosition(cowPos: Vec3, foodPos: Vec3): Vec3 {
  const dx = foodPos[0] - cowPos[0]
  const dz = foodPos[2] - cowPos[2]
  const dist = Math.sqrt(dx * dx + dz * dz)
  const offset = 0.6
  if (dist < offset) return cowPos
  return [foodPos[0] - (dx / dist) * offset, 0, foodPos[2] - (dz / dist) * offset]
}
