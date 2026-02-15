import { Entity, GameEvent, GameState } from '@autarch/engine'
import { Orchestrator } from '../src/orchestrator'

export class InMemoryEventStore {
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

export class InMemoryStateStore {
  private map = new Map<string, GameState>()
  async load(gameId: string) {
    return this.map.get(gameId) ?? null
  }
  async save(state: GameState) {
    this.map.set(state._id, state)
  }
}

export function makeEntity(id: string, kind: Entity['kind'], name: string, zoneId: string): Entity {
  return {
    id,
    kind,
    name,
    status: { alive: true, conditions: [] },
    stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
    tags: [],
    position: { zoneId },
  }
}

export async function setupEncounter(orch: any, gameId: string, pcZone: string, enemyZone: string) {
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
  await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('pc-1', 'pc', 'Hero', pcZone) })
  await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('e-1', 'enemy', 'Goblin', enemyZone) })
  await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('e-2', 'enemy', 'Goblin B', 'A') })

  await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
  await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })

  await orch.dispatch(gameId, {
    type: 'SetEncounterMap',
    map: {
      zones: {
        A: { id: 'A', name: 'A', tags: [], adjacent: ['B'] },
        B: { id: 'B', name: 'B', tags: [], adjacent: ['A'] },
      },
    },
  })

  await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1'] })

  /// Advance to enter turn phase
  await orch.dispatch(gameId, { type: 'Advance' })

  await orch.dispatch(gameId, { type: 'StartRound' })
}

export async function killTarget(orch: Orchestrator, gameId: string, attackerId: string, targetId: string) {
  // Loop until reducer marks target dead.
  // This stays correct even if maxStress changes later.
  while (true) {
    const s = await orch.loadState(gameId)
    if (!s) throw new Error('state missing')

    const target = s.entities[targetId]
    if (!target.status.alive) return

    await orch.dispatch(gameId, { type: 'Attack', attackerId, targetId })
  }
}
