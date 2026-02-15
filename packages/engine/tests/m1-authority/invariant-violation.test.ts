// tests/invariant-violation.test.ts

import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/engine/orchestrator'
import { InvariantError } from '../../src/domain/invariants'
import type { GameEvent, GameState } from '../../src/types/doc-db'

class InMemoryEventStore {
  private events: GameEvent[] = []

  async append(event: GameEvent): Promise<void> {
    this.events.push(event)
  }

  async list(gameId: string): Promise<GameEvent[]> {
    return this.events.filter((e) => e.gameId === gameId)
  }

  async getLastSeq(gameId: string): Promise<number> {
    const gameEvents = this.events.filter((e) => e.gameId === gameId)
    if (gameEvents.length === 0) return 0
    return Math.max(...gameEvents.map((e) => e.seq))
  }
}

class InMemoryStateStore {
  private state = new Map<string, GameState>()

  async load(gameId: string): Promise<GameState | null> {
    return this.state.get(gameId) ?? null
  }

  async save(gameState: GameState): Promise<void> {
    this.state.set(gameState._id, gameState)
  }
}

describe('invariant enforcement', () => {
  it('throws when ending a turn with no active entity', async () => {
    const gameId = 'game-invariant'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await orch.dispatch(gameId, {
      type: 'CreateGame',
      schemaVersion: 1,
      seed: 'seed',
    })

    // No StartTurn has occurred
    await expect(orch.dispatch(gameId, { type: 'EndTurn' })).rejects.toBeInstanceOf(InvariantError)
  })
})
