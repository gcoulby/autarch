import { GameState } from '../types/game.js'

export function createInitialState(gameId: string, schemaVersion: number, createdAt: string, seed = ''): GameState {
  return {
    _id: gameId,
    schemaVersion,
    meta: { createdAt, seed },
    runtime: {
      mode: 'scene',
      phase: 'setup',
      activeSide: 'system',
      activeEntityId: null,
      round: 0,
      tick: 0,
      chaos: 5,
    },
    world: {
      sceneId: null,
      locationId: null,
    },
    entities: {},
    encounter: undefined,
    flags: { locks: [] },
    lastEventSeq: 0,
  }
}
