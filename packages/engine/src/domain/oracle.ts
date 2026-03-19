/**
 * M6 — AI Oracle (Fate-style)
 *
 * Pure, deterministic resolution of yes/no questions using the oracle mechanic.
 * No randomness here — dice are rolled by the caller and passed in.
 * The engine decides; the LLM narrates.
 *
 * Mechanic (2d6 + chaos-driven):
 *   adjusted = die1 + die2 + likelihoodModifier + (chaos - 5)
 *   threshold = 7
 *
 * Result bands (relative to threshold):
 *   adjusted >= threshold + 4  →  exceptional-yes
 *   adjusted >= threshold + 2  →  yes-and
 *   adjusted >= threshold      →  yes
 *   adjusted >= threshold - 2  →  no-but
 *   adjusted >= threshold - 4  →  no
 *   adjusted <  threshold - 4  →  exceptional-no
 *
 * Random event (Mythic-style):
 *   If die1 === die2 AND die1 <= chaos → a random event is triggered alongside the answer.
 *   Higher chaos = doubles trigger random events more often.
 */

export type OracleLikelihood =
  | 'very-likely'
  | 'likely'
  | '50-50'
  | 'unlikely'
  | 'very-unlikely'

export type OracleResult =
  | 'exceptional-yes'
  | 'yes-and'
  | 'yes'
  | 'no-but'
  | 'no'
  | 'exceptional-no'

const LIKELIHOOD_MODIFIERS: Record<OracleLikelihood, number> = {
  'very-likely': 4,
  'likely': 2,
  '50-50': 0,
  'unlikely': -2,
  'very-unlikely': -4,
}

const THRESHOLD = 7

/**
 * Resolve an oracle question given pre-rolled dice values.
 *
 * @param die1       - first d6 result (1–6)
 * @param die2       - second d6 result (1–6)
 * @param likelihood - how likely the yes answer is
 * @param chaos      - current chaos factor (1–9)
 */
export function resolveOracle(
  die1: number,
  die2: number,
  likelihood: OracleLikelihood,
  chaos: number,
): OracleResult {
  const adjusted = die1 + die2 + LIKELIHOOD_MODIFIERS[likelihood] + (chaos - 5)

  if (adjusted >= THRESHOLD + 4) return 'exceptional-yes'
  if (adjusted >= THRESHOLD + 2) return 'yes-and'
  if (adjusted >= THRESHOLD) return 'yes'
  if (adjusted >= THRESHOLD - 2) return 'no-but'
  if (adjusted >= THRESHOLD - 4) return 'no'
  return 'exceptional-no'
}

/**
 * Determine whether a random event fires alongside the oracle answer.
 * Fires when the two dice show the same face value AND that value is <= chaos.
 *
 * @param die1  - first d6 result (1–6)
 * @param die2  - second d6 result (1–6)
 * @param chaos - current chaos factor (1–9)
 */
export function isRandomEvent(die1: number, die2: number, chaos: number): boolean {
  return die1 === die2 && die1 <= chaos
}
