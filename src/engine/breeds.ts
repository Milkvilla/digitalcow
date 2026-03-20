// ── Cow Breed Definitions ────────────────────────────────

export type BreedId = 'holstein' | 'gir' | 'sindhi' | 'sahiwal' | 'kankrej'

export interface SpotDef {
  position: [number, number, number]
  scale: [number, number, number]
}

export interface BreedDef {
  label: string
  bodyColor: string
  spotColor: string
  spots: SpotDef[]
  headSpot: SpotDef | null
  muzzleColor: string
  skinColor: string
  legFrontColor: string
  legBackColor: string
  hoofColor: string
  hornColor: string
  hornLength: number        // multiplier on base horn size
  hornCurve: number         // Z rotation for outward curve
  hornSpread: number        // Z offset from center
  earScale: number          // multiplier on ear size
  udderColor: string
  outlineColor: string
}

export const BREEDS: Record<BreedId, BreedDef> = {
  // ── Holstein Friesian (classic black & white dairy cow) ──
  holstein: {
    label: 'Holstein',
    bodyColor: '#f5f0e0',
    spotColor: '#2a2a2a',
    spots: [
      // Large patch on front barrel, left side
      { position: [0.02, 0.68, 0.28], scale: [0.24, 0.18, 0.16] },
      // Patch on rear barrel, right side
      { position: [-0.25, 0.60, -0.24], scale: [0.20, 0.16, 0.16] },
      // Small spot on chest, right
      { position: [0.28, 0.68, -0.18], scale: [0.12, 0.10, 0.14] },
      // Patch on hip, left
      { position: [-0.46, 0.58, 0.20], scale: [0.16, 0.14, 0.14] },
      // Top of back (spine area)
      { position: [-0.08, 0.82, 0.04], scale: [0.22, 0.08, 0.18] },
      // Small spot on front barrel, right
      { position: [0.12, 0.62, -0.28], scale: [0.10, 0.10, 0.14] },
    ],
    headSpot: { position: [-0.05, 0.16, 0.07], scale: [0.10, 0.08, 0.08] },
    muzzleColor: '#e8a0a0',
    skinColor: '#e8b8a0',
    legFrontColor: '#f0e8d8',
    legBackColor: '#2a2a2a',
    hoofColor: '#333333',
    hornColor: '#d4c8a0',
    hornLength: 1.0,
    hornCurve: 0.45,
    hornSpread: 0.10,
    earScale: 1.0,
    udderColor: '#f0b0b0',
    outlineColor: '#1a1008',
  },

  // ── Gir (Indian breed — reddish, large curved horns, big droopy ears) ──
  gir: {
    label: 'Gir',
    bodyColor: '#c8785a',
    spotColor: '#8b4030',
    spots: [
      { position: [-0.06, 0.66, 0.26], scale: [0.22, 0.16, 0.16] },
      { position: [0.12, 0.62, -0.24], scale: [0.18, 0.14, 0.16] },
    ],
    headSpot: null,
    muzzleColor: '#d09080',
    skinColor: '#c09078',
    legFrontColor: '#b87060',
    legBackColor: '#a06050',
    hoofColor: '#4a3530',
    hornColor: '#c8b888',
    hornLength: 2.0,
    hornCurve: 0.8,
    hornSpread: 0.14,
    earScale: 1.8,
    udderColor: '#d8a098',
    outlineColor: '#3a2018',
  },

  // ── Red Sindhi (deep red-brown, compact, small horns) ──
  sindhi: {
    label: 'Red Sindhi',
    bodyColor: '#a04828',
    spotColor: '#783018',
    spots: [],
    headSpot: null,
    muzzleColor: '#904838',
    skinColor: '#985040',
    legFrontColor: '#8a4028',
    legBackColor: '#7a3820',
    hoofColor: '#3a2820',
    hornColor: '#a09070',
    hornLength: 0.7,
    hornCurve: 0.3,
    hornSpread: 0.08,
    earScale: 1.1,
    udderColor: '#c08070',
    outlineColor: '#2a1008',
  },

  // ── Sahiwal (golden-brown, medium build, short horns) ──
  sahiwal: {
    label: 'Sahiwal',
    bodyColor: '#c89858',
    spotColor: '#a07840',
    spots: [
      { position: [-0.10, 0.64, 0.24], scale: [0.20, 0.14, 0.16] },
    ],
    headSpot: null,
    muzzleColor: '#b88868',
    skinColor: '#b09070',
    legFrontColor: '#b08848',
    legBackColor: '#a07838',
    hoofColor: '#4a3828',
    hornColor: '#b0a080',
    hornLength: 0.8,
    hornCurve: 0.35,
    hornSpread: 0.09,
    earScale: 1.3,
    udderColor: '#d0a888',
    outlineColor: '#302010',
  },

  // ── Kankrej / Gujrati (grey-white, tall, large upward-curved horns) ──
  kankrej: {
    label: 'Kankrej',
    bodyColor: '#d0ccc0',
    spotColor: '#a8a498',
    spots: [
      { position: [-0.04, 0.66, 0.26], scale: [0.18, 0.12, 0.16] },
      { position: [0.10, 0.60, -0.26], scale: [0.16, 0.12, 0.16] },
    ],
    headSpot: null,
    muzzleColor: '#888480',
    skinColor: '#a8a498',
    legFrontColor: '#c0b8b0',
    legBackColor: '#a09890',
    hoofColor: '#484440',
    hornColor: '#b8b0a0',
    hornLength: 2.2,
    hornCurve: 0.9,
    hornSpread: 0.16,
    earScale: 1.2,
    udderColor: '#c8b8b0',
    outlineColor: '#282420',
  },
}

export const BREED_IDS = Object.keys(BREEDS) as BreedId[]
