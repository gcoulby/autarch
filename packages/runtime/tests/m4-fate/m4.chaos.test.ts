import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, setupEncounter, killTarget } from '../helpers'

describe('M4 Chaos factor (integration)', () => {
  it('starts at 5', async () => {
    const gameId = 'm4-chaos-init'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    const state = await orch.loadState(gameId)
    expect(state!.runtime.chaos).toBe(5)
  })

  it('decreases by 1 on encounter win', async () => {
    const gameId = 'm4-chaos-win'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    const before = await orch.loadState(gameId)
    const chaosBefore = before!.runtime.chaos

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1', 'e-2'] })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    const enemies = Object.values(before!.entities).filter((e) => e?.kind === 'enemy')
    for (const e of enemies) {
      await killTarget(orch, gameId, 'pc-1', (e as any).id)
    }

    await orch.dispatch(gameId, { type: 'EndTurn' })
    await orch.dispatch(gameId, { type: 'Advance' })

    const after = await orch.loadState(gameId)
    expect(after!.runtime.encounterResult).toBe('win')
    expect(after!.runtime.chaos).toBe(chaosBefore - 1)
  })

  it('increases by 1 on encounter loss', async () => {
    const gameId = 'm4-chaos-loss'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)

    await setupEncounter(orch, gameId, 'A', 'A')

    const before = await orch.loadState(gameId)
    const chaosBefore = before!.runtime.chaos

    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['e-1', 'pc-1'] })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    await killTarget(orch, gameId, 'e-1', 'pc-1')

    await orch.dispatch(gameId, { type: 'EndTurn' })
    await orch.dispatch(gameId, { type: 'Advance' })

    const after = await orch.loadState(gameId)
    expect(after!.runtime.encounterResult).toBe('loss')
    expect(after!.runtime.chaos).toBe(chaosBefore + 1)
  })
})
