'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@autarch/ui/components/ui/card'
import { Button } from '@autarch/ui/components/ui/button'

interface Props {
  narrative: string
  prompt: string
  narrating: boolean
}

export function NarrativePanel({ narrative, prompt, narrating }: Props) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Narrative</p>
        {prompt && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-zinc-600 hover:text-zinc-400 h-6 px-2"
            onClick={() => setShowPrompt((v) => !v)}
          >
            {showPrompt ? 'hide prompt' : 'show prompt'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {narrating ? (
          <p className="text-sm text-zinc-500 animate-pulse italic">Generating narrative…</p>
        ) : (
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {narrative || <span className="text-zinc-600 italic">No narrative yet</span>}
          </p>
        )}

        {showPrompt && prompt && (
          <div className="rounded bg-zinc-900 border border-zinc-800 p-2 max-h-48 overflow-y-auto">
            <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap font-mono">{prompt}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
