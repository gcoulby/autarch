import { describe, it, expect } from 'vitest'
import { rollFateDice, sumRolls } from '../../src/domain/rng'

describe('M4 Fate RNG', () => {
  it('produces the same rolls for the same seed and seq', () => {
    const a = rollFateDice('my-seed', 42)
    const b = rollFateDice('my-seed', 42)
    expect(a).toEqual(b)
  })

  it('produces different rolls for different seeds', () => {
    const a = rollFateDice('seed-a', 1)
    const b = rollFateDice('seed-b', 1)
    expect(a).not.toEqual(b)
  })

  it('produces different rolls for different seq numbers', () => {
    const a = rollFateDice('seed', 1)
    const b = rollFateDice('seed', 2)
    expect(a).not.toEqual(b)
  })

  it('produces different rolls for different prefixes', () => {
    const a = rollFateDice('seed', 1, 4, 'atk')
    const b = rollFateDice('seed', 1, 4, 'def')
    expect(a.map((r) => r.result)).not.toEqual(b.map((r) => r.result))
  })

  it('all results are in {-1, 0, +1}', () => {
    for (let i = 0; i < 50; i++) {
      const rolls = rollFateDice(`seed-${i}`, i)
      for (const r of rolls) {
        expect([-1, 0, 1]).toContain(r.result)
      }
    }
  })

  it('returns 4 dice by default with correct die names', () => {
    const rolls = rollFateDice('seed', 1, 4, 'atk')
    expect(rolls).toHaveLength(4)
    expect(rolls.map((r) => r.die)).toEqual(['atk-1', 'atk-2', 'atk-3', 'atk-4'])
  })

  it('sumRolls sums die results', () => {
    expect(sumRolls([{ die: 'd-1', result: -1 }, { die: 'd-2', result: 1 }, { die: 'd-3', result: 0 }, { die: 'd-4', result: 1 }])).toBe(1)
  })

  it('produces a reasonably uniform distribution over many rolls', () => {
    const counts = { '-1': 0, '0': 0, '1': 0 }
    const total = 600
    for (let i = 0; i < total / 4; i++) {
      for (const r of rollFateDice(`seed-${i}`, i)) {
        counts[String(r.result) as keyof typeof counts] += 1
      }
    }
    // Each bucket should be roughly 200 ± 60 (10% tolerance on 600 trials)
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThan(140)
      expect(count).toBeLessThan(260)
    }
  })
})
