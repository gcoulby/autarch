import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, makeEntity } from '../helpers'

async function setupGame(orch: Orchestrator, gameId: string) {
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
  const pc = makeEntity('pc-1', 'pc', 'Hero', 'A')
  await orch.dispatch(gameId, { type: 'AddEntity', entity: pc })
}

describe('M4 TakeConsequence', () => {
  it('adds a mild consequence aspect to the entity', async () => {
    const gameId = 'm4-consequence-mild'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, {
      type: 'TakeConsequence',
      entityId: 'pc-1',
      severity: 'mild',
      name: 'Winded',
    })

    const state = await orch.loadState(gameId)
    const aspects = state!.entities['pc-1'].stats.aspects
    const consequence = aspects.find((a) => a.consequenceSeverity === 'mild')
    expect(consequence).toBeTruthy()
    expect(consequence!.name).toBe('Winded')
    expect(consequence!.freeInvokes).toBe(0)
  })

  it('adds moderate and severe consequences independently', async () => {
    const gameId = 'm4-consequence-multi'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'mild', name: 'Winded' })
    await orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'moderate', name: 'Sprained Ankle' })
    await orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'severe', name: 'Broken Arm' })

    const state = await orch.loadState(gameId)
    const aspects = state!.entities['pc-1'].stats.aspects
    expect(aspects.filter((a) => a.consequenceSeverity === 'mild')).toHaveLength(1)
    expect(aspects.filter((a) => a.consequenceSeverity === 'moderate')).toHaveLength(1)
    expect(aspects.filter((a) => a.consequenceSeverity === 'severe')).toHaveLength(1)
  })

  it('emits an EntityPatched event', async () => {
    const gameId = 'm4-consequence-event'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'mild', name: 'Dazed' })

    const events = await eventStore.list(gameId)
    expect(events.find((e) => e.type === 'EntityPatched')).toBeTruthy()
  })

  it('throws when the entity already has a consequence of the same severity', async () => {
    const gameId = 'm4-consequence-dup'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'mild', name: 'Winded' })

    await expect(
      orch.dispatch(gameId, { type: 'TakeConsequence', entityId: 'pc-1', severity: 'mild', name: 'Bruised Ribs' }),
    ).rejects.toThrow()
  })
})
