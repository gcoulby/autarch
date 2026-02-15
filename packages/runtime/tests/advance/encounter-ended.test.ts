import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, killTarget, setupEncounter } from '../helpers'

describe('M3 EncounterEnded', () => {
  it('emits win when all enemies are dead', async () => {
    const gameId = 'm3-win'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    // Make PC go first
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1', 'e-2'] })

    await orch.dispatch(gameId, { type: 'StartTurn' })

    const started = await orch.loadState(gameId)
    if (!started) throw new Error('state missing after StartTurn')
    expect(started.runtime.activeEntityId).toBe('pc-1')
    expect(started.runtime.activeSide).toBe('players')

    // Kill every enemy that exists
    const enemies = Object.values(started.entities).filter((e: any) => e?.kind === 'enemy')
    expect(enemies.length).toBeGreaterThan(0)

    for (const e of enemies) {
      await killTarget(orch, gameId, 'pc-1', (e as any).id)
    }

    const afterKill = await orch.loadState(gameId)
    if (!afterKill) throw new Error('state missing after kill')
    for (const e of enemies) {
      expect(afterKill.entities[(e as any).id].status.alive).toBe(false)
    }

    await orch.dispatch(gameId, { type: 'EndTurn' })
    await orch.dispatch(gameId, { type: 'Advance' })

    const events = await eventStore.list(gameId)
    const ended = events.find((e: any) => e.type === 'EncounterEnded')
    expect(ended).toBeTruthy()
    expect((ended as any).payload.result).toBe('win')
  })

  it('emits loss when all pcs are dead', async () => {
    const gameId = 'm3-loss'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    // Make enemy go first
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['e-1', 'pc-1'] })

    // Start enemy turn
    await orch.dispatch(gameId, { type: 'StartTurn' })

    const started = await orch.loadState(gameId)
    if (!started) throw new Error('state missing after StartTurn')
    expect(started.runtime.activeEntityId).toBe('e-1')
    expect(started.runtime.activeSide).toBe('ai')

    // Kill PC
    await killTarget(orch, gameId, 'e-1', 'pc-1')

    const afterKill = await orch.loadState(gameId)
    if (!afterKill) throw new Error('state missing after kill')
    expect(afterKill.entities['pc-1'].status.alive).toBe(false)

    await orch.dispatch(gameId, { type: 'EndTurn' })

    await orch.dispatch(gameId, { type: 'Advance' })

    const events = await eventStore.list(gameId)
    const ended = events.find((e: any) => e.type === 'EncounterEnded')
    expect(ended).toBeTruthy()
    expect((ended as any).payload.result).toBe('loss')

    const finalState = await orch.loadState(gameId)
    expect(finalState?.runtime.phase).toBe('resolution')
    expect(finalState?.runtime.activeEntityId).toBe(null)
    expect(finalState?.runtime.activeSide).toBe('system')
  })

  it('Advance is a no-op once in resolution', async () => {
    const gameId = 'm3-resolution-noop'

    const eventStore = new InMemoryEventStore()
    const stateStore = new InMemoryStateStore()
    const orch = new Orchestrator(eventStore as any, stateStore as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'resolution' })

    const before = await eventStore.list(gameId)
    await orch.dispatch(gameId, { type: 'Advance' })
    const after = await eventStore.list(gameId)

    expect(after.length).toBe(before.length)
  })
})
