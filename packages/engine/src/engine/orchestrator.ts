import type { GameEvent, GameState, Entity, EncounterMap } from '../types/doc-db'
import { assert, requireEntity, isEncounterMode } from '../domain/invariants'
import { replay } from '../domain/replay'
import type { EventStore, StateStore } from '../storage/stores'
import { runAiTurn } from './ai/basic-ai'

function getZoneId(state: any, entityId: string): string | null {
  return state.entities?.[entityId]?.position?.zoneId ?? null
}

function areOpponents(aKind: string, bKind: string): boolean {
  const aIsEnemy = aKind === 'enemy'
  const bIsEnemy = bKind === 'enemy'
  return aIsEnemy !== bIsEnemy
}

function getZone(state: any, zoneId: string) {
  return state.encounter?.map?.zones?.[zoneId]
}

function isAlive(e: any): boolean {
  return !!e?.status?.alive
}

function isPc(e: any): boolean {
  return e?.kind === 'pc'
}

function isEnemy(e: any): boolean {
  return e?.kind === 'enemy'
}

function getEncounterResult(state: GameState): 'win' | 'loss' | null {
  const ents = Object.values(state.entities ?? {})
  const pcs = ents.filter(isPc)
  const enemies = ents.filter(isEnemy)

  const anyPcAlive = pcs.some(isAlive)
  const anyEnemyAlive = enemies.some(isAlive)

  if (!anyEnemyAlive && enemies.length > 0) return 'win'
  if (!anyPcAlive && pcs.length > 0) return 'loss'
  return null
}

export type Command =
  | { type: 'CreateGame'; schemaVersion: number; seed: string }
  | { type: 'Advance' }
  | { type: 'SetMode'; mode: GameState['runtime']['mode'] }
  | { type: 'SetPhase'; phase: GameState['runtime']['phase'] }
  | { type: 'AddEntity'; entity: Entity }
  | { type: 'SetInitiative'; order: string[] }
  | { type: 'StartRound' }
  | { type: 'StartTurn' }
  | { type: 'EndTurn' }
  | { type: 'SetEncounterMap'; map: EncounterMap }
  | { type: 'Move'; entityId: string; toZoneId: string }
  | { type: 'Attack'; attackerId: string; targetId: string }

export class Orchestrator {
  constructor(
    private eventStore: EventStore,
    private stateStore?: StateStore,
  ) {}

  private nowIso() {
    return new Date().toISOString()
  }

  private newId() {
    return crypto.randomUUID()
  }

  async loadState(gameId: string): Promise<GameState | null> {
    if (this.stateStore) {
      const snap = await this.stateStore.load(gameId)
      if (snap) return snap
    }
    const events = await this.eventStore.list(gameId)
    if (events.length === 0) return null
    return replay(gameId, events)
  }

  private makeEvent(gameId: string, seq: number, type: GameEvent['type'], payload: any, actorId?: string): GameEvent {
    return {
      _id: this.newId(),
      gameId,
      seq,
      ts: this.nowIso(),
      type,
      actorId,
      payload,
    }
  }
  async dispatch(gameId: string, cmd: Command, actorId?: string): Promise<GameState> {
    const current = await this.loadState(gameId)
    const lastSeq = await this.eventStore.getLastSeq(gameId)

    let seq = lastSeq
    const nextSeq = () => {
      seq += 1
      return seq
    }

    const eventsToAppend: GameEvent[] = []

    if (cmd.type === 'CreateGame') {
      assert(!current, 'Game already exists')
      eventsToAppend.push(
        this.makeEvent(
          gameId,
          nextSeq(),
          'GameCreated',
          {
            schemaVersion: cmd.schemaVersion,
            createdAt: this.nowIso(),
            seed: cmd.seed,
          },
          actorId,
        ),
      )
    } else {
      assert(current, 'Game does not exist')
      const state = current

      switch (cmd.type) {
        case 'Move': {
          assert(state.runtime.mode === 'encounter', 'Move requires encounter mode')
          assert(state.runtime.phase === 'turn', 'Move only allowed in turn phase')
          assert(state.runtime.activeEntityId === cmd.entityId, 'Move must be for the active entity')

          const fromZoneId = getZoneId(state, cmd.entityId)
          assert(fromZoneId, 'Active entity has no position.zoneId')

          const fromZone = getZone(state, fromZoneId)
          assert(fromZone, 'Current zone not found in encounter map')

          assert(Array.isArray(fromZone.adjacent) && fromZone.adjacent.includes(cmd.toZoneId), 'Destination zone is not adjacent')

          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'EntityMoved',
              {
                entityId: cmd.entityId,
                fromZoneId,
                toZoneId: cmd.toZoneId,
              },
              actorId,
            ),
          )
          break
        }

        case 'Attack': {
          assert(state.runtime.mode === 'encounter', 'Attack requires encounter mode')
          assert(state.runtime.phase === 'turn', 'Attack only allowed in turn phase')
          assert(state.runtime.activeEntityId === cmd.attackerId, 'Attack must be by the active entity')

          const attacker = requireEntity(state, cmd.attackerId)
          const target = requireEntity(state, cmd.targetId)

          assert(target.status.alive, 'Target is not alive')
          assert(areOpponents(attacker.kind, target.kind), 'Cannot attack an ally')

          const attackerZoneId = getZoneId(state, cmd.attackerId)
          const targetZoneId = getZoneId(state, cmd.targetId)
          assert(attackerZoneId && targetZoneId, 'Attacker/target missing position.zoneId')

          // M2: melee-only for now
          assert(attackerZoneId === targetZoneId, 'Target not in range (must be same zone)')

          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'EntityDamaged',
              {
                entityId: cmd.targetId,
                amount: 1,
                sourceEntityId: cmd.attackerId,
              },
              actorId,
            ),
          )
          break
        }

        case 'Advance': {
          assert(isEncounterMode(state), 'Advance only valid in encounter mode')

          // Once resolved, do nothing.
          if (state.runtime.phase === 'resolution') return state

          // Termination can be checked from any encounter phase.
          const result = getEncounterResult(state)
          if (result) {
            eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'EncounterEnded', { result }, actorId))
            break
          }

          // If we are still in initiative, Advance moves us into turn phase.
          if (state.runtime.phase === 'initiative') {
            assert(state.encounter, 'Advance requires encounter state')
            assert(state.encounter.initiative.length > 0, 'Advance in initiative requires initiative to be set')
            eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'PhaseSet', { phase: 'turn' }, actorId))
            break
          }

          // For now we support advancing only in turn phase beyond this point.
          assert(state.runtime.phase === 'turn', 'Advance only supported in initiative/turn/resolution for now')

          // No active entity means "start next turn"
          if (!state.runtime.activeEntityId) {
            return await this.dispatch(gameId, { type: 'StartTurn' }, actorId)
          }

          // AI turn means "run AI"
          if (state.runtime.activeSide === 'ai') {
            // const { runAiTurn } = await import('./ai/basic-ai')
            // return await runAiTurn(this as any, gameId)
            return await runAiTurn(this, gameId)
          }

          // Player turn: do nothing
          return state
        }

        case 'SetMode': {
          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'ModeSet', { mode: cmd.mode }, actorId))
          break
        }

        case 'SetPhase': {
          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'PhaseSet', { phase: cmd.phase }, actorId))
          break
        }

        case 'AddEntity': {
          assert(state.runtime.phase === 'setup', 'AddEntity only allowed in setup phase')
          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'EntityAdded', { entity: cmd.entity }, actorId))
          break
        }

        case 'SetEncounterMap': {
          assert(state.runtime.mode === 'encounter', 'SetEncounterMap requires encounter mode')
          assert(state.runtime.phase === 'setup' || state.runtime.phase === 'initiative', 'SetEncounterMap only in setup or initiative')
          assert(state.encounter, 'SetEncounterMap requires encounter state')

          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'EncounterMapSet', { map: cmd.map }, actorId))
          break
        }

        case 'SetInitiative': {
          assert(isEncounterMode(state), 'SetInitiative requires encounter mode')
          assert(state.runtime.phase === 'initiative' || state.runtime.phase === 'setup', 'SetInitiative only in initiative or setup')
          for (const id of cmd.order) requireEntity(state, id)

          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'InitiativeSet', { order: cmd.order }, actorId))
          break
        }

        case 'StartRound': {
          const nextRound = state.runtime.round + 1
          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'RoundStarted', { round: nextRound }, actorId))
          break
        }

        case 'StartTurn': {
          assert(isEncounterMode(state), 'StartTurn requires encounter mode')
          assert(state.encounter, 'Missing encounter state')
          assert(state.encounter.initiative.length > 0, 'No initiative set')
          assert(state.runtime.activeEntityId === null, 'Cannot start turn while an entity is active')

          const idx = state.encounter.initiativeIndex ?? 0
          const entityId = state.encounter.initiative[idx]
          if (!entityId) throw new Error('Missing entityId')
          requireEntity(state, entityId)

          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'TurnStarted', { entityId }, actorId))
          break
        }

        case 'EndTurn': {
          assert(state.runtime.phase === 'turn', 'EndTurn only allowed during turn phase')
          assert(state.runtime.activeEntityId, 'No active entity to end turn for')

          const entityId = state.runtime.activeEntityId

          eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'TurnEnded', { entityId }, actorId))

          if (state.encounter) {
            const nextIndex = (state.encounter.initiativeIndex + 1) % state.encounter.initiative.length

            eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'EncounterPointerSet', { initiativeIndex: nextIndex }, actorId))
          }

          break
        }
      }
    }

    for (const ev of eventsToAppend) {
      await this.eventStore.append(ev)
    }

    const finalEvents = await this.eventStore.list(gameId)
    const newState = replay(gameId, finalEvents)

    if (this.stateStore) {
      await this.stateStore.save(newState)
    }

    return newState
  }
}
