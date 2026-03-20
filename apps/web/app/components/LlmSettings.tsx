'use client'

import { useState } from 'react'

interface Props {
  llmUrl: string
  onApply: (url: string) => void
}

export function LlmSettings({ llmUrl, onApply }: Props) {
  const [draft, setDraft] = useState(llmUrl)
  const [open, setOpen] = useState(false)

  const isConnected = !!llmUrl

  return (
    <div className="relative flex items-center gap-2">
      {/* Status indicator + toggle */}
      <button
        className="flex items-center gap-2 text-xs transition-colors"
        style={{ color: 'oklch(0.50 0.018 68)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'oklch(0.70 0.022 76)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'oklch(0.50 0.018 68)')}
        onClick={() => setOpen((v) => !v)}
        title={isConnected ? `LLM: ${llmUrl}` : 'No LLM connected — using stub'}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: isConnected ? 'var(--game-safe)' : 'oklch(0.40 0.018 68)',
            boxShadow: isConnected ? '0 0 5px var(--game-safe)' : 'none',
          }}
        />
        <span>{isConnected ? 'LLM connected' : 'Stub mode'}</span>
        <span style={{ opacity: 0.5 }}>{open ? '↑' : '↓'}</span>
      </button>

      {/* Dropdown form */}
      {open && (
        <div
          className="absolute top-8 right-0 z-20 rounded-lg p-4 space-y-3 w-80 shadow-2xl"
          style={{
            background: 'var(--game-surface)',
            border: '1px solid var(--game-border-warm)',
          }}
        >
          <p className="text-xs font-semibold" style={{ color: 'oklch(0.72 0.022 76)' }}>
            LLM Server
          </p>
          <p className="text-[11px]" style={{ color: 'oklch(0.48 0.018 68)' }}>
            OpenAI-compatible endpoint. Leave blank to use the offline stub.
            In Docker: <code className="font-mono">http://ollama:11434/v1</code>
          </p>
          <input
            className="w-full rounded px-3 py-1.5 text-xs font-mono outline-none focus:ring-1"
            style={{
              background: 'var(--game-surface-2)',
              border: '1px solid var(--game-border-warm)',
              color: 'oklch(0.78 0.022 76)',
            }}
            placeholder="http://localhost:11434/v1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onApply(draft); setOpen(false) }
              if (e.key === 'Escape') setOpen(false)
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="action-btn action-btn-player flex-1 justify-center"
              onClick={() => { onApply(draft); setOpen(false) }}
            >
              Apply
            </button>
            <button
              className="action-btn action-btn-system"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
