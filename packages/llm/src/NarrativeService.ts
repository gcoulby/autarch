import type { ContextModelService, BuildOptions } from '@autarch/context'
import { toPrompt } from '@autarch/context'
import type { INarrativeStore } from '@autarch/vector-store'
import type { ILLMClient } from './interfaces.js'

export interface NarrateOptions extends BuildOptions {
  /**
   * Whether to persist the generated narrative to the vector store.
   * Requires `queryEmbedding` to be set (the same embedding is used for storage).
   * Default: true
   */
  storeNarrative?: boolean
}

export interface NarrateResult {
  narrative: string
  prompt: string
}

/**
 * M9 — Narrative Service
 *
 * Orchestrates the full narration pipeline:
 *   1. Build context model from the four data sources (M8)
 *   2. Serialise to prompt string
 *   3. Call the LLM client
 *   4. Optionally store the result in the narrative vector store for future retrieval
 *   5. Return the narrative text
 *
 * This is the only place in M9 that writes to a store (the narrative store).
 * It never touches the event store or state store — game state is immutable from here.
 */
export class NarrativeService {
  constructor(
    private readonly contextService: ContextModelService,
    private readonly llmClient: ILLMClient,
    private readonly narrativeStore: INarrativeStore,
  ) {}

  async narrate(gameId: string, options: NarrateOptions = {}): Promise<NarrateResult> {
    const { storeNarrative = true, ...buildOptions } = options

    // 1 + 2 — Build context and serialise to prompt
    const model = await this.contextService.build(gameId, buildOptions)
    const prompt = toPrompt(model)

    // 3 — Generate narrative
    const narrative = await this.llmClient.complete(prompt)

    // 4 — Persist to narrative store for future retrieval (requires an embedding)
    if (storeNarrative && buildOptions.queryEmbedding && narrative) {
      await this.narrativeStore.upsert({
        id: crypto.randomUUID(),
        text: narrative,
        embedding: buildOptions.queryEmbedding,
        metadata: {
          gameId,
          mode: model.mode,
          chaos: model.chaos,
          storedAt: new Date().toISOString(),
        },
      })
    }

    return { narrative, prompt }
  }
}
