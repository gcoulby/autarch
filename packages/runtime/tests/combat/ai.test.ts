import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { runAiTurn } from '@autarch/engine'
import { InMemoryEventStore, InMemoryStateStore, setupEncounter } from '../helpers'

describe('M2 AI (zones)', () => {
  it('AI moves closer when not in the same zone', async () => {
    const gameId = 'm2-ai-move'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'B')

    // Advance to enemy's turn
    await orch.dispatch(gameId, { type: 'StartTurn' }) // pc
    await orch.dispatch(gameId, { type: 'EndTurn' })
    await orch.dispatch(gameId, { type: 'StartTurn' }) // enemy (active entity becomes e-1)

    const after = await runAiTurn(orch, gameId)

    expect(after.entities['e-1'].position?.zoneId).toBe('A') // moved into player's zone
    expect(after.runtime.activeEntityId).toBe(null) // ended turn
  })

  it('AI attacks when in the same zone', async () => {
    const gameId = 'm2-ai-attack'
    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    // Advance to enemy's turn
    await orch.dispatch(gameId, { type: 'StartTurn' }) // pc
    await orch.dispatch(gameId, { type: 'EndTurn' })
    await orch.dispatch(gameId, { type: 'StartTurn' }) // enemy

    const before = await orch.loadState(gameId)
    await expect(before).toBeDefined()
    const beforeStress = before?.entities['pc-1'].stats.stress
    await expect(beforeStress).toBeDefined()

    expect(before?.runtime.activeSide).toBe('ai')
    expect(before?.runtime.activeEntityId).toBe('e-1')

    const after = await runAiTurn(orch, gameId)

    expect(after.entities['pc-1'].stats.stress).toBe((beforeStress as number) + 1)
    expect(after.runtime.activeEntityId).toBe(null)
  })
})
