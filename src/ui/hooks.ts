import { useStore } from 'zustand'
import { gameStore } from '../engine/store'
import type { GameStore } from '../engine/types'

export { gameStore }
export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector)
}
