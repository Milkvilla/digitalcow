import { SUNRISE_HOUR, SUNSET_HOUR } from './constants'

// ── Time Palette ────────────────────────────────────────

export interface TimePalette {
  zenithColor: [number, number, number]     // top of sky
  horizonColor: [number, number, number]    // horizon band
  fogColor: [number, number, number]        // scene fog
  sunColor: [number, number, number]        // directional light & sun disc
  ambientColor: [number, number, number]    // ambient light
  cloudTint: [number, number, number]       // cloud coloring
  waterReflect: [number, number, number]    // pond reflection tint
  groundBounce: [number, number, number]    // hemisphere light ground
  sunIntensity: number                      // directional light intensity
  ambientIntensity: number                  // ambient light intensity
  hemiIntensity: number                     // hemisphere light intensity
  starOpacity: number                       // star visibility
  hazeStrength: number                      // horizon haze intensity
}

// ── Keyframe definitions ────────────────────────────────
// Each keyframe is [hour, palette]. The system lerps between adjacent keyframes.

interface PaletteKeyframe {
  hour: number
  zenith: [number, number, number]
  horizon: [number, number, number]
  fog: [number, number, number]
  sun: [number, number, number]
  ambient: [number, number, number]
  cloud: [number, number, number]
  water: [number, number, number]
  ground: [number, number, number]
  sunIntensity: number
  ambientIntensity: number
  hemiIntensity: number
  starOpacity: number
  hazeStrength: number
}

// Hours are anchored to SUNRISE_HOUR/SUNSET_HOUR
const SOLAR_NOON = (SUNRISE_HOUR + SUNSET_HOUR) / 2

const KEYFRAMES: PaletteKeyframe[] = [
  {
    // Deep night (midnight) — deeper blue-black, not just dark
    hour: 0,
    zenith:   [0.01, 0.01, 0.12],
    horizon:  [0.03, 0.03, 0.10],
    fog:      [0.02, 0.02, 0.08],
    sun:      [0.12, 0.15, 0.30],
    ambient:  [0.06, 0.06, 0.16],
    cloud:    [0.08, 0.08, 0.15],
    water:    [0.02, 0.04, 0.10],
    ground:   [0.04, 0.06, 0.04],
    sunIntensity: 0.1,
    ambientIntensity: 0.10,
    hemiIntensity: 0.10,
    starOpacity: 0.95,
    hazeStrength: 0.08,
  },
  {
    // Pre-dawn (twilight starts) — deeper purples
    hour: SUNRISE_HOUR - 1.0,
    zenith:   [0.05, 0.03, 0.18],
    horizon:  [0.22, 0.08, 0.22],
    fog:      [0.10, 0.06, 0.16],
    sun:      [0.50, 0.25, 0.40],
    ambient:  [0.14, 0.10, 0.24],
    cloud:    [0.22, 0.12, 0.28],
    water:    [0.06, 0.05, 0.16],
    ground:   [0.08, 0.10, 0.06],
    sunIntensity: 0.15,
    ambientIntensity: 0.15,
    hemiIntensity: 0.12,
    starOpacity: 0.55,
    hazeStrength: 0.30,
  },
  {
    // Dawn (sunrise) — warm oranges with softer sky
    hour: SUNRISE_HOUR,
    zenith:   [0.25, 0.28, 0.55],
    horizon:  [1.0, 0.42, 0.18],
    fog:      [0.75, 0.48, 0.32],
    sun:      [1.0, 0.48, 0.18],
    ambient:  [0.45, 0.28, 0.22],
    cloud:    [1.0, 0.55, 0.35],
    water:    [0.40, 0.28, 0.20],
    ground:   [0.22, 0.25, 0.10],
    sunIntensity: 0.6,
    ambientIntensity: 0.35,
    hemiIntensity: 0.25,
    starOpacity: 0.12,
    hazeStrength: 0.70,
  },
  {
    // Early morning
    hour: SUNRISE_HOUR + 1.5,
    zenith:   [0.30, 0.55, 0.78],
    horizon:  [0.68, 0.72, 0.65],
    fog:      [0.72, 0.74, 0.68],
    sun:      [1.0, 0.78, 0.50],
    ambient:  [0.52, 0.52, 0.45],
    cloud:    [1.0, 0.88, 0.72],
    water:    [0.42, 0.58, 0.60],
    ground:   [0.28, 0.35, 0.15],
    sunIntensity: 1.0,
    ambientIntensity: 0.50,
    hemiIntensity: 0.35,
    starOpacity: 0.0,
    hazeStrength: 0.28,
  },
  {
    // Morning
    hour: SUNRISE_HOUR + 3,
    zenith:   [0.22, 0.52, 0.82],
    horizon:  [0.58, 0.72, 0.80],
    fog:      [0.70, 0.76, 0.80],
    sun:      [1.0, 0.95, 0.85],
    ambient:  [0.55, 0.58, 0.58],
    cloud:    [1.0, 0.98, 0.94],
    water:    [0.42, 0.62, 0.74],
    ground:   [0.30, 0.42, 0.18],
    sunIntensity: 1.3,
    ambientIntensity: 0.55,
    hemiIntensity: 0.40,
    starOpacity: 0.0,
    hazeStrength: 0.12,
  },
  {
    // Solar noon
    hour: SOLAR_NOON,
    zenith:   [0.13, 0.35, 0.72],
    horizon:  [0.55, 0.72, 0.85],
    fog:      [0.75, 0.82, 0.88],
    sun:      [1.0, 1.0, 0.95],
    ambient:  [0.60, 0.62, 0.65],
    cloud:    [1.0, 1.0, 1.0],
    water:    [0.40, 0.62, 0.78],
    ground:   [0.30, 0.45, 0.18],
    sunIntensity: 1.5,
    ambientIntensity: 0.60,
    hemiIntensity: 0.50,
    starOpacity: 0.0,
    hazeStrength: 0.10,
  },
  {
    // Afternoon
    hour: SUNSET_HOUR - 3,
    zenith:   [0.18, 0.38, 0.68],
    horizon:  [0.60, 0.65, 0.72],
    fog:      [0.72, 0.75, 0.78],
    sun:      [1.0, 0.90, 0.75],
    ambient:  [0.55, 0.55, 0.52],
    cloud:    [1.0, 0.95, 0.85],
    water:    [0.38, 0.55, 0.68],
    ground:   [0.30, 0.40, 0.18],
    sunIntensity: 1.3,
    ambientIntensity: 0.50,
    hemiIntensity: 0.42,
    starOpacity: 0.0,
    hazeStrength: 0.18,
  },
  {
    // Golden hour — warm amber tones throughout
    hour: SUNSET_HOUR - 1.5,
    zenith:   [0.22, 0.28, 0.52],
    horizon:  [0.95, 0.52, 0.18],
    fog:      [0.85, 0.58, 0.32],
    sun:      [1.0, 0.55, 0.15],
    ambient:  [0.55, 0.38, 0.22],
    cloud:    [1.0, 0.65, 0.32],
    water:    [0.55, 0.38, 0.22],
    ground:   [0.32, 0.35, 0.12],
    sunIntensity: 1.0,
    ambientIntensity: 0.48,
    hemiIntensity: 0.38,
    starOpacity: 0.0,
    hazeStrength: 0.62,
  },
  {
    // Sunset — richer, more saturated pinks and deep oranges
    hour: SUNSET_HOUR,
    zenith:   [0.12, 0.10, 0.35],
    horizon:  [0.95, 0.28, 0.12],
    fog:      [0.60, 0.30, 0.20],
    sun:      [1.0, 0.35, 0.10],
    ambient:  [0.38, 0.22, 0.18],
    cloud:    [1.0, 0.40, 0.22],
    water:    [0.38, 0.20, 0.14],
    ground:   [0.22, 0.25, 0.10],
    sunIntensity: 0.5,
    ambientIntensity: 0.30,
    hemiIntensity: 0.22,
    starOpacity: 0.1,
    hazeStrength: 0.72,
  },
  {
    // Dusk (post-sunset) — warm purples
    hour: SUNSET_HOUR + 0.8,
    zenith:   [0.06, 0.04, 0.22],
    horizon:  [0.35, 0.12, 0.20],
    fog:      [0.16, 0.10, 0.16],
    sun:      [0.28, 0.18, 0.38],
    ambient:  [0.16, 0.12, 0.22],
    cloud:    [0.25, 0.14, 0.25],
    water:    [0.10, 0.07, 0.16],
    ground:   [0.10, 0.12, 0.07],
    sunIntensity: 0.15,
    ambientIntensity: 0.15,
    hemiIntensity: 0.12,
    starOpacity: 0.55,
    hazeStrength: 0.35,
  },
  {
    // Night (early) — deep blue-black
    hour: SUNSET_HOUR + 1.5,
    zenith:   [0.01, 0.01, 0.12],
    horizon:  [0.03, 0.03, 0.10],
    fog:      [0.02, 0.02, 0.08],
    sun:      [0.12, 0.15, 0.30],
    ambient:  [0.06, 0.06, 0.16],
    cloud:    [0.08, 0.08, 0.15],
    water:    [0.02, 0.04, 0.10],
    ground:   [0.04, 0.06, 0.04],
    sunIntensity: 0.1,
    ambientIntensity: 0.10,
    hemiIntensity: 0.10,
    starOpacity: 0.95,
    hazeStrength: 0.08,
  },
  {
    // Night (late, wraps to midnight) — deep blue-black
    hour: 24,
    zenith:   [0.01, 0.01, 0.12],
    horizon:  [0.03, 0.03, 0.10],
    fog:      [0.02, 0.02, 0.08],
    sun:      [0.12, 0.15, 0.30],
    ambient:  [0.06, 0.06, 0.16],
    cloud:    [0.08, 0.08, 0.15],
    water:    [0.02, 0.04, 0.10],
    ground:   [0.04, 0.06, 0.04],
    sunIntensity: 0.1,
    ambientIntensity: 0.10,
    hemiIntensity: 0.10,
    starOpacity: 0.95,
    hazeStrength: 0.08,
  },
]

// ── Smooth interpolation helpers ────────────────────────

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    lerpScalar(a[0], b[0], t),
    lerpScalar(a[1], b[1], t),
    lerpScalar(a[2], b[2], t),
  ]
}

/** Smoothstep for nicer transitions */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

// ── Main palette function ───────────────────────────────

/**
 * Returns a full TimePalette for any hour (0–24).
 * Smoothly lerps between keyframe stops — no hard if/else blocks.
 */
export function getTimePalette(timeOfDay: number): TimePalette {
  // Wrap to [0, 24)
  const hour = ((timeOfDay % 24) + 24) % 24

  // Find the two keyframes to interpolate between
  let lo = KEYFRAMES[0]
  let hi = KEYFRAMES[1]

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].hour && hour < KEYFRAMES[i + 1].hour) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }

  // Compute progress between the two keyframes, with smoothstep
  const range = hi.hour - lo.hour
  const raw = range > 0 ? (hour - lo.hour) / range : 0
  const t = smoothstep(raw)

  return {
    zenithColor:      lerpVec3(lo.zenith, hi.zenith, t),
    horizonColor:     lerpVec3(lo.horizon, hi.horizon, t),
    fogColor:         lerpVec3(lo.fog, hi.fog, t),
    sunColor:         lerpVec3(lo.sun, hi.sun, t),
    ambientColor:     lerpVec3(lo.ambient, hi.ambient, t),
    cloudTint:        lerpVec3(lo.cloud, hi.cloud, t),
    waterReflect:     lerpVec3(lo.water, hi.water, t),
    groundBounce:     lerpVec3(lo.ground, hi.ground, t),
    sunIntensity:     lerpScalar(lo.sunIntensity, hi.sunIntensity, t),
    ambientIntensity: lerpScalar(lo.ambientIntensity, hi.ambientIntensity, t),
    hemiIntensity:    lerpScalar(lo.hemiIntensity, hi.hemiIntensity, t),
    starOpacity:      lerpScalar(lo.starOpacity, hi.starOpacity, t),
    hazeStrength:     lerpScalar(lo.hazeStrength, hi.hazeStrength, t),
  }
}
