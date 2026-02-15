import { describe, it, expect } from 'vitest'
import type { Entity, GameState } from '../../src/types/game'
import type { ActionDescriptor } from '../../src/types/actions'
import { getValidActions } from '../../src/engine/valid-actions'

type GameStateOverrides = {
  runtime?: Partial<GameState['runtime']>
  world?: Partial<GameState['world']>
  meta?: Partial<GameState['meta']>

  // Keep these concrete to avoid DeepPartial pollution
  entities?: Record<string, Entity>
  encounter?: GameState['encounter']
  flags?: { locks?: string[] }

  schemaVersion?: GameState['schemaVersion']
  lastEventSeq?: GameState['lastEventSeq']
  _id?: GameState['_id']
}

function baseState(overrides?: GameStateOverrides): GameState {
  const defaultLocks: string[] = []
  const s: GameState = {
    _id: 'game-1',
    schemaVersion: 1,
    meta: { createdAt: '2026-01-01T00:00:00Z' },

    runtime: {
      mode: 'scene',
      phase: 'setup',
      activeSide: 'system',
      activeEntityId: null,
      round: 0,
      tick: 0,
      chaos: 5,
    },

    world: { sceneId: null, locationId: null },

    entities: {},

    encounter: undefined,

    flags: { locks: [] },

    lastEventSeq: 0,
  }

  return {
    ...s,
    ...overrides,
    meta: { ...s.meta, ...(overrides?.meta ?? {}) },
    runtime: { ...s.runtime, ...(overrides?.runtime ?? {}) },
    world: { ...s.world, ...(overrides?.world ?? {}) },
    entities: overrides?.entities ?? s.entities,
    encounter: overrides?.encounter ?? s.encounter,
    flags: { locks: defaultLocks },
  }
}

function ids(actions: ActionDescriptor[]) {
  return actions.map((a) => a.id)
}

describe('getValidActions', () => {
  it('does not include end-turn in setup phase', () => {
    const state = baseState({
      runtime: { mode: 'scene', phase: 'setup', activeEntityId: null, activeSide: 'system' },
    })

    const actions = getValidActions(state)
    expect(ids(actions)).not.toContain('end-turn')
  })

  it('includes start-turn when in encounter mode, initiative set, and no active entity', () => {
    const state = baseState({
      runtime: { mode: 'encounter', phase: 'turn', activeEntityId: null, activeSide: 'system' },
      entities: {
        'pc-1': {
          id: 'pc-1',
          kind: 'pc',
          name: 'Tester',
          status: { alive: true, conditions: [] },
          stats: { stress: 0, maxStress: 6, aspects: [], resources: {} },
          tags: [],
        },
        'e-1': {
          id: 'e-1',
          kind: 'enemy',
          name: 'Goblin',
          status: { alive: true, conditions: [] },
          stats: { stress: 0, maxStress: 6, aspects: [], resources: {} },
          tags: [],
        },
      },
      encounter: {
        initiative: ['pc-1', 'e-1'],
        initiativeIndex: 0,
        map: undefined,
      } as any,
    })

    const actions = getValidActions(state)
    expect(ids(actions)).toContain('start-turn')
    expect(ids(actions)).not.toContain('end-turn')
  })

  it('includes end-turn and excludes start-turn when an entity is active', () => {
    const state = baseState({
      runtime: { mode: 'encounter', phase: 'turn', activeEntityId: 'pc-1', activeSide: 'players' },
      entities: {
        'pc-1': {
          id: 'pc-1',
          kind: 'pc',
          name: 'Tester',
          status: { alive: true, conditions: [] },
          stats: { stress: 0, maxStress: 6, aspects: [], resources: {} },
          tags: [],
        },
      },
      encounter: {
        initiative: ['pc-1'],
        initiativeIndex: 0,
        map: undefined,
      } as any,
    })

    const actions = getValidActions(state)
    expect(ids(actions)).toContain('end-turn')
    expect(ids(actions)).not.toContain('start-turn')
  })
})
