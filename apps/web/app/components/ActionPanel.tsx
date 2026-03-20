'use client'

import { useState } from 'react'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'

const LIKELIHOOD_OPTIONS = [
  { value: 'certain',          label: 'Certain' },
  { value: 'nearly-certain',   label: 'Nearly Certain' },
  { value: 'likely',           label: 'Likely' },
  { value: 'fifty-fifty',      label: 'Fifty-Fifty' },
  { value: 'unlikely',         label: 'Unlikely' },
  { value: 'nearly-impossible',label: 'Nearly Impossible' },
  { value: 'impossible',       label: 'Impossible' },
] as const

function getButtonClass(actionId: string): string {
  if (actionId === 'travel') return 'action-btn action-btn-travel'
  if (actionId === 'rest')   return 'action-btn action-btn-safe'
  return 'action-btn action-btn-player'
}

function getButtonPrefix(actionId: string): string {
  if (actionId === 'travel')   return '→'
  if (actionId === 'rest')     return '⊕'
  if (actionId === 'search')   return '◎'
  if (actionId === 'interact') return '◈'
  if (actionId === 'attack')   return '✦'
  if (actionId === 'move')     return '↗'
  if (actionId === 'end-turn') return '⏎'
  if (actionId === 'advance')  return '▶'
  return '·'
}

interface InlineFormProps {
  onCancel: () => void
  children: React.ReactNode
  title: string
  accentVar: string
}

function InlineForm({ onCancel, children, title, accentVar }: InlineFormProps) {
  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{
        background: 'var(--game-surface)',
        border: `1px solid ${accentVar}`,
        boxShadow: `0 0 20px color-mix(in oklch, ${accentVar} 15%, transparent)`,
      }}
    >
      <p className="text-xs font-semibold tracking-wide" style={{ color: accentVar }}>
        {title}
      </p>
      {children}
      <button className="action-btn action-btn-system text-xs mt-1" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

interface Props {
  actions: ActionDescriptor[]
  onDispatch: (cmd: Command) => void
}

export function ActionPanel({ actions, onDispatch }: Props) {
  const [oracleOpen, setOracleOpen] = useState(false)
  const [oracleQuestion, setOracleQuestion] = useState('')
  const [oracleLikelihood, setOracleLikelihood] = useState('fifty-fifty')

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAspect, setSearchAspect] = useState('')

  const [endSceneOpen, setEndSceneOpen] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--game-surface-2)',
    border: '1px solid var(--game-border-warm)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '0.8125rem',
    color: 'oklch(0.80 0.022 76)',
    outline: 'none',
  }

  const playerActions = actions.filter((a) => a.kind === 'player')
  const systemActions = actions.filter((a) => a.kind !== 'player')

  function handleAction(action: ActionDescriptor) {
    switch (action.id) {
      case 'ask-oracle': setOracleOpen(true); return
      case 'search':     setSearchOpen(true);  return
      case 'end-scene':  setEndSceneOpen(true); return
      default:
        onDispatch(action.command as Command)
    }
  }

  const openForm = oracleOpen || searchOpen || endSceneOpen

  return (
    <div className="space-y-4">
      {/* Player actions row */}
      {playerActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {playerActions.map((a, i) => (
            <button
              key={`${a.id}-${i}`}
              className={getButtonClass(a.id)}
              onClick={() => handleAction(a)}
            >
              <span style={{ opacity: 0.7 }}>{getButtonPrefix(a.id)}</span>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Always-available meta actions */}
      {!openForm && (
        <div className="flex flex-wrap gap-2 pt-1" style={{ borderTop: '1px solid var(--game-border)' }}>
          <button
            className="action-btn action-btn-oracle"
            onClick={() => setOracleOpen(true)}
          >
            <span style={{ opacity: 0.7 }}>◆</span> Ask Oracle
          </button>
          <button
            className="action-btn action-btn-danger"
            onClick={() => setEndSceneOpen(true)}
          >
            <span style={{ opacity: 0.7 }}>◀</span> End Scene
          </button>
        </div>
      )}

      {/* Oracle form */}
      {oracleOpen && (
        <InlineForm
          title="◆ Oracle — ask the fates"
          accentVar="var(--game-oracle)"
          onCancel={() => setOracleOpen(false)}
        >
          <input
            style={inputStyle}
            placeholder="What do you ask the oracle?"
            value={oracleQuestion}
            onChange={(e) => setOracleQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && oracleQuestion.trim()) {
                onDispatch({ type: 'AskOracle', question: oracleQuestion.trim(), likelihood: oracleLikelihood as any })
                setOracleOpen(false)
                setOracleQuestion('')
                setOracleLikelihood('fifty-fifty')
              }
            }}
            autoFocus
          />
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={oracleLikelihood}
            onChange={(e) => setOracleLikelihood(e.target.value)}
          >
            {LIKELIHOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            className="action-btn action-btn-oracle"
            onClick={() => {
              if (!oracleQuestion.trim()) return
              onDispatch({ type: 'AskOracle', question: oracleQuestion.trim(), likelihood: oracleLikelihood as any })
              setOracleOpen(false)
              setOracleQuestion('')
              setOracleLikelihood('fifty-fifty')
            }}
          >
            Ask the fates
          </button>
        </InlineForm>
      )}

      {/* Search form */}
      {searchOpen && (
        <InlineForm
          title="◎ Search — what are you looking for?"
          accentVar="var(--game-amber)"
          onCancel={() => setSearchOpen(false)}
        >
          <input
            style={inputStyle}
            placeholder="Aspect name (e.g. Hidden passage)"
            value={searchAspect}
            onChange={(e) => setSearchAspect(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchAspect.trim()) {
                onDispatch({ type: 'Search', aspectName: searchAspect.trim() })
                setSearchOpen(false)
                setSearchAspect('')
              }
            }}
            autoFocus
          />
          <button
            className="action-btn action-btn-player"
            onClick={() => {
              if (!searchAspect.trim()) return
              onDispatch({ type: 'Search', aspectName: searchAspect.trim() })
              setSearchOpen(false)
              setSearchAspect('')
            }}
          >
            Search
          </button>
        </InlineForm>
      )}

      {/* End-scene form */}
      {endSceneOpen && (
        <InlineForm
          title="◀ End Scene — how did it resolve?"
          accentVar="var(--game-danger)"
          onCancel={() => setEndSceneOpen(false)}
        >
          <div className="flex gap-3">
            <button
              className="action-btn action-btn-safe"
              onClick={() => { onDispatch({ type: 'EndScene', result: 'success' }); setEndSceneOpen(false) }}
            >
              ✓ Success
            </button>
            <button
              className="action-btn action-btn-danger"
              onClick={() => { onDispatch({ type: 'EndScene', result: 'failure' }); setEndSceneOpen(false) }}
            >
              ✗ Failure
            </button>
          </div>
        </InlineForm>
      )}

      {/* System actions — de-emphasized */}
      {systemActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {systemActions.map((a, i) => (
            <button
              key={`${a.id}-${i}`}
              className="action-btn action-btn-system"
              onClick={() => handleAction(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
