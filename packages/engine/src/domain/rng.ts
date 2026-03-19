import type { RollResult } from '../types/game.js'

/**
 * FNV-1a hash — maps an arbitrary string to a 32-bit unsigned integer.
 * Used to convert a string seed into a numeric seed for the PRNG.
 */
function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

/**
 * Mulberry32 — fast, high-quality 32-bit PRNG.
 * Returns a function that yields values in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Maps a uniform [0,1) value to a Fate die result: -1, 0, or +1 with equal probability. */
function toFateDie(r: number): number {
  if (r < 1 / 3) return -1
  if (r < 2 / 3) return 0
  return 1
}

/**
 * Roll `count` Fate dice deterministically from a game seed and event sequence number.
 *
 * The combined key `${gameSeed}:${eventSeq}:${prefix}` is hashed to produce a
 * reproducible PRNG state, guaranteeing identical results on replay.
 *
 * @param gameSeed  - the seed stored in GameState.meta.seed
 * @param eventSeq  - the seq number of the event that owns these rolls
 * @param count     - number of dice (default 4 for standard 4dF)
 * @param prefix    - die name prefix, e.g. "atk" or "def"
 */
export function rollFateDice(
  gameSeed: string,
  eventSeq: number,
  count = 4,
  prefix = 'd',
): RollResult[] {
  const key = `${gameSeed}:${eventSeq}:${prefix}`
  const rng = mulberry32(fnv1a(key))
  return Array.from({ length: count }, (_, i) => ({
    die: `${prefix}-${i + 1}`,
    result: toFateDie(rng()),
  }))
}

/** Sum an array of RollResults. */
export function sumRolls(rolls: RollResult[]): number {
  return rolls.reduce((acc, r) => acc + r.result, 0)
}

/**
 * Roll two standard d6 dice (results 1–6) deterministically.
 * Used by the M6 oracle. Die names are `oracle-1` and `oracle-2` by default.
 *
 * @param gameSeed  - the seed stored in GameState.meta.seed
 * @param eventSeq  - the seq number of the event that owns these rolls
 * @param prefix    - die name prefix (default "oracle")
 */
export function rollD6Pair(
  gameSeed: string,
  eventSeq: number,
  prefix = 'oracle',
): [RollResult, RollResult] {
  const key = `${gameSeed}:${eventSeq}:${prefix}`
  const rng = mulberry32(fnv1a(key))
  const die1: RollResult = { die: `${prefix}-1`, result: Math.floor(rng() * 6) + 1 }
  const die2: RollResult = { die: `${prefix}-2`, result: Math.floor(rng() * 6) + 1 }
  return [die1, die2]
}
