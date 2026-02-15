import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, makeEntity } from '../helpers'
import { getValidActions } from '@autarch/engine'

describe('M2 replay includes encounter map', () => {
  it('replay reconstructs map so Move actions exist', async () => {
    const gameId = 'm2-map-replay'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEntity('pc-1', 'pc', 'Hero', 'A') })
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

    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1'] })
    await orch.dispatch(gameId, { type: 'StartRound' })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    // Simulate "cold start": ignore cached state and rebuild from events only
    const coldOrch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    const replayed = await coldOrch.loadState(gameId)

    const actions = getValidActions(replayed!)
    const moveActions = actions.filter((a) => (a.command as any)?.type === 'Move')

    expect(moveActions.length).toBeGreaterThan(0)
    expect(moveActions.some((a) => (a.command as any).toZoneId === 'B')).toBe(true)
  })
})
