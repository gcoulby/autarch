export type GameEventType =
  | 'ActiveEntitySet'
  | 'GameCreated'
  | 'ModeSet'
  | 'PhaseSet'
  | 'EntityAdded'
  | 'EntityPatched'
  | 'InitiativeSet'
  | 'EncounterPointerSet'
  | 'RoundStarted'
  | 'TurnStarted'
  | 'TurnEnded'
  | 'EncounterMapSet'
  | 'EntityMoved'
  | 'EntityDamaged'
  | 'EncounterEnded'

export interface Entity {
  id: string
  kind: 'pc' | 'npc' | 'enemy' | 'summon'
  name: string

  status: {
    alive: boolean
    conditions: string[]
  }

  position?: {
    zoneId: string
  }

  stats: {
    stress: number
    maxStress: number
    aspects: {
      id: string
      name: string
      freeInvokes: number
    }[]
    resources: Record<string, number>
  }

  tags: string[]
}

export interface GameState {
  _id: string // gameId
  schemaVersion: number

  meta: {
    createdAt: string
  }

  runtime: {
    mode: 'scene' | 'encounter' | 'downtime'
    phase: 'setup' | 'initiative' | 'turn' | 'resolution'
    activeSide: 'players' | 'ai' | 'system'
    activeEntityId: string | null
    round: number
    tick: number
    chaos: number
    encounterResult?: 'win' | 'loss'
  }

  world: {
    sceneId: string | null
    locationId?: string | null
  }

  entities: Record<string, Entity>

  encounter?: EncounterState

  flags?: {
    locks: string[]
  }

  lastEventSeq: number
}

export interface GameEvent {
  _id: string // uuid
  gameId: string

  seq: number
  ts: string

  type: GameEventType
  actorId?: string

  payload: Record<string, unknown>

  rng?: {
    seed: string
    rolls: {
      die: string
      result: number
    }[]
  }
}

export type Zone = {
  id: string
  name: string
  tags: string[]
  adjacent: string[]
}

export type EncounterMap = {
  zones: Record<string, Zone>
}

export type EncounterState = {
  initiative: string[]
  initiativeIndex: number
  map?: EncounterMap
}

type EncounterMapSetPayload = { map: EncounterMap }

type EntityMovedPayload = {
  entityId: string
  fromZoneId: string
  toZoneId: string
}

type EntityDamagedPayload = {
  entityId: string
  amount: number
  sourceEntityId?: string
}

type EntityDefeatedPayload = {
  entityId: string
  byEntityId?: string
}
