import type { ExclusionZone, Vec3, FoodType } from './types'

// ── Simulation ──────────────────────────────────────────

export const SIM_TICK = 1 / 30              // fixed sim-time step (seconds)
export const MAX_SUBSTEPS_PER_FRAME = 20    // safety cap

// ── Need Decay Rates (per sim-second) ───────────────────

export const HUNGER_DECAY_PER_SEC = 0.15    // hunger 0→100 in ~667s
export const ENERGY_DECAY_PER_SEC = 0.1     // energy 100→0 in ~1000s
export const HAPPINESS_DECAY_PER_SEC = 0.2  // happiness 100→0 in ~500s
export const THIRST_DECAY_PER_SEC = 0.12    // thirst 0→100 in ~833s

// ── Behavior Effects (per sim-second) ───────────────────

export const EATING_HUNGER_REDUCTION = 15
export const EATING_FOOD_CONSUMPTION = 10
export const GRAZING_HUNGER_REDUCTION = 5
export const SLEEPING_ENERGY_GAIN = 3.5
export const RUNNING_ENERGY_COST = 2.7
export const RUNNING_HAPPINESS_GAIN = 3
export const PLAYING_HAPPINESS_GAIN = 5
export const PLAYING_ENERGY_COST = 2
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
export const THIRST_CRITICAL = 80
export const HEALTH_CRITICAL = 30

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
  { center: [8, 13], radius: 1.2 },    // windmill
  { center: [4, 3], radius: 0.5 },     // scarecrow
  { center: [12, 12], radius: 0.6 },   // mango tree
  // Tree trunks
  ...SCENE_LAYOUT.trees.map(t => ({
    center: [t.position[0], t.position[2]] as [number, number],
    radius: 0.4,
  })),
]

// ── Grass ───────────────────────────────────────────────

export const GRASS_COUNT = 4000
export const GRASS_AREA = 22            // spread radius from center
export const GRASS_MIN_HEIGHT = 0.08
export const GRASS_MAX_HEIGHT = 0.24

// ── Time / Sun ──────────────────────────────────────────

export const SUNRISE_HOUR = 6
export const SUNSET_HOUR = 19
export const SUN_DISTANCE = 50

/** Outdoor light intensity curve: gradual on 1.5h before sunset, full by sunset+1h, gradual dim after midnight */
export function outdoorLightFactor(timeOfDay: number): number {
  const lightsOn = SUNSET_HOUR - 1.5       // lights start turning on 1.5h before sunset
  const fullBright = SUNSET_HOUR + 1        // full brightness 1h after sunset
  // Daytime: off
  if (timeOfDay >= SUNRISE_HOUR && timeOfDay < lightsOn) return 0
  // Ramp up to full brightness
  if (timeOfDay >= lightsOn && timeOfDay < fullBright) {
    const t = (timeOfDay - lightsOn) / (fullBright - lightsOn)
    return t * t * (3 - 2 * t) // smoothstep
  }
  // After full brightness until midnight: gradual dim from 1.0→0.35
  if (timeOfDay >= fullBright) {
    const t = (timeOfDay - fullBright) / (24 - fullBright)
    return 1.0 - 0.65 * t * t * (3 - 2 * t)
  }
  // 0:00–sunrise: gradual dim from 0.35→0.15
  const t = timeOfDay / SUNRISE_HOUR
  return 0.35 - 0.2 * t * t * (3 - 2 * t)
}

// ── Food Types ───────────────────────────────────────────

export const FOOD_PROPERTIES: Record<FoodType, {
  amount: number
  hungerReduction: number
  happinessBoost: number
  energyBoost: number
  thirstEffect: number    // positive = increases thirst, negative = decreases
  label: string
  color: string
}> = {
  hay:    { amount: 300, hungerReduction: 15, happinessBoost: 0,  energyBoost: 0,  thirstEffect: 0.3,  label: 'Hay',    color: '#c4a840' },
  apple:  { amount: 60,  hungerReduction: 12, happinessBoost: 5,  energyBoost: 3,  thirstEffect: -0.5, label: 'Apple',  color: '#cc3333' },
  carrot: { amount: 70,  hungerReduction: 10, happinessBoost: 2,  energyBoost: 5,  thirstEffect: -0.2, label: 'Carrot', color: '#ee8833' },
}

// ── Grass Patch (dense grazing area near pond) ───────────

export const GRASS_PATCH_CENTER: Vec3 = [1, 0, -8]
export const GRASS_PATCH_RADIUS = 2.5

// ── Pond Edge (drinking spot) ────────────────────────────

export const POND_DRINK_SPOT: Vec3 = [-5.5, 0, -3]  // edge of pond nearest the field

// ── Drinking ─────────────────────────────────────────────

export const DRINK_DURATION = 4              // sim-seconds
export const DRINKING_HAPPINESS_BOOST = 2
export const DRINKING_THIRST_REDUCTION = 25  // thirst reduction per second while drinking
export const GRAZE_PATCH_DURATION = 8        // sim-seconds

// ── Home / Sleep Routing ────────────────────────────────

export const HOME_ANCHOR: Vec3 = [-10.7, 0, 8.7]  // center of scaled-up barn interior (room to rotate)
export const HOME_RADIUS = 1.0                     // how close cow needs to be to "be home"
export const BARN_ENTRANCE: Vec3 = [-7.0, 0, 5.0] // in front of the barn opening (rotated 45°, scale 1.3)
export const SETTLE_DURATION = 3                // seconds to settle before sleeping

// ── Jump ─────────────────────────────────────────────────

export const JUMP_DURATION = 0.8         // sim-seconds
export const JUMP_HAPPINESS_BOOST = 8
export const JUMP_ENERGY_COST = 1.7

// ── Thirst ──────────────────────────────────────────────

export const RAIN_THIRST_SLOW_FACTOR = 0.2   // rain slows thirst decay by 20%

// ── Health ──────────────────────────────────────────────

export const HEALTH_HUNGER_PENALTY = 0.1     // health loss/sec when hunger > 70
export const HEALTH_THIRST_PENALTY = 0.1     // health loss/sec when thirst > 70
export const HEALTH_ENERGY_PENALTY = 0.05    // health loss/sec when energy < 20
export const HEALTH_WEATHER_PENALTY = 0.02   // health loss/sec per rain intensity when exposed
export const HEALTH_RECOVERY_RATE = 0.05     // health gain/sec when conditions are good
export const HEALTH_LOW_SPEED_PENALTY = 0.2  // movement speed reduction when health < 50
export const HEALTH_LOW_HAPPINESS_PENALTY = 0.5  // extra happiness decay multiplier when health < 50

// ── Milk Production ──────────────────────────────────────

export const MILK_BASE_RATE = 0.5            // liters per sim-hour base rate
export const MILK_MAX_STORAGE = 100          // max milk in udder
export const MILK_OVER_MILKING_THRESHOLD = 20 // milking below this = over-milking
export const MILK_OVER_MILKING_PENALTY = 10  // happiness loss for over-milking
export const MILK_FULL_COMFORT_PENALTY = 0.05 // happiness loss/sec when storage > 90
export const MILK_DRAIN_PER_MILKING = 80     // how much milk is drained per milking session
export const MILK_MIN_AGE = 0.5              // minimum age for milk production

// ── Relationship Tiers ───────────────────────────────────

export const TRUST_TIER_WARY = 30        // 0-30 = wary
export const TRUST_TIER_FAMILIAR = 65    // 31-65 = familiar
// 66+ = bonded

// ── Daily Routine Schedule ──────────────────────────────

export const ROUTINE = {
  morningExplore: { start: 6, end: 8 },
  morningGraze:   { start: 8, end: 11 },
  middayRest:     { start: 12, end: 14 },
  afternoonGraze: { start: 15, end: 17 },
  eveningReturn:  { start: 18, end: 20 },
  nightSleep:     { startHour: 20, endHour: 6 },
}

// ── Seasonal Modifiers ───────────────────────────────────

export const SEASON_MODIFIERS: Record<number, {
  hungerMultiplier: number
  energyCostMultiplier: number
  dayLengthShift: number
  label: string
}> = {
  0: { hungerMultiplier: 1.0,  energyCostMultiplier: 1.0,  dayLengthShift: 0,   label: 'Spring' },
  1: { hungerMultiplier: 0.9,  energyCostMultiplier: 0.9,  dayLengthShift: 1,   label: 'Summer' },
  2: { hungerMultiplier: 1.1,  energyCostMultiplier: 1.1,  dayLengthShift: -0.5, label: 'Autumn' },
  3: { hungerMultiplier: 1.2,  energyCostMultiplier: 1.2,  dayLengthShift: -1,  label: 'Winter' },
}

// ── Weather Effects on Movement ─────────────────────────

export const MUD_SPEED_PENALTY = 0.2        // 20% speed reduction during/after rain outdoors

// ── Age Progression ──────────────────────────────────────

export const AGE_PER_SIM_DAY = 0.002        // age increase per sim-day (0→1 in 500 days)
export const AGE_NUTRITION_BONUS = 1.5       // well-fed cow ages 50% faster

// ── Gate Defaults ────────────────────────────────────────

export const DEFAULT_GATES = [
  {
    id: 'gate_right',
    position: [14, 0, 0] as Vec3,
    isOpen: true,
    exclusionRadius: 2.5,
  },
]

// ── Social Animal Effects ────────────────────────────────

export const SOCIAL_HAPPINESS_BONUS = 0.002  // happiness/sec from nearby animals
export const DOG_EXCITEMENT_BONUS = 3        // wander score boost when dog nearby

// ── Barn Bonuses ─────────────────────────────────────────

export const BARN_ENERGY_BONUS = 1.5         // energy recovery multiplier when in barn
export const BARN_SHELTER_PROTECTION = true   // no weather damage in barn

// ── Persistence ──────────────────────────────────────────

export const SAVE_KEY = 'digitalcow_save'
export const AUTOSAVE_INTERVAL = 60_000      // autosave every 60 real seconds
