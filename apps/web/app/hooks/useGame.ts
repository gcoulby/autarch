'use client'

import { useCallback, useRef, useState } from 'react'
import type { GameState } from '@autarch/engine'
import { getValidActions } from '@autarch/engine'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'
import { orchestrator, makeNarrativeService } from '../lib/game'

export interface GameSession {
  gameId: string
  state: GameState
  actions: ActionDescriptor[]
  narrative: string
  prompt: string
  narrating: boolean
  error: string | null
}

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null)
  const [llmUrl, setLlmUrl] = useState<string>('')
  const narrativeSvcRef = useRef(makeNarrativeService(undefined))

  // Re-create narrative service when URL changes
  const applyLlmUrl = useCallback((url: string) => {
    setLlmUrl(url)
    narrativeSvcRef.current = makeNarrativeService(url.trim() || undefined)
  }, [])

  const refreshState = useCallback(
    async (gameId: string, doNarrate = true): Promise<void> => {
      const state = await orchestrator.loadState(gameId)
      if (!state) return

      const actions = getValidActions(state)

      setSession((prev) => ({
        gameId,
        state,
        actions,
        narrative: prev?.narrative ?? '',
        prompt: prev?.prompt ?? '',
        narrating: doNarrate,
        error: null,
      }))

      if (doNarrate) {
        try {
          const { narrative, prompt } = await narrativeSvcRef.current.narrate(gameId)
          setSession((prev) =>
            prev ? { ...prev, narrative, prompt, narrating: false } : prev,
          )
        } catch (e) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  narrative: '',
                  prompt: '',
                  narrating: false,
                  error: e instanceof Error ? e.message : String(e),
                }
              : prev,
          )
        }
      }
    },
    [],
  )

  const createGame = useCallback(async () => {
    const gameId = crypto.randomUUID()
    await orchestrator.dispatch(gameId, {
      type: 'CreateGame',
      schemaVersion: 1,
      seed: String(Date.now()),
    })
    await refreshState(gameId)
  }, [refreshState])

  const dispatch = useCallback(
    async (command: Command) => {
      if (!session) return
      setSession((prev) => (prev ? { ...prev, error: null } : prev))
      try {
        await orchestrator.dispatch(session.gameId, command)
        await refreshState(session.gameId)
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

  return { session, llmUrl, applyLlmUrl, createGame, dispatch }
}
