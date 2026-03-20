'use client'

import { useState } from 'react'

interface Props {
  onSetup: (characterName: string, locationName: string) => void
}

export function SetupWizard({ onSetup }: Props) {
  const [characterName, setCharacterName] = useState('')
  const [locationName, setLocationName] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--game-surface)',
    border: '1px solid var(--game-border-warm)',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '0.9375rem',
    color: 'oklch(0.80 0.022 76)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'oklch(0.48 0.018 68)',
    marginBottom: '8px',
  }

  const canSubmit = characterName.trim().length > 0 && locationName.trim().length > 0

  function handleSubmit() {
    if (!canSubmit) return
    onSetup(characterName.trim(), locationName.trim())
  }

  return (
    <div
      className="rounded-xl px-8 py-10 space-y-8 max-w-lg mx-auto"
      style={{
        background: 'var(--game-surface)',
        border: '1px solid var(--game-border-warm)',
        boxShadow: '0 0 60px color-mix(in oklch, var(--game-amber) 6%, transparent)',
      }}
    >
      <div className="space-y-1">
        <p
          className="text-base font-semibold tracking-wide"
          style={{ color: 'var(--game-amber)' }}
        >
          Begin your story
        </p>
        <p className="text-sm" style={{ color: 'oklch(0.48 0.018 68)' }}>
          Name your character and their starting location to enter the world.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label style={labelStyle}>Character name</label>
          <input
            style={inputStyle}
            placeholder="e.g. Kira, The Wanderer"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Starting location</label>
          <input
            style={inputStyle}
            placeholder="e.g. The Docks, Ironhold Tavern"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
      </div>

      <button
        className="action-btn action-btn-player w-full justify-center py-3 text-sm"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
      >
        ⊕ Enter the world
      </button>
    </div>
  )
}
