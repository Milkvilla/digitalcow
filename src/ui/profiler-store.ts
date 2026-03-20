import { createStore } from 'zustand/vanilla'

export interface ProfilerState {
  enabled: boolean
  toggles: Record<string, boolean>
  stats: {
    drawCalls: number
    triangles: number
    geometries: number
    textures: number
  }
  toggle: (key: string) => void
  toggleProfiler: () => void
  setStats: (s: ProfilerState['stats']) => void
}

export const profilerStore = createStore<ProfilerState>()((set) => ({
  enabled: false,
  toggles: {
    sky: true,
    clouds: true,
    horizon: true,
    ground: true,
    grass: true,
    grassPatch: true,
    decorations: true,
    trees: true,
    cow: true,
    barn: true,
    pond: true,
    fences: true,
    food: true,
    creatures: true,
    rain: true,
    particles: true,
    postProcessing: true,
    windmill: true,
    hayBales: true,
    waterWell: true,
    stonePath: true,
    scarecrow: true,
    chickens: true,
    ducks: true,
    farmDog: true,
    flowerPatches: true,
    birdsOverhead: true,
    fireflies: true,
    cloudShadows: true,
    moodBubbles: true,
    milkSystem: true,
    vegetableGarden: true,
    seasonalEffects: true,
  },
  stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 },
  toggle(key) {
    set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } }))
  },
  toggleProfiler() {
    set((s) => ({ enabled: !s.enabled }))
  },
  setStats(stats) {
    set({ stats })
  },
}))
