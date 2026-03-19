'use client'

import { useState } from 'react'
import { Input } from '@autarch/ui/components/ui/input'
import { Button } from '@autarch/ui/components/ui/button'

interface Props {
  llmUrl: string
  onApply: (url: string) => void
}

export function LlmSettings({ llmUrl, onApply }: Props) {
  const [draft, setDraft] = useState(llmUrl)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 whitespace-nowrap">LLM URL</span>
      <Input
        className="h-7 text-xs bg-zinc-900 border-zinc-700 w-64"
        placeholder="http://localhost:4891/v1 (leave blank for stub)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200"
        onClick={() => onApply(draft)}
      >
        Apply
      </Button>
      {llmUrl ? (
        <span className="text-xs text-green-500">● GPT4All</span>
      ) : (
        <span className="text-xs text-zinc-600">● Stub</span>
      )}
    </div>
  )
}
