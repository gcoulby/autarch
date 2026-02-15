/**
 * milestone1.smoke.test.ts
 * Vitest smoke test for Milestone 1 flow (7)
 *
 * This test uses an in-memory EventStore and StateStore so it does not need Mongo.
 */

import { describe, it, expect } from 'vitest'

// Adjust these import paths to match your project
import { Orchestrator } from '../../src/engine/orchestrator'
import type { Entity, GameState, GameEvent } from '../../src/types/doc-db'

class InMemoryEventStore {
  private events: GameEvent[] = []

  async append(event: GameEvent): Promise<void> {
    this.events.push(event)
  }

  async list(gameId: string): Promise<GameEvent[]> {
    return this.events.filter((e) => e.gameId === gameId).sort((a, b) => a.seq - b.seq)
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

function makeEntity(id: string, kind: Entity['kind'], name: string): Entity {
  return {
    id,
    kind,
    name,
    status: { alive: true, conditions: [] },
    stats: {
      stress: 0,
      maxStress: 6,
      aspects: [],
      resources: {},
    },
    tags: [],
  }
}

describe('Milestone 1 smoke flow', () => {
  it('creates game, adds entities, sets encounter mode, initiative, and advances turns', async () => {
    const gameId = 'game-1'
    const seed = 'seed-123'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()

    const orch = new Orchestrator(eventStore as any, stateStore as any)

    // 1) Create game
    let state = await orch.dispatch(gameId, {
      type: 'CreateGame',
      schemaVersion: 1,
      seed,
    })

    expect(state._id).toBe(gameId)
    expect(state.schemaVersion).toBe(1)
    expect(state.runtime.phase).toBe('setup')
    expect(state.runtime.mode).toBe('scene')

    // 2) Add entities (2 PCs, 2 enemies)
    const pc1 = makeEntity('pc-1', 'pc', 'Graham the Hexed')
    const pc2 = makeEntity('pc-2', 'pc', 'Ada the Calm')
    const e1 = makeEntity('e-1', 'enemy', 'Goblin A')
    const e2 = makeEntity('e-2', 'enemy', 'Goblin B')

    state = await orch.dispatch(gameId, { type: 'AddEntity', entity: pc1 })
    state = await orch.dispatch(gameId, { type: 'AddEntity', entity: pc2 })
    state = await orch.dispatch(gameId, { type: 'AddEntity', entity: e1 })
    state = await orch.dispatch(gameId, { type: 'AddEntity', entity: e2 })

    expect(Object.keys(state.entities).length).toBe(4)

    // 3) Set encounter mode
    state = await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
    expect(state.runtime.mode).toBe('encounter')
    expect(state.encounter).toBeTruthy()

    // 4) Phase initiative
    state = await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    expect(state.runtime.phase).toBe('initiative')

    // 5) Set initiative order (this should also move phase to turn in your orchestrator)
    const order = ['pc-1', 'e-1', 'pc-2', 'e-2']
    state = await orch.dispatch(gameId, { type: 'SetInitiative', order })

    expect(state.encounter?.initiative).toEqual(order)
    expect(state.encounter?.initiativeIndex).toBe(0)
    state = await orch.dispatch(gameId, { type: 'Advance' })
    expect(state.runtime.phase).toBe('turn')

    // 6) Start round
    state = await orch.dispatch(gameId, { type: 'StartRound' })
    expect(state.runtime.round).toBe(1)

    // 7) Start turn (should pick initiative[0])
    state = await orch.dispatch(gameId, { type: 'StartTurn' })
    expect(state.runtime.activeEntityId).toBe('pc-1')
    expect(state.runtime.activeSide).toBe('players')

    // 8) End turn (should clear active entity and advance pointer)
    state = await orch.dispatch(gameId, { type: 'EndTurn' })
    expect(state.runtime.activeEntityId).toBe(null)
    expect(state.runtime.activeSide).toBe('system')
    expect(state.encounter?.initiativeIndex).toBe(1)

    // 9) Start next turn (should pick initiative[1])
    state = await orch.dispatch(gameId, { type: 'StartTurn' })
    expect(state.runtime.activeEntityId).toBe('e-1')
    expect(state.runtime.activeSide).toBe('ai')

    // 10) End and advance again
    state = await orch.dispatch(gameId, { type: 'EndTurn' })
    expect(state.encounter?.initiativeIndex).toBe(2)

    // Extra: ensure event log exists and is ordered
    const events = await eventStore.list(gameId)
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('GameCreated')
    for (let i = 1; i < events.length; i++) {
      expect(events[i].seq).toBeGreaterThan(events[i - 1].seq)
    }

    // Extra: state store cache got updated
    const cached = await stateStore.load(gameId)
    expect(cached?.lastEventSeq).toBe(state.lastEventSeq)
  })
})
