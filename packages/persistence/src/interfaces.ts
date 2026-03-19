import type { GameEvent, GameState } from '@autarch/engine'

export interface IEventStore {
  append(event: GameEvent): Promise<void>
  list(gameId: string): Promise<GameEvent[]>
  getLastSeq(gameId: string): Promise<number>
}

export interface IStateStore {
  load(gameId: string): Promise<GameState | null>
  save(state: GameState): Promise<void>
}
