// ── Vector ──────────────────────────────────────────────

export type Vec3 = [number, number, number]

// ── Core Types ──────────────────────────────────────────

export type CowBehavior =
  | 'idle'
  | 'walking'
  | 'grazing'
  | 'eating'
  | 'running'
  | 'sitting'
  | 'sleeping'
  | 'jumping'
  | 'settling'
  | 'drinking'

export type CameraMode = 'manual' | 'cinematic' | 'firstPerson'

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export type FoodType = 'hay' | 'apple' | 'carrot'

export type BreedId = 'holstein' | 'gir' | 'sindhi' | 'sahiwal' | 'kankrej'

export type PlayerAction =
  | { type: 'place_food'; foodType: FoodType }
  | { type: 'play' }
  | { type: 'pet' }
  | { type: 'call' }
  | { type: 'jump' }
  | { type: 'drink' }
  | { type: 'graze_patch' }
  | { type: 'milk' }

// ── Activity (intent layer) ─────────────────────────────

export type Activity =
  | { type: 'idle' }
  | { type: 'wander'; destination: Vec3 }
  | { type: 'go_to_food'; targetId: string; destination: Vec3 }
  | { type: 'eat_food'; targetId: string }
  | { type: 'graze' }
  | { type: 'sleep' }
  | { type: 'rest' }
  | { type: 'jump' }
  | { type: 'go_home'; reachedEntrance?: boolean }
  | { type: 'settle_for_sleep' }
  | { type: 'react_to_player'; action: 'play' | 'call'; destination?: Vec3 }
  | { type: 'go_to_pond'; destination: Vec3 }
  | { type: 'drink' }
  | { type: 'go_to_grass'; destination: Vec3 }
  | { type: 'graze_patch' }
  | { type: 'leave_barn' }
  | { type: 'go_to_milk'; destination: Vec3 }
  | { type: 'milking' }

// ── Engine Events ───────────────────────────────────────

export type EngineEvent =
  | { type: 'behavior_changed'; from: CowBehavior; to: CowBehavior }
  | { type: 'activity_changed'; activity: Activity }
  | { type: 'food_placed'; food: FoodItem }
  | { type: 'food_consumed'; foodId: string }
  | { type: 'pet_received' }
  | { type: 'play_started' }
  | { type: 'arrived_at_target' }
  | { type: 'need_critical'; need: keyof CowNeeds; value: number }
  | { type: 'cow_jumped' }
  | { type: 'cow_called' }
  | { type: 'cow_went_home' }
  | { type: 'cow_settled' }
  | { type: 'cow_drinking' }
  | { type: 'cow_grazing_patch' }
  | { type: 'cow_milked' }

// ── Cow State ───────────────────────────────────────────

export interface CowNeeds {
  hunger: number       // 0 (full) → 100 (starving)
  energy: number       // 0 (exhausted) → 100 (fully rested)
  happiness: number    // 0 (miserable) → 100 (joyful)
}

export interface CowPersonality {
  trust: number        // 0–100
  curiosity: number    // 0–100
}

export interface CowState {
  needs: CowNeeds
  personality: CowPersonality
  behavior: CowBehavior
  activity: Activity
  activityStartedAt: number
  nextDecisionAt: number
  position: Vec3
  facingAngle: number
  breed: BreedId
  age: number             // 0.0 (newborn calf) → 1.0 (full adult/mother)
}

// ── World State ─────────────────────────────────────────

export interface FoodItem {
  id: string
  position: Vec3
  amount: number       // 0–100
  placedAt: number
  foodType: FoodType
}

export interface ExclusionZone {
  center: [number, number]    // x, z
  radius: number
}

export interface WorldState {
  timeOfDay: number           // 0.0 – 24.0
  timeSpeed: number           // multiplier
  simulationTime: number
  isPaused: boolean
  windStrength: number        // 0.0 – 1.0
  windDirection: number       // radians
  foods: FoodItem[]
  exclusionZones: ExclusionZone[]
  showButterflies: boolean
  season: number // 0=spring, 1=summer, 2=autumn, 3=winter
}

// ── First-Person Input Intent ──────────────────────────

export interface FirstPersonIntent {
  forward: number   // -1 to 1 (back/forward)
  turn: number      // -1 to 1 (right/left)
  sprint: boolean
}

// ── Store Shape ─────────────────────────────────────────

export interface GameStore {
  cow: CowState
  world: WorldState
  events: EngineEvent[]
  cameraMode: CameraMode
  rain: boolean
  rainIntensity: number  // 0.0 – 1.0
  firstPersonIntent: FirstPersonIntent | null

  tick: (dt: number) => void
  playerAction: (action: PlayerAction) => void
  setFirstPersonIntent: (intent: FirstPersonIntent | null) => void
  setTimeOfDay: (time: number) => void
  setTimeSpeed: (speed: number) => void
  togglePause: () => void
  toggleButterflies: () => void
  setCameraMode: (mode: CameraMode) => void
  toggleRain: () => void
  setRainIntensity: (intensity: number) => void
  setBreed: (breed: BreedId) => void
  setAge: (age: number) => void
  setSeason: (season: number) => void
  flushEvents: () => void
}
