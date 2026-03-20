import type { Vec3, TimeOfDay } from './types'
import { SUNRISE_HOUR, SUNSET_HOUR, SUN_DISTANCE } from './constants'

/**
 * Advance timeOfDay by dt sim-seconds, wrapping at 24.
 * dt is in sim-seconds; we convert to hours (÷ 3600).
 */
export function updateTime(timeOfDay: number, dt: number): number {
  const hours = dt / 3600
  return (timeOfDay + hours) % 24
}

/**
 * Sun arcs from east (+x) at sunrise through top (y) at solar noon
 * to west (-x) at sunset. Below the horizon at night.
 */
export function getSunPosition(timeOfDay: number): Vec3 {
  const dayLength = SUNSET_HOUR - SUNRISE_HOUR

  // Normalized progress through the daylight window: 0 at sunrise, 1 at sunset
  const t = (timeOfDay - SUNRISE_HOUR) / dayLength

  if (t < 0 || t > 1) {
    // Night: sun is below the horizon
    // Mirror daytime arc but below y=0
    const nightLength = 24 - dayLength
    let nightProgress: number
    if (timeOfDay >= SUNSET_HOUR) {
      nightProgress = (timeOfDay - SUNSET_HOUR) / nightLength
    } else {
      nightProgress = (timeOfDay + 24 - SUNSET_HOUR) / nightLength
    }
    const angle = nightProgress * Math.PI // 0 → PI, west to east under horizon
    const x = -Math.cos(angle) * SUN_DISTANCE // starts at west (-x), ends at east (+x)
    const y = -Math.sin(angle) * SUN_DISTANCE * 0.5 // below horizon
    const z = 0
    return [x, y, z]
  }

  // Daytime: arc from east to west
  const angle = t * Math.PI // 0 → PI
  const x = Math.cos(angle) * SUN_DISTANCE   // +x (east) → -x (west)
  const y = Math.sin(angle) * SUN_DISTANCE   // 0 → peak → 0
  const z = 0
  return [x, y, z]
}

/**
 * Dawn/sunset → warm orange, noon → white, night → cool blue.
 * Returns [r, g, b] in 0–1 range.
 */
export function getSunColor(timeOfDay: number): [number, number, number] {
  const solarNoon = (SUNRISE_HOUR + SUNSET_HOUR) / 2

  // Night
  if (timeOfDay < SUNRISE_HOUR - 0.5 || timeOfDay > SUNSET_HOUR + 0.5) {
    return [0.2, 0.25, 0.5] // cool blue
  }

  // Dawn transition: SUNRISE_HOUR-0.5 → SUNRISE_HOUR+1
  if (timeOfDay >= SUNRISE_HOUR - 0.5 && timeOfDay <= SUNRISE_HOUR + 1) {
    const t = (timeOfDay - (SUNRISE_HOUR - 0.5)) / 1.5
    return [
      lerp(0.2, 1.0, t),
      lerp(0.25, 0.6, t),
      lerp(0.5, 0.3, t),
    ]
  }

  // Morning: warm orange fading to white
  if (timeOfDay > SUNRISE_HOUR + 1 && timeOfDay < solarNoon) {
    const t = (timeOfDay - (SUNRISE_HOUR + 1)) / (solarNoon - SUNRISE_HOUR - 1)
    return [
      lerp(1.0, 1.0, t),
      lerp(0.6, 1.0, t),
      lerp(0.3, 0.95, t),
    ]
  }

  // Noon
  if (timeOfDay >= solarNoon && timeOfDay <= solarNoon + 1) {
    return [1.0, 1.0, 0.95]
  }

  // Afternoon: white fading to warm orange
  if (timeOfDay > solarNoon + 1 && timeOfDay < SUNSET_HOUR - 1) {
    const t = (timeOfDay - (solarNoon + 1)) / (SUNSET_HOUR - 1 - solarNoon - 1)
    return [
      lerp(1.0, 1.0, t),
      lerp(1.0, 0.5, t),
      lerp(0.95, 0.2, t),
    ]
  }

  // Sunset transition: SUNSET_HOUR-1 → SUNSET_HOUR+0.5
  if (timeOfDay >= SUNSET_HOUR - 1 && timeOfDay <= SUNSET_HOUR + 0.5) {
    const t = (timeOfDay - (SUNSET_HOUR - 1)) / 1.5
    return [
      lerp(1.0, 0.2, t),
      lerp(0.5, 0.25, t),
      lerp(0.2, 0.5, t),
    ]
  }

  // Fallback (shouldn't reach)
  return [1.0, 1.0, 0.95]
}

/**
 * Ambient light intensity: bright during day, dim at night.
 */
export function getAmbientIntensity(timeOfDay: number): number {
  if (timeOfDay < SUNRISE_HOUR - 0.5 || timeOfDay > SUNSET_HOUR + 0.5) {
    return 0.15 // night
  }

  // Dawn ramp up
  if (timeOfDay >= SUNRISE_HOUR - 0.5 && timeOfDay <= SUNRISE_HOUR + 1) {
    const t = (timeOfDay - (SUNRISE_HOUR - 0.5)) / 1.5
    return lerp(0.15, 0.7, t)
  }

  // Morning ramp to full
  const solarNoon = (SUNRISE_HOUR + SUNSET_HOUR) / 2
  if (timeOfDay > SUNRISE_HOUR + 1 && timeOfDay <= solarNoon) {
    const t = (timeOfDay - (SUNRISE_HOUR + 1)) / (solarNoon - SUNRISE_HOUR - 1)
    return lerp(0.7, 1.0, t)
  }

  // Afternoon ramp down
  if (timeOfDay > solarNoon && timeOfDay < SUNSET_HOUR - 1) {
    const t = (timeOfDay - solarNoon) / (SUNSET_HOUR - 1 - solarNoon)
    return lerp(1.0, 0.7, t)
  }

  // Sunset ramp down
  if (timeOfDay >= SUNSET_HOUR - 1 && timeOfDay <= SUNSET_HOUR + 0.5) {
    const t = (timeOfDay - (SUNSET_HOUR - 1)) / 1.5
    return lerp(0.7, 0.15, t)
  }

  return 1.0
}

/**
 * Map continuous hour to a discrete TimeOfDay label.
 */
export function getTimeLabel(timeOfDay: number): TimeOfDay {
  if (timeOfDay >= SUNRISE_HOUR - 1 && timeOfDay < SUNRISE_HOUR + 1) return 'dawn'
  if (timeOfDay >= SUNRISE_HOUR + 1 && timeOfDay < 11) return 'morning'
  if (timeOfDay >= 11 && timeOfDay < 14) return 'noon'
  if (timeOfDay >= 14 && timeOfDay < SUNSET_HOUR - 2) return 'afternoon'
  if (timeOfDay >= SUNSET_HOUR - 2 && timeOfDay < SUNSET_HOUR + 2) return 'evening'
  return 'night'
}

// ── helpers ────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
