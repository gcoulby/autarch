import type { GameEvent, GameState } from '../types/game.js'
import { assert, requireEntity } from './invariants.js'

export function applyEvent(state: GameState, ev: GameEvent): GameState {
  const next: GameState = structuredClone(state)

  next.runtime.tick += 1
  next.lastEventSeq = ev.seq

  switch (ev.type) {
    case 'GameCreated': {
      // Normally you would not apply this to an existing state, but it is safe.
      const p = ev.payload as { schemaVersion: number; createdAt: string }
      next.schemaVersion = p.schemaVersion
      next.meta.createdAt = p.createdAt
      return next
    }

    case 'ModeSet': {
      const p = ev.payload as { mode: GameState['runtime']['mode'] }
      next.runtime.mode = p.mode

      if (p.mode !== 'encounter') {
        next.encounter = undefined
        next.runtime.activeEntityId = null
        next.runtime.activeSide = 'system'
      } else {
        next.encounter ??= { initiative: [], initiativeIndex: 0, map: undefined }
      }
      return next
    }

    case 'PhaseSet': {
      const p = ev.payload as { phase: GameState['runtime']['phase'] }
      next.runtime.phase = p.phase
      return next
    }

    case 'EncounterPointerSet': {
      const p = ev.payload as { initiativeIndex: number }
      assert(next.encounter, 'EncounterPointerSet requires encounter state')
      next.encounter.initiativeIndex = p.initiativeIndex
      return next
    }

    case 'EncounterMapSet': {
      const p = ev.payload as { map: any }
      assert(next.encounter, 'EncounterMapSet requires encounter state')
      next.encounter.map = p.map
      return next
    }

    case 'EncounterEnded': {
      const p = ev.payload as { result: 'win' | 'loss' }

      next.runtime.phase = 'resolution'
      next.runtime.activeEntityId = null
      next.runtime.activeSide = 'system'
      next.runtime.encounterResult = p.result

      return next
    }

    case 'EntityMoved': {
      const p = ev.payload as { entityId: string; fromZoneId: string; toZoneId: string }
      const ent = requireEntity(next, p.entityId)

      // Optional sanity
      assert(ent.position?.zoneId === p.fromZoneId, 'EntityMoved fromZone does not match current position')

      next.entities[p.entityId] = {
        ...ent,
        position: { zoneId: p.toZoneId },
      }
      return next
    }

    case 'EntityDamaged': {
      const p = ev.payload as { entityId: string; amount: number }
      const ent = requireEntity(next, p.entityId)
      const stress = Math.max(0, ent.stats.stress + p.amount)

      next.entities[p.entityId] = {
        ...ent,
        stats: { ...ent.stats, stress },
      }

      // Defeat rule for M2: stress >= maxStress => not alive
      if (stress >= ent.stats.maxStress) {
        const entity = next.entities[p.entityId]
        if (!entity) throw new Error(`Entity not found: ${p.entityId}`)

        next.entities[p.entityId] = {
          ...entity,
          status: { ...entity.status, alive: false },
        }
      }

      return next
    }

    case 'EntityAdded': {
      const p = ev.payload as { entity: any }
      const entity = p.entity
      assert(entity?.id, 'EntityAdded missing entity.id')
      next.entities[entity.id] = entity
      return next
    }

    case 'EntityPatched': {
      const p = ev.payload as { entityId: string; patch: any }
      const current = requireEntity(next, p.entityId)
      next.entities[p.entityId] = { ...current, ...p.patch }
      return next
    }

    case 'InitiativeSet': {
      const p = ev.payload as { order: string[] }
      assert(next.encounter, 'InitiativeSet requires encounter state')
      next.encounter.initiative = [...p.order]
      next.encounter.initiativeIndex = 0
      return next
    }

    case 'RoundStarted': {
      const p = ev.payload as { round: number }
      next.runtime.round = p.round
      if (next.encounter) next.encounter.initiativeIndex = 0
      return next
    }

    case 'ActiveEntitySet': {
      const p = ev.payload as { entityId: string | null; side: GameState['runtime']['activeSide'] }
      next.runtime.activeEntityId = p.entityId
      next.runtime.activeSide = p.side
      return next
    }

    case 'TurnStarted': {
      const p = ev.payload as { entityId: string }
      requireEntity(next, p.entityId)
      next.runtime.activeEntityId = p.entityId
      next.runtime.activeSide = next.entities[p.entityId]?.kind === 'enemy' ? 'ai' : 'players'
      next.runtime.phase = 'turn'
      return next
    }

    case 'TurnEnded': {
      const p = ev.payload as { entityId: string }
      assert(next.runtime.activeEntityId === p.entityId, 'TurnEnded entity does not match activeEntityId')
      next.runtime.activeEntityId = null
      next.runtime.activeSide = 'system'
      return next
    }

    default:
      return next
  }
}
