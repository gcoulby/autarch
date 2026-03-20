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

function EntityBadge({ name, isActive, isEnemy }: { name: string; isActive: boolean; isEnemy: boolean }) {
  const bg = isActive
    ? 'var(--game-amber-bg)'
    : isEnemy
      ? 'var(--game-danger-bg)'
      : 'oklch(0.14 0.020 230)'
  const border = isActive
    ? 'var(--game-amber-ring)'
    : isEnemy
      ? 'var(--game-danger-ring)'
      : 'oklch(0.25 0.030 230)'
  const color = isActive
    ? 'var(--game-amber)'
    : isEnemy
      ? 'var(--game-danger)'
      : 'oklch(0.65 0.060 230)'

  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {isActive && <span style={{ fontSize: 8 }}>▶</span>}
      {name}
    </span>
  )
}

export function EncounterView({ state, actions, onDispatch }: Props) {
  const enc = state.encounter
  const { round, phase, activeEntityId, activeSide } = state.runtime
  const activeEntity = activeEntityId ? state.entities[activeEntityId] : null
  const zones = enc?.map?.zones ?? {}
  const initiative = enc?.initiative ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Left column: map + actions ── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Active-entity banner */}
        {activeEntity && (
          <div
            className="rounded-lg px-4 py-3 flex items-center justify-between"
            style={{
              background: 'var(--game-amber-bg)',
              border: '1px solid var(--game-amber-ring)',
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--game-amber)', fontSize: 18 }}>▶</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--game-amber)' }}>
                  {activeEntity.name}
                </p>
                <p className="text-xs" style={{ color: 'oklch(0.55 0.022 76)' }}>
                  {activeSide} · round {round} · {phase}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Zone map */}
        {Object.keys(zones).length > 0 && (
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
                Battlefield
              </p>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {Object.values(zones).map((zone) => {
                const occupants = Object.values(state.entities).filter(
                  (e) => e.position?.zoneId === zone.id,
                )
                const hasActive = occupants.some((e) => e.id === activeEntityId)

                return (
                  <div
                    key={zone.id}
                    className="rounded-lg p-3 min-w-28 space-y-2 transition-colors"
                    style={{
                      background: hasActive ? 'var(--game-surface-3)' : 'var(--game-surface-2)',
                      border: `1px solid ${hasActive ? 'var(--game-amber-ring)' : 'var(--game-border)'}`,
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: 'oklch(0.78 0.022 76)' }}>
                      {zone.name}
                    </p>

                    {/* Occupants */}
                    {occupants.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {occupants.map((e) => (
                          <EntityBadge
                            key={e.id}
                            name={e.name}
                            isActive={e.id === activeEntityId}
                            isEnemy={e.kind === 'enemy'}
                          />
                        ))}
                      </div>
                    )}

                    {/* Adjacent zones */}
                    {zone.adjacent.length > 0 && (
                      <p className="text-[10px]" style={{ color: 'oklch(0.38 0.014 68)' }}>
                        → {zone.adjacent.map((id) => zones[id]?.name ?? id).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
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

      {/* ── Sidebar: initiative + combatants ── */}
      <div className="space-y-4">

        {/* Initiative tracker */}
        {initiative.length > 0 && (
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
                Initiative
              </p>
            </div>
            <div className="py-2">
              {initiative.map((id, idx) => {
                const e = state.entities[id]
                const isActive = id === activeEntityId
                const isEnemy = e?.kind === 'enemy'

                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                    style={{
                      background: isActive ? 'var(--game-amber-bg)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--game-amber)' : '2px solid transparent',
                    }}
                  >
                    <span
                      className="text-xs tabular-nums w-5 text-right"
                      style={{ color: 'oklch(0.38 0.014 68)' }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        color: isActive
                          ? 'var(--game-amber)'
                          : isEnemy
                            ? 'var(--game-danger)'
                            : 'oklch(0.72 0.022 76)',
                        fontWeight: isActive ? 600 : 400,
                        textDecoration: e && !e.status.alive ? 'line-through' : undefined,
                        opacity: e && !e.status.alive ? 0.4 : 1,
                      }}
                    >
                      {e?.name ?? id}
                    </span>
                    {e && !e.status.alive && (
                      <span className="ml-auto text-xs" style={{ color: 'var(--game-danger)', opacity: 0.6 }}>
                        ✕
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Combatant stat summary */}
        {Object.keys(state.entities).length > 0 && (
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
                Combatants
              </p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {Object.values(state.entities).map((e) => {
                const isActive = e.id === activeEntityId
                const isEnemy = e.kind === 'enemy'

                return (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span
                      style={{
                        color: isActive
                          ? 'var(--game-amber)'
                          : isEnemy
                            ? 'var(--game-danger)'
                            : 'oklch(0.68 0.022 76)',
                        fontWeight: isActive ? 600 : 400,
                        textDecoration: !e.status.alive ? 'line-through' : undefined,
                        opacity: !e.status.alive ? 0.4 : 1,
                      }}
                    >
                      {e.name}
                    </span>
                    {(e.stats.maxStress ?? 0) > 0 && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: e.stats.maxStress }).map((_, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-sm border"
                            style={{
                              borderColor: i < (e.stats.stress || 0) ? 'var(--game-danger)' : 'var(--game-border-warm)',
                              background: i < (e.stats.stress || 0) ? 'var(--game-danger-bg)' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    )}
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
