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

// NEXT_PUBLIC_LLM_URL is injected at build time by Next.js
const ENV_LLM_URL = process.env.NEXT_PUBLIC_LLM_URL ?? ''
const ENV_LLM_MODEL = process.env.NEXT_PUBLIC_LLM_MODEL ?? 'mistral'

export function makeNarrativeService(llmUrl?: string): NarrativeService {
  const url = (llmUrl ?? ENV_LLM_URL).trim()
  const llm = url
    ? new GPT4AllClient({ baseUrl: url, model: ENV_LLM_MODEL })
    : new StubLLMClient((prompt) => {
        const tail = prompt.slice(-160).trim()
        return `[Stub narrative — connect an LLM to see real prose]\n\n…${tail}`
      })
  return new NarrativeService(contextService, llm, narrativeStore)
}

export { ENV_LLM_URL }
