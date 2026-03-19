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
  // M4 — Fate mechanics
  | 'RollMade'
  | 'AspectInvoked'
  | 'AspectCompelled'
  // M5 — Scene mode
  | 'SceneStarted'
  | 'LocationAdded'
  | 'LocationChanged'
  | 'LocationAspectAdded'
  | 'Rested'
  | 'Interacted'
  | 'SceneEnded'
  // M6 — Oracle
  | 'OracleAnswered'
  | 'RandomEventTriggered'

export interface Skill {
  id: string
  name: string
  rating: number
}

export interface Stunt {
  id: string
  name: string
  description: string
  skillId?: string
}

export interface Aspect {
  id: string
  name: string
  freeInvokes: number
  /** 'mild' | 'moderate' | 'severe' if this is a consequence */
  consequenceSeverity?: 'mild' | 'moderate' | 'severe'
}

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
    aspects: Aspect[]
    resources: Record<string, number>
    skills?: Skill[]
    stunts?: Stunt[]
  }

  tags: string[]
}

export interface GameState {
  _id: string // gameId
  schemaVersion: number

  meta: {
    createdAt: string
    seed: string
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
  scene?: SceneState

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

// M5 — Scene mode

export interface Location {
  id: string
  name: string
  tags: string[]
  aspects: Aspect[]
  /** IDs of directly connected locations the player can travel to */
  connections: string[]
}

export type SceneState = {
  locationId: string | null
  locations: Record<string, Location>
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

// M4 — Fate mechanics payload types

export type RollResult = { die: string; result: number }

export type RollMadePayload = {
  attackerId: string
  targetId: string
  attackRolls: RollResult[]
  defenseRolls: RollResult[]
  attackSkillRating: number
  defenseSkillRating: number
  shifts: number
}

export type AspectInvokedPayload = {
  entityId: string
  aspectId: string
  usedFreeInvoke: boolean
  bonus: 'plus2' | 'reroll'
}

export type AspectCompelledPayload = {
  entityId: string
  aspectId: string
}

// M5 — Scene mode payload types

export type LocationAddedPayload = { location: Location }

export type LocationChangedPayload = {
  fromLocationId: string | null
  toLocationId: string
}

export type LocationAspectAddedPayload = {
  locationId: string
  aspect: Aspect
}

export type RestedPayload = {
  locationId: string
  entityIds: string[]
}

export type InteractedPayload = {
  entityId: string
  locationId: string
}

export type SceneEndedPayload = {
  result: 'success' | 'failure'
}

// M6 — Oracle payload types

export type OracleAnsweredPayload = {
  question: string
  likelihood: import('../domain/oracle.js').OracleLikelihood
  chaosAtRoll: number
  die1: number
  die2: number
  adjusted: number
  result: import('../domain/oracle.js').OracleResult
  randomEventTriggered: boolean
}

export type RandomEventTriggeredPayload = {
  chaos: number
  triggerValue: number
}
