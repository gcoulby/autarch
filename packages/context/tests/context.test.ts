import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryEventStore, MemoryStateStore } from '@autarch/persistence'
import { MemoryWorldGraph } from '@autarch/knowledge-graph'
import { MemoryVectorStore } from '@autarch/vector-store'
import { Orchestrator } from '@autarch/runtime'
import { ContextModelService } from '../src/ContextModelService'
import { toPrompt } from '../src/prompt'
import { summarizeEvent } from '../src/summarize'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStores() {
  return {
    eventStore: new MemoryEventStore(),
    stateStore: new MemoryStateStore(),
    worldGraph: new MemoryWorldGraph(),
    narrativeStore: new MemoryVectorStore(),
  }
}

function makeService(stores: ReturnType<typeof makeStores>) {
  return new ContextModelService(
    stores.eventStore,
    stores.stateStore,
    stores.worldGraph,
    stores.narrativeStore,
  )
}

async function newGame(
  stores: ReturnType<typeof makeStores>,
  gameId = 'g1',
  seed = 'test-seed',
) {
  const orch = new Orchestrator(stores.eventStore as any, stores.stateStore as any)
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed })
  return orch
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('M8 ContextModelService — basic game state', () => {
  it('returns the correct mode and chaos', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    expect(model.gameId).toBe('g1')
    expect(model.mode).toBe('scene') // initial mode
    expect(model.chaos).toBe(5)      // initial chaos
  })

  it('builds from replay when no state snapshot exists', async () => {
    const stores = makeStores()
    // Populate eventStore but leave stateStore empty
    const orch = new Orchestrator(stores.eventStore as any, new MemoryStateStore() as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'x' })
    const model = await makeService(stores).build('g1')
    expect(model.mode).toBe('scene')
  })

  it('includes a human-readable recent events list', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    expect(model.recentEvents.length).toBeGreaterThan(0)
    expect(model.recentEvents[0]).toBe('New game started')
  })

  it('respects recentEventCount option', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    const model = await makeService(stores).build('g1', { recentEventCount: 1 })
    expect(model.recentEvents).toHaveLength(1)
  })
})

describe('M8 ContextModelService — player context', () => {
  it('extracts the PC entity as the player', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: {
        id: 'hero',
        kind: 'pc',
        name: 'Seraphina',
        status: { alive: true, conditions: [] },
        stats: { stress: 1, maxStress: 4, aspects: [{ id: 'a1', name: 'Grizzled Vet', freeInvokes: 0 }], resources: { fatePoints: 3 } },
        tags: [],
      },
    })
    const model = await makeService(stores).build('g1')
    expect(model.player?.name).toBe('Seraphina')
    expect(model.player?.stress).toBe(1)
    expect(model.player?.maxStress).toBe(4)
    expect(model.player?.fatePoints).toBe(3)
    expect(model.player?.aspects).toContain('Grizzled Vet')
  })

  it('player is null when no PC entity exists', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    expect(model.player).toBeNull()
  })

  it('pcId option selects a specific entity', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: { id: 'pc-a', kind: 'pc', name: 'First', status: { alive: true, conditions: [] }, stats: { stress: 0, maxStress: 3, aspects: [], resources: {} }, tags: [] },
    })
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: { id: 'pc-b', kind: 'pc', name: 'Second', status: { alive: true, conditions: [] }, stats: { stress: 2, maxStress: 3, aspects: [], resources: {} }, tags: [] },
    })
    const model = await makeService(stores).build('g1', { pcId: 'pc-b' })
    expect(model.player?.name).toBe('Second')
  })
})

describe('M8 ContextModelService — scene mode', () => {
  async function sceneSetup() {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', {
      type: 'AddLocation',
      location: { id: 'tavern', name: 'The Rusty Flagon', tags: [], aspects: [], connections: ['market'] },
    })
    await orch.dispatch('g1', {
      type: 'AddLocation',
      location: { id: 'market', name: 'Market Square', tags: [], aspects: [], connections: ['tavern'] },
    })
    await orch.dispatch('g1', { type: 'SetLocation', locationId: 'tavern' })
    return { stores, orch }
  }

  it('currentLocation reflects the scene state', async () => {
    const { stores } = await sceneSetup()
    const model = await makeService(stores).build('g1')
    expect(model.currentLocation?.id).toBe('tavern')
    expect(model.currentLocation?.name).toBe('The Rusty Flagon')
    expect(model.currentLocation?.connections).toContain('market')
  })

  it('currentLocation is null when no location is set', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    const model = await makeService(stores).build('g1')
    expect(model.currentLocation).toBeNull()
  })

  it('currentLocation includes discovered aspects', async () => {
    const { stores, orch } = await sceneSetup()
    await orch.dispatch('g1', { type: 'Search', locationId: 'tavern', aspectName: 'Hidden Trapdoor' })
    const model = await makeService(stores).build('g1')
    expect(model.currentLocation?.aspects).toContain('Hidden Trapdoor')
  })

  it('nearbyNpcs lists NPCs at the current location', async () => {
    const { stores, orch } = await sceneSetup()
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: {
        id: 'barmaid',
        kind: 'npc',
        name: 'Elara',
        status: { alive: true, conditions: [] },
        stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
        tags: [],
        position: { zoneId: 'tavern' },
      },
    })
    const model = await makeService(stores).build('g1')
    expect(model.nearbyNpcs.map((n) => n.id)).toContain('barmaid')
    expect(model.nearbyNpcs.find((n) => n.id === 'barmaid')?.name).toBe('Elara')
  })

  it('NPC relationships are populated from the world graph', async () => {
    const { stores, orch } = await sceneSetup()
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: {
        id: 'barmaid',
        kind: 'npc',
        name: 'Elara',
        status: { alive: true, conditions: [] },
        stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
        tags: [],
        position: { zoneId: 'tavern' },
      },
    })
    await stores.worldGraph.upsertNode({ id: 'innkeeper', type: 'npc', properties: { name: 'Gerolt' } })
    await stores.worldGraph.upsertEdge({ type: 'KNOWS', fromId: 'barmaid', toId: 'innkeeper' })

    const model = await makeService(stores).build('g1')
    const barmaid = model.nearbyNpcs.find((n) => n.id === 'barmaid')
    expect(barmaid?.relationships).toEqual([{ type: 'KNOWS', targetId: 'innkeeper' }])
  })

  it('NPCs at other locations are not included', async () => {
    const { stores, orch } = await sceneSetup()
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: {
        id: 'merchant',
        kind: 'npc',
        name: 'Tomas',
        status: { alive: true, conditions: [] },
        stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
        tags: [],
        position: { zoneId: 'market' }, // different location
      },
    })
    const model = await makeService(stores).build('g1')
    expect(model.nearbyNpcs.map((n) => n.id)).not.toContain('merchant')
  })
})

describe('M8 ContextModelService — encounter mode', () => {
  async function encounterSetup() {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: { id: 'hero', kind: 'pc', name: 'Hero', status: { alive: true, conditions: [] }, stats: { stress: 0, maxStress: 3, aspects: [], resources: {} }, tags: [], position: { zoneId: 'A' } },
    })
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: { id: 'goblin', kind: 'enemy', name: 'Goblin', status: { alive: true, conditions: [] }, stats: { stress: 0, maxStress: 2, aspects: [], resources: {} }, tags: [], position: { zoneId: 'B' } },
    })
    await orch.dispatch('g1', { type: 'SetMode', mode: 'encounter' })
    return { stores, orch }
  }

  it('encounterEntities lists all entities in encounter mode', async () => {
    const { stores } = await encounterSetup()
    const model = await makeService(stores).build('g1')
    expect(model.mode).toBe('encounter')
    expect(model.encounterEntities.map((e) => e.id).sort()).toEqual(['goblin', 'hero'])
  })

  it('encounter entity includes zone and alive status', async () => {
    const { stores } = await encounterSetup()
    const model = await makeService(stores).build('g1')
    const hero = model.encounterEntities.find((e) => e.id === 'hero')
    expect(hero?.zoneId).toBe('A')
    expect(hero?.alive).toBe(true)
    expect(hero?.kind).toBe('pc')
  })

  it('currentLocation and nearbyNpcs are empty in encounter mode', async () => {
    const { stores } = await encounterSetup()
    const model = await makeService(stores).build('g1')
    expect(model.currentLocation).toBeNull()
    expect(model.nearbyNpcs).toHaveLength(0)
  })
})

describe('M8 ContextModelService — oracle', () => {
  it('latestOracle is null when last event is not OracleAnswered', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    expect(model.latestOracle).toBeNull()
  })

  it('latestOracle is populated when last event is OracleAnswered', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Is the door unlocked?', likelihood: '50-50' })
    const model = await makeService(stores).build('g1')
    expect(model.latestOracle?.question).toBe('Is the door unlocked?')
    expect(['exceptional-yes', 'yes-and', 'yes', 'no-but', 'no', 'exceptional-no']).toContain(model.latestOracle?.result)
  })

  it('randomEventTriggered flag is propagated', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
    const model = await makeService(stores).build('g1')
    expect(typeof model.latestOracle?.randomEventTriggered).toBe('boolean')
  })
})

describe('M8 ContextModelService — narrative history', () => {
  it('narrativeHistory is empty when no queryEmbedding is provided', async () => {
    const stores = makeStores()
    await newGame(stores)
    await stores.narrativeStore.upsert({ id: 'n1', text: 'The tavern was smoky.', embedding: [1, 0], metadata: {} })
    const model = await makeService(stores).build('g1') // no queryEmbedding
    expect(model.narrativeHistory).toHaveLength(0)
  })

  it('narrativeHistory returns relevant entries when queryEmbedding is provided', async () => {
    const stores = makeStores()
    await newGame(stores)
    await stores.narrativeStore.upsert({ id: 'n1', text: 'The tavern was smoky.', embedding: [1, 0], metadata: {} })
    await stores.narrativeStore.upsert({ id: 'n2', text: 'Rain fell on the market.', embedding: [0, 1], metadata: {} })
    const model = await makeService(stores).build('g1', { queryEmbedding: [1, 0], narrativeHistoryCount: 1 })
    expect(model.narrativeHistory).toHaveLength(1)
    expect(model.narrativeHistory[0]).toBe('The tavern was smoky.')
  })
})

describe('M8 toPrompt', () => {
  it('produces a non-empty string', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    const prompt = toPrompt(model)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(50)
  })

  it('prompt contains mode, chaos, and closing instruction', async () => {
    const stores = makeStores()
    await newGame(stores)
    const model = await makeService(stores).build('g1')
    const prompt = toPrompt(model)
    expect(prompt).toContain('MODE:')
    expect(prompt).toContain('CHAOS:')
    expect(prompt).toContain('Narrate the current moment:')
  })

  it('prompt includes player info when a PC exists', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', {
      type: 'AddEntity',
      entity: { id: 'hero', kind: 'pc', name: 'Seraphina', status: { alive: true, conditions: [] }, stats: { stress: 1, maxStress: 3, aspects: [], resources: { fatePoints: 2 } }, tags: [] },
    })
    const model = await makeService(stores).build('g1')
    const prompt = toPrompt(model)
    expect(prompt).toContain('Seraphina')
    expect(prompt).toContain('PLAYER:')
  })

  it('prompt includes oracle section when latestOracle is set', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Is the guard awake?', likelihood: 'unlikely' })
    const model = await makeService(stores).build('g1')
    const prompt = toPrompt(model)
    expect(prompt).toContain('ORACLE:')
    expect(prompt).toContain('Is the guard awake?')
  })

  it('prompt includes location section when in scene mode with a location', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', {
      type: 'AddLocation',
      location: { id: 'keep', name: 'The Keep', tags: [], aspects: [], connections: [] },
    })
    await orch.dispatch('g1', { type: 'SetLocation', locationId: 'keep' })
    const model = await makeService(stores).build('g1')
    const prompt = toPrompt(model)
    expect(prompt).toContain('LOCATION:')
    expect(prompt).toContain('The Keep')
  })
})

describe('M8 summarizeEvent', () => {
  it('summarizes known event types', () => {
    const base = { _id: 'x', gameId: 'g1', seq: 1, ts: '', rng: undefined } as const

    expect(summarizeEvent({ ...base, type: 'GameCreated', payload: {} })).toBe('New game started')
    expect(summarizeEvent({ ...base, type: 'Rested', payload: {} })).toContain('rest')
    expect(summarizeEvent({ ...base, type: 'OracleAnswered', payload: { question: 'Q?', result: 'yes', randomEventTriggered: false } }))
      .toContain('Q?')
    expect(summarizeEvent({ ...base, type: 'LocationChanged', payload: { fromLocationId: 'a', toLocationId: 'b' } }))
      .toContain('b')
  })

  it('falls back to event type name for unknown events', () => {
    const ev = { _id: 'x', gameId: 'g1', seq: 1, ts: '', type: 'SomeUnknownEvent' as any, payload: {} }
    expect(summarizeEvent(ev)).toBe('SomeUnknownEvent')
  })
})
