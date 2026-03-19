import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { replay, rollD6Pair, resolveOracle, isRandomEvent } from '@autarch/engine'
import { InMemoryEventStore, InMemoryStateStore } from '../helpers'

async function newGame(seed = 'oracle-seed') {
  const eventStore = new InMemoryEventStore()
  const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
  await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed })
  return { orch, eventStore }
}

describe('M6 AskOracle — event structure', () => {
  it('emits an OracleAnswered event with all required fields', async () => {
    const { orch, eventStore } = await newGame()
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Is the door unlocked?', likelihood: '50-50' })

    const events = await eventStore.list('g1')
    const ev = events.find((e) => e.type === 'OracleAnswered')
    expect(ev).toBeTruthy()

    const p = ev!.payload as any
    expect(p.question).toBe('Is the door unlocked?')
    expect(p.likelihood).toBe('50-50')
    expect(typeof p.chaosAtRoll).toBe('number')
    expect(typeof p.die1).toBe('number')
    expect(typeof p.die2).toBe('number')
    expect(typeof p.adjusted).toBe('number')
    expect(['exceptional-yes', 'yes-and', 'yes', 'no-but', 'no', 'exceptional-no']).toContain(p.result)
    expect(typeof p.randomEventTriggered).toBe('boolean')
  })

  it('stores dice in event.rng.rolls', async () => {
    const { orch, eventStore } = await newGame()
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })

    const events = await eventStore.list('g1')
    const ev = events.find((e) => e.type === 'OracleAnswered')
    expect(ev!.rng).toBeDefined()
    expect(ev!.rng!.rolls).toHaveLength(2)
    expect(ev!.rng!.rolls[0].die).toBe('oracle-1')
    expect(ev!.rng!.rolls[1].die).toBe('oracle-2')
  })
})

describe('M6 AskOracle — determinism', () => {
  it('produces the same result on replay', async () => {
    const { orch, eventStore } = await newGame()
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Second question', likelihood: 'likely' })

    const events = await eventStore.list('g1')
    const state1 = replay('g1', events)
    const state2 = replay('g1', events)
    expect(state1).toEqual(state2)
  })

  it('computed result matches what resolveOracle would return for the same inputs', async () => {
    const seed = 'determinism-test'
    const { orch, eventStore } = await newGame(seed)

    const stateBefore = await orch.loadState('g1')
    const chaos = stateBefore!.runtime.chaos
    const oracleSeq = stateBefore!.lastEventSeq + 1

    await orch.dispatch('g1', { type: 'AskOracle', question: 'Will it rain?', likelihood: 'unlikely' })

    const [d1, d2] = rollD6Pair(seed, oracleSeq)
    const expectedResult = resolveOracle(d1.result, d2.result, 'unlikely', chaos)
    const expectedRandomEvent = isRandomEvent(d1.result, d2.result, chaos)

    const events = await eventStore.list('g1')
    const ev = events.find((e) => e.type === 'OracleAnswered')!
    const p = ev.payload as any

    expect(p.result).toBe(expectedResult)
    expect(p.die1).toBe(d1.result)
    expect(p.die2).toBe(d2.result)
    expect(p.randomEventTriggered).toBe(expectedRandomEvent)
  })

  it('does not change chaos', async () => {
    const { orch } = await newGame()
    const before = await orch.loadState('g1')
    await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
    const after = await orch.loadState('g1')
    expect(after!.runtime.chaos).toBe(before!.runtime.chaos)
  })
})

describe('M6 AskOracle — random event', () => {
  it('emits RandomEventTriggered when doubles roll at or below chaos', async () => {
    // Find a seed+seq that produces doubles <= chaos to verify the mechanic end-to-end.
    // We know our RNG is deterministic so we can find this by scanning seeds.
    let found = false
    for (let i = 0; i < 200 && !found; i++) {
      const seed = `scan-${i}`
      const eventStore = new InMemoryEventStore()
      const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
      await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed })

      const state = await orch.loadState('g1')
      const chaos = state!.runtime.chaos
      const nextSeq = state!.lastEventSeq + 1
      const [d1, d2] = rollD6Pair(seed, nextSeq)

      if (d1.result === d2.result && d1.result <= chaos) {
        await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
        const events = await eventStore.list('g1')
        expect(events.find((e) => e.type === 'RandomEventTriggered')).toBeTruthy()
        expect((events.find((e) => e.type === 'OracleAnswered')!.payload as any).randomEventTriggered).toBe(true)
        found = true
      }
    }
    if (!found) throw new Error('Could not find a seed that produces doubles — increase scan range')
  })

  it('does not emit RandomEventTriggered when dice do not match', async () => {
    // Find a seed that produces non-matching dice
    for (let i = 0; i < 200; i++) {
      const seed = `no-rand-${i}`
      const eventStore = new InMemoryEventStore()
      const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
      await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed })

      const state = await orch.loadState('g1')
      const nextSeq = state!.lastEventSeq + 1
      const [d1, d2] = rollD6Pair(seed, nextSeq)

      if (d1.result !== d2.result) {
        await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
        const events = await eventStore.list('g1')
        expect(events.find((e) => e.type === 'RandomEventTriggered')).toBeUndefined()
        return // test passed
      }
    }
  })

  it('RandomEventTriggered payload records chaos and trigger value', async () => {
    for (let i = 0; i < 200; i++) {
      const seed = `payload-${i}`
      const eventStore = new InMemoryEventStore()
      const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)
      await orch.dispatch('g1', { type: 'CreateGame', schemaVersion: 1, seed })

      const state = await orch.loadState('g1')
      const chaos = state!.runtime.chaos
      const nextSeq = state!.lastEventSeq + 1
      const [d1, d2] = rollD6Pair(seed, nextSeq)

      if (d1.result === d2.result && d1.result <= chaos) {
        await orch.dispatch('g1', { type: 'AskOracle', question: 'Test', likelihood: '50-50' })
        const events = await eventStore.list('g1')
        const ev = events.find((e) => e.type === 'RandomEventTriggered')!
        expect((ev.payload as any).chaos).toBe(chaos)
        expect((ev.payload as any).triggerValue).toBe(d1.result)
        return
      }
    }
    throw new Error('No seed produced a random event trigger')
  })
})

describe('M6 AskOracle — game state not mutated', () => {
  it('oracle questions are available in any mode', async () => {
    // Scene mode
    const { orch: orchScene } = await newGame()
    await expect(
      orchScene.dispatch('g1', { type: 'AskOracle', question: 'In scene mode?', likelihood: '50-50' }),
    ).resolves.toBeDefined()

    // Encounter mode
    const eventStore2 = new InMemoryEventStore()
    const orch2 = new Orchestrator(eventStore2 as any, new InMemoryStateStore() as any)
    await orch2.dispatch('g2', { type: 'CreateGame', schemaVersion: 1, seed: 's' })
    await orch2.dispatch('g2', { type: 'SetMode', mode: 'encounter' })
    await expect(
      orch2.dispatch('g2', { type: 'AskOracle', question: 'In encounter mode?', likelihood: 'likely' }),
    ).resolves.toBeDefined()
  })
})
