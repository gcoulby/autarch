import type { GameEvent, GameState } from '../types/game.js'
import { assert, requireEntity } from './invariants.js'

export function applyEvent(state: GameState, ev: GameEvent): GameState {
  const next: GameState = structuredClone(state)

  next.runtime.tick += 1
  next.lastEventSeq = ev.seq

  switch (ev.type) {
    case 'GameCreated': {
      // Normally you would not apply this to an existing state, but it is safe.
      const p = ev.payload as { schemaVersion: number; createdAt: string; seed: string }
      next.schemaVersion = p.schemaVersion
      next.meta.createdAt = p.createdAt
      next.meta.seed = p.seed ?? ''
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

      // M5 — initialise scene graph when entering scene mode
      if (p.mode === 'scene') {
        next.scene ??= { locationId: null, locations: {} }
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

      // M4 — chaos factor: win decreases chaos, loss increases it (clamped 1–9)
      if (p.result === 'win') {
        next.runtime.chaos = Math.max(1, next.runtime.chaos - 1)
      } else {
        next.runtime.chaos = Math.min(9, next.runtime.chaos + 1)
      }

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

    // M5 — Scene mode

    case 'SceneStarted': {
      // Narrative marker only — scene state is initialised via ModeSet.
      return next
    }

    case 'LocationAdded': {
      const p = ev.payload as { location: import('../types/game.js').Location }
      assert(next.scene, 'LocationAdded requires scene state — set mode to scene first')
      next.scene.locations[p.location.id] = p.location
      return next
    }

    case 'LocationChanged': {
      const p = ev.payload as { fromLocationId: string | null; toLocationId: string }
      assert(next.scene, 'LocationChanged requires scene state')
      assert(next.scene.locations[p.toLocationId], `Location '${p.toLocationId}' not found in scene graph`)
      next.scene.locationId = p.toLocationId
      return next
    }

    case 'LocationAspectAdded': {
      const p = ev.payload as { locationId: string; aspect: import('../types/game.js').Aspect }
      assert(next.scene, 'LocationAspectAdded requires scene state')
      const loc = next.scene.locations[p.locationId]
      assert(loc, `Location '${p.locationId}' not found`)
      loc.aspects = [...loc.aspects, p.aspect]
      return next
    }

    case 'Rested': {
      // Narrative marker — actual stress recovery is applied via EntityPatched events.
      return next
    }

    case 'Interacted': {
      // Narrative marker — dialogue / narrative handled by the context model service (M8).
      return next
    }

    case 'SceneEnded': {
      const p = ev.payload as { result: 'success' | 'failure' }
      if (p.result === 'success') {
        next.runtime.chaos = Math.max(1, next.runtime.chaos - 1)
      } else {
        next.runtime.chaos = Math.min(9, next.runtime.chaos + 1)
      }
      return next
    }

    // M6 — Oracle

    case 'OracleAnswered': {
      // All oracle data lives in the event payload for the narrative layer (M8).
      // No state mutation needed — chaos is not changed by oracle questions.
      return next
    }

    case 'RandomEventTriggered': {
      // Narrative hook only — the context model service (M8) will narrate the event.
      return next
    }

    // M4 — Fate mechanics

    case 'RollMade': {
      // Records a roll in the event log for narrative purposes; no state mutation.
      return next
    }

    case 'AspectInvoked': {
      const p = ev.payload as { entityId: string; aspectId: string; usedFreeInvoke: boolean }
      const ent = requireEntity(next, p.entityId)
      const aspects = ent.stats.aspects.map((a) => {
        if (a.id !== p.aspectId) return a
        if (p.usedFreeInvoke) {
          assert(a.freeInvokes > 0, 'No free invokes remaining on this aspect')
          return { ...a, freeInvokes: a.freeInvokes - 1 }
        }
        return a
      })
      const resources = p.usedFreeInvoke
        ? ent.stats.resources
        : { ...ent.stats.resources, fatePoints: (ent.stats.resources.fatePoints ?? 0) - 1 }
      next.entities[p.entityId] = { ...ent, stats: { ...ent.stats, aspects, resources } }
      return next
    }

    case 'AspectCompelled': {
      const p = ev.payload as { entityId: string; aspectId: string }
      const ent = requireEntity(next, p.entityId)
      const fatePoints = (ent.stats.resources.fatePoints ?? 0) + 1
      next.entities[p.entityId] = {
        ...ent,
        stats: { ...ent.stats, resources: { ...ent.stats.resources, fatePoints } },
      }
      return next
    }

    default:
      return next
  }
}
