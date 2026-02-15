import { Entity, GameEvent } from './game.js'

export type GameMode = 'scene' | 'encounter' | 'downtime'
export type GamePhase = 'setup' | 'initiative' | 'turn' | 'resolution'
export type Side = 'players' | 'ai' | 'system'

export type EventType =
  | 'GameCreated'
  | 'ModeSet'
  | 'PhaseSet'
  | 'RoundStarted'
  | 'InitiativeSet'
  | 'ActiveEntitySet'
  | 'TurnStarted'
  | 'TurnEnded'
  | 'EntityAdded'
  | 'EntityPatched'
  | 'EncounterPointerSet'

export interface BaseEventPayloads {
  GameCreated: { schemaVersion: number; createdAt: string; seed: string }
  ModeSet: { mode: GameMode }
  PhaseSet: { phase: GamePhase }
  RoundStarted: { round: number }
  InitiativeSet: { order: string[] }
  ActiveEntitySet: { entityId: string | null; side: Side }
  TurnStarted: { entityId: string }
  TurnEnded: { entityId: string }
  EntityAdded: { entity: Entity }
  EntityPatched: { entityId: string; patch: Partial<Entity> }
  EncounterPointerSet: { initiativeIndex: number }
}

export type TypedGameEvent<T extends EventType = EventType> = GameEvent & {
  type: T
  payload: BaseEventPayloads[T]
}
