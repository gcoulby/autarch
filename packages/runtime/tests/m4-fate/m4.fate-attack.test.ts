import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator'
import { replay, rollFateDice, sumRolls } from '@autarch/engine'
import { InMemoryEventStore, InMemoryStateStore, makeEntity } from '../helpers'

async function setupFateEncounter(orch: Orchestrator, gameId: string) {
  await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'fate-seed' })

  const pc = makeEntity('pc-1', 'pc', 'Hero', 'A')
  pc.stats.skills = [{ id: 'fight', name: 'Fight', rating: 2 }]
  pc.stats.resources = { fatePoints: 3 }

  const enemy = makeEntity('e-1', 'enemy', 'Goblin', 'A')
  enemy.stats.skills = [{ id: 'athletics', name: 'Athletics', rating: 0 }]

  await orch.dispatch(gameId, { type: 'AddEntity', entity: pc })
  await orch.dispatch(gameId, { type: 'AddEntity', entity: enemy })
  await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
  await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
  await orch.dispatch(gameId, {
    type: 'SetEncounterMap',
    map: {
      zones: {
        A: { id: 'A', name: 'A', tags: [], adjacent: ['B'] },
        B: { id: 'B', name: 'B', tags: [], adjacent: ['A'] },
      },
    },
  })
  await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1'] })
  await orch.dispatch(gameId, { type: 'Advance' }) // initiative → turn
  await orch.dispatch(gameId, { type: 'StartRound' })
  await orch.dispatch(gameId, { type: 'StartTurn' })
}

describe('M4 FateAttack', () => {
  it('emits RollMade event with correct fields', async () => {
    const gameId = 'm4-fate-attack-roll'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)

    await setupFateEncounter(orch, gameId)
    await orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'pc-1', targetId: 'e-1' })

    const events = await eventStore.list(gameId)
    const rollMade = events.find((e) => e.type === 'RollMade')
    expect(rollMade).toBeTruthy()

    const p = rollMade!.payload as any
    expect(p.attackerId).toBe('pc-1')
    expect(p.targetId).toBe('e-1')
    expect(p.attackRolls).toHaveLength(4)
    expect(p.defenseRolls).toHaveLength(4)
    expect(p.attackSkillRating).toBe(2)
    expect(p.defenseSkillRating).toBe(0)
    expect(typeof p.shifts).toBe('number')
  })

  it('applies computed shifts as stress when shifts > 0', async () => {
    const gameId = 'm4-fate-attack-damage'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)

    await setupFateEncounter(orch, gameId)

    // Determine the seq of the RollMade event ahead of time by loading current state
    const before = await orch.loadState(gameId)!
    const gameSeed = before!.meta.seed

    // The RollMade event will be at lastEventSeq+1
    const rollSeq = before!.lastEventSeq + 1
    const atkRolls = rollFateDice(gameSeed, rollSeq, 4, 'atk')
    const defRolls = rollFateDice(gameSeed, rollSeq, 4, 'def')
    const fightRating = 2
    const athleticsRating = 0
    const expectedShifts = sumRolls(atkRolls) + fightRating - (sumRolls(defRolls) + athleticsRating)

    await orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'pc-1', targetId: 'e-1' })

    const after = await orch.loadState(gameId)
    const expectedStress = Math.max(0, expectedShifts)
    expect(after!.entities['e-1'].stats.stress).toBe(expectedStress)
  })

  it('deals no stress on a miss (shifts <= 0) and still emits RollMade', async () => {
    // Use a seed + fight rating combination that we know produces a miss via the known RNG
    const gameId = 'm4-fate-attack-miss'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)

    // Give enemy a very high athletics to force a miss
    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'fate-seed' })
    const pc = makeEntity('pc-1', 'pc', 'Hero', 'A')
    pc.stats.skills = [{ id: 'fight', name: 'Fight', rating: -4 }] // worst possible

    const enemy = makeEntity('e-1', 'enemy', 'Goblin', 'A')
    enemy.stats.skills = [{ id: 'athletics', name: 'Athletics', rating: 4 }] // best possible

    await orch.dispatch(gameId, { type: 'AddEntity', entity: pc })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: enemy })
    await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, {
      type: 'SetEncounterMap',
      map: { zones: { A: { id: 'A', name: 'A', tags: [], adjacent: [] } } },
    })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'e-1'] })
    await orch.dispatch(gameId, { type: 'Advance' })
    await orch.dispatch(gameId, { type: 'StartRound' })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    await orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'pc-1', targetId: 'e-1' })

    const events = await eventStore.list(gameId)
    expect(events.find((e) => e.type === 'RollMade')).toBeTruthy()
    // -4 fight vs +4 athletics: shifts will always be <= 0 (max atk roll sum is +4, -4+4=0; def roll sum min is -4, +4-4=0; but atk total max is 0, def total min is 0, so shifts ≤ 0 always)
    const after = await orch.loadState(gameId)
    expect(after!.entities['e-1'].stats.stress).toBe(0)
    expect(events.find((e) => e.type === 'EntityDamaged')).toBeUndefined()
  })

  it('replay is deterministic — replaying events yields the same state', async () => {
    const gameId = 'm4-replay-det'
    const eventStore = new InMemoryEventStore()
    const orch = new Orchestrator(eventStore as any, new InMemoryStateStore() as any)

    await setupFateEncounter(orch, gameId)
    await orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'pc-1', targetId: 'e-1' })

    const events = await eventStore.list(gameId)
    const state1 = replay(gameId, events)
    const state2 = replay(gameId, events)

    expect(state1).toEqual(state2)
  })

  it('rejects FateAttack when attacker is not the active entity', async () => {
    const gameId = 'm4-fate-attack-guard'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)

    await setupFateEncounter(orch, gameId)
    // e-1 is not the active entity (pc-1 is)
    await expect(
      orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'e-1', targetId: 'pc-1' }),
    ).rejects.toThrow()
  })

  it('rejects FateAttack on an ally', async () => {
    const gameId = 'm4-fate-attack-ally'
    const orch = new Orchestrator(new InMemoryEventStore() as any, new InMemoryStateStore() as any)

    await orch.dispatch(gameId, { type: 'CreateGame', schemaVersion: 1, seed: 'fate-seed' })
    const pc1 = makeEntity('pc-1', 'pc', 'Hero', 'A')
    const pc2 = makeEntity('pc-2', 'pc', 'Ally', 'A')
    await orch.dispatch(gameId, { type: 'AddEntity', entity: pc1 })
    await orch.dispatch(gameId, { type: 'AddEntity', entity: pc2 })
    await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
    await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })
    await orch.dispatch(gameId, {
      type: 'SetEncounterMap',
      map: { zones: { A: { id: 'A', name: 'A', tags: [], adjacent: [] } } },
    })
    await orch.dispatch(gameId, { type: 'SetInitiative', order: ['pc-1', 'pc-2'] })
    await orch.dispatch(gameId, { type: 'Advance' })
    await orch.dispatch(gameId, { type: 'StartRound' })
    await orch.dispatch(gameId, { type: 'StartTurn' })

    await expect(
      orch.dispatch(gameId, { type: 'FateAttack', attackerId: 'pc-1', targetId: 'pc-2' }),
    ).rejects.toThrow()
  })
})
