import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryEventStore, MemoryStateStore } from '@autarch/persistence'
import { MemoryWorldGraph } from '@autarch/knowledge-graph'
import { MemoryVectorStore } from '@autarch/vector-store'
import { ContextModelService } from '@autarch/context'
import { Orchestrator } from '@autarch/runtime'
import { NarrativeService, StubLLMClient } from '../src/index'
import type { ILLMClient } from '../src/interfaces'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStores() {
  return {
    eventStore: new MemoryEventStore(),
    stateStore: new MemoryStateStore(),
    worldGraph: new MemoryWorldGraph(),
    narrativeStore: new MemoryVectorStore(),
  }
}

function makeServices(stores: ReturnType<typeof makeStores>, llm: ILLMClient) {
  const contextService = new ContextModelService(
    stores.eventStore,
    stores.stateStore,
    stores.worldGraph,
    stores.narrativeStore,
  )
  return new NarrativeService(contextService, llm, stores.narrativeStore)
}

async function newGame(stores: ReturnType<typeof makeStores>, gameId = 'g1') {
  const orch = new Orchestrator(stores.eventStore as any, stores.stateStore as any)
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'test' })
  return orch
}

// ── StubLLMClient ──────────────────────────────────────────────────────────────

describe('M9 StubLLMClient', () => {
  it('returns a fixed string', async () => {
    const client = new StubLLMClient('The fire crackled.')
    expect(await client.complete('any prompt')).toBe('The fire crackled.')
  })

  it('returns empty string by default', async () => {
    const client = new StubLLMClient()
    expect(await client.complete('prompt')).toBe('')
  })

  it('accepts a callback that receives the prompt', async () => {
    let captured = ''
    const client = new StubLLMClient((p) => {
      captured = p
      return 'response'
    })
    await client.complete('hello world')
    expect(captured).toBe('hello world')
  })
})

// ── NarrativeService — core pipeline ──────────────────────────────────────────

describe('M9 NarrativeService — core pipeline', () => {
  it('returns the narrative from the LLM', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('The tavern door creaks open.'))
    const { narrative } = await svc.narrate('g1')
    expect(narrative).toBe('The tavern door creaks open.')
  })

  it('returns the prompt alongside the narrative', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('Narrative.'))
    const { prompt } = await svc.narrate('g1')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
  })

  it('prompt contains game state derived from events', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'encounter' })

    let receivedPrompt = ''
    const svc = makeServices(stores, new StubLLMClient((p) => { receivedPrompt = p; return '' }))
    await svc.narrate('g1')
    expect(receivedPrompt).toContain('ENCOUNTER')
  })

  it('prompt contains location when in scene mode with location set', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'SetMode', mode: 'scene' })
    await orch.dispatch('g1', {
      type: 'AddLocation',
      location: { id: 'crypt', name: 'The Crypt', tags: [], aspects: [], connections: [] },
    })
    await orch.dispatch('g1', { type: 'SetLocation', locationId: 'crypt' })

    let receivedPrompt = ''
    const svc = makeServices(stores, new StubLLMClient((p) => { receivedPrompt = p; return '' }))
    await svc.narrate('g1')
    expect(receivedPrompt).toContain('The Crypt')
  })

  it('prompt contains oracle result when last event is OracleAnswered', async () => {
    const stores = makeStores()
    const orch = await newGame(stores)
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Is the witch friendly?', likelihood: 'likely' })

    let receivedPrompt = ''
    const svc = makeServices(stores, new StubLLMClient((p) => { receivedPrompt = p; return '' }))
    await svc.narrate('g1')
    expect(receivedPrompt).toContain('Is the witch friendly?')
    expect(receivedPrompt).toContain('ORACLE')
  })
})

// ── NarrativeService — narrative store ────────────────────────────────────────

describe('M9 NarrativeService — narrative storage', () => {
  it('does not store narrative when no queryEmbedding is provided', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('Some prose.'))
    await svc.narrate('g1') // no queryEmbedding
    // Querying with any vector should return nothing
    const results = await stores.narrativeStore.query([1, 0], 5)
    expect(results).toHaveLength(0)
  })

  it('stores narrative when queryEmbedding is provided and storeNarrative is true', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('Rain fell on the cobblestones.'))
    await svc.narrate('g1', { queryEmbedding: [1, 0] })
    const results = await stores.narrativeStore.query([1, 0], 5)
    expect(results).toHaveLength(1)
    expect(results[0]!.text).toBe('Rain fell on the cobblestones.')
  })

  it('does not store narrative when storeNarrative is false', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('Hidden text.'))
    await svc.narrate('g1', { queryEmbedding: [1, 0], storeNarrative: false })
    const results = await stores.narrativeStore.query([1, 0], 5)
    expect(results).toHaveLength(0)
  })

  it('stored entry includes gameId and mode in metadata', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('A moment of silence.'))
    await svc.narrate('g1', { queryEmbedding: [1, 0] })
    const results = await stores.narrativeStore.query([1, 0], 1)
    expect(results[0]!.metadata['gameId']).toBe('g1')
    expect(results[0]!.metadata['mode']).toBe('scene')
  })

  it('stored narrative is retrieved as history on subsequent narrate calls', async () => {
    const stores = makeStores()
    await newGame(stores)
    const svc = makeServices(stores, new StubLLMClient('First narration.'))

    // First call — stores the narrative
    await svc.narrate('g1', { queryEmbedding: [1, 0] })

    // Second call — the stored narrative should appear in the prompt as history
    let receivedPrompt = ''
    const svc2 = makeServices(stores, new StubLLMClient((p) => { receivedPrompt = p; return 'Second.' }))
    await svc2.narrate('g1', { queryEmbedding: [1, 0], narrativeHistoryCount: 3 })
    expect(receivedPrompt).toContain('First narration.')
  })
})

// ── NarrativeService — isolation ──────────────────────────────────────────────

describe('M9 NarrativeService — game isolation', () => {
  it('narratives are isolated by gameId', async () => {
    const stores = makeStores()
    const orch = new Orchestrator(stores.eventStore as any, stores.stateStore as any)
    await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed: 'a' })
    await orch.dispatch('g2', { type: 'CreateGame', schemaVersion: 1, seed: 'b' })

    let g1prompt = '', g2prompt = ''
    const svc = makeServices(stores, new StubLLMClient((p) => { return p }))

    const r1 = await svc.narrate('g1')
    const r2 = await svc.narrate('g2')

    // Both return prompts — they're different games so context differs at the event level
    expect(r1.narrative).toContain('New game started')
    expect(r2.narrative).toContain('New game started')
  })
})

// ── NarrativeService — LLM errors ─────────────────────────────────────────────

describe('M9 NarrativeService — error handling', () => {
  it('propagates LLM errors without swallowing them', async () => {
    const stores = makeStores()
    await newGame(stores)
    const failingLLM: ILLMClient = {
      complete: async () => { throw new Error('LLM server unreachable') },
    }
    const svc = makeServices(stores, failingLLM)
    await expect(svc.narrate('g1')).rejects.toThrow('LLM server unreachable')
  })

  it('does not store narrative when LLM throws', async () => {
    const stores = makeStores()
    await newGame(stores)
    const failingLLM: ILLMClient = {
      complete: async () => { throw new Error('timeout') },
    }
    const svc = makeServices(stores, failingLLM)
    try { await svc.narrate('g1', { queryEmbedding: [1, 0] }) } catch {}
    const results = await stores.narrativeStore.query([1, 0], 5)
    expect(results).toHaveLength(0)
  })
})
