import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { replay } from '@autarch/engine'
import { InMemoryEventStore, InMemoryStateStore, makeEntity } from '../helpers'
import type { Location } from '@autarch/engine'

function makeLocation(id: string, name: string, connections: string[] = []): Location {
  return { id, name, tags: [], aspects: [], connections }
}

async function setupScene(orch: Orchestrator, gameId: string) {
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
  await orch.dispatch(gameId, { type: 'SetMode', mode: 'scene' })
  await orch.dispatch(gameId, { type: 'AddLocation', location: makeLocation('town', 'Town Square', ['forest', 'cave']) })
  await orch.dispatch(gameId, { type: 'AddLocation', location: makeLocation('forest', 'Dark Forest', ['town']) })
  await orch.dispatch(gameId, { type: 'AddLocation', location: makeLocation('cave', 'Hidden Cave', ['town']) })
  await orch.dispatch(gameId, { type: 'SetLocation', locationId: 'town' })
}

describe('M5 Scene setup', () => {
  it('SetMode to scene initialises scene state', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })

    const state = await orch.loadState('g1')
    expect(state!.scene).toBeDefined()
    expect(state!.scene!.locationId).toBeNull()
    expect(state!.scene!.locations).toEqual({})
  })

  it('AddLocation adds to scene graph', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', { type: 'AddLocation', location: makeLocation('town', 'Town Square') })

    const state = await orch.loadState('g1')
    expect(state!.scene!.locations['town']).toBeDefined()
    expect(state!.scene!.locations['town'].name).toBe('Town Square')
  })

  it('AddLocation rejects duplicate location IDs', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', { type: 'AddLocation', location: makeLocation('town', 'Town Square') })

    await expect(
      orch.dispatch('g1', { type: 'AddLocation', location: makeLocation('town', 'Duplicate') }),
    ).rejects.toThrow()
  })

  it('SetLocation sets the current location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const state = await orch.loadState('g1')
    expect(state!.scene!.locationId).toBe('town')
  })

  it('SetLocation rejects unknown location IDs', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })

    await expect(
      orch.dispatch('g1', { type: 'SetLocation', locationId: 'nowhere' }),
    ).rejects.toThrow()
  })
})

describe('M5 Travel', () => {
  it('moves to a connected location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await orch.dispatch('g1', { type: 'Travel', toLocationId: 'forest' })

    const state = await orch.loadState('g1')
    expect(state!.scene!.locationId).toBe('forest')
  })

  it('emits a LocationChanged event', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await orch.dispatch('g1', { type: 'Travel', toLocationId: 'forest' })

    const events = await eventStore.list('g1')
    const changed = events.find((e) => e.type === 'LocationChanged' && (e.payload as any).toLocationId === 'forest')
    expect(changed).toBeTruthy()
    expect((changed!.payload as any).fromLocationId).toBe('town')
  })

  it('rejects travel to a non-connected location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')
    // forest and cave are not directly connected — only via town
    await orch.dispatch('g1', { type: 'Travel', toLocationId: 'forest' })

    await expect(
      orch.dispatch('g1', { type: 'Travel', toLocationId: 'cave' }),
    ).rejects.toThrow()
  })

  it('rejects travel when no current location is set', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'seed' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', { type: 'AddLocation', location: makeLocation('town', 'Town') })

    await expect(
      orch.dispatch('g1', { type: 'Travel', toLocationId: 'town' }),
    ).rejects.toThrow()
  })
})

describe('M5 Rest', () => {
  it('restores stress to 0 for PCs at the current location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const pc = makeEntity('pc-1', 'pc', 'Hero', 'town')
    pc.stats.stress = 3
    await orch.dispatch('g1', { type: 'AddEntity', entity: pc })

    await orch.dispatch('g1', { type: 'Rest' })

    const state = await orch.loadState('g1')
    expect(state!.entities['pc-1'].stats.stress).toBe(0)
  })

  it('only restores PCs at the current location, not elsewhere', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const pc1 = makeEntity('pc-1', 'pc', 'Hero', 'town')
    pc1.stats.stress = 2
    const pc2 = makeEntity('pc-2', 'pc', 'Ally', 'forest') // different location
    pc2.stats.stress = 2

    await orch.dispatch('g1', { type: 'AddEntity', entity: pc1 })
    await orch.dispatch('g1', { type: 'AddEntity', entity: pc2 })

    await orch.dispatch('g1', { type: 'Rest' })

    const state = await orch.loadState('g1')
    expect(state!.entities['pc-1'].stats.stress).toBe(0)
    expect(state!.entities['pc-2'].stats.stress).toBe(2)
  })

  it('emits a Rested event', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const pc = makeEntity('pc-1', 'pc', 'Hero', 'town')
    pc.stats.stress = 1
    await orch.dispatch('g1', { type: 'AddEntity', entity: pc })

    await orch.dispatch('g1', { type: 'Rest' })

    const events = await eventStore.list('g1')
    expect(events.find((e) => e.type === 'Rested')).toBeTruthy()
  })
})

describe('M5 Search', () => {
  it('adds a discovered aspect to the current location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await orch.dispatch('g1', { type: 'Search', aspectName: 'Hidden Shrine' })

    const state = await orch.loadState('g1')
    const loc = state!.scene!.locations['town']
    expect(loc.aspects).toHaveLength(1)
    expect(loc.aspects[0].name).toBe('Hidden Shrine')
    expect(loc.aspects[0].freeInvokes).toBe(1)
  })

  it('emits a LocationAspectAdded event', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await orch.dispatch('g1', { type: 'Search', aspectName: 'Old Map' })

    const events = await eventStore.list('g1')
    const ev = events.find((e) => e.type === 'LocationAspectAdded')
    expect(ev).toBeTruthy()
    expect((ev!.payload as any).locationId).toBe('town')
    expect((ev!.payload as any).aspect.name).toBe('Old Map')
  })

  it('rejects an empty aspectName', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await expect(
      orch.dispatch('g1', { type: 'Search', aspectName: '   ' }),
    ).rejects.toThrow()
  })
})

describe('M5 Interact', () => {
  it('emits an Interacted event for an NPC at the current location', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const npc = makeEntity('npc-1', 'npc', 'Old Merchant', 'town')
    await orch.dispatch('g1', { type: 'AddEntity', entity: npc })

    await orch.dispatch('g1', { type: 'Interact', entityId: 'npc-1' })

    const events = await eventStore.list('g1')
    const interacted = events.find((e) => e.type === 'Interacted')
    expect(interacted).toBeTruthy()
    expect((interacted!.payload as any).entityId).toBe('npc-1')
    expect((interacted!.payload as any).locationId).toBe('town')
  })

  it('rejects interacting with a non-NPC entity', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const pc = makeEntity('pc-1', 'pc', 'Hero', 'town')
    await orch.dispatch('g1', { type: 'AddEntity', entity: pc })

    await expect(
      orch.dispatch('g1', { type: 'Interact', entityId: 'pc-1' }),
    ).rejects.toThrow()
  })

  it('rejects interacting with an NPC at a different location', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const npc = makeEntity('npc-1', 'npc', 'Forest Spirit', 'forest') // not in town
    await orch.dispatch('g1', { type: 'AddEntity', entity: npc })

    await expect(
      orch.dispatch('g1', { type: 'Interact', entityId: 'npc-1' }),
    ).rejects.toThrow()
  })
})

describe('M5 EndScene', () => {
  it('decreases chaos on success', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const before = await orch.loadState('g1')
    await orch.dispatch('g1', { type: 'EndScene', result: 'success' })

    const after = await orch.loadState('g1')
    expect(after!.runtime.chaos).toBe(before!.runtime.chaos - 1)
  })

  it('increases chaos on failure', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const before = await orch.loadState('g1')
    await orch.dispatch('g1', { type: 'EndScene', result: 'failure' })

    const after = await orch.loadState('g1')
    expect(after!.runtime.chaos).toBe(before!.runtime.chaos + 1)
  })

  it('emits a SceneEnded event', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    await orch.dispatch('g1', { type: 'EndScene', result: 'success' })

    const events = await eventStore.list('g1')
    const ended = events.find((e) => e.type === 'SceneEnded')
    expect(ended).toBeTruthy()
    expect((ended!.payload as any).result).toBe('success')
  })
})

describe('M5 replay determinism', () => {
  it('replaying scene events yields identical state', async () => {
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')

    const pc = makeEntity('pc-1', 'pc', 'Hero', 'town')
    pc.stats.stress = 2
    await orch.dispatch('g1', { type: 'AddEntity', entity: pc })
    await orch.dispatch('g1', { type: 'Search', aspectName: 'Ancient Rune' })
    await orch.dispatch('g1', { type: 'Rest' })
    await orch.dispatch('g1', { type: 'Travel', toLocationId: 'forest' })

    const events = await eventStore.list('g1')
    const state1 = replay('g1', events)
    const state2 = replay('g1', events)

    expect(state1).toEqual(state2)
  })
})

describe('M5 scene → encounter transition', () => {
  it('switching to encounter mode does not clear scene state', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')
    await orch.dispatch('g1', { type: 'Search', aspectName: 'Dark Altar' })

    await orch.dispatch('g1', { type: 'SetMode', mode: 'encounter' })

    const state = await orch.loadState('g1')
    expect(state!.runtime.mode).toBe('encounter')
    // Scene data persists
    expect(state!.scene).toBeDefined()
    expect(state!.scene!.locations['town']).toBeDefined()
  })

  it('switching back to scene mode preserves the location graph', async () => {
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)
    await setupScene(orch, 'g1')
    await orch.dispatch('g1', { type: 'SetMode', mode: 'encounter' })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })

    const state = await orch.loadState('g1')
    expect(state!.runtime.mode).toBe('scene')
    expect(state!.scene!.locations['town']).toBeDefined()
    expect(state!.scene!.locationId).toBe('town')
  })
})
