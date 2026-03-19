import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { InMemoryEventStore, InMemoryStateStore, makeEntity } from '../helpers'

async function setupGame(orch: Orchestrator, gameId: string) {
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
  const pc = makeEntity('pc-1', 'pc', 'Hero', 'A')
  pc.stats.aspects = [
    { id: 'aspect-tough', name: 'Tough as Nails', freeInvokes: 2 },
    { id: 'aspect-clumsy', name: 'Clumsy when Rushed', freeInvokes: 0 },
  ]
  pc.stats.resources = { fatePoints: 3 }
  await orch.dispatch(gameId, { type: 'AddEntity', entity: pc })
}

describe('M4 InvokeAspect', () => {
  it('consumes a free invoke when one is available', async () => {
    const gameId = 'm4-invoke-free'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    const before = await orch.loadState(gameId)
    expect(before!.entities['pc-1'].stats.aspects.find((a) => a.id === 'aspect-tough')!.freeInvokes).toBe(2)

    await orch.dispatch(gameId, { type: 'InvokeAspect', entityId: 'pc-1', aspectId: 'aspect-tough', bonus: 'plus2' })

    const after = await orch.loadState(gameId)
    expect(after!.entities['pc-1'].stats.aspects.find((a) => a.id === 'aspect-tough')!.freeInvokes).toBe(1)
    // fate points unchanged when using a free invoke
    expect(after!.entities['pc-1'].stats.resources.fatePoints).toBe(3)
  })

  it('spends a fate point when no free invokes remain', async () => {
    const gameId = 'm4-invoke-fp'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    // aspect-clumsy has 0 free invokes
    await orch.dispatch(gameId, { type: 'InvokeAspect', entityId: 'pc-1', aspectId: 'aspect-clumsy', bonus: 'plus2' })

    const after = await orch.loadState(gameId)
    expect(after!.entities['pc-1'].stats.resources.fatePoints).toBe(2)
    // free invokes still 0
    expect(after!.entities['pc-1'].stats.aspects.find((a) => a.id === 'aspect-clumsy')!.freeInvokes).toBe(0)
  })

  it('emits an AspectInvoked event with the correct payload', async () => {
    const gameId = 'm4-invoke-event'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, { type: 'InvokeAspect', entityId: 'pc-1', aspectId: 'aspect-tough', bonus: 'reroll' })

    const events = await eventStore.list(gameId)
    const invoked = events.find((e) => e.type === 'AspectInvoked')
    expect(invoked).toBeTruthy()
    expect((invoked!.payload as any).entityId).toBe('pc-1')
    expect((invoked!.payload as any).aspectId).toBe('aspect-tough')
    expect((invoked!.payload as any).usedFreeInvoke).toBe(true)
    expect((invoked!.payload as any).bonus).toBe('reroll')
  })

  it('throws when no free invokes and no fate points', async () => {
    const gameId = 'm4-invoke-fail'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    const pc = makeEntity('pc-1', 'pc', 'Hero', 'A')
    pc.stats.aspects = [{ id: 'aspect-a', name: 'Some Aspect', freeInvokes: 0 }]
    pc.stats.resources = { fatePoints: 0 }
    await orch.dispatch(gameId, { type: 'AddEntity', entity: pc })

    await expect(
      orch.dispatch(gameId, { type: 'InvokeAspect', entityId: 'pc-1', aspectId: 'aspect-a', bonus: 'plus2' }),
    ).rejects.toThrow()
  })

  it('throws when the aspect does not exist on the entity', async () => {
    const gameId = 'm4-invoke-noaspect'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await expect(
      orch.dispatch(gameId, { type: 'InvokeAspect', entityId: 'pc-1', aspectId: 'nonexistent', bonus: 'plus2' }),
    ).rejects.toThrow()
  })
})

describe('M4 CompelAspect', () => {
  it('grants a fate point to the entity', async () => {
    const gameId = 'm4-compel'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    const before = await orch.loadState(gameId)
    const fpBefore = before!.entities['pc-1'].stats.resources.fatePoints ?? 0

    await orch.dispatch(gameId, { type: 'CompelAspect', entityId: 'pc-1', aspectId: 'aspect-clumsy' })

    const after = await orch.loadState(gameId)
    expect(after!.entities['pc-1'].stats.resources.fatePoints).toBe(fpBefore + 1)
  })

  it('emits an AspectCompelled event', async () => {
    const gameId = 'm4-compel-event'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await orch.dispatch(gameId, { type: 'CompelAspect', entityId: 'pc-1', aspectId: 'aspect-clumsy' })

    const events = await eventStore.list(gameId)
    const compelled = events.find((e) => e.type === 'AspectCompelled')
    expect(compelled).toBeTruthy()
    expect((compelled!.payload as any).entityId).toBe('pc-1')
    expect((compelled!.payload as any).aspectId).toBe('aspect-clumsy')
  })

  it('throws when the aspect does not exist on the entity', async () => {
    const gameId = 'm4-compel-noaspect'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupGame(orch, gameId)

    await expect(
      orch.dispatch(gameId, { type: 'CompelAspect', entityId: 'pc-1', aspectId: 'nonexistent' }),
    ).rejects.toThrow()
  })
})
