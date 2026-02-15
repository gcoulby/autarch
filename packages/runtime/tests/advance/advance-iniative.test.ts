import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, setupEncounter } from '../helpers'

describe('M3 Advance (initiative)', () => {
  it('Advance in initiative moves phase to turn', async () => {
    const gameId = 'm3-advance-initiative'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1'] })

    const before = await orch.loadState(gameId)
    expect(before?.runtime.phase).toBe('initiative')

    await orch.dispatch(gameId, { type: 'Advance' })

    const after = await orch.loadState(gameId)
    expect(after?.runtime.phase).toBe('turn')
  })
})
