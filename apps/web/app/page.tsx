'use client'

import { useGame } from './hooks/useGame'
import { SceneView } from './components/SceneView'
import { EncounterView } from './components/EncounterView'
import { NarrativePanel } from './components/NarrativePanel'
import { LlmSettings } from './components/LlmSettings'
import { ChaosMeter } from './components/ChaosMeter'

const MODE_LABEL: Record<string, string> = {
  scene:     'SCENE',
  encounter: 'ENCOUNTER',
  downtime:  'DOWNTIME',
}

const MODE_COLOR: Record<string, string> = {
  scene:     'var(--game-travel)',
  encounter: 'var(--game-danger)',
  downtime:  'var(--game-safe)',
}

export default function Home() {
  const { session, llmUrl, applyLlmUrl, createGame, dispatch } = useGame()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          background: 'var(--game-surface)',
          borderBottom: '1px solid var(--game-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-bold tracking-[0.15em]"
            style={{ color: 'var(--game-amber)' }}
          >
            AUTARCH
          </span>
          {session && (
            <>
              <span style={{ color: 'var(--game-border-warm)' }}>·</span>
              {/* Mode badge */}
              <span
                className="text-[10px] font-semibold tracking-[0.12em] px-2 py-0.5 rounded"
                style={{
                  background: 'var(--game-surface-2)',
                  border: `1px solid ${MODE_COLOR[session.state.runtime.mode] ?? 'var(--game-border)'}`,
                  color: MODE_COLOR[session.state.runtime.mode] ?? 'var(--game-amber)',
                }}
              >
                {MODE_LABEL[session.state.runtime.mode] ?? session.state.runtime.mode.toUpperCase()}
              </span>
              <ChaosMeter chaos={session.state.runtime.chaos} />
            </>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-5">
          <LlmSettings llmUrl={llmUrl} onApply={applyLlmUrl} />
          <button
            className="action-btn action-btn-player text-xs"
            onClick={createGame}
          >
            ⊕ New Game
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <main className="flex-1 p-5 space-y-5 max-w-7xl mx-auto w-full">

        {!session ? (
          /* ── Empty state ── */
          <div
            className="flex flex-col items-center justify-center rounded-xl py-32 space-y-6"
            style={{
              background: 'var(--game-surface)',
              border: '1px solid var(--game-border)',
            }}
          >
            <p
              className="text-5xl font-bold tracking-[0.2em]"
              style={{ color: 'var(--game-amber)', opacity: 0.15 }}
            >
              AUTARCH
            </p>
            <p className="text-sm" style={{ color: 'oklch(0.48 0.018 68)' }}>
              Solo RPG engine — no game active
            </p>
            <button className="action-btn action-btn-player text-sm px-8 py-3" onClick={createGame}>
              ⊕ Begin a new game
            </button>
          </div>
        ) : (
          <>
            {/* ── Error banner ── */}
            {session.error && (
              <div
                className="rounded-lg px-4 py-3 text-sm flex items-center gap-3"
                style={{
                  background: 'var(--game-danger-bg)',
                  border: '1px solid var(--game-danger-ring)',
                  color: 'var(--game-danger)',
                }}
              >
                <span style={{ opacity: 0.7 }}>⚠</span>
                {session.error}
              </div>
            )}

            {/* ── Narrative — always the centrepiece ── */}
            <NarrativePanel
              narrative={session.narrative}
              prompt={session.prompt}
              narrating={session.narrating}
            />

            {/* ── Mode-specific game view ── */}
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
          </>
        )}
      </main>
    </div>
  )
}
