'use client'

import { useEffect, useRef, useState } from 'react'
import type { NarrativeEntry } from '../hooks/useGame'

interface Props {
  entries: NarrativeEntry[]
  prompt: string
  narrating: boolean
}

export function NarrativePanel({ entries, prompt, narrating }: Props) {
  const [showPrompt, setShowPrompt] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, narrating])

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

      {/* Scrollable entry list */}
      <div
        ref={scrollRef}
        className="px-6 py-4 space-y-5 overflow-y-auto"
        style={{ maxHeight: '28rem', minHeight: '7rem' }}
      >
        {entries.length === 0 && !narrating ? (
          <p style={{ color: 'oklch(0.40 0.018 68)', fontStyle: 'italic', fontSize: '0.875rem' }}>
            No narrative yet. Dispatch an action to begin.
          </p>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className="space-y-1">
              <p className="narrative-text whitespace-pre-wrap">{entry.text}</p>
              <p
                className="text-[10px] tracking-wide"
                style={{ color: 'oklch(0.35 0.015 68)' }}
              >
                {entry.eventType} · {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))
        )}

        {/* Typing indicator at the bottom when narrating */}
        {narrating && (
          <div className="flex items-center gap-2 pt-1">
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
        )}
      </div>

      {/* Prompt inspector */}
      {showPrompt && prompt && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: '1px solid var(--game-border)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-2 mt-3" style={{ color: 'oklch(0.40 0.018 68)' }}>
            LLM Prompt (last)
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
