import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/engine/orchestrator'
import type { GameEvent, GameState, Entity } from '../../src/types/doc-db'

class InMemoryEventStore {
  private events: GameEvent[] = []
  async append(event: GameEvent) {
    this.events.push(event)
  }
  async list(gameId: string) {
    return this.events.filter((e) => e.gameId === gameId).sort((a, b) => a.seq - b.seq)
  }
  async getLastSeq(gameId: string) {
    const xs = this.events.filter((e) => e.gameId === gameId)
    return xs.length ? Math.max(...xs.map((e) => e.seq)) : 0
  }
}

class InMemoryStateStore {
  private map = new Map<string, GameState>()
  async load(gameId: string) {
    return this.map.get(gameId) ?? null
  }
  async save(state: GameState) {
    this.map.set(state._id, state)
  }
}

function makeEntity(id: string, kind: Entity['kind'], name: string, zoneId: string): Entity {
  return {
    id,
    kind,
    name,
    status: { alive: true, conditions: [] },
    stats: { stress: 0, maxStress: 2, aspects: [], resources: {} },
    tags: [],
    position: { zoneId },
  }
}

describe('M2 e2e: Move + Attack', () => {
  it('Move updates the active entity position (adjacent zones only)', async () => {
    const gameId = 'm2-move'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('pc-1', 'pc', 'Hero', 'A') })
    await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1'] })

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'turn' })

    await orch.dispatch(gameId, { type: 'StartRound' })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    // Inject a map (however your system does this today)
    // If you already have a SetEncounterMap command, use that instead.
    // Otherwise, patch it into state store for now:
    const current = await stateStore.load(gameId)
    if (!current) throw new Error('state missing')
    current.encounter = current.encounter ?? { initiative: ['pc-1'], initiativeIndex: 0, map: undefined }
    current.encounter.map = {
      zones: {
        A: { id: 'A', name: 'A', tags: [], adjacent: ['B'] },
        B: { id: 'B', name: 'B', tags: [], adjacent: ['A'] },
      },
    }
    await stateStore.save(current)

    const afterMove = await orch.dispatch(gameId, { type: 'Move', entityId: 'pc-1', toZoneId: 'B' })
    expect(afterMove.entities['pc-1'].position?.zoneId).toBe('B')
  })

  it('Attack increments stress and defeats when stress >= maxStress', async () => {
    const gameId = 'm2-attack'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('pc-1', 'pc', 'Hero', 'A') })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('e-1', 'enemy', 'Goblin', 'A') })
    await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1'] })
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'turn' })
    await orch.dispatch(gameId, { type: 'StartRound' })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    // map not strictly required for attack (same zone check uses positions),
    // but keep it consistent if your code expects it:
    const current = await stateStore.load(gameId)

    if (!current) throw new Error('state missing')
    current.encounter = current.encounter ?? { initiative: ['pc-1', 'e-1'], initiativeIndex: 0, map: undefined }
    current.encounter.map = {
      zones: {
        A: { id: 'A', name: 'A', tags: [], adjacent: [] },
      },
    }
    await stateStore.save(current)

    const after1 = await orch.dispatch(gameId, { type: 'Attack', attackerId: 'pc-1', targetId: 'e-1' })
    expect(after1.entities['e-1'].stats.stress).toBe(1)
    expect(after1.entities['e-1'].status.alive).toBe(true)

    const after2 = await orch.dispatch(gameId, { type: 'Attack', attackerId: 'pc-1', targetId: 'e-1' })
    expect(after2.entities['e-1'].stats.stress).toBe(2)
    expect(after2.entities['e-1'].status.alive).toBe(false)
  })
})
