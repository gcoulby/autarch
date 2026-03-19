import type { EncounterMap, Entity, GameEvent, GameState } from '@autarch/engine'
import { assert, isEncounterMode, requireEntity, rollFateDice, sumRolls } from '@autarch/engine'
import { replay } from '@autarch/engine'
import type { EventStore, StateStore } from '@autarch/persistence'
import { runAiTurn } from '@autarch/engine'

function getZoneId(state: GameState, entityId: string): string | null {
  return state.entities?.[entityId]?.position?.zoneId ?? null
}

function areOpponents(aKind: string, bKind: string): boolean {
  const aIsEnemy = aKind === 'enemy'
  const bIsEnemy = bKind === 'enemy'
  return aIsEnemy !== bIsEnemy
}

function getZone(state: GameState, zoneId: string) {
  return state.encounter?.map?.zones?.[zoneId]
}

function isAlive(e: Entity | undefined): boolean {
  return !!e?.status?.alive
}

function isPc(e: Entity): boolean {
  return e.kind === 'pc'
}

function isEnemy(e: Entity): boolean {
  return e.kind === 'enemy'
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
  // M4 — Fate mechanics
  | { type: 'FateAttack'; attackerId: string; targetId: string }
  | { type: 'InvokeAspect'; entityId: string; aspectId: string; bonus: 'plus2' | 'reroll' }
  | { type: 'CompelAspect'; entityId: string; aspectId: string }
  | { type: 'TakeConsequence'; entityId: string; severity: 'mild' | 'moderate' | 'severe'; name: string }

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

        // M4 — Fate mechanics

        case 'FateAttack': {
          assert(state.runtime.mode === 'encounter', 'FateAttack requires encounter mode')
          assert(state.runtime.phase === 'turn', 'FateAttack only allowed in turn phase')
          assert(state.runtime.activeEntityId === cmd.attackerId, 'FateAttack must be by the active entity')

          const attacker = requireEntity(state, cmd.attackerId)
          const target = requireEntity(state, cmd.targetId)

          assert(target.status.alive, 'Target is not alive')
          assert(areOpponents(attacker.kind, target.kind), 'Cannot attack an ally')

          const attackerZoneId = getZoneId(state, cmd.attackerId)
          const targetZoneId = getZoneId(state, cmd.targetId)
          assert(attackerZoneId && targetZoneId, 'Attacker/target missing position.zoneId')
          assert(attackerZoneId === targetZoneId, 'Target not in range (must be same zone)')

          const gameSeed = state.meta.seed
          const rollSeq = seq + 1 // seq of the events we're about to emit

          const attackRolls = rollFateDice(gameSeed, rollSeq, 4, 'atk')
          const defenseRolls = rollFateDice(gameSeed, rollSeq, 4, 'def')

          const atkSkill = (attacker.stats.skills ?? []).find((s) => s.id === 'fight')?.rating ?? 0
          const defSkill = (target.stats.skills ?? []).find((s) => s.id === 'athletics')?.rating ?? 0

          const atkTotal = sumRolls(attackRolls) + atkSkill
          const defTotal = sumRolls(defenseRolls) + defSkill
          const shifts = atkTotal - defTotal

          // Always emit RollMade so the narrative layer can describe what happened
          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'RollMade',
              {
                attackerId: cmd.attackerId,
                targetId: cmd.targetId,
                attackRolls,
                defenseRolls,
                attackSkillRating: atkSkill,
                defenseSkillRating: defSkill,
                shifts,
              },
              actorId,
            ),
          )

          if (shifts > 0) {
            const damageEvent = this.makeEvent(
              gameId,
              nextSeq(),
              'EntityDamaged',
              { entityId: cmd.targetId, amount: shifts, sourceEntityId: cmd.attackerId },
              actorId,
            )
            damageEvent.rng = {
              seed: `${gameSeed}:${damageEvent.seq}`,
              rolls: [...attackRolls, ...defenseRolls],
            }
            eventsToAppend.push(damageEvent)
          }
          break
        }

        case 'InvokeAspect': {
          const invoker = requireEntity(state, cmd.entityId)
          const aspect = invoker.stats.aspects.find((a) => a.id === cmd.aspectId)
          assert(aspect, `Aspect '${cmd.aspectId}' not found on entity '${cmd.entityId}'`)

          const hasFreeInvoke = aspect.freeInvokes > 0
          const fatePoints = invoker.stats.resources.fatePoints ?? 0
          assert(hasFreeInvoke || fatePoints >= 1, 'No free invokes and insufficient fate points to invoke aspect')

          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'AspectInvoked',
              {
                entityId: cmd.entityId,
                aspectId: cmd.aspectId,
                usedFreeInvoke: hasFreeInvoke,
                bonus: cmd.bonus,
              },
              actorId,
            ),
          )
          break
        }

        case 'CompelAspect': {
          const compelled = requireEntity(state, cmd.entityId)
          const compelAspect = compelled.stats.aspects.find((a) => a.id === cmd.aspectId)
          assert(compelAspect, `Aspect '${cmd.aspectId}' not found on entity '${cmd.entityId}'`)

          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'AspectCompelled',
              { entityId: cmd.entityId, aspectId: cmd.aspectId },
              actorId,
            ),
          )
          break
        }

        case 'TakeConsequence': {
          const entity = requireEntity(state, cmd.entityId)
          const existing = entity.stats.aspects.find(
            (a) => a.consequenceSeverity === cmd.severity,
          )
          assert(!existing, `Entity already has a ${cmd.severity} consequence`)

          const consequenceId = `consequence-${cmd.severity}-${cmd.entityId}`
          const newAspects = [
            ...entity.stats.aspects,
            { id: consequenceId, name: cmd.name, freeInvokes: 0, consequenceSeverity: cmd.severity },
          ]

          eventsToAppend.push(
            this.makeEvent(
              gameId,
              nextSeq(),
              'EntityPatched',
              {
                entityId: cmd.entityId,
                patch: { stats: { ...entity.stats, aspects: newAspects } },
              },
              actorId,
            ),
          )
          break
        }

        case 'Advance': {
          assert(isEncounterMode(state), 'Advance only valid in encounter mode')

          if (state.runtime.phase === 'resolution') return state

          const result = getEncounterResult(state)
          if (result) {
            eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'EncounterEnded', { result }, actorId))
            break
          }

          if (state.runtime.phase === 'initiative') {
            assert(state.encounter, 'Advance requires encounter state')
            assert(state.encounter.initiative.length > 0, 'Advance in initiative requires initiative to be set')
            eventsToAppend.push(this.makeEvent(gameId, nextSeq(), 'PhaseSet', { phase: 'turn' }, actorId))
            break
          }

          assert(state.runtime.phase === 'turn', 'Advance only supported in initiative/turn/resolution for now')

          if (!state.runtime.activeEntityId) {
            return await this.dispatch(gameId, { type: 'StartTurn' }, actorId)
          }

          if (state.runtime.activeSide === 'ai') {
            return await runAiTurn(this, gameId)
          }

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
