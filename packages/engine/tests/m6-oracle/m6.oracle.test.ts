import { describe, it, expect } from 'vitest'
import { resolveOracle, isRandomEvent } from '../../src/domain/oracle'
import { rollD6Pair } from '../../src/domain/rng'

describe('M6 resolveOracle', () => {
  // threshold = 7, formula: die1+die2 + likelihoodMod + (chaos-5)

  it('returns exceptional-yes on very high adjusted roll', () => {
    // die1=6, die2=6, very-likely(+4), chaos 9(+4) → adjusted = 24, threshold+4 = 11
    expect(resolveOracle(6, 6, 'very-likely', 9)).toBe('exceptional-yes')
  })

  it('returns yes-and on high adjusted roll', () => {
    // die1=6, die2=4, 50-50(0), chaos 5(0) → adjusted = 10, threshold+2=9 ≤ 10 < threshold+4=11 → yes-and
    expect(resolveOracle(6, 4, '50-50', 5)).toBe('yes-and')
  })

  it('returns yes when adjusted == threshold', () => {
    // die1=3, die2=4, 50-50, chaos 5 → adjusted = 7 = threshold
    expect(resolveOracle(3, 4, '50-50', 5)).toBe('yes')
  })

  it('returns no-but just below threshold', () => {
    // die1=2, die2=3, 50-50, chaos 5 → adjusted = 5, threshold-2 = 5 ≤ 5 < 7
    expect(resolveOracle(2, 3, '50-50', 5)).toBe('no-but')
  })

  it('returns no on low adjusted roll', () => {
    // die1=1, die2=2, unlikely(-2), chaos 5 → adjusted = 1+2-2+0 = 1, threshold-4 = 3 > 1
    expect(resolveOracle(1, 2, 'unlikely', 5)).toBe('exceptional-no')
  })

  it('returns exceptional-no on very low adjusted roll', () => {
    // die1=1, die2=1, very-unlikely(-4), chaos 1(-4) → adjusted = 2-4-4 = -6, < 7-4 = 3
    expect(resolveOracle(1, 1, 'very-unlikely', 1)).toBe('exceptional-no')
  })

  it('high chaos increases adjusted value (more likely yes)', () => {
    const low = resolveOracle(3, 3, '50-50', 1)  // adjusted = 6+(-4) = 2 → exceptional-no or no
    const high = resolveOracle(3, 3, '50-50', 9)  // adjusted = 6+(+4) = 10 → yes-and
    expect(['exceptional-no', 'no', 'no-but']).toContain(low)
    expect(['yes-and', 'exceptional-yes']).toContain(high)
  })

  it('very-likely raises odds vs very-unlikely for same dice and chaos', () => {
    const r1 = resolveOracle(3, 3, 'very-likely', 5)
    const r2 = resolveOracle(3, 3, 'very-unlikely', 5)
    const YES_RESULTS = ['exceptional-yes', 'yes-and', 'yes']
    const NO_RESULTS = ['no-but', 'no', 'exceptional-no']
    expect(YES_RESULTS).toContain(r1)
    expect(NO_RESULTS).toContain(r2)
  })

  it('all six result types are reachable', () => {
    const results = new Set<string>()
    // Sweep extreme combinations to hit all bands
    const likelihoods = ['very-likely', 'likely', '50-50', 'unlikely', 'very-unlikely'] as const
    const chaosValues = [1, 5, 9]
    for (const d1 of [1, 3, 6]) {
      for (const d2 of [1, 3, 6]) {
        for (const l of likelihoods) {
          for (const c of chaosValues) {
            results.add(resolveOracle(d1, d2, l, c))
          }
        }
      }
    }
    expect(results).toContain('exceptional-yes')
    expect(results).toContain('yes-and')
    expect(results).toContain('yes')
    expect(results).toContain('no-but')
    expect(results).toContain('no')
    expect(results).toContain('exceptional-no')
  })
})

describe('M6 isRandomEvent', () => {
  it('fires when dice match and value <= chaos', () => {
    expect(isRandomEvent(3, 3, 5)).toBe(true)
    expect(isRandomEvent(5, 5, 5)).toBe(true)
  })

  it('does not fire when dice do not match', () => {
    expect(isRandomEvent(3, 4, 9)).toBe(false)
  })

  it('does not fire when matching value > chaos', () => {
    expect(isRandomEvent(6, 6, 5)).toBe(false)
    expect(isRandomEvent(4, 4, 3)).toBe(false)
  })

  it('fires on doubles 1 even at chaos 1', () => {
    expect(isRandomEvent(1, 1, 1)).toBe(true)
  })

  it('never fires at chaos 0 (edge case)', () => {
    expect(isRandomEvent(1, 1, 0)).toBe(false)
  })
})

describe('M6 rollD6Pair', () => {
  it('returns two results each in 1–6', () => {
    for (let i = 0; i < 20; i++) {
      const [d1, d2] = rollD6Pair(`seed-${i}`, i)
      expect(d1.result).toBeGreaterThanOrEqual(1)
      expect(d1.result).toBeLessThanOrEqual(6)
      expect(d2.result).toBeGreaterThanOrEqual(1)
      expect(d2.result).toBeLessThanOrEqual(6)
    }
  })

  it('is deterministic — same seed+seq yields same result', () => {
    const a = rollD6Pair('my-seed', 42)
    const b = rollD6Pair('my-seed', 42)
    expect(a).toEqual(b)
  })

  it('different seeds produce different results', () => {
    const a = rollD6Pair('seed-a', 1)
    const b = rollD6Pair('seed-b', 1)
    expect(a).not.toEqual(b)
  })

  it('die names are oracle-1 and oracle-2 by default', () => {
    const [d1, d2] = rollD6Pair('seed', 1)
    expect(d1.die).toBe('oracle-1')
    expect(d2.die).toBe('oracle-2')
  })
})
