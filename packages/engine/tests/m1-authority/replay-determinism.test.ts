// tests/replay-determinism.test.ts

import { describe, it, expect } from 'vitest'
import { replay } from '../../src/domain/replay'
import type { GameEvent, Entity } from '../../src/types/game'

function makeEntity(id: string, kind: Entity['kind'], name: string): Entity {
  return {
    id,
    kind,
    name,
    status: { alive: true, conditions: [] },
    stats: {
      stress: 0,
      maxStress: 6,
      aspects: [],
      resources: {},
    },
    tags: [],
  }
}

describe('replay determinism', () => {
  it('replaying the same events twice yields identical state', () => {
    const gameId = 'game-determinism'

    const events: GameEvent[] = [
      {
        _id: 'e1',
        gameId,
        seq: 1,
        ts: '2026-01-01T00:00:00Z',
        type: 'GameCreated',
        payload: { schemaVersion: 1, createdAt: '2026-01-01T00:00:00Z' },
      },
      {
        _id: 'e2',
        gameId,
        seq: 2,
        ts: '2026-01-01T00:00:01Z',
        type: 'EntityAdded',
        payload: { entity: makeEntity('pc-1', 'pc', 'Tester') },
      },
      {
        _id: 'e3',
        gameId,
        seq: 3,
        ts: '2026-01-01T00:00:02Z',
        type: 'EntityAdded',
        payload: { entity: makeEntity('e-1', 'enemy', 'Goblin') },
      },
      {
        _id: 'e4',
        gameId,
        seq: 4,
        ts: '2026-01-01T00:00:03Z',
        type: 'ModeSet',
        payload: { mode: 'encounter' },
      },
      {
        _id: 'e5',
        gameId,
        seq: 5,
        ts: '2026-01-01T00:00:04Z',
        type: 'PhaseSet',
        payload: { phase: 'initiative' },
      },
      {
        _id: 'e6',
        gameId,
        seq: 6,
        ts: '2026-01-01T00:00:05Z',
        type: 'InitiativeSet',
        payload: { order: ['pc-1', 'e-1'] },
      },
      {
        _id: 'e7',
        gameId,
        seq: 7,
        ts: '2026-01-01T00:00:06Z',
        type: 'RoundStarted',
        payload: { round: 1 },
      },
      {
        _id: 'e8',
        gameId,
        seq: 8,
        ts: '2026-01-01T00:00:07Z',
        type: 'TurnStarted',
        payload: { entityId: 'pc-1' },
      },
      {
        _id: 'e9',
        gameId,
        seq: 9,
        ts: '2026-01-01T00:00:08Z',
        type: 'TurnEnded',
        payload: { entityId: 'pc-1' },
      },
      {
        _id: 'e10',
        gameId,
        seq: 10,
        ts: '2026-01-01T00:00:09Z',
        type: 'EncounterPointerSet',
        payload: { initiativeIndex: 1 },
      },
      {
        _id: 'e11',
        gameId,
        seq: 11,
        ts: '2026-01-01T00:00:10Z',
        type: 'TurnStarted',
        payload: { entityId: 'e-1' },
      },
    ]

    const stateA = replay(gameId, events)
    const stateB = replay(gameId, events)

    expect(stateA).toEqual(stateB)

    // Extra sanity: ensure branch effects happened (so we know we're not hitting default)
    expect(stateA.runtime.mode).toBe('encounter')
    expect(stateA.runtime.phase).toBe('turn')
    expect(stateA.runtime.activeEntityId).toBe('e-1')
    expect(stateA.encounter?.initiativeIndex).toBe(1)
  })
})
