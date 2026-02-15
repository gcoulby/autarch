import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, setupEncounter } from '../helpers'

describe('M3 Advance (pure system driver)', () => {
  it('Advance starts a turn when no entity is active', async () => {
    const gameId = 'm3-advance-start-turn'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    const before = await orch.loadState(gameId)
    expect(before?.runtime.activeEntityId).toBe(null)

    const after = await orch.dispatch(gameId, { type: 'Advance' })

    expect(after.runtime.activeEntityId).not.toBe(null)
    // setupEncounter usually puts pc first, so this will typically be 'players'
    expect(['players', 'ai']).toContain(after.runtime.activeSide)
  })

  it('Advance runs the AI turn when it is AI’s turn (same zone => attack)', async () => {
    const gameId = 'm3-advance-ai-attack'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    // Same zone so the simple AI should attack.
    await setupEncounter(orch, gameId, 'A', 'A')

    // Force enemy to go first.
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['e-1', 'pc-1'] })

    const afterToTurn = await orch.dispatch(gameId, { type: 'Advance' })
    expect(afterToTurn.runtime.phase).toBe('turn')
    expect(afterToTurn.runtime.activeEntityId).toBe(null)

    // 1st Advance should start the enemy turn (active entity becomes e-1, side 'ai')
    const afterStart = await orch.dispatch(gameId, { type: 'Advance' })
    expect(afterStart.runtime.activeSide).toBe('ai')
    expect(afterStart.runtime.activeEntityId).toBe('e-1')

    const beforeStress = afterStart.entities['pc-1'].stats.stress

    // 2nd Advance should execute the AI turn (attack) and end it.
    const afterAi = await orch.dispatch(gameId, { type: 'Advance' })

    expect(afterAi.entities['pc-1'].stats.stress).toBe(beforeStress + 1)
    expect(afterAi.runtime.activeEntityId).toBe(null)
    expect(afterAi.runtime.activeSide).toBe('system')
  })

  it('Advance does nothing on player turn', async () => {
    const gameId = 'm3-advance-player-noop'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    // Start player turn explicitly.
    await orch.dispatch(gameId, { type: 'StartTurn' })

    const beforeEvents = await eventStore.list(gameId)
    const beforeState = await orch.loadState(gameId)

    await orch.dispatch(gameId, { type: 'Advance' })

    const afterEvents = await eventStore.list(gameId)
    const afterState = await orch.loadState(gameId)

    // No new events appended
    expect(afterEvents.length).toBe(beforeEvents.length)

    // State should be identical (at least the key driver fields)
    expect(afterState?.runtime.activeEntityId).toBe(beforeState?.runtime.activeEntityId)
    expect(afterState?.runtime.activeSide).toBe(beforeState?.runtime.activeSide)
    expect(afterState?.lastEventSeq).toBe(beforeState?.lastEventSeq)
  })
})
