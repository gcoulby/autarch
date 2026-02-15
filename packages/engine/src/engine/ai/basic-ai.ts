import type { GameState } from '../../types/doc-db'
import type { ActionDescriptor, CommandDescriptor } from '../../types/actions'
import { getValidActions } from '../valid-actions'
import { assert } from '../../domain/invariants'

export interface AiOrchestrator {
  loadState(gameId: string): Promise<GameState | null>
  dispatch(gameId: string, cmd: { type: string; [k: string]: any }, actorId?: string): Promise<GameState>
}

type AiCommand = { type: 'Move'; entityId: string; toZoneId: string } | { type: 'Attack'; attackerId: string; targetId: string } | { type: 'EndTurn' }

function isEnemy(kind: string) {
  return kind === 'enemy'
}

function zoneDistance(state: GameState, from: string, to: string): number | null {
  if (from === to) return 0

  const zones = state.encounter?.map?.zones
  if (!zones) return null

  const visited = new Set<string>()
  const q: Array<{ z: string; d: number }> = [{ z: from, d: 0 }]
  visited.add(from)

  while (q.length) {
    const cur = q.shift()!
    const zone = zones[cur.z]
    if (!zone) continue

    for (const nxt of zone.adjacent ?? []) {
      if (visited.has(nxt)) continue
      if (nxt === to) return cur.d + 1
      visited.add(nxt)
      q.push({ z: nxt, d: cur.d + 1 })
    }
  }

  return null
}

function getZoneId(state: GameState, entityId: string): string | null {
  return state.entities[entityId]?.position?.zoneId ?? null
}

function getAliveOpponents(state: GameState, attackerId: string): string[] {
  const attacker = state.entities[attackerId]
  if (!attacker) return []

  const attackerEnemy = isEnemy(attacker.kind)

  return Object.values(state.entities)
    .filter((e) => e.id !== attackerId)
    .filter((e) => e.status.alive)
    .filter((e) => attackerEnemy !== isEnemy(e.kind))
    .map((e) => e.id)
}

function pickClosestTarget(state: GameState, attackerId: string): string | null {
  const from = getZoneId(state, attackerId)
  if (!from) return null

  let best: { id: string; dist: number } | null = null

  for (const oppId of getAliveOpponents(state, attackerId)) {
    const to = getZoneId(state, oppId)
    if (!to) continue
    const d = zoneDistance(state, from, to)
    if (d === null) continue

    if (!best || d < best.dist) best = { id: oppId, dist: d }
  }

  return best?.id ?? null
}

function isFullCommand(c: any): c is CommandDescriptor {
  return c && typeof c.type === 'string' && (c.type !== 'SetEncounterMap' || 'map' in c)
}

function commandFromAction(a: ActionDescriptor): AiCommand | null {
  const c: any = a.command
  if (!c?.type) return null
  if (!isFullCommand(c)) return null

  if (c.type === 'Move') return c
  if (c.type === 'Attack') return c
  if (c.type === 'EndTurn') return c

  return null
}

export function chooseAiCommand(state: GameState): AiCommand | null {
  const activeId = state.runtime.activeEntityId
  if (!activeId) return { type: 'EndTurn' }

  const active = state.entities[activeId]
  if (!active || !isEnemy(active.kind)) return { type: 'EndTurn' }

  const actions = getValidActions(state)

  const attackActions = actions.filter((a) => (a.command as any)?.type === 'Attack')
  if (attackActions.length) {
    const target = pickClosestTarget(state, activeId)
    if (target) {
      const match = attackActions.find((a) => (a.command as any).targetId === target)
      if (match) return commandFromAction(match)!
    }
    const firstAttack = attackActions[0]
    if (!firstAttack) return null // or some fallback command
    return commandFromAction(firstAttack)!
  }

  const moveActions = actions.filter((a) => (a.command as any)?.type === 'Move')
  if (moveActions.length) {
    const target = pickClosestTarget(state, activeId)

    const firstMove = moveActions[0]
    if (!firstMove) return null
    if (!target) return commandFromAction(firstMove)

    const targetZone = getZoneId(state, target)
    const fromZone = getZoneId(state, activeId)

    if (targetZone && fromZone) {
      let bestMove: { cmd: any; dist: number } | null = null

      for (const a of moveActions) {
        const cmd = a.command as any as { type: 'Move'; toZoneId: string }
        const d = zoneDistance(state, cmd.toZoneId, targetZone)
        if (d === null) continue

        if (!bestMove || d < bestMove.dist) bestMove = { cmd, dist: d }
      }

      if (bestMove) return bestMove.cmd
    }

    return commandFromAction(firstMove)
  }

  return { type: 'EndTurn' }
}

// export async function runAiTurn(orchestrator: any, gameId: string): Promise<GameState> {
export async function runAiTurn(orchestrator: AiOrchestrator, gameId: string): Promise<GameState> {
  let state: GameState = (await orchestrator.loadState(gameId)) as GameState

  assert(state, 'Missing game state')

  assert(state.runtime.activeSide === 'ai', "runAiTurn called when it's not AI's turn")
  assert(!!state.runtime.activeEntityId, 'runAiTurn called with no active entity')

  const cmd = chooseAiCommand(state)

  // If AI had no legal full command, just end turn (but only if active)
  if (cmd) {
    await orchestrator.dispatch(gameId, cmd)
  }

  state = (await orchestrator.loadState(gameId)) as GameState

  if (state.runtime.activeEntityId) {
    await orchestrator.dispatch(gameId, { type: 'EndTurn' })
  }

  return (await orchestrator.loadState(gameId)) as GameState
}
