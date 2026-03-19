'use client'

import type { GameState } from '@autarch/engine'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'
import { Card, CardContent, CardHeader } from '@autarch/ui/components/ui/card'
import { Badge } from '@autarch/ui/components/ui/badge'
import { ActionPanel } from './ActionPanel'

interface Props {
  state: GameState
  actions: ActionDescriptor[]
  onDispatch: (cmd: Command) => void
}

export function EncounterView({ state, actions, onDispatch }: Props) {
  const enc = state.encounter
  const { round, chaos, activeEntityId, activeSide, phase } = state.runtime
  const activeEntity = activeEntityId ? state.entities[activeEntityId] : null

  const initiative = enc?.initiative ?? []
  const zones = enc?.map?.zones ?? {}

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Main area */}
      <div className="md:col-span-2 space-y-4">
        {/* Status bar */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="px-4 py-3 flex flex-wrap gap-3 items-center">
            <Badge variant="outline" className="border-red-800 text-red-400 text-xs">
              encounter
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
              round {round}
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
              chaos {chaos}
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
              phase: {phase}
            </Badge>
            {activeEntity && (
              <Badge className="bg-amber-800 text-amber-100 text-xs">
                {activeEntity.name}'s turn ({activeSide})
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Zone map */}
        {Object.keys(zones).length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Zones</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-3">
                {Object.values(zones).map((zone) => {
                  const occupants = Object.values(state.entities).filter(
                    (e) => e.position?.zoneId === zone.id,
                  )
                  return (
                    <div
                      key={zone.id}
                      className="rounded border border-zinc-700 p-2 min-w-24 space-y-1"
                    >
                      <p className="text-xs font-semibold text-zinc-300">{zone.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {occupants.map((e) => (
                          <Badge
                            key={e.id}
                            className={`text-xs ${
                              e.id === activeEntityId
                                ? 'bg-amber-700 text-amber-100'
                                : e.kind === 'enemy'
                                  ? 'bg-red-900 text-red-200'
                                  : 'bg-blue-900 text-blue-200'
                            } border-0`}
                          >
                            {e.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {zone.adjacent.map((adj) => (
                          <span key={adj} className="text-zinc-600 text-[10px]">
                            → {zones[adj]?.name ?? adj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Actions</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ActionPanel actions={actions} onDispatch={onDispatch} />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar — initiative + entity list */}
      <div className="space-y-4">
        {/* Initiative order */}
        {initiative.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Initiative</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              {initiative.map((id, idx) => {
                const e = state.entities[id]
                const isActive = id === activeEntityId
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                      isActive ? 'bg-amber-900/50 text-amber-100' : 'text-zinc-400'
                    }`}
                  >
                    <span className="text-zinc-600 w-4">{idx + 1}.</span>
                    <span className={isActive ? 'font-semibold' : ''}>
                      {e?.name ?? id}
                    </span>
                    {e && !e.status.alive && (
                      <span className="text-red-500 text-[10px]">✗</span>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Entity stat summary */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Combatants</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {Object.values(state.entities)
              .filter((e) => e.kind !== 'npc')
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span
                    className={`${e.status.alive ? 'text-zinc-300' : 'text-zinc-600 line-through'} ${
                      e.id === activeEntityId ? 'font-semibold text-amber-200' : ''
                    }`}
                  >
                    {e.name}
                  </span>
                  <span className="text-zinc-500">
                    {e.kind === 'pc' || e.kind === 'enemy'
                      ? `${e.stats.stress ?? 0}/${e.stats.maxStress ?? 0}`
                      : ''}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
