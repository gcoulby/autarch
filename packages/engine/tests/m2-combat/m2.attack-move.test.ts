import { describe, it, expect } from 'vitest'
import { getValidActions } from '../../src/engine/valid-actions'
import type { GameState, Entity } from '../../src/types/game'

function makeEntity(id: string, kind: Entity['kind'], name: string, zoneId: string): Entity {
  return {
    id,
    kind,
    name,
    status: { alive: true, conditions: [] },
    stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
    tags: [],
    position: { zoneId },
  }
}

function baseState(overrides?: Partial<GameState>): GameState {
  const s: GameState = {
    _id: 'game-1',
    schemaVersion: 1,
    meta: { createdAt: '2026-01-01T00:00:00Z' },
    runtime: {
      mode: 'encounter',
      phase: 'turn',
      activeSide: 'players',
      activeEntityId: 'pc-1',
      round: 1,
      tick: 0,
      chaos: 5,
    },
    world: { sceneId: null, locationId: null },
    entities: {},
    encounter: {
      initiative: ['pc-1', 'e-1'],
      initiativeIndex: 0,
      map: {
        zones: {
          A: { id: 'A', name: 'A', tags: [], adjacent: ['B', 'C'] },
          B: { id: 'B', name: 'B', tags: [], adjacent: ['A'] },
          C: { id: 'C', name: 'C', tags: [], adjacent: ['A'] },
        },
      },
    },
    flags: { locks: [] },
    lastEventSeq: 0,
  }

  return {
    ...s,
    ...overrides,
    runtime: { ...s.runtime, ...(overrides?.runtime ?? {}) },
    world: { ...s.world, ...(overrides?.world ?? {}) },
    entities: overrides?.entities ?? s.entities,
    encounter: overrides?.encounter ?? s.encounter,
    flags: overrides?.flags ?? s.flags,
  }
}

describe('M2 valid actions (zones)', () => {
  it('includes Move actions to all adjacent zones for the active entity', () => {
    const state = baseState({
      entities: {
        'pc-1': makeEntity('pc-1', 'pc', 'Hero', 'A'),
      },
    })

    const actions = getValidActions(state)

    const moves = actions.filter((a: any) => a.command?.type === 'Move')
    const toZoneIds = moves.map((m: any) => m.command.toZoneId).sort()

    expect(toZoneIds).toEqual(['B', 'C'])
  })

  it('includes Attack only for opposing, alive targets in the same zone', () => {
    const state = baseState({
      entities: {
        'pc-1': makeEntity('pc-1', 'pc', 'Hero', 'A'),
        'e-1': makeEntity('e-1', 'enemy', 'Goblin', 'A'), // same zone -> attackable
        'e-2': makeEntity('e-2', 'enemy', 'Orc', 'B'), // different zone -> not attackable
      },
    })

    const actions = getValidActions(state)

    const attacks = actions.filter((a: any) => a.command?.type === 'Attack')
    const targetIds = attacks.map((a: any) => a.command.targetId)

    expect(targetIds).toEqual(['e-1'])
  })

  it('does not include Move or Attack if the map or positions are missing', () => {
    const state = baseState({
      entities: {
        'pc-1': {
          ...makeEntity('pc-1', 'pc', 'Hero', 'A'),
          position: undefined,
        } as any,
      },
      encounter: {
        initiative: ['pc-1'],
        initiativeIndex: 0,
        map: undefined,
      } as any,
    })

    const actions = getValidActions(state)

    expect(actions.some((a: any) => a.command?.type === 'Move')).toBe(false)
    expect(actions.some((a: any) => a.command?.type === 'Attack')).toBe(false)
  })
})
