import type { CowState, WorldState, TaskState, MilkStats } from './types'
import { SAVE_KEY } from './constants'

// ── Save Shape ──────────────────────────────────────────

interface SaveData {
  version: 2
  savedAt: number          // Date.now() — real wall-clock time
  cow: CowState
  world: WorldState
  tasks: TaskState
  milkStats: MilkStats
  rain: boolean
  rainIntensity: number
}

// ── Save ─────────────────────────────────────────────────

export function saveGame(state: {
  cow: CowState
  world: WorldState
  tasks: TaskState
  milkStats: MilkStats
  rain: boolean
  rainIntensity: number
}): void {
  try {
    const data: SaveData = {
      version: 2,
      savedAt: Date.now(),
      cow: state.cow,
      world: state.world,
      tasks: state.tasks,
      milkStats: state.milkStats,
      rain: state.rain,
      rainIntensity: state.rainIntensity,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

// ── Load ─────────────────────────────────────────────────

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (!data || !data.version || !data.cow || !data.world) return null

    // Migrate from older saves that lack new fields
    if (!data.cow.needs.thirst && data.cow.needs.thirst !== 0) {
      data.cow.needs.thirst = 20
    }
    if (data.cow.health === undefined) data.cow.health = 100
    if (data.cow.milkStorage === undefined) data.cow.milkStorage = 0
    if (data.cow.lastMilkedAt === undefined) data.cow.lastMilkedAt = 0
    if (!data.cow.conditions) data.cow.conditions = []
    if (data.world.dayCount === undefined) data.world.dayCount = 0
    if (data.world.lastDayChangeHour === undefined) data.world.lastDayChangeHour = data.world.timeOfDay
    if (!data.world.gates) data.world.gates = []
    if (!data.tasks) {
      data.tasks = createDefaultTasks()
    }
    if (!data.milkStats) {
      data.milkStats = { totalProduced: 0, todayProduced: 0, lastProductionDay: 0 }
    }

    return data
  } catch {
    return null
  }
}

// ── Clear ────────────────────────────────────────────────

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}

// ── Apply offline time ──────────────────────────────────

export function computeOfflineDecay(
  savedAt: number,
  cow: CowState,
): void {
  const elapsed = (Date.now() - savedAt) / 1000  // real seconds since save
  // Cap offline time to 24 real hours (86400s) to avoid extreme values
  const cappedSeconds = Math.min(elapsed, 86400)
  // Apply very mild offline decay (1/10th of normal rate)
  const factor = cappedSeconds * 0.1
  cow.needs.hunger = Math.min(100, cow.needs.hunger + factor * 0.05)
  cow.needs.energy = Math.max(0, cow.needs.energy - factor * 0.03)
  cow.needs.thirst = Math.min(100, cow.needs.thirst + factor * 0.04)
  // Happiness doesn't decay offline — player shouldn't be punished for being away
}

// ── Default Tasks ────────────────────────────────────────

export function createDefaultTasks(): TaskState {
  return {
    dailyTasks: [
      { id: 'feed', label: 'Feed the cow', completed: false },
      { id: 'water', label: 'Give water', completed: false },
      { id: 'pet', label: 'Pet the cow', completed: false },
      { id: 'rest', label: 'Ensure cow rests', completed: false },
      { id: 'milk', label: 'Milk the cow', completed: false },
    ],
    achievements: [
      { id: 'first_feed', label: 'First Meal', description: 'Feed the cow for the first time', unlocked: false },
      { id: 'first_pet', label: 'First Touch', description: 'Pet the cow for the first time', unlocked: false },
      { id: 'happy_day', label: 'Happy Day', description: 'Keep cow happy (>60) for a full day', unlocked: false },
      { id: 'rainy_night', label: 'Stormy Shelter', description: 'Keep cow safe through a rainy night', unlocked: false },
      { id: 'first_milk', label: 'First Milk', description: 'Milk the cow for the first time', unlocked: false },
      { id: 'milk_streak', label: 'Dairy Farmer', description: 'Produce milk for 3 consecutive days', unlocked: false },
      { id: 'grow_up', label: 'All Grown Up', description: 'Raise a calf to adulthood', unlocked: false },
      { id: 'bonded', label: 'Best Friends', description: 'Reach bonded relationship tier', unlocked: false },
      { id: 'full_health', label: 'Peak Condition', description: 'Reach 100 health with all needs satisfied', unlocked: false },
      { id: 'explorer', label: 'Explorer', description: 'Cow wanders 50 times', unlocked: false },
    ],
    dailyTaskResetDay: 0,
    consecutiveMilkDays: 0,
    happyDayCount: 0,
    totalMilkProduced: 0,
  }
}

// ── Autosave timer ──────────────────────────────────────

let autosaveTimer: ReturnType<typeof setInterval> | null = null

export function startAutosave(getSaveState: () => Parameters<typeof saveGame>[0], intervalMs: number): void {
  stopAutosave()
  autosaveTimer = setInterval(() => {
    saveGame(getSaveState())
  }, intervalMs)

  // Also save on tab close
  window.addEventListener('beforeunload', () => {
    saveGame(getSaveState())
  })
}

export function stopAutosave(): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
}
