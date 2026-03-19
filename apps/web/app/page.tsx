'use client'

import { useGame } from './hooks/useGame'
import { SceneView } from './components/SceneView'
import { EncounterView } from './components/EncounterView'
import { NarrativePanel } from './components/NarrativePanel'
import { LlmSettings } from './components/LlmSettings'
import { Button } from '@autarch/ui/components/ui/button'

export default function Home() {
  const { session, llmUrl, applyLlmUrl, createGame, dispatch } = useGame()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between gap-4">
        <span className="font-bold tracking-wide text-zinc-200 text-sm">AUTARCH</span>
        <LlmSettings llmUrl={llmUrl} onApply={applyLlmUrl} />
        <Button
          size="sm"
          className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs h-7"
          onClick={createGame}
        >
          New game
        </Button>
      </header>

      {/* Body */}
      <main className="flex-1 p-4 space-y-4 max-w-6xl mx-auto w-full">
        {!session ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4 text-zinc-500">
            <p className="text-lg">No active game</p>
            <Button
              className="bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={createGame}
            >
              Start a new game
            </Button>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {session.error && (
              <div className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-xs text-red-300">
                {session.error}
              </div>
            )}

            {/* Game view — scene or encounter */}
            {session.state.runtime.mode === 'encounter' ? (
              <EncounterView
                state={session.state}
                actions={session.actions}
                onDispatch={dispatch}
              />
            ) : (
              <SceneView
                state={session.state}
                actions={session.actions}
                onDispatch={dispatch}
              />
            )}

            {/* Narrative panel */}
            <NarrativePanel
              narrative={session.narrative}
              prompt={session.prompt}
              narrating={session.narrating}
            />
          </>
        )}
      </main>
    </div>
  )
}
