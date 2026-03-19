import type { ContextModel } from './types.js'

const SYSTEM_PREAMBLE = [
  'You are narrating a solo tabletop RPG in the Fate system.',
  'Generate vivid, concise narrative prose for the current moment.',
  'Do not make game decisions, alter rules, or change game state.',
  'Respond with narrative text only.',
].join(' ')

/**
 * Serialise a ContextModel into an LLM prompt string.
 *
 * The prompt is intentionally compact — the context model does the heavy
 * lifting so the model narrates rather than reasons.
 */
export function toPrompt(model: ContextModel): string {
  const lines: string[] = []

  lines.push(SYSTEM_PREAMBLE)
  lines.push('')
  lines.push(`MODE: ${model.mode.toUpperCase()}  |  CHAOS: ${model.chaos}`)

  // ── Player ──────────────────────────────────────────────────────────────────
  if (model.player) {
    const { name, stress, maxStress, fatePoints, aspects } = model.player
    lines.push('')
    lines.push(`PLAYER: ${name}  [Stress ${stress}/${maxStress}  Fate Points ${fatePoints}]`)
    if (aspects.length > 0) {
      lines.push(`  Aspects: ${aspects.join(', ')}`)
    }
  }

  // ── Scene ───────────────────────────────────────────────────────────────────
  if (model.mode === 'scene') {
    if (model.currentLocation) {
      const { name, id, aspects, connections } = model.currentLocation
      lines.push('')
      lines.push(`LOCATION: ${name} [${id}]`)
      if (aspects.length > 0) lines.push(`  Aspects: ${aspects.join(', ')}`)
      if (connections.length > 0) lines.push(`  Exits: ${connections.join(', ')}`)
    }

    if (model.nearbyNpcs.length > 0) {
      lines.push('')
      lines.push('CHARACTERS HERE:')
      for (const npc of model.nearbyNpcs) {
        const relStr = npc.relationships.map((r) => `${r.type} → ${r.targetId}`).join(', ')
        lines.push(`  ${npc.name}${relStr ? `  (${relStr})` : ''}`)
      }
    }
  }

  // ── Encounter ───────────────────────────────────────────────────────────────
  if (model.mode === 'encounter' && model.encounterEntities.length > 0) {
    lines.push('')
    lines.push('COMBAT:')
    if (model.activeEntityId) lines.push(`  Active: ${model.activeEntityId}`)
    if (model.initiativeOrder.length > 0) {
      lines.push(`  Initiative: ${model.initiativeOrder.join(' → ')}`)
    }
    for (const e of model.encounterEntities) {
      const hp = e.alive ? `${e.stress}/${e.maxStress} stress` : 'DEFEATED'
      lines.push(`  ${e.name} [${e.kind}]  ${hp}  @ ${e.zoneId}`)
    }
  }

  // ── Narrative history ────────────────────────────────────────────────────────
  if (model.narrativeHistory.length > 0) {
    lines.push('')
    lines.push('RELEVANT HISTORY:')
    for (const h of model.narrativeHistory) {
      lines.push(`  "${h}"`)
    }
  }

  // ── Recent events ────────────────────────────────────────────────────────────
  if (model.recentEvents.length > 0) {
    lines.push('')
    lines.push('RECENT EVENTS:')
    for (const ev of model.recentEvents) {
      lines.push(`  • ${ev}`)
    }
  }

  // ── Oracle ───────────────────────────────────────────────────────────────────
  if (model.latestOracle) {
    const { question, result, randomEventTriggered } = model.latestOracle
    lines.push('')
    lines.push(`ORACLE: "${question}"`)
    lines.push(`  Answer: ${result}`)
    if (randomEventTriggered) lines.push('  ⚡ A random event unfolds alongside this answer.')
  }

  lines.push('')
  lines.push('Narrate the current moment:')

  return lines.join('\n')
}
