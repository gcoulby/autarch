'use client'

import type { GameState } from '@autarch/engine'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'
import { ActionPanel } from './ActionPanel'

interface Props {
  state: GameState
  actions: ActionDescriptor[]
  onDispatch: (cmd: Command) => void
}

function AspectChip({ name, freeInvokes }: { name: string; freeInvokes: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
      style={{
        background: 'var(--game-amber-bg)',
        border: '1px solid var(--game-amber-ring)',
        color: 'var(--game-amber)',
      }}
    >
      {name}
      {freeInvokes > 0 && (
        <span
          className="rounded-full px-1 text-[10px] font-bold"
          style={{ background: 'var(--game-safe-bg)', color: 'var(--game-safe)' }}
        >
          ×{freeInvokes}
        </span>
      )}
    </span>
  )
}

export function SceneView({ state, actions, onDispatch }: Props) {
  const scene = state.scene
  const currentLoc = scene?.locationId ? scene.locations[scene.locationId] : null
  const npcs = Object.values(state.entities).filter(
    (e) => e.kind === 'npc' && e.position?.zoneId === scene?.locationId,
  )
  const pc = Object.values(state.entities).find((e) => e.kind === 'pc')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Left column: location + actions ── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Location card */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: 'var(--game-surface)',
            border: '1px solid var(--game-border)',
          }}
        >
          {/* Location header */}
          <div
            className="px-5 py-4"
            style={{
              background: 'var(--game-surface-2)',
              borderBottom: '1px solid var(--game-border)',
            }}
          >
            {currentLoc ? (
              <>
                <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'oklch(0.90 0.025 78)' }}>
                  {currentLoc.name}
                </h2>
                {currentLoc.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentLoc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--game-surface-3)', color: 'oklch(0.54 0.022 76)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm italic" style={{ color: 'oklch(0.45 0.018 68)' }}>
                No location set — use the oracle or system actions to establish a scene.
              </p>
            )}
          </div>

          {/* Location body */}
          <div className="px-5 py-4 space-y-4">
            {/* Aspects */}
            {currentLoc?.aspects?.length ? (
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'oklch(0.45 0.018 68)' }}>
                  Aspects
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentLoc.aspects.map((a) => (
                    <AspectChip key={a.id} name={a.name} freeInvokes={a.freeInvokes} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* NPCs */}
            {npcs.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'oklch(0.45 0.018 68)' }}>
                  Present
                </p>
                <div className="flex flex-wrap gap-2">
                  {npcs.map((npc) => (
                    <span
                      key={npc.id}
                      className="text-sm px-3 py-1 rounded-full"
                      style={{
                        background: 'oklch(0.18 0.030 75)',
                        border: '1px solid oklch(0.32 0.040 75)',
                        color: 'oklch(0.80 0.045 75)',
                      }}
                    >
                      {npc.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connections */}
            {currentLoc?.connections?.length ? (
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'oklch(0.45 0.018 68)' }}>
                  Connected to
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentLoc.connections.map((id) => {
                    const loc = scene?.locations[id]
                    return (
                      <span
                        key={id}
                        className="text-xs px-2.5 py-1 rounded"
                        style={{
                          background: 'var(--game-travel-bg)',
                          border: '1px solid var(--game-travel-ring)',
                          color: 'var(--game-travel)',
                        }}
                      >
                        → {loc?.name ?? id}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Actions card */}
        <div
          className="rounded-lg p-5"
          style={{
            background: 'var(--game-surface)',
            border: '1px solid var(--game-border)',
          }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: 'oklch(0.45 0.018 68)' }}>
            Actions
          </p>
          <ActionPanel actions={actions} onDispatch={onDispatch} />
        </div>
      </div>

      {/* ── Right sidebar: character sheet + locations ── */}
      <div className="space-y-4">

        {/* Character sheet */}
        {pc && (
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--game-surface)',
              border: '1px solid var(--game-border)',
            }}
          >
            <div
              className="px-4 py-3"
              style={{
                background: 'var(--game-surface-2)',
                borderBottom: '1px solid var(--game-border)',
              }}
            >
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'oklch(0.45 0.018 68)' }}>
                Character
              </p>
              <h3 className="font-semibold" style={{ color: 'oklch(0.88 0.025 78)' }}>
                {pc.name}
              </h3>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* Stress track */}
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'oklch(0.45 0.018 68)' }}>
                  Stress
                </p>
                <div className="flex gap-1.5">
                  {Array.from({ length: pc.stats.maxStress || 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-sm border flex items-center justify-center"
                      style={{
                        borderColor: i < (pc.stats.stress || 0) ? 'var(--game-danger)' : 'var(--game-border-warm)',
                        background: i < (pc.stats.stress || 0) ? 'var(--game-danger-bg)' : 'transparent',
                      }}
                    >
                      {i < (pc.stats.stress || 0) && (
                        <span className="text-[9px]" style={{ color: 'var(--game-danger)' }}>✕</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Aspects */}
              {pc.stats.aspects?.length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'oklch(0.45 0.018 68)' }}>
                    Aspects
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {pc.stats.aspects.map((a) => (
                      <AspectChip key={a.id} name={a.name} freeInvokes={a.freeInvokes} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Skills */}
              {pc.stats.skills?.length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'oklch(0.45 0.018 68)' }}>
                    Skills
                  </p>
                  <div className="space-y-1">
                    {pc.stats.skills.slice(0, 6).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span style={{ color: 'oklch(0.70 0.022 76)' }}>{s.name}</span>
                        <span className="font-mono tabular-nums" style={{ color: 'var(--game-amber)' }}>
                          +{s.rating}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Known locations */}
        {scene && Object.keys(scene.locations).length > 0 && (
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--game-surface)',
              border: '1px solid var(--game-border)',
            }}
          >
            <div
              className="px-4 py-3"
              style={{ background: 'var(--game-surface-2)', borderBottom: '1px solid var(--game-border)' }}
            >
              <p className="text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.45 0.018 68)' }}>
                Known Locations
              </p>
            </div>
            <div className="px-4 py-3 space-y-1">
              {Object.values(scene.locations).map((loc) => {
                const isHere = loc.id === scene.locationId
                return (
                  <div
                    key={loc.id}
                    className="flex items-center gap-2 text-sm py-0.5"
                    style={{ color: isHere ? 'oklch(0.88 0.025 78)' : 'oklch(0.48 0.018 68)' }}
                  >
                    <span style={{ color: isHere ? 'var(--game-amber)' : 'transparent' }}>▶</span>
                    <span className={isHere ? 'font-medium' : ''}>{loc.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
