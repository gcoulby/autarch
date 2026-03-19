import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryEventStore } from '../src/memory/MemoryEventStore'
import { MemoryStateStore } from '../src/memory/MemoryStateStore'
import type { GameEvent, GameState } from '@autarch/engine'

function makeEvent(gameId: string, seq: number, type = 'GameCreated'): GameEvent {
  return { gameId, seq, type, payload: {}, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as GameEvent
}

function makeState(id: string): GameState {
  return { _id: id, runtime: { tick: 0 } } as unknown as GameState
}

describe('MemoryEventStore', () => {
  let store: MemoryEventStore

  beforeEach(() => {
    store = new MemoryEventStore()
  })

  it('returns empty list for unknown gameId', async () => {
    expect(await store.list('g1')).toEqual([])
  })

  it('appends and lists events in seq order', async () => {
    await store.append(makeEvent('g1', 2))
    await store.append(makeEvent('g1', 1))
    const events = await store.list('g1')
    expect(events.map((e) => e.seq)).toEqual([1, 2])
  })

  it('isolates events by gameId', async () => {
    await store.append(makeEvent('g1', 1))
    await store.append(makeEvent('g2', 1))
    expect(await store.list('g1')).toHaveLength(1)
    expect(await store.list('g2')).toHaveLength(1)
  })

  it('getLastSeq returns 0 for unknown game', async () => {
    expect(await store.getLastSeq('g1')).toBe(0)
  })

  it('getLastSeq returns the highest seq', async () => {
    await store.append(makeEvent('g1', 1))
    await store.append(makeEvent('g1', 3))
    await store.append(makeEvent('g1', 2))
    expect(await store.getLastSeq('g1')).toBe(3)
  })
})

describe('MemoryStateStore', () => {
  let store: MemoryStateStore

  beforeEach(() => {
    store = new MemoryStateStore()
  })

  it('returns null for unknown gameId', async () => {
    expect(await store.load('g1')).toBeNull()
  })

  it('saves and loads state by gameId', async () => {
    const state = makeState('g1')
    await store.save(state)
    expect(await store.load('g1')).toEqual(state)
  })

  it('overwrites existing state on save', async () => {
    await store.save(makeState('g1'))
    const updated = { ...makeState('g1'), runtime: { tick: 99 } } as unknown as GameState
    await store.save(updated)
    expect((await store.load('g1'))!.runtime.tick).toBe(99)
  })
})
