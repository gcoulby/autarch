export type InputSpec =
  | { kind: 'none' }
  | { kind: 'entity'; id: string; label: string }
  | { kind: 'mode'; value: 'scene' | 'encounter' | 'downtime' }
  | { kind: 'phase'; value: 'setup' | 'initiative' | 'turn' | 'resolution' }
  | { kind: 'initiativeOrder'; entityIds: string[] }

export type CommandTemplate = { type: CommandDescriptor['type'] }

export type CommandDescriptor =
  | { type: 'CreateGame'; schemaVersion: number; seed: string }
  | { type: 'Advance' }
  | { type: 'AddEntity' }
  | { type: 'SetMode' }
  | { type: 'SetPhase' }
  | { type: 'SetInitiative' }
  | { type: 'SetEncounterMap'; map: any }
  | { type: 'StartRound' }
  | { type: 'StartTurn' }
  | { type: 'EndTurn' }
  | { type: 'Move'; entityId: string; toZoneId: string }
  | { type: 'Attack'; attackerId: string; targetId: string }
  // M4 — Fate mechanics
  | { type: 'FateAttack'; attackerId: string; targetId: string }
  | { type: 'InvokeAspect'; entityId: string; aspectId: string; bonus: 'plus2' | 'reroll' }
  | { type: 'CompelAspect'; entityId: string; aspectId: string }
  | { type: 'TakeConsequence'; entityId: string; severity: 'mild' | 'moderate' | 'severe'; name: string }

export type ActionId =
  | 'create-game'
  | 'add-entity'
  | 'set-mode'
  | 'set-phase'
  | 'set-initiative'
  | 'set-encounter-map'
  | 'advance'
  | 'start-round'
  | 'start-turn'
  | 'end-turn'
  | 'move'
  | 'attack'
  // M4 — Fate mechanics
  | 'fate-attack'
  | 'invoke-aspect'
  | 'compel-aspect'
  | 'take-consequence'

export interface ActionDescriptor {
  id: ActionId
  label: string
  kind: 'system' | 'player' | 'ai'
  inputs: InputSpec
  command: CommandDescriptor | CommandTemplate
}

export type EncounterResult = 'win' | 'loss'
