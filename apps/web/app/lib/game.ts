'use client'

import { MemoryEventStore, MemoryStateStore } from '@autarch/persistence'
import { MemoryWorldGraph } from '@autarch/knowledge-graph'
import { MemoryVectorStore } from '@autarch/vector-store'
import { Orchestrator } from '@autarch/runtime'
import { ContextModelService } from '@autarch/context'
import { NarrativeService, StubLLMClient, GPT4AllClient } from '@autarch/llm'

// Singletons — created once per browser session
export const eventStore = new MemoryEventStore()
export const stateStore = new MemoryStateStore()
export const worldGraph = new MemoryWorldGraph()
export const narrativeStore = new MemoryVectorStore()

export const orchestrator = new Orchestrator(eventStore as any, stateStore as any)

export const contextService = new ContextModelService(
  eventStore,
  stateStore,
  worldGraph,
  narrativeStore,
)

export function makeNarrativeService(llmUrl?: string): NarrativeService {
  const llm = llmUrl
    ? new GPT4AllClient({ baseUrl: llmUrl, model: 'gpt4all-default' })
    : new StubLLMClient((prompt) => {
        // Offline stub: surface last 80 chars of prompt as a placeholder narrative
        const tail = prompt.slice(-120).trim()
        return `[Stub LLM] …${tail}`
      })
  return new NarrativeService(contextService, llm, narrativeStore)
}
