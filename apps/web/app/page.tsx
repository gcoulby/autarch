'use client'

import { useGame } from './hooks/useGame'
import { SceneView } from './components/SceneView'
import { EncounterView } from './components/EncounterView'
import { NarrativePanel } from './components/NarrativePanel'
import { LlmSettings } from './components/LlmSettings'
import { ChaosMeter } from './components/ChaosMeter'
import { SetupWizard } from './components/SetupWizard'
import { OracleResultPanel } from './components/OracleResultPanel'

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
  const {
    session,
    llmUrl,
    applyLlmUrl,
    createGame,
    confirmCreate,
    cancelCreate,
    confirmNewGame,
    setupCharacter,
    dispatch,
  } = useGame()

  // Show setup wizard when a game exists but has no PC entity yet
  const needsSetup =
    session !== null &&
    !Object.values(session.state.entities).find((e) => e.kind === 'pc')

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

      {/* ── New game confirmation overlay ──────────────────── */}
      {confirmNewGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'oklch(0.06 0.012 30 / 0.85)' }}
        >
          <div
            className="rounded-xl px-8 py-8 space-y-5 max-w-sm w-full mx-4"
            style={{
              background: 'var(--game-surface)',
              border: '1px solid var(--game-danger-ring)',
              boxShadow: '0 0 60px color-mix(in oklch, var(--game-danger) 15%, transparent)',
            }}
          >
            <p className="font-semibold text-sm" style={{ color: 'oklch(0.78 0.022 76)' }}>
              Abandon current game?
            </p>
            <p className="text-sm" style={{ color: 'oklch(0.48 0.018 68)' }}>
              All progress in this session will be lost. In-memory stores are not persisted.
            </p>
            <div className="flex gap-3 pt-1">
              <button className="action-btn action-btn-danger flex-1 justify-center" onClick={confirmCreate}>
                Start new game
              </button>
              <button className="action-btn action-btn-system flex-1 justify-center" onClick={cancelCreate}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

        ) : needsSetup ? (
          /* ── Setup wizard ── */
          <div className="flex flex-col items-center justify-center py-12">
            <SetupWizard onSetup={setupCharacter} />
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

            {/* ── Oracle result — shown as distinct UI element, separate from prose ── */}
            {session.lastOracle && (
              <OracleResultPanel oracle={session.lastOracle} />
            )}

            {/* ── Narrative — scrollable history, always the centrepiece ── */}
            <NarrativePanel
              entries={session.entries}
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
