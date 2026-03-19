import type { GameState } from '@autarch/engine'
import type { IStateStore } from '../interfaces.js'

export class MemoryStateStore implements IStateStore {
  private states = new Map<string, GameState>()

  async load(gameId: string): Promise<GameState | null> {
    return this.states.get(gameId) ?? null
  }

  async save(state: GameState): Promise<void> {
    this.states.set(state._id, state)
  }
}
