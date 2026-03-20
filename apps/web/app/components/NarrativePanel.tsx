'use client'

import { useState } from 'react'

interface Props {
  narrative: string
  prompt: string
  narrating: boolean
}

export function NarrativePanel({ narrative, prompt, narrating }: Props) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--game-surface)',
        borderLeft: '3px solid var(--game-amber)',
        borderTop: '1px solid var(--game-border)',
        borderRight: '1px solid var(--game-border)',
        borderBottom: '1px solid var(--game-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-2.5"
        style={{ borderBottom: '1px solid var(--game-border)', background: 'var(--game-surface-2)' }}
      >
        <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--game-amber)', opacity: 0.8 }}>
          Narrative
        </span>
        {prompt && (
          <button
            className="text-[11px] transition-colors"
            style={{ color: 'oklch(0.45 0.018 68)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'oklch(0.60 0.022 76)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'oklch(0.45 0.018 68)')}
            onClick={() => setShowPrompt((v) => !v)}
          >
            {showPrompt ? 'hide prompt ↑' : 'show prompt ↓'}
          </button>
        )}
      </div>

      {/* Narrative body */}
      <div className="px-6 py-5 min-h-24">
        {narrating ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--game-amber)' }}
            />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--game-amber)', animationDelay: '0.2s' }}
            />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--game-amber)', animationDelay: '0.4s' }}
            />
          </div>
        ) : (
          <p className="narrative-text whitespace-pre-wrap">
            {narrative || (
              <span style={{ color: 'oklch(0.40 0.018 68)', fontStyle: 'italic' }}>
                No narrative yet. Dispatch an action to begin.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Prompt inspector */}
      {showPrompt && prompt && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: '1px solid var(--game-border)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-2 mt-3" style={{ color: 'oklch(0.40 0.018 68)' }}>
            LLM Prompt
          </p>
          <pre
            className="text-[10px] font-mono leading-relaxed overflow-y-auto max-h-40 whitespace-pre-wrap"
            style={{ color: 'oklch(0.48 0.018 68)' }}
          >
            {prompt}
          </pre>
        </div>
      )}
    </div>
  )
}
