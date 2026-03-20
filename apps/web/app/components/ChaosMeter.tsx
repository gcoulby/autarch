'use client'

interface Props {
  chaos: number
  max?: number
}

export function ChaosMeter({ chaos, max = 9 }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--game-amber)', opacity: 0.7 }}>
        chaos
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={i < chaos ? 'chaos-pip' : 'chaos-pip-empty'} />
        ))}
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--game-amber)', opacity: 0.6 }}>
        {chaos}
      </span>
    </div>
  )
}
