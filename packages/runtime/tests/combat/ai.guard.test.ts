import { describe, it, expect } from 'vitest'
import { runAiTurn } from '@autarch/engine' // adjust path
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, makeEntity, setupEncounter } from '../helpers'

// reuse your InMemoryEventStore/StateStore + setupEncounter helper

describe('M2 AI guards', () => {
  it("throws if runAiTurn called when it's not AI's turn", async () => {
    const gameId = 'm2-ai-guard'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    // Start PC turn (players side)
    await orch.dispatch(gameId, { type: 'StartTurn' })

    await expect(runAiTurn(orch, gameId)).rejects.toThrow(/not AI's turn/i)
  })

  it('does not attack allies', async () => {
    const gameId = 'm2-ai-no-friendly-fire'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['e-1', 'e-2'] })

    // // Start enemy turn for e-1
    await orch.dispatch(gameId, { type: 'StartTurn' })

    const before = await orch.loadState(gameId)
    const beforeStress = before?.entities['e-2'].stats.stress

    const after = await runAiTurn(orch, gameId)

    expect(after.entities['e-2'].stats.stress).toBe(beforeStress)
  })
})
