import { Entity, GameState } from '@autarch/engine'
import { MemoryEventStore, MemoryStateStore } from '@autarch/persistence'
import { Orchestrator } from '../src/orchestrator'

// Re-export under the names tests already use so no test files need to change
export { MemoryEventStore as InMemoryEventStore, MemoryStateStore as InMemoryStateStore }

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

  // Advance to enter turn phase
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
    if (!target!.status.alive) return

    await orch.dispatch(gameId, { type: 'Attack', attackerId, targetId })
  }
}
