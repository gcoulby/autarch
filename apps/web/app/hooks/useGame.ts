'use client'

import { useCallback, useRef, useState } from 'react'
import type { GameState, Entity, Location } from '@autarch/engine'
import { getValidActions } from '@autarch/engine'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'
import { orchestrator, makeNarrativeService, eventStore, ENV_LLM_URL } from '../lib/game'

export interface NarrativeEntry {
  text: string
  eventType: string
  ts: string
}

export interface OracleResult {
  question: string
  result: string
  die1: number
  die2: number
  chaosAtRoll: number
  adjusted: number
  randomEventTriggered: boolean
}

export interface GameSession {
  gameId: string
  state: GameState
  actions: ActionDescriptor[]
  entries: NarrativeEntry[]
  prompt: string
  narrating: boolean
  error: string | null
  lastOracle: OracleResult | null
}

// Returns a focused trigger description for commands that should produce narration,
// or null to skip narration entirely for mechanical-only commands.
function getTrigger(cmd: Command, state: GameState): string | null {
  const ent = (id: string) => state.entities[id]?.name ?? id
  const loc = (id: string) => state.scene?.locations[id]?.name ?? id
  const pc = Object.values(state.entities).find((e) => e.kind === 'pc')?.name ?? 'The player'

  switch (cmd.type) {
    case 'Travel':          return `${pc} travelled to ${loc(cmd.toLocationId)}`
    case 'Interact':        return `${pc} interacted with ${ent(cmd.entityId)}`
    case 'AskOracle':       return `Oracle asked: "${cmd.question}"`
    case 'FateAttack':      return `${ent(cmd.attackerId)} attacked ${ent(cmd.targetId)} with Fate dice`
    case 'Attack':          return `${ent(cmd.attackerId)} attacked ${ent(cmd.targetId)}`
    case 'Rest':            return `${pc} rested and recovered`
    case 'Search':          return `${pc} searched and discovered: ${cmd.aspectName}`
    case 'EndScene':        return `Scene concluded in ${cmd.result}`
    case 'InvokeAspect':    return `${ent(cmd.entityId)} invoked aspect ${cmd.aspectId}`
    case 'CompelAspect':    return `${ent(cmd.entityId)} was compelled by aspect ${cmd.aspectId}`
    case 'TakeConsequence': return `${ent(cmd.entityId)} took a ${cmd.severity} consequence: ${cmd.name}`
    // Advance is handled after dispatch so we can inspect the resulting event
    default:                return null
  }
}

function extractOracleResult(payload: Record<string, unknown>): OracleResult {
  return {
    question:            String(payload['question']            ?? ''),
    result:              String(payload['result']              ?? ''),
    die1:               Number(payload['die1']               ?? 0),
    die2:               Number(payload['die2']               ?? 0),
    chaosAtRoll:        Number(payload['chaosAtRoll']        ?? 0),
    adjusted:           Number(payload['adjusted']           ?? 0),
    randomEventTriggered: Boolean(payload['randomEventTriggered']),
  }
}

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null)
  const [llmUrl, setLlmUrl] = useState<string>(ENV_LLM_URL)
  const [confirmNewGame, setConfirmNewGame] = useState(false)
  const narrativeSvcRef = useRef(makeNarrativeService(ENV_LLM_URL || undefined))

  const applyLlmUrl = useCallback((url: string) => {
    setLlmUrl(url)
    narrativeSvcRef.current = makeNarrativeService(url.trim() || undefined)
  }, [])

  const refreshState = useCallback(
    async (gameId: string, triggerDescription: string | null): Promise<void> => {
      const state = await orchestrator.loadState(gameId)
      if (!state) return

      const actions = getValidActions(state)
      const events = await eventStore.list(gameId)

      // Surface oracle result immediately from the event — independent of narration
      const lastEvent = events.at(-1)
      const lastOracle =
        lastEvent?.type === 'OracleAnswered'
          ? extractOracleResult(lastEvent.payload)
          : null

      setSession((prev) => ({
        gameId,
        state,
        actions,
        entries: prev?.entries ?? [],
        prompt: prev?.prompt ?? '',
        narrating: triggerDescription !== null,
        error: null,
        lastOracle,
      }))

      if (triggerDescription !== null) {
        const eventType = lastEvent?.type ?? 'unknown'
        try {
          const { narrative, prompt } = await narrativeSvcRef.current.narrate(gameId, {
            triggerEvent: triggerDescription,
          })
          const entry: NarrativeEntry = {
            text: narrative,
            eventType,
            ts: new Date().toISOString(),
          }
          setSession((prev) =>
            prev ? { ...prev, entries: [...prev.entries, entry], prompt, narrating: false } : prev,
          )
        } catch (e) {
          setSession((prev) =>
            prev
              ? { ...prev, narrating: false, error: e instanceof Error ? e.message : String(e) }
              : prev,
          )
        }
      }
    },
    [],
  )

  const doCreateGame = useCallback(async () => {
    const gameId = crypto.randomUUID()
    await orchestrator.dispatch(gameId, {
      type: 'CreateGame',
      schemaVersion: 1,
      seed: String(Date.now()),
    })
    const state = await orchestrator.loadState(gameId)
    if (!state) return
    setSession({
      gameId,
      state,
      actions: getValidActions(state),
      entries: [],
      prompt: '',
      narrating: false,
      error: null,
      lastOracle: null,
    })
  }, [])

  const createGame = useCallback(() => {
    if (session) {
      setConfirmNewGame(true)
    } else {
      void doCreateGame()
    }
  }, [session, doCreateGame])

  const confirmCreate = useCallback(async () => {
    setConfirmNewGame(false)
    await doCreateGame()
  }, [doCreateGame])

  const cancelCreate = useCallback(() => setConfirmNewGame(false), [])

  // Dispatches AddEntity + AddLocation + SetLocation in sequence, then narrates arrival.
  // None of the individual setup commands trigger narration.
  const setupCharacter = useCallback(
    async (characterName: string, locationName: string) => {
      if (!session) return
      const { gameId } = session
      const locationId = crypto.randomUUID()
      const entityId = crypto.randomUUID()

      const location: Location = {
        id: locationId,
        name: locationName,
        tags: [],
        aspects: [],
        connections: [],
      }

      const entity: Entity = {
        id: entityId,
        kind: 'pc',
        name: characterName,
        status: { alive: true, conditions: [] },
        position: { zoneId: locationId },
        stats: {
          stress: 0,
          maxStress: 6,
          aspects: [],
          resources: { fatePoints: 3 },
        },
        tags: [],
      }

      // SetMode initializes state.scene (emits SceneStarted); required before AddLocation
      await orchestrator.dispatch(gameId, { type: 'SetMode', mode: 'scene' })
      await orchestrator.dispatch(gameId, { type: 'AddEntity', entity })
      await orchestrator.dispatch(gameId, { type: 'AddLocation', location })
      await orchestrator.dispatch(gameId, { type: 'SetLocation', locationId })
      await refreshState(gameId, `${characterName} begins their story at ${locationName}`)
    },
    [session, refreshState],
  )

  const dispatch = useCallback(
    async (command: Command) => {
      if (!session) return
      setSession((prev) => (prev ? { ...prev, error: null } : prev))
      try {
        // Capture trigger from pre-dispatch state (entity names may change after dispatch)
        const triggerBefore = getTrigger(command, session.state)
        await orchestrator.dispatch(session.gameId, command)

        // Advance: only narrate when it produces EncounterEnded; skip routine phase transitions
        let trigger = triggerBefore
        if (command.type === 'Advance') {
          const events = await eventStore.list(session.gameId)
          const last = events.at(-1)
          if (last?.type === 'EncounterEnded') {
            const result = last.payload['result'] === 'win' ? 'victory' : 'defeat'
            trigger = `The encounter ended in ${result}`
          } else {
            trigger = null
          }
        }

        await refreshState(session.gameId, trigger)
      } catch (e) {
        setSession((prev) =>
          prev
            ? { ...prev, error: e instanceof Error ? e.message : String(e) }
            : prev,
        )
      }
    },
    [session, refreshState],
  )

  return {
    session,
    llmUrl,
    applyLlmUrl,
    createGame,
    confirmCreate,
    cancelCreate,
    confirmNewGame,
    setupCharacter,
    dispatch,
  }
}
