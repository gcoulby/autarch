import type { EncounterMap, GameState } from '../types/game.js'
import type { ActionDescriptor } from '../types/actions.js'
import { isEncounterMode } from '../domain/invariants.js'

function hasInitiative(state: GameState): boolean {
  return !!state.encounter && state.encounter.initiative.length > 0
}

function getZoneId(state: GameState, entityId: string): string | null {
  const ent = state.entities[entityId]
  return ent?.position?.zoneId ?? null
}

function getZone(state: GameState, zoneId: string) {
  return state.encounter?.map?.zones?.[zoneId]
}

function isAlive(state: GameState, entityId: string): boolean {
  const ent = state.entities[entityId]
  return !!ent && ent.status.alive
}

function isEnemy(entKind: string): boolean {
  return entKind === 'enemy'
}

export function getValidActions(state: GameState): ActionDescriptor[] {
  const actions: ActionDescriptor[] = []

  const emptyEncounterMap: EncounterMap = { zones: {} }

  const { mode, phase, activeEntityId } = state.runtime

  // Setup actions
  if (phase === 'setup') {
    actions.push({
      id: 'add-entity',
      label: 'Add entity',
      kind: 'system',
      inputs: { kind: 'none' },
      command: { type: 'AddEntity' },
    })

    actions.push({
      id: 'set-mode',
      label: 'Set mode',
      kind: 'system',
      inputs: { kind: 'none' },
      command: { type: 'SetMode' },
    })

    actions.push({
      id: 'set-phase',
      label: 'Set phase',
      kind: 'system',
      inputs: { kind: 'none' },
      command: { type: 'SetPhase' },
    })
  }

  if (isEncounterMode(state) && phase === 'turn') {
    // M3: allow the system to progress the game when the system/AI is active.
    if (state.runtime.activeSide === 'system' || state.runtime.activeSide === 'ai') {
      actions.push({
        id: 'advance',
        label: 'Advance',
        kind: 'system',
        inputs: { kind: 'none' },
        command: { type: 'Advance' },
      })
    }

    if (!activeEntityId) {
      if (hasInitiative(state)) {
        actions.push({
          id: 'start-turn',
          label: 'Start turn',
          kind: 'system',
          inputs: { kind: 'none' },
          command: { type: 'StartTurn' },
        })
      }
    } else {
      actions.push({
        id: 'end-turn',
        label: 'End turn',
        kind: 'system',
        inputs: { kind: 'none' },
        command: { type: 'EndTurn' },
      })
    }
  }

  // Start round
  if (mode === 'encounter' && (phase === 'turn' || phase === 'resolution')) {
    actions.push({
      id: 'start-round',
      label: 'Start round',
      kind: 'system',
      inputs: { kind: 'none' },
      command: { type: 'StartRound' },
    })
  }

  // Turn actions
  if (mode === 'encounter' && phase === 'turn') {
    if (!activeEntityId) {
      if (hasInitiative(state)) {
        actions.push({
          id: 'start-turn',
          label: 'Start turn',
          kind: 'system',
          inputs: { kind: 'none' },
          command: { type: 'StartTurn' },
        })
      }
    } else {
      // End turn is always valid for the active entity
      actions.push({
        id: 'end-turn',
        label: 'End turn',
        kind: state.runtime.activeSide === 'ai' ? 'ai' : 'player',
        inputs: { kind: 'none' },
        command: { type: 'EndTurn' },
      })

      // M2: Move + Attack (only if we have a map and positions)
      const fromZoneId = getZoneId(state, activeEntityId)
      const fromZone = fromZoneId ? getZone(state, fromZoneId) : undefined

      if (fromZoneId && fromZone && Array.isArray(fromZone.adjacent)) {
        for (const toZoneId of fromZone.adjacent) {
          const toZone = getZone(state, toZoneId)
          const toName = toZone?.name ?? toZoneId

          actions.push({
            id: `move`,
            label: `Move to ${toName}`,
            kind: state.runtime.activeSide === 'ai' ? 'ai' : 'player',
            inputs: { kind: 'none' },
            command: { type: 'Move', entityId: activeEntityId, toZoneId },
          })
        }

        // Attack: for M2, melee only (same zone)
        const attacker = state.entities[activeEntityId]
        if (!attacker) return [] // or whatever makes sense here
        const attackerIsEnemy = isEnemy(attacker.kind)

        for (const [targetId, target] of Object.entries(state.entities)) {
          if (targetId === activeEntityId) continue
          if (!isAlive(state, targetId)) continue

          const targetIsEnemy = isEnemy(target.kind)
          if (attackerIsEnemy === targetIsEnemy) continue // must be opposing sides

          const targetZoneId = getZoneId(state, targetId)
          if (targetZoneId !== fromZoneId) continue

          actions.push({
            id: `attack`,
            label: `Attack ${target.name}`,
            kind: state.runtime.activeSide === 'ai' ? 'ai' : 'player',
            inputs: { kind: 'none' },
            command: { type: 'Attack', attackerId: activeEntityId, targetId },
          })
        }
      }
    }
  }

  return actions
}
