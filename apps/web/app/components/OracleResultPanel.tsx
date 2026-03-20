'use client'

import type { OracleResult } from '../hooks/useGame'

const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  'exceptional-yes': { label: 'EXCEPTIONAL YES!', color: 'var(--game-safe)' },
  'yes-and':         { label: 'YES, AND...',       color: 'var(--game-safe)' },
  'yes':             { label: 'YES',               color: 'var(--game-safe)' },
  'no-but':          { label: 'NO, BUT...',        color: 'var(--game-amber)' },
  'no':              { label: 'NO',                color: 'var(--game-danger)' },
  'exceptional-no':  { label: 'EXCEPTIONAL NO',    color: 'var(--game-danger)' },
}

interface Props {
  oracle: OracleResult
}

export function OracleResultPanel({ oracle }: Props) {
  const cfg = RESULT_CONFIG[oracle.result] ?? { label: oracle.result.toUpperCase(), color: 'var(--game-amber)' }

  return (
    <div
      className="rounded-lg px-5 py-4 space-y-3"
      style={{
        background: 'var(--game-surface)',
        border: `1px solid ${cfg.color}`,
        boxShadow: `0 0 24px color-mix(in oklch, ${cfg.color} 12%, transparent)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--game-oracle)', opacity: 0.8 }}>
          ◆ Oracle
        </span>
        <span
          className="text-xs font-bold tracking-widest"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Question */}
      <p className="text-sm italic" style={{ color: 'oklch(0.70 0.022 76)' }}>
        "{oracle.question}"
      </p>

      {/* Roll details */}
      <div className="flex items-center gap-4 text-[11px]" style={{ color: 'oklch(0.42 0.015 68)' }}>
        <span>Dice: {oracle.die1} + {oracle.die2}</span>
        <span>Chaos: {oracle.chaosAtRoll}</span>
        <span>Adjusted: {oracle.adjusted}</span>
        {oracle.randomEventTriggered && (
          <span style={{ color: 'var(--game-oracle)' }}>⚡ Random event!</span>
        )}
      </div>
    </div>
  )
}
