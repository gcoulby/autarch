import type { GameState } from '../types/game.js'

export class InvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvariantError'
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantError(message)
}

export function requireEntity(state: GameState, entityId: string) {
  const e = state.entities[entityId]
  assert(e, `Unknown entity: ${entityId}`)
  return e
}

export function isEncounterMode(state: GameState) {
  return state.runtime.mode === 'encounter'
}
