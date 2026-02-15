import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/engine/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, setupEncounter } from '../helpers'

describe('M2 event semantics', () => {
  it('EndTurn emits TurnEnded and EncounterPointerSet but not ActiveEntitySet', async () => {
    const gameId = 'm2-event-semantics'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    await orch.dispatch(gameId, { type: 'StartTurn' })
    await orch.dispatch(gameId, { type: 'EndTurn' })

    const events = await eventStore.list(gameId)
    const types = events.map((e) => e.type)

    expect(types).toContain('TurnEnded')
    expect(types).toContain('EncounterPointerSet')
    expect(types).not.toContain('ActiveEntitySet')
  })
})
