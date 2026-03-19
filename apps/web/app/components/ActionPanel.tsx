'use client'

import { useState } from 'react'
import type { ActionDescriptor } from '@autarch/engine'
import type { Command } from '@autarch/runtime'
import { Button } from '@autarch/ui/components/ui/button'
import { Input } from '@autarch/ui/components/ui/input'
import { Badge } from '@autarch/ui/components/ui/badge'

const KIND_COLOURS: Record<string, string> = {
  player: 'bg-blue-700 hover:bg-blue-600',
  system: 'bg-zinc-600 hover:bg-zinc-500',
  ai: 'bg-red-800 hover:bg-red-700',
}

const LIKELIHOOD_OPTIONS = [
  'certain',
  'nearly-certain',
  'likely',
  'fifty-fifty',
  'unlikely',
  'nearly-impossible',
  'impossible',
] as const

interface Props {
  actions: ActionDescriptor[]
  onDispatch: (cmd: Command) => void
}

export function ActionPanel({ actions, onDispatch }: Props) {
  // Extra inputs for ask-oracle
  const [oracleOpen, setOracleOpen] = useState(false)
  const [oracleQuestion, setOracleQuestion] = useState('')
  const [oracleLikelihood, setOracleLikelihood] = useState<string>('fifty-fifty')

  // Extra input for search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAspect, setSearchAspect] = useState('')

  // Extra input for end-scene
  const [endSceneOpen, setEndSceneOpen] = useState(false)

  if (actions.length === 0) {
    return <p className="text-xs text-zinc-500 italic">No actions available</p>
  }

  const playerActions = actions.filter((a) => a.kind === 'player')
  const systemActions = actions.filter((a) => a.kind !== 'player')

  function handleAction(action: ActionDescriptor) {
    switch (action.id) {
      case 'ask-oracle':
        setOracleOpen(true)
        return
      case 'search':
        setSearchOpen(true)
        return
      case 'end-scene':
        setEndSceneOpen(true)
        return
      default:
        onDispatch(action.command as Command)
    }
  }

  return (
    <div className="space-y-3">
      {playerActions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Player actions</p>
          <div className="flex flex-wrap gap-2">
            {playerActions.map((a, i) => (
              <Button
                key={`${a.id}-${i}`}
                size="sm"
                className={`${KIND_COLOURS[a.kind] ?? KIND_COLOURS.system} text-white text-xs`}
                onClick={() => handleAction(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Ask oracle form */}
      {oracleOpen && (
        <div className="rounded border border-zinc-700 p-3 space-y-2 bg-zinc-900">
          <p className="text-xs font-semibold text-zinc-300">Ask the Oracle</p>
          <Input
            placeholder="Question…"
            value={oracleQuestion}
            onChange={(e) => setOracleQuestion(e.target.value)}
            className="h-7 text-xs bg-zinc-800 border-zinc-700"
          />
          <select
            value={oracleLikelihood}
            onChange={(e) => setOracleLikelihood(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-200 px-2 py-1"
          >
            {LIKELIHOOD_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs"
              onClick={() => {
                if (!oracleQuestion.trim()) return
                onDispatch({
                  type: 'AskOracle',
                  question: oracleQuestion.trim(),
                  likelihood: oracleLikelihood as any,
                })
                setOracleOpen(false)
                setOracleQuestion('')
                setOracleLikelihood('fifty-fifty')
              }}
            >
              Ask
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setOracleOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search form */}
      {searchOpen && (
        <div className="rounded border border-zinc-700 p-3 space-y-2 bg-zinc-900">
          <p className="text-xs font-semibold text-zinc-300">Search</p>
          <Input
            placeholder="What are you looking for? (aspect name)"
            value={searchAspect}
            onChange={(e) => setSearchAspect(e.target.value)}
            className="h-7 text-xs bg-zinc-800 border-zinc-700"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs"
              onClick={() => {
                if (!searchAspect.trim()) return
                onDispatch({ type: 'Search', aspectName: searchAspect.trim() })
                setSearchOpen(false)
                setSearchAspect('')
              }}
            >
              Search
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setSearchOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* End-scene form */}
      {endSceneOpen && (
        <div className="rounded border border-zinc-700 p-3 space-y-2 bg-zinc-900">
          <p className="text-xs font-semibold text-zinc-300">End scene</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-600 text-white text-xs"
              onClick={() => {
                onDispatch({ type: 'EndScene', result: 'success' })
                setEndSceneOpen(false)
              }}
            >
              Success
            </Button>
            <Button
              size="sm"
              className="bg-red-800 hover:bg-red-700 text-white text-xs"
              onClick={() => {
                onDispatch({ type: 'EndScene', result: 'failure' })
                setEndSceneOpen(false)
              }}
            >
              Failure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setEndSceneOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Oracle & end-scene triggers (shown alongside player actions) */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-purple-800 hover:bg-purple-700 text-white text-xs"
          onClick={() => setOracleOpen(true)}
        >
          Ask Oracle
        </Button>
        <Button
          size="sm"
          className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs"
          onClick={() => setEndSceneOpen(true)}
        >
          End Scene
        </Button>
      </div>

      {systemActions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-zinc-500">System</p>
          <div className="flex flex-wrap gap-2">
            {systemActions.map((a, i) => (
              <Button
                key={`${a.id}-${i}`}
                size="sm"
                variant="outline"
                className="text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200"
                onClick={() => handleAction(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
