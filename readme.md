# Digital Cow — Architecture Document

A low-poly 3D farm simulation where a cow lives autonomously — grazing, resting, sleeping — driven by needs, time of day, and player interactions. Built with React Three Fiber.

---

## 1. Project Structure

```
digital-cow/
├── public/
│   └── models/
│       ├── cow.glb                  # Animated low-poly cow (idle, walk, eat, sit, sleep)
│       ├── tree.glb                 # Low-poly tree model
│       ├── barn.glb                 # Low-poly barn model
│       ├── fence.glb                # Fence segment model
│       └── trough.glb              # Food trough model (cosmetic v1, functional later)
├── src/
│   ├── engine/                      # Pure logic — no rendering, no React
│   │   ├── store.ts                 # Zustand vanilla store (all game state)
│   │   ├── types.ts                 # All TypeScript interfaces
│   │   ├── behaviors.ts            # Utility AI — cow decision-making
│   │   ├── needs.ts                # Need decay, conflict resolution
│   │   ├── time.ts                 # Time progression, sun position math
│   │   ├── actions.ts              # Player action handlers (place food, pet, play)
│   │   ├── world-query.ts          # Spatial helpers (findNearestFood, isPointWalkable, sampleRoamTarget)
│   │   ├── events.ts               # Engine event emitter (behavior_changed, food_consumed, etc.)
│   │   └── constants.ts            # Tuning values, decay rates, thresholds
│   ├── scene/                       # React Three Fiber 3D components
│   │   ├── FarmScene.tsx           # R3F Canvas wrapper, scene composition
│   │   ├── Cow.tsx                 # GLTF cow loader, animation controller
│   │   ├── Ground.tsx              # Textured ground plane
│   │   ├── Grass.tsx               # Instanced grass with wind shader
│   │   ├── Trees.tsx               # Tree placement + wind sway
│   │   ├── Barn.tsx                # Barn model loader
│   │   ├── Fences.tsx              # Fence segment placement
│   │   ├── Pond.tsx                # Simple water plane with subtle animation
│   │   ├── Sky.tsx                 # Dynamic sky + sun sphere + lighting
│   │   ├── Food.tsx                # Food item that appears when player feeds
│   │   └── Particles.tsx           # Hearts, dust, zzz, eating particles
│   ├── shaders/
│   │   ├── grass.vert              # Grass vertex shader (wind displacement)
│   │   └── grass.frag              # Grass fragment shader (color variation)
│   ├── audio/
│   │   └── sounds.ts              # Web Audio API procedural sounds
│   ├── ui/                         # React DOM overlay (HTML, not 3D)
│   │   ├── App.tsx                 # Root layout — canvas + UI overlay
│   │   ├── ControlPanel.tsx        # Action buttons (feed, play, pet)
│   │   ├── TimeControl.tsx         # Time-of-day slider + speed multiplier
│   │   ├── StatusBars.tsx          # Hunger / energy / happiness bars
│   │   └── DebugOverlay.tsx        # Toggleable state inspector
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles + UI overlay positioning
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── readme.md                       # This file
```

---

## 2. Tech Stack

| Package | Purpose | Why this |
|---------|---------|----------|
| `react`, `react-dom` | UI framework | Control panel + app shell |
| `three` | 3D engine | Industry standard WebGL |
| `@react-three/fiber` | React renderer for Three.js | Declarative 3D, component model |
| `@react-three/drei` | R3F helpers (Sky, useGLTF, useAnimations, etc.) | Saves hundreds of lines of boilerplate |
| `@react-three/postprocessing` | Bloom, vignette | Visual polish (optional, Phase 4) |
| `zustand` | State management | Tiny (~2KB), works inside and outside React |
| `vite` | Build tool | Fast HMR, zero-config TypeScript |
| `typescript` | Type safety | Catch state bugs at compile time |

**No other dependencies.** Audio uses the native Web Audio API. Shaders are raw GLSL files imported as strings.

---

## 3. State Model

```ts
// ── Core Types ──────────────────────────────────────────

type CowBehavior =
  | 'idle'
  | 'walking'
  | 'grazing'
  | 'eating'      // eating from placed food
  | 'running'
  | 'sitting'
  | 'sleeping'

type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

type PlayerAction = 'place_food' | 'play' | 'pet'

// ── Activity (intent layer — what the cow is trying to do) ──

type Activity =
  | { type: 'idle' }
  | { type: 'wander'; destination: Vec3 }
  | { type: 'go_to_food'; targetId: string; destination: Vec3 }
  | { type: 'eat_food'; targetId: string }
  | { type: 'graze' }
  | { type: 'sleep' }
  | { type: 'rest' }
  | { type: 'react_to_player'; action: PlayerAction }

// Activity drives both behavior (animation) AND movement.
// The behavior system sets the activity; the tick loop derives
// CowBehavior from it:
//   wander        → 'walking'
//   go_to_food    → 'walking'
//   eat_food      → 'eating'
//   graze         → 'grazing'
//   sleep         → 'sleeping'
//   rest          → 'sitting'
//   react_to_player('play') → 'running'

type Vec3 = [number, number, number]

// ── Engine Events (emitted by tick, consumed by scene/audio) ──

type EngineEvent =
  | { type: 'behavior_changed'; from: CowBehavior; to: CowBehavior }
  | { type: 'activity_changed'; activity: Activity }
  | { type: 'food_placed'; food: FoodItem }
  | { type: 'food_consumed'; foodId: string }
  | { type: 'pet_received' }
  | { type: 'play_started' }
  | { type: 'arrived_at_target' }
  | { type: 'need_critical'; need: keyof CowNeeds; value: number }

// ── Cow State ───────────────────────────────────────────

interface CowNeeds {
  hunger: number       // 0 (full) → 100 (starving)
  energy: number       // 0 (exhausted) → 100 (fully rested)
  happiness: number    // 0 (miserable) → 100 (joyful)
}

interface CowPersonality {
  trust: number        // 0–100, grows with consistent care
  curiosity: number    // 0–100, affects idle behavior variety
}

interface CowState {
  needs: CowNeeds
  personality: CowPersonality
  behavior: CowBehavior             // derived from activity, drives animation
  activity: Activity                // what the cow is trying to do (intent)
  activityStartedAt: number         // simulation time
  nextDecisionAt: number            // sim time when behavior is re-evaluated
  position: Vec3                    // world position (x, y, z)
  facingAngle: number               // y-axis rotation in radians
}

// ── World State ─────────────────────────────────────────

interface FoodItem {
  id: string
  position: Vec3
  amount: number       // 0–100, decreases as cow eats
  placedAt: number     // simulation time
}

// Walkability: positions where the cow cannot go (barn, pond, fences).
// Represented as an exclusion list. Target sampling rejects points
// that fall inside any exclusion zone.
interface ExclusionZone {
  center: [number, number]    // x, z
  radius: number
}

interface WorldState {
  timeOfDay: number           // 0.0 – 24.0 (continuous)
  timeSpeed: number           // multiplier: 1 = real-time, 60 = 1 min/sec
  simulationTime: number      // total elapsed sim seconds
  isPaused: boolean
  windStrength: number        // 0.0 – 1.0
  windDirection: number       // radians
  foods: FoodItem[]           // active food items in scene
  exclusionZones: ExclusionZone[]  // non-walkable areas (computed from layout at init)
}

// ── Derived (computed, not stored) ──────────────────────

interface DerivedState {
  timeOfDayLabel: TimeOfDay
  sunPosition: Vec3                        // calculated from timeOfDay
  sunColor: [number, number, number]       // RGB, changes with time
  ambientIntensity: number                 // dims at night
  skyTurbidity: number                     // haze, changes with time
}

// ── Store Shape ─────────────────────────────────────────

interface GameStore {
  cow: CowState
  world: WorldState
  events: EngineEvent[]    // flushed each frame after scene/audio consume them

  // Actions
  tick: (deltaSeconds: number) => void
  playerAction: (action: PlayerAction) => void
  setTimeOfDay: (time: number) => void
  setTimeSpeed: (speed: number) => void
  togglePause: () => void
  flushEvents: () => void

  // Derived (computed via selectors, not stored)
}
```

> **Engine store uses `zustand/vanilla`** — the store is created with `createStore()` (not `create()`), keeping the engine free of React imports. A thin `src/ui/hooks.ts` file wraps it with `useStore()` for React components.

---

## 4. Behavior System (Utility AI)

The cow makes its own decisions using **utility scoring**. Each possible activity gets a score (0–100) based on current needs, time, and environment. The highest score wins. The chosen activity then determines `CowBehavior` (which drives animation).

```ts
function scoreActivities(cow: CowState, world: WorldState): Record<string, number> {
  const { hunger, energy, happiness } = cow.needs
  const time = world.timeOfDay
  const nearestFood = findNearestFood(cow.position, world.foods)
  const isNight = time >= 21 || time < 5

  return {
    sleep:     isNight ? 80 : 0
             + (energy < 20 ? 90 : 0)
             + (energy < 40 ? 30 : 0),

    eat_food:  nearestFood && hunger > 30 ? 70 + hunger * 0.2 : 0,

    graze:     hunger > 50 ? 60
             : (time >= 6 && time < 10 ? 40 : 15),

    rest:      energy < 50 ? 45
             : (time >= 14 && time < 17 ? 35 : 10),

    wander:    energy > 50 ? 20 : 5,

    idle:      10,  // always available as fallback
  }
}

// Maps the winning activity to a concrete Activity object:
function buildActivity(key: string, cow: CowState, world: WorldState): Activity {
  switch (key) {
    case 'eat_food': {
      const food = findNearestFood(cow.position, world.foods)!
      return { type: 'go_to_food', targetId: food.id, destination: food.position }
    }
    case 'wander':
      return { type: 'wander', destination: sampleRoamTarget(world) }
    case 'sleep':  return { type: 'sleep' }
    case 'rest':   return { type: 'rest' }
    case 'graze':  return { type: 'graze' }
    default:       return { type: 'idle' }
  }
}
```

**Decision timing:** Cow re-evaluates at `nextDecisionAt` (set to current sim time + 5–15 random seconds on each decision).

**Behavior stickiness:** Current activity type gets a +15 bonus to prevent rapid switching.

**Noise:** Add random ±5 to each score for organic variation.

**Transitions:**
- Activity completes naturally (e.g., food depleted → `food_consumed` event → re-evaluate)
- A higher-priority need emerges (e.g., energy drops below 20 → immediate re-evaluate)
- `nextDecisionAt` reached → scheduled re-evaluation

### Activity → Behavior mapping

```ts
function behaviorFromActivity(activity: Activity): CowBehavior {
  switch (activity.type) {
    case 'wander':
    case 'go_to_food':    return 'walking'
    case 'eat_food':      return 'eating'
    case 'graze':         return 'grazing'
    case 'sleep':         return 'sleeping'
    case 'rest':          return 'sitting'
    case 'react_to_player': return activity.action === 'play' ? 'running' : 'idle'
    default:              return 'idle'
  }
}
```

### Walking to targets

When cow decides to eat placed food:
1. Activity set to `{ type: 'go_to_food', targetId, destination }`
2. Behavior derived as `'walking'`, animation plays Walk clip
3. Each tick, move cow toward `destination` at walk speed
4. Target is validated via `isPointWalkable()` — avoids barn, pond, fences
5. When within 0.5 units, activity transitions to `{ type: 'eat_food', targetId }`
6. Behavior becomes `'eating'`, food amount decreases per tick
7. When food depleted, emit `food_consumed` event, re-evaluate

---

## 5. Time System

### Time progression

```ts
function updateTime(world: WorldState, realDeltaMs: number): number {
  if (world.isPaused) return world.timeOfDay

  // Convert real milliseconds to simulation hours
  // timeSpeed=1: 1 real second = 1 sim second
  // timeSpeed=60: 1 real second = 1 sim minute
  const simSeconds = (realDeltaMs / 1000) * world.timeSpeed
  const simHours = simSeconds / 3600

  return (world.timeOfDay + simHours) % 24
}
```

### Sun position (arc across sky)

```ts
function getSunPosition(timeOfDay: number): [number, number, number] {
  // Sun rises at 6:00, sets at 20:00
  // Maps time to angle: 6h = 0° (horizon east), 13h = 90° (zenith), 20h = 180° (horizon west)
  const sunriseHour = 6
  const sunsetHour = 20
  const dayLength = sunsetHour - sunriseHour  // 14 hours

  if (timeOfDay < sunriseHour || timeOfDay > sunsetHour) {
    // Sun is below horizon at night
    return [0, -10, 0]
  }

  const progress = (timeOfDay - sunriseHour) / dayLength  // 0 → 1
  const angle = progress * Math.PI  // 0 → π

  const distance = 50  // distance of sun from origin
  const x = Math.cos(angle) * distance      // east → west
  const y = Math.sin(angle) * distance       // rises then falls
  const z = -20                               // slightly behind scene

  return [x, y, z]
}
```

### Sun color by time

```ts
function getSunColor(timeOfDay: number): [number, number, number] {
  // Dawn/dusk: warm orange. Noon: white. Night: cool blue (moonlight).
  if (timeOfDay >= 6 && timeOfDay < 8)   return [1.0, 0.7, 0.4]  // dawn warm
  if (timeOfDay >= 8 && timeOfDay < 16)  return [1.0, 0.95, 0.9] // daylight
  if (timeOfDay >= 16 && timeOfDay < 20) return [1.0, 0.6, 0.3]  // sunset warm
  return [0.2, 0.2, 0.5]                                          // night cool
}
```

### Time-of-day label

```ts
function getTimeLabel(time: number): TimeOfDay {
  if (time >= 5 && time < 7)   return 'dawn'
  if (time >= 7 && time < 12)  return 'morning'
  if (time >= 12 && time < 14) return 'noon'
  if (time >= 14 && time < 18) return 'afternoon'
  if (time >= 18 && time < 21) return 'evening'
  return 'night'
}
```

---

## 6. Animation System

### GLTF model expectations

The cow.glb model should contain these named animation clips:

| Clip Name | Description | Loop |
|-----------|-------------|------|
| `Idle` | Standing, subtle body sway, tail wag | yes |
| `Walk` | Walking cycle | yes |
| `Eat` | Head down, jaw movement | yes |
| `Run` | Fast leg cycle | yes |
| `Sit` | Transition to sitting pose | once, then hold |
| `Sleep` | Lying down, slow breathing | yes |

### Animation controller (in Cow.tsx)

```ts
// Pseudocode for animation management
const animationMap: Record<CowBehavior, string> = {
  idle:     'Idle',
  walking:  'Walk',
  grazing:  'Eat',    // reuse eat animation for grazing
  eating:   'Eat',
  running:  'Run',
  sitting:  'Sit',
  sleeping: 'Sleep',
}

// On behavior change:
// 1. Get new clip name from animationMap
// 2. Crossfade from current action to new action over 0.5 seconds
// 3. mixer.clipAction(newClip).crossFadeFrom(currentAction, 0.5).play()
```

### Movement

Movement is driven by the activity's `destination` field (present on `wander` and `go_to_food` activities).

```ts
function updateCowPosition(cow: CowState, delta: number): void {
  const dest = getActivityDestination(cow.activity)
  if (!dest) return  // stationary activities (eat, sleep, graze, idle)

  const dx = dest[0] - cow.position[0]
  const dz = dest[2] - cow.position[2]
  const dist = Math.sqrt(dx * dx + dz * dz)

  if (dist < 0.5) {
    // Arrived — emit 'arrived_at_target', transition activity
    // e.g., go_to_food → eat_food
    return
  }

  const speed = cow.behavior === 'running' ? 3.0 : 1.0  // units/sec
  const step = Math.min(speed * delta, dist)
  const angle = Math.atan2(dx, dz)

  cow.position = [
    cow.position[0] + (dx / dist) * step,
    cow.position[1],
    cow.position[2] + (dz / dist) * step,
  ]
  cow.facingAngle = angle  // renderer lerps this for smooth turning
}

function getActivityDestination(activity: Activity): Vec3 | null {
  if (activity.type === 'wander' || activity.type === 'go_to_food') {
    return activity.destination
  }
  return null
}
```

---

## 7. Scene Graph

```tsx
// FarmScene.tsx — component hierarchy
<Canvas camera={{ position: [12, 8, 12], fov: 45 }} shadows>

  {/* Sky + Lighting */}
  <Sky sunPosition={sunPos} turbidity={turbidity} rayleigh={rayleigh} />
  <directionalLight
    position={sunPos}
    color={sunColor}
    intensity={sunIntensity}
    castShadow
    shadow-mapSize={[1024, 1024]}
  />
  <ambientLight intensity={ambientIntensity} color={ambientColor} />
  <hemisphereLight
    skyColor={skyHemiColor}
    groundColor="#8B7355"
    intensity={0.3}
  />

  {/* Sun visual (glowing sphere) */}
  <Sun position={sunPos} visible={isDaytime} />

  {/* Environment */}
  <Ground />               {/* 40x40 textured plane, receiveShadow */}
  <Grass />                {/* ~2000 instanced blades with wind shader */}
  <Pond position={[-8, 0, -5]} />
  <Trees positions={treePositions} windStrength={wind} />
  <Barn position={[-10, 0, 8]} />
  <Fences segments={fenceSegments} />

  {/* Interactive */}
  <Cow state={cowState} />
  {foods.map(f => <Food key={f.id} item={f} />)}

  {/* Effects */}
  <Particles />

</Canvas>
```

### Camera

Fixed isometric-style view. No OrbitControls in v1.

```ts
// Camera setup
const CAMERA_POSITION: [number, number, number] = [12, 8, 12]
const CAMERA_LOOK_AT: [number, number, number] = [0, 0, 0]
const CAMERA_FOV = 45
```

---

## 8. Shader System

### Grass Wind Shader

**Vertex shader** (`grass.vert`):

```glsl
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;

attribute float aHeight;      // per-instance: blade height
attribute float aOffset;      // per-instance: random phase offset

varying float vHeight;
varying float vFade;

void main() {
  vHeight = aHeight;

  vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);

  // Wind displacement — stronger at blade tip (position.y = top)
  float tipFactor = position.y / aHeight;
  float wave = sin(uTime * 2.0 + worldPos.x * 0.5 + worldPos.z * 0.3 + aOffset);
  float sway = wave * tipFactor * uWindStrength * 0.3;

  worldPos.x += sway * uWindDirection.x;
  worldPos.z += sway * uWindDirection.y;

  // Fade out distant grass
  vFade = smoothstep(20.0, 15.0, length(worldPos.xz));

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

**Fragment shader** (`grass.frag`):

```glsl
varying float vHeight;
varying float vFade;

void main() {
  // Color gradient: darker at base, lighter at tip
  vec3 baseColor = vec3(0.15, 0.35, 0.08);
  vec3 tipColor = vec3(0.3, 0.55, 0.15);
  vec3 color = mix(baseColor, tipColor, vHeight);

  gl_FragColor = vec4(color, vFade);
}
```

### Grass geometry (instanced)

```ts
// Each grass blade: a simple triangle or thin quad
// width: 0.02–0.05, height: 0.2–0.5 (randomized per instance)
// ~2000 instances scattered across the ground plane
// Use InstancedBufferGeometry with per-instance attributes:
//   - position (x, z on ground plane)
//   - rotation (random y-axis)
//   - height (random 0.2–0.5)
//   - offset (random 0–2π for wind phase)
```

---

## 9. Audio System

Procedural audio using Web Audio API. No audio files needed.

> **Note:** Web Audio API has no built-in noise generators (no "BrownNoise" or "WhiteNoise" node). Noise is generated by filling an `AudioBuffer` with random samples and looping it via `AudioBufferSourceNode`.

### Noise generation helper

```ts
function createNoiseBuffer(ctx: AudioContext, durationSec = 2): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * durationSec
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1  // white noise
  }
  return buffer
}
// Reuse this buffer for all noise-based sounds (chew, footstep, wind).
```

### Sound definitions

| Sound | Trigger | Method |
|-------|---------|--------|
| Moo | `behavior_changed` to idle (random chance), or `pet_received` | OscillatorNode: start 300Hz, frequency ramp to 200Hz over 0.6s, gain envelope |
| Chew | `behavior_changed` to eating/grazing | Looping noise buffer → BiquadFilter(bandpass, 800Hz), gain pulsed 0.1s on/off |
| Footstep | Walking/running (timed to animation cycle) | Short noise buffer slice → BiquadFilter(highpass, 2000Hz), 0.05s gain envelope |
| Wind | Always playing, gain = windStrength * 0.1 | Looping noise buffer → BiquadFilter(bandpass, 400Hz, Q=0.5), continuous |

### Audio engine structure

```ts
class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode
  private noiseBuffer: AudioBuffer    // pre-generated, reused

  init(): void         // call on first user interaction (click/tap) — browser autoplay policy
  playMoo(): void
  startChewing(): void
  stopChewing(): void
  playFootstep(): void
  setWindVolume(strength: number): void
}
```

**Event-driven:** The audio engine subscribes to `EngineEvent[]` each frame. On `behavior_changed` → start/stop chew loop. On `pet_received` → play moo. This keeps audio decoupled from engine logic.

---

## 10. UI System

The UI is a React DOM overlay on top of the 3D canvas. Positioned with CSS `position: absolute`.

### Layout

```
┌─────────────────────────────────────────────────────┐
│                    3D CANVAS                         │
│                  (full viewport)                     │
│                                                      │
│  ┌──────────┐                        ┌────────────┐ │
│  │ Status   │                        │  Time      │ │
│  │ Bars     │                        │  Control   │ │
│  │ hunger   │                        │  ──●────── │ │
│  │ energy   │                        │  speed: 1x │ │
│  │ happy    │                        │            │ │
│  └──────────┘                        └────────────┘ │
│                                                      │
│           ┌──────────────────────┐                   │
│           │  🍃 Feed  🎾 Play  🤚 Pet │              │
│           └──────────────────────┘                   │
└─────────────────────────────────────────────────────┘
```

### Components

**App.tsx** — root layout:
```tsx
function App() {
  return (
    <div className="app">
      <FarmScene />           {/* fills viewport */}
      <StatusBars />          {/* top-left overlay */}
      <TimeControl />         {/* top-right overlay */}
      <ControlPanel />        {/* bottom-center overlay */}
      <DebugOverlay />        {/* toggleable with ~ key */}
    </div>
  )
}
```

**StatusBars.tsx** — reads from Zustand store:
```tsx
// Displays 3 horizontal bars for hunger, energy, happiness
// Color-coded: green (good) → yellow (warning) → red (critical)
// Updates reactively via useStore selectors
```

**TimeControl.tsx**:
```tsx
// Range input: 0–24 (time of day, sets directly)
// Speed buttons: 1x, 10x, 60x, 300x
// Pause/play toggle
// Displays: "Morning 8:30 AM" label
```

**ControlPanel.tsx**:
```tsx
// Three buttons:
// Feed — calls store.playerAction('place_food')
//   → creates FoodItem at random position near cow
//   → cow walks to it, eats it
// Play — calls store.playerAction('play')
//   → cow runs around happily, +happiness, -energy
// Pet — calls store.playerAction('pet')
//   → hearts particle effect, +happiness, +trust
```

**DebugOverlay.tsx**:
```tsx
// Toggle with ~ key
// Shows raw state JSON: cow needs, behavior, position, time
// Shows behavior scores from utility AI
// Shows current animation clip name
// FPS counter
```

---

## 11. Particle System

Simple particle effects using Three.js Points or instanced quads.

### Effects

| Effect | Trigger | Visual | Duration |
|--------|---------|--------|----------|
| Hearts | Pet action | 3-5 pink heart shapes float up | 2 seconds |
| Dust | Walking/running | Small brown dots at feet | Continuous while moving |
| Zzz | Sleeping | "Z" shapes float up from cow | Continuous while sleeping |
| Food sparkle | Food placed | Yellow sparkles at food position | 1 second |
| Eating bits | Eating | Green bits fly from mouth | Continuous while eating |

### Implementation approach

Each effect is a component that:
1. Maintains a pool of particle objects (Points geometry)
2. On trigger, initializes N particles with position, velocity, lifetime
3. In useFrame, updates positions, fades alpha, removes expired
4. Renders as Points with small textures or colored dots

---

## 12. Game Loop

### Tick architecture

The simulation runs on a **fixed sim-time timestep**. When `timeSpeed` is high, the loop runs multiple substeps per frame instead of scaling dt (which would cause large jumps in movement and need decay).

```ts
const SIM_TICK = 1 / 30           // fixed: 1/30th of a sim-second per tick
const MAX_SUBSTEPS_PER_FRAME = 20 // safety cap: prevents freeze at extreme speeds

useFrame((_, realDelta) => {
  if (store.world.isPaused) return

  // How many sim-seconds should pass this frame
  const simDeltaTarget = realDelta * store.world.timeSpeed
  const substeps = Math.min(
    Math.ceil(simDeltaTarget / SIM_TICK),
    MAX_SUBSTEPS_PER_FRAME
  )

  for (let i = 0; i < substeps; i++) {
    store.tick(SIM_TICK)
  }

  // Scene/audio consume events after all substeps
  const events = store.events
  store.flushEvents()
  // → pass events to particles, audio, debug overlay
})
```

At `timeSpeed=1` and 60fps: ~2 substeps/frame.
At `timeSpeed=60`: ~120 needed, capped at 20 (simulation slows gracefully).
At `timeSpeed=300`: capped at 20 substeps, time advances at ~10x real visual rate.

### What happens each tick

Each tick advances exactly `SIM_TICK` sim-seconds. No scaling by timeSpeed inside tick — that's handled by the substep count above.

```ts
function tick(dt: number) {  // dt is always SIM_TICK
  const events: EngineEvent[] = []

  // 1. Advance time
  world.timeOfDay = (world.timeOfDay + dt / 3600) % 24
  world.simulationTime += dt

  // 2. Decay needs
  cow.needs.hunger = clamp(cow.needs.hunger + HUNGER_DECAY_PER_SEC * dt, 0, 100)
  cow.needs.energy = clamp(cow.needs.energy - ENERGY_DECAY_PER_SEC * dt, 0, 100)
  cow.needs.happiness = clamp(cow.needs.happiness - HAPPINESS_DECAY_PER_SEC * dt, 0, 100)

  // 2b. Emit critical need warnings
  if (cow.needs.hunger > 85) events.push({ type: 'need_critical', need: 'hunger', value: cow.needs.hunger })
  if (cow.needs.energy < 15) events.push({ type: 'need_critical', need: 'energy', value: cow.needs.energy })

  // 3. Apply activity effects
  applyActivityEffects(cow, dt)
  //   eat_food: hunger -= 15/sec, food.amount -= 20/sec
  //   sleep:    energy += 10/sec
  //   graze:    hunger -= 5/sec
  //   wander:   (no effect, just moving)
  //   react_to_player(play): energy -= 8/sec, happiness += 3/sec

  // 4. Move cow toward activity destination
  updateCowPosition(cow, dt)

  // 5. Check activity completion
  //   go_to_food arrived → transition to eat_food, emit 'arrived_at_target'
  //   eat_food & food depleted → emit 'food_consumed', force re-evaluate
  //   wander arrived → re-evaluate

  // 6. Re-evaluate activity (at nextDecisionAt, or on completion, or on critical need)
  if (world.simulationTime >= cow.nextDecisionAt || activityCompleted) {
    const oldBehavior = cow.behavior
    const scores = scoreActivities(cow, world)
    const winnerKey = pickHighestWithNoise(scores, 5, cow.activity.type)
    const newActivity = buildActivity(winnerKey, cow, world)
    cow.activity = newActivity
    cow.behavior = behaviorFromActivity(newActivity)
    cow.activityStartedAt = world.simulationTime
    cow.nextDecisionAt = world.simulationTime + 5 + Math.random() * 10

    if (cow.behavior !== oldBehavior) {
      events.push({ type: 'behavior_changed', from: oldBehavior, to: cow.behavior })
    }
    events.push({ type: 'activity_changed', activity: newActivity })
  }

  // 7. Update food items (remove depleted)
  world.foods = world.foods.filter(f => {
    if (f.amount <= 0) {
      events.push({ type: 'food_consumed', foodId: f.id })
      return false
    }
    return true
  })

  // 8. Update personality (very slow drift)
  // trust increases if cow has been fed recently
  // curiosity increases with player interaction variety

  // 9. Append events to store
  store.events.push(...events)
}
```

### Need decay rates (tuning constants)

```ts
const HUNGER_DECAY_PER_SEC = 0.5    // hunger goes 0→100 in ~200 sim-seconds
const ENERGY_DECAY_PER_SEC = 0.3    // energy goes 100→0 in ~333 sim-seconds
const HAPPINESS_DECAY_PER_SEC = 0.2 // happiness goes 100→0 in ~500 sim-seconds
```

---

## 13. Asset Pipeline

### Where to get models

| Asset | Source | Notes |
|-------|--------|-------|
| Cow (animated) | Quaternius free animal pack, or Sketchfab CC0 | Need: idle, walk, eat, sit, sleep clips |
| Trees | Kenney Nature Kit, or Quaternius | Low-poly style |
| Barn | Kenney Farm Kit, or model manually | Simple box + roof |
| Fences | Kenney, or simple box geometry in code | Can be procedural |
| Ground texture | Ambient CG (CC0 textures) | Grass/dirt tileable |
| Trough | Simple box geometry in code | Cosmetic v1, can be procedural |

### Model processing workflow

1. Download model (FBX/OBJ/GLTF from source)
2. Open in **Blender**
3. Verify/adjust: scale (cow ~2 units tall), origin (feet at y=0), face count (<2000 tris)
4. If no animations: rig in Blender or upload to **Mixamo** for auto-rigging + animation
5. Export as `.glb` (binary GLTF — single file, compressed)
6. Place in `public/models/`
7. Optimize with `gltf-transform` CLI if needed: `npx @gltf-transform/cli optimize cow.glb cow.glb`

### If cow model has no animations

Use Mixamo (free with Adobe account):
1. Upload model to mixamo.com
2. Auto-rigging detects skeleton
3. Browse animation library, download: idle, walking, eating (use "picking up" as proxy), sitting, sleeping (use "lying down")
4. Import all into Blender, combine into single file with named actions
5. Export as .glb

---

## 14. World Query Helpers

Pure functions in `src/engine/world-query.ts` that the behavior system uses for spatial decisions:

```ts
// Find closest food item with amount > 0
function findNearestFood(cowPos: Vec3, foods: FoodItem[]): FoodItem | null

// Check if a point is inside any exclusion zone (barn, pond, fence)
function isPointWalkable(point: [number, number], zones: ExclusionZone[]): boolean

// Sample a random walkable point within roam bounds
// Retries up to 10 times if sampled point hits an exclusion zone
function sampleRoamTarget(world: WorldState): Vec3

// Distance between two xz positions (ignores y)
function distanceXZ(a: Vec3, b: Vec3): number
```

Exclusion zones are computed once at init from `SCENE_LAYOUT`:

```ts
const EXCLUSION_ZONES: ExclusionZone[] = [
  { center: [-10, 8], radius: 4 },    // barn
  { center: [-8, -5], radius: 3.5 },  // pond
  // fences: approximated as circles around fence midpoints
]
```

---

## 15. Development Phases

### Phase 0 — "Headless Engine" (prove the simulation)

- [ ] Project setup: Vite + React + TypeScript
- [ ] Install zustand (vanilla store)
- [ ] Core types in `types.ts`
- [ ] Zustand vanilla store with CowState, WorldState, events
- [ ] Time system: `updateTime()`, `getSunPosition()`, `getTimeLabel()`
- [ ] Need decay system
- [ ] Activity system: `scoreActivities()`, `buildActivity()`, `behaviorFromActivity()`
- [ ] World query helpers: `isPointWalkable()`, `sampleRoamTarget()`, `findNearestFood()`
- [ ] Tick function with substep logic
- [ ] `playerAction('place_food')` handler
- [ ] Debug overlay component (renders raw JSON state, behavior scores, event log)
- [ ] Minimal `App.tsx` that runs the tick loop and shows DebugOverlay only

**Milestone:** Run the simulation headlessly — watch JSON state evolve. Cow transitions between activities. Feed it, watch it walk to food and eat. No 3D rendering yet, just proof the engine works.

### Phase 1 — "It Renders" (first visual)

- [ ] Install three, @react-three/fiber, @react-three/drei
- [ ] R3F Canvas with fixed camera
- [ ] Green ground plane with `receiveShadow`
- [ ] `<Sky>` component driven by engine's `timeOfDay`
- [ ] Directional light + ambient light, color/intensity from time
- [ ] Static cow model loaded with `useGLTF` (no animation yet)
- [ ] Engine-to-scene bridge: `useStore()` hook wrapper
- [ ] Wire engine tick into `useFrame` with substep loop
- [ ] Debug overlay showing live state alongside 3D view

**Milestone:** Cow model standing on green ground. Sky changes color as time advances. Debug panel shows engine state updating in real-time.

### Phase 2 — "It Moves" (animation + interaction)

- [ ] Cow animation: load clips with `useAnimations`, play idle
- [ ] Animation controller: crossfade between clips on behavior change
- [ ] Cow movement: position updates from engine reflected in scene
- [ ] Smooth facing angle (lerp in renderer, not engine)
- [ ] Feed action: button places food, cow walks to it, eats it (full loop)
- [ ] Play action: cow runs around, +happiness, -energy
- [ ] Pet action: +happiness, +trust
- [ ] StatusBars UI (hunger, energy, happiness)
- [ ] TimeControl UI (slider, speed buttons, pause)
- [ ] ControlPanel UI (feed, play, pet buttons)

**Milestone:** Complete interaction loop working end-to-end. Feed the cow and watch it walk to food, eat, then decide what to do next. Time controls work.

### Phase 3 — "It Breathes" (environment)

- [ ] Instanced grass with wind vertex shader
- [ ] Trees with wind sway animation
- [ ] Pond (simple reflective/transparent plane)
- [ ] Barn model
- [ ] Fence segments
- [ ] Particle effects (hearts on pet, dust on walk, zzz on sleep)
- [ ] Event-driven particles: subscribe to engine events

**Milestone:** Rich, alive environment. Grass sways, trees move, particles respond to cow actions.

### Phase 4 — "It Shines" (polish)

- [ ] Procedural audio engine (moo, chew, footstep, wind ambient)
- [ ] Audio driven by engine events
- [ ] Personality system (trust, curiosity slow drift)
- [ ] Random idle variations (look around, tail wag timing)
- [ ] Post-processing (optional: bloom, vignette)
- [ ] Mobile responsive (touch-friendly controls, reduced grass density)

**Milestone:** Polished, alive-feeling simulation with audio and visual effects.

---

## 16. Scene Layout (top-down view)

```
        N
        │
   ┌────┴────────────────────────┐
   │                              │
   │   [Barn]                     │
   │      │                       │
   │   ───┤   fence fence fence   │
   │      │                       │
W ─│   [Trough]    🐄            │─ E
   │                   [Tree]     │
   │                              │
   │      [Pond]        [Tree]    │
   │                              │
   │           [Tree]             │
   │                              │
   └──────────┬──────────────────┘
              │
              S

Ground: 40 x 40 units
Camera: looking from SE corner, elevated
Cow roam area: central 20x20 zone
```

### Static object positions (tuned during dev)

```ts
const SCENE_LAYOUT = {
  barn:    { position: [-10, 0, 8],  rotation: [0, Math.PI / 4, 0] },
  trough:  { position: [-6, 0, 5] },
  pond:    { position: [-8, 0, -5],  radius: 3 },
  trees: [
    { position: [8, 0, -3] },
    { position: [10, 0, -8] },
    { position: [-5, 0, -10] },
    { position: [3, 0, 10] },
  ],
  fences: [
    { start: [-12, 0, 6], end: [-12, 0, 12] },  // behind barn
    { start: [-12, 0, 12], end: [-6, 0, 12] },
  ],
  cowSpawn: { position: [0, 0, 0] },
  cowRoamBounds: { min: [-8, -8], max: [8, 8] },
}
```

---

## 17. Key Architectural Rules

1. **Engine is pure** — `src/engine/` has zero imports from React, Three.js, or DOM. Store uses `zustand/vanilla` (`createStore()`, not `create()`). React bindings live in `src/ui/hooks.ts`. This means the engine can be unit-tested trivially and reused on a server later.

2. **Scene reads state, never writes** — R3F components read from the Zustand store and render. They never mutate game state. The only place state changes is in `store.tick()` and `store.playerAction()`.

3. **Scene reacts to events, not state diffs** — Particles and audio are triggered by `EngineEvent[]` emitted from `tick()`, not by comparing previous/current state. Events are flushed each frame after consumption.

4. **One source of truth** — The Zustand store is the only state. No `useState` for game data in components. UI components use `useStore(selector)` to read.

5. **Fixed sim-time timestep** — Each tick advances exactly `SIM_TICK` sim-seconds. High `timeSpeed` runs more substeps per frame (capped at `MAX_SUBSTEPS_PER_FRAME`), not larger dt values.

6. **Activity drives behavior** — The behavior system sets an `Activity` (intent). `CowBehavior` (animation state) is derived from the activity, never set directly.

7. **Behaviors are data, not code** — The utility AI scoring table is a data structure, not a switch statement with hardcoded logic. This makes it easy to tune and extend.

8. **Walkability is enforced** — Target positions are validated against exclusion zones before being assigned. The cow never walks through the barn, pond, or fences.
