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

export function SceneView({ state, actions, onDispatch }: Props) {
  const scene = state.scene
  const currentLoc = scene?.locationId ? scene.locations[scene.locationId] : null
  const npcs = Object.values(state.entities).filter(
    (e) => e.kind === 'npc' && e.position?.zoneId === scene?.locationId,
  )
  const pc = Object.values(state.entities).find((e) => e.kind === 'pc')

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Main area */}
      <div className="md:col-span-2 space-y-4">
        {/* Location */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-zinc-500">Location</span>
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                scene
              </Badge>
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                chaos {state.runtime.chaos}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {currentLoc?.name ?? 'No location set'}
            </h2>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {currentLoc?.aspects?.length ? (
              <div className="flex flex-wrap gap-1">
                {currentLoc.aspects.map((a) => (
                  <Badge key={a.id} className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                    {a.name}
                  </Badge>
                ))}
              </div>
            ) : null}

            {npcs.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Present</p>
                <div className="flex flex-wrap gap-2">
                  {npcs.map((npc) => (
                    <Badge
                      key={npc.id}
                      className="text-xs bg-zinc-800 text-amber-300 border-zinc-700"
                    >
                      {npc.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {currentLoc?.connections?.length ? (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Connected to</p>
                <div className="flex flex-wrap gap-1">
                  {currentLoc.connections.map((id) => {
                    const loc = scene?.locations[id]
                    return (
                      <Badge key={id} variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                        {loc?.name ?? id}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

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

      {/* Sidebar — character sheet */}
      <div className="space-y-4">
        {pc && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Character</p>
              <h3 className="font-semibold text-zinc-100">{pc.name}</h3>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex gap-2 text-xs text-zinc-400">
                <span>Stress {pc.stats.stress ?? 0} / {pc.stats.maxStress ?? 0}</span>
              </div>
              {pc.stats.aspects?.length ? (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Aspects</p>
                  <div className="flex flex-col gap-1">
                    {pc.stats.aspects.map((a) => (
                      <Badge
                        key={a.id}
                        className="text-xs bg-zinc-800 text-blue-300 border-zinc-700 justify-start"
                      >
                        {a.name}
                        {a.freeInvokes > 0 && (
                          <span className="ml-1 text-green-400">×{a.freeInvokes}</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* All locations list */}
        {scene && Object.keys(scene.locations).length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Known locations</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col gap-1">
                {Object.values(scene.locations).map((loc) => (
                  <span
                    key={loc.id}
                    className={`text-xs ${loc.id === scene.locationId ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}
                  >
                    {loc.id === scene.locationId ? '▶ ' : '  '}
                    {loc.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
