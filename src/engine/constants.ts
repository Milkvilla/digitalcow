import type { ExclusionZone, Vec3, FoodType } from './types'

// ── Simulation ──────────────────────────────────────────

export const SIM_TICK = 1 / 30              // fixed sim-time step (seconds)
export const MAX_SUBSTEPS_PER_FRAME = 20    // safety cap

// ── Need Decay Rates (per sim-second) ───────────────────

export const HUNGER_DECAY_PER_SEC = 0.5     // hunger 0→100 in ~200s
export const ENERGY_DECAY_PER_SEC = 0.3     // energy 100→0 in ~333s
export const HAPPINESS_DECAY_PER_SEC = 0.2  // happiness 100→0 in ~500s

// ── Behavior Effects (per sim-second) ───────────────────

export const EATING_HUNGER_REDUCTION = 15
export const EATING_FOOD_CONSUMPTION = 10
export const GRAZING_HUNGER_REDUCTION = 5
export const SLEEPING_ENERGY_GAIN = 10
export const RUNNING_ENERGY_COST = 8
export const RUNNING_HAPPINESS_GAIN = 3
export const PLAYING_HAPPINESS_GAIN = 5
export const PLAYING_ENERGY_COST = 6
export const PET_HAPPINESS_BOOST = 15
export const PET_TRUST_BOOST = 3

// ── Movement ────────────────────────────────────────────

export const WALK_SPEED = 0.6              // units/sec
export const RUN_SPEED = 3.0
export const ARRIVAL_THRESHOLD = 0.5       // distance to consider "arrived"

// ── Behavior Decision ───────────────────────────────────

export const BEHAVIOR_STICKINESS = 15      // bonus score for current activity
export const SCORE_NOISE = 5               // ±random added to each score
export const MIN_DECISION_INTERVAL = 5     // sim-seconds
export const MAX_DECISION_INTERVAL = 15

// ── Critical Thresholds ─────────────────────────────────

export const HUNGER_CRITICAL = 85
export const ENERGY_CRITICAL = 15

// ── Camera ──────────────────────────────────────────────

export const CAMERA_POSITION: Vec3 = [0, 12, 18]
export const CAMERA_LOOK_AT: Vec3 = [0, 0, 0]
export const CAMERA_FOV = 38

// ── Scene Layout ────────────────────────────────────────

export const SCENE_LAYOUT = {
  barn:     { position: [-10, 0, 8] as Vec3, rotation: [0, Math.PI / 4, 0] as Vec3 },
  trough:   { position: [-6, 0, 5] as Vec3 },
  pond:     { position: [-8, 0, -5] as Vec3, radius: 3 },
  trees: [
    // Existing large trees
    { position: [8, 0, -3] as Vec3 },
    { position: [10, 0, -8] as Vec3 },
    { position: [-5, 0, -10] as Vec3 },
    { position: [3, 0, 10] as Vec3 },
    { position: [12, 0, 4] as Vec3 },
    { position: [-12, 0, -7] as Vec3 },
    { position: [6, 0, 8] as Vec3 },
    // Small saplings near pond and fences
    { position: [-6, 0, -7] as Vec3 },
    { position: [-13, 0, 13] as Vec3 },
    // Medium trees in mid-field
    { position: [-3, 0, 6] as Vec3 },
    { position: [8, 0, -10] as Vec3 },
    // Small cluster of trees close together
    { position: [11, 0, -4] as Vec3 },
    { position: [12, 0, -6] as Vec3 },
    { position: [10, 0, -5.5] as Vec3 },
  ],
  fences: [
    // ── Full perimeter fence with gate gap on the right side ──
    // Back edge (z = -12)
    { start: [-14, 0, -12] as Vec3, end: [14, 0, -12] as Vec3 },
    // Right edge (x = 14)
    { start: [14, 0, -12] as Vec3, end: [14, 0, -2] as Vec3 },
    // Gate gap from z=-2 to z=2 on right side
    { start: [14, 0, 2] as Vec3, end: [14, 0, 14] as Vec3 },
    // Front edge (z = 14)
    { start: [14, 0, 14] as Vec3, end: [-14, 0, 14] as Vec3 },
    // Left edge (x = -14)
    { start: [-14, 0, 14] as Vec3, end: [-14, 0, -12] as Vec3 },
  ],
  cowSpawn: { position: [0, 0, 0] as Vec3 },
  cowRoamBounds: { min: [-8, -8] as [number, number], max: [8, 8] as [number, number] },
}

// ── Exclusion Zones (non-walkable areas) ────────────────

export const EXCLUSION_ZONES: ExclusionZone[] = [
  { center: [-10, 8], radius: 6.5 },   // barn scaled 1.3x (larger to prevent body clipping through walls)
  { center: [-8, -5], radius: 3.5 },   // pond
  { center: [-6, 5], radius: 1.5 },    // trough
]

// ── Grass ───────────────────────────────────────────────

export const GRASS_COUNT = 4000
export const GRASS_AREA = 22            // spread radius from center
export const GRASS_MIN_HEIGHT = 0.08
export const GRASS_MAX_HEIGHT = 0.24

// ── Time / Sun ──────────────────────────────────────────

export const SUNRISE_HOUR = 6
export const SUNSET_HOUR = 20
export const SUN_DISTANCE = 50

// ── Food Types ───────────────────────────────────────────

export const FOOD_PROPERTIES: Record<FoodType, {
  amount: number
  hungerReduction: number
  happinessBoost: number
  energyBoost: number
  label: string
  color: string
}> = {
  hay:    { amount: 300, hungerReduction: 15, happinessBoost: 0,  energyBoost: 0,  label: 'Hay',    color: '#c4a840' },
  apple:  { amount: 60,  hungerReduction: 12, happinessBoost: 5,  energyBoost: 3,  label: 'Apple',  color: '#cc3333' },
  carrot: { amount: 70,  hungerReduction: 10, happinessBoost: 2,  energyBoost: 5,  label: 'Carrot', color: '#ee8833' },
}

// ── Grass Patch (dense grazing area near pond) ───────────

export const GRASS_PATCH_CENTER: Vec3 = [1, 0, -8]
export const GRASS_PATCH_RADIUS = 2.5

// ── Pond Edge (drinking spot) ────────────────────────────

export const POND_DRINK_SPOT: Vec3 = [-5.5, 0, -3]  // edge of pond nearest the field

// ── Drinking ─────────────────────────────────────────────

export const DRINK_DURATION = 4              // sim-seconds
export const DRINKING_HAPPINESS_BOOST = 2
export const GRAZE_PATCH_DURATION = 8        // sim-seconds

// ── Home / Sleep Routing ────────────────────────────────

export const HOME_ANCHOR: Vec3 = [-10.7, 0, 8.7]  // center of scaled-up barn interior (room to rotate)
export const HOME_RADIUS = 1.0                     // how close cow needs to be to "be home"
export const BARN_ENTRANCE: Vec3 = [-7.0, 0, 5.0] // in front of the barn opening (rotated 45°, scale 1.3)
export const SETTLE_DURATION = 3                // seconds to settle before sleeping

// ── Jump ─────────────────────────────────────────────────

export const JUMP_DURATION = 0.8         // sim-seconds
export const JUMP_HAPPINESS_BOOST = 8
export const JUMP_ENERGY_COST = 5
