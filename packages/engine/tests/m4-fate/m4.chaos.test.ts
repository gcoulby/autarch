import { describe, it, expect } from 'vitest'
import { applyEvent } from '../../src/domain/reducer'
import { createInitialState } from '../../src/engine/state'
import type { GameEvent, GameState } from '../../src/types/game'

function makeEncounterEndedEvent(result: 'win' | 'loss', seq = 1): GameEvent {
  return {
    _id: 'test-ev',
    gameId: 'game-1',
    seq,
    ts: '2024-01-01T00:00:00.000Z',
    type: 'EncounterEnded',
    payload: { result },
  }
}

function stateWithChaos(chaos: number): GameState {
  const s = createInitialState('game-1', 1, '2024-01-01T00:00:00.000Z')
  s.runtime.chaos = chaos
  return s
}

describe('M4 Chaos factor (reducer)', () => {
  it('decreases by 1 on win', () => {
    const state = stateWithChaos(5)
    const next = applyEvent(state, makeEncounterEndedEvent('win'))
    expect(next.runtime.chaos).toBe(4)
  })

  it('increases by 1 on loss', () => {
    const state = stateWithChaos(5)
    const next = applyEvent(state, makeEncounterEndedEvent('loss'))
    expect(next.runtime.chaos).toBe(6)
  })

  it('does not go below 1 on win', () => {
    const state = stateWithChaos(1)
    const next = applyEvent(state, makeEncounterEndedEvent('win'))
    expect(next.runtime.chaos).toBe(1)
  })

  it('does not go above 9 on loss', () => {
    const state = stateWithChaos(9)
    const next = applyEvent(state, makeEncounterEndedEvent('loss'))
    expect(next.runtime.chaos).toBe(9)
  })
})
