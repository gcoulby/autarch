import type { GameEvent, GameState } from '../types/game.js'
import { applyEvent } from './reducer.js'
import { createInitialState } from '../engine/state.js'

export function replay(gameId: string, events: GameEvent[]): GameState {
  const created = events.find((e) => e.type === 'GameCreated')
  if (!created) throw new Error('Missing GameCreated event')

  const p = created.payload as { schemaVersion: number; createdAt: string }
  let state = createInitialState(gameId, p.schemaVersion, p.createdAt)

  for (const ev of events.sort((a, b) => a.seq - b.seq)) {
    state = applyEvent(state, ev)
  }
  return state
}
