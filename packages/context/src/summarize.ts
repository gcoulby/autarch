import type { GameEvent } from '@autarch/engine'

/**
 * Converts a GameEvent into a single human-readable sentence for the recent
 * events section of the context model prompt.
 */
export function summarizeEvent(ev: GameEvent): string {
  const p = ev.payload

  switch (ev.type) {
    case 'GameCreated':
      return 'New game started'

    case 'ModeSet':
      return `Mode changed to ${p['mode']}`

    case 'SceneStarted':
      return 'Scene began'

    case 'LocationAdded':
      return `Location added: ${(p['location'] as { name?: string })?.name ?? p['location']}`

    case 'LocationChanged':
      return `Traveled from ${p['fromLocationId'] ?? 'unknown'} to ${p['toLocationId']}`

    case 'LocationAspectAdded': {
      const aspect = p['aspect'] as { name?: string } | undefined
      return `Discovered "${aspect?.name ?? 'aspect'}" at ${p['locationId']}`
    }

    case 'Rested':
      return 'Party rested and recovered stress'

    case 'Interacted':
      return `Interacted with ${p['npcId']}`

    case 'SceneEnded':
      return `Scene ended — ${p['result']}`

    case 'OracleAnswered':
      return `Oracle: "${p['question']}" → ${p['result']}${p['randomEventTriggered'] ? ' (random event!)' : ''}`

    case 'RandomEventTriggered':
      return 'Random event triggered'

    case 'RollMade': {
      const total = p['shifts'] !== undefined ? `${p['shifts']} shifts` : `total ${p['attackerTotal']}`
      return `Fate roll: ${total}`
    }

    case 'EntityDamaged':
      return `${p['entityId']} took ${p['amount']} stress`

    case 'EntityAdded':
      return `${(p['entity'] as { name?: string })?.name ?? p['entityId']} entered the scene`

    case 'EntityMoved':
      return `${p['entityId']} moved to ${p['toZoneId']}`

    case 'TurnStarted':
      return `${p['entityId']}'s turn began`

    case 'TurnEnded':
      return `${p['entityId']}'s turn ended`

    case 'RoundStarted':
      return `Round ${p['round']} started`

    case 'EncounterEnded':
      return `Encounter ended — ${p['result']}`

    case 'AspectInvoked':
      return `Aspect invoked on ${p['entityId']}`

    case 'AspectCompelled':
      return `Aspect compelled on ${p['entityId']}`

    default:
      return ev.type
  }
}
