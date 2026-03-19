import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import { MongoEventStore } from '../src/mongodb/MongoEventStore'
import { MongoStateStore } from '../src/mongodb/MongoStateStore'
import type { GameEvent, GameState } from '@autarch/engine'

function makeEvent(gameId: string, seq: number, type = 'GameCreated'): GameEvent {
  return { gameId, seq, type, payload: {}, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as GameEvent
}

function makeState(id: string, tick = 0): GameState {
  return { _id: id, runtime: { tick } } as unknown as GameState
}

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = await MongoClient.connect(mongod.getUri())
  db = client.db('autarch-test')
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

beforeEach(async () => {
  await db.collection('events').deleteMany({})
  await db.collection('states').deleteMany({})
})

describe('MongoEventStore', () => {
  it('returns empty list for unknown gameId', async () => {
    const store = new MongoEventStore(db)
    expect(await store.list('g1')).toEqual([])
  })

  it('appends and lists events in seq order', async () => {
    const store = new MongoEventStore(db)
    await store.append(makeEvent('g1', 2))
    await store.append(makeEvent('g1', 1))
    const events = await store.list('g1')
    expect(events.map((e) => e.seq)).toEqual([1, 2])
  })

  it('isolates events by gameId', async () => {
    const store = new MongoEventStore(db)
    await store.append(makeEvent('g1', 1))
    await store.append(makeEvent('g2', 1))
    expect(await store.list('g1')).toHaveLength(1)
    expect(await store.list('g2')).toHaveLength(1)
  })

  it('getLastSeq returns 0 for unknown game', async () => {
    const store = new MongoEventStore(db)
    expect(await store.getLastSeq('g1')).toBe(0)
  })

  it('getLastSeq returns the highest seq', async () => {
    const store = new MongoEventStore(db)
    await store.append(makeEvent('g1', 1))
    await store.append(makeEvent('g1', 3))
    await store.append(makeEvent('g1', 2))
    expect(await store.getLastSeq('g1')).toBe(3)
  })

  it('events round-trip with all fields intact', async () => {
    const store = new MongoEventStore(db)
    const ev = makeEvent('g1', 1, 'ModeSet')
    await store.append(ev)
    const [loaded] = await store.list('g1')
    expect(loaded!.gameId).toBe('g1')
    expect(loaded!.seq).toBe(1)
    expect(loaded!.type).toBe('ModeSet')
  })
})

describe('MongoStateStore', () => {
  it('returns null for unknown gameId', async () => {
    const store = new MongoStateStore(db)
    expect(await store.load('g1')).toBeNull()
  })

  it('saves and loads state by gameId', async () => {
    const store = new MongoStateStore(db)
    const state = makeState('g1', 5)
    await store.save(state)
    const loaded = await store.load('g1')
    expect(loaded!._id).toBe('g1')
    expect(loaded!.runtime.tick).toBe(5)
  })

  it('overwrites existing state on save (upsert)', async () => {
    const store = new MongoStateStore(db)
    await store.save(makeState('g1', 0))
    await store.save(makeState('g1', 42))
    expect((await store.load('g1'))!.runtime.tick).toBe(42)
  })

  it('isolates states by gameId', async () => {
    const store = new MongoStateStore(db)
    await store.save(makeState('g1', 1))
    await store.save(makeState('g2', 2))
    expect((await store.load('g1'))!.runtime.tick).toBe(1)
    expect((await store.load('g2'))!.runtime.tick).toBe(2)
  })
})
