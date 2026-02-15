import { GameState } from '@autarch/engine'

export class StateStore {
  constructor(private state: GameState[] = []) {}

  async load(gameId: string): Promise<GameState | null> {
    return this.state.find((s) => s._id === gameId) ?? null
  }

  async save(gameState: GameState): Promise<void> {
    const index = this.state.findIndex((s) => s._id === gameState._id)

    if (index >= 0) {
      this.state[index] = gameState
    } else {
      this.state.push(gameState)
    }
  }
}
