import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryVectorStore } from '../src/memory/MemoryVectorStore'
import type { NarrativeEntry } from '../src/interfaces'

function entry(id: string, embedding: number[], text = ''): NarrativeEntry {
  return { id, text, embedding, metadata: {} }
}

describe('MemoryVectorStore', () => {
  let store: MemoryVectorStore

  beforeEach(() => {
    store = new MemoryVectorStore()
  })

  it('returns empty results when store is empty', async () => {
    expect(await store.query([1, 0])).toEqual([])
  })

  it('returns the most similar entry first', async () => {
    await store.upsert(entry('a', [1, 0]))
    await store.upsert(entry('b', [0, 1]))
    await store.upsert(entry('c', [0.9, 0.1]))

    const results = await store.query([1, 0])
    expect(results[0]!.id).toBe('a')
    expect(results[1]!.id).toBe('c')
    expect(results[2]!.id).toBe('b')
  })

  it('respects topK limit', async () => {
    await store.upsert(entry('a', [1, 0]))
    await store.upsert(entry('b', [0.8, 0.2]))
    await store.upsert(entry('c', [0.5, 0.5]))

    const results = await store.query([1, 0], 2)
    expect(results).toHaveLength(2)
  })

  it('upsert replaces existing entry', async () => {
    await store.upsert(entry('a', [1, 0], 'original'))
    await store.upsert(entry('a', [0, 1], 'updated'))
    const results = await store.query([0, 1], 1)
    expect(results[0]!.text).toBe('updated')
  })

  it('delete removes an entry', async () => {
    await store.upsert(entry('a', [1, 0]))
    await store.delete('a')
    expect(await store.query([1, 0])).toHaveLength(0)
  })

  it('identical embeddings have cosine similarity of 1', async () => {
    await store.upsert(entry('a', [0.6, 0.8]))
    await store.upsert(entry('b', [0, 1]))
    const results = await store.query([0.6, 0.8], 1)
    expect(results[0]!.id).toBe('a')
  })

  it('preserves metadata through round-trip', async () => {
    await store.upsert({ id: 'x', text: 'scene', embedding: [1, 0], metadata: { scene: 'tavern', round: 3 } })
    const results = await store.query([1, 0], 1)
    expect(results[0]!.metadata['scene']).toBe('tavern')
    expect(results[0]!.metadata['round']).toBe(3)
  })
})
