/**
 * M9 — LLM Client interface
 *
 * The interface is deliberately minimal: the context model (M8) owns all the
 * structure; the LLM only needs to receive a prompt and return prose.
 *
 * Implementations:
 *   - GPT4AllClient  — calls GPT4All's local OpenAI-compatible REST endpoint
 *   - StubLLMClient  — returns a configured string; used in tests and offline dev
 */

export interface ILLMClient {
  /**
   * Send a prompt and return the generated narrative text.
   * Implementations must never modify game state.
   */
  complete(prompt: string): Promise<string>
}

export interface GPT4AllConfig {
  /** Base URL of the OpenAI-compatible endpoint. Default: http://localhost:4891/v1 */
  baseUrl?: string
  /** Model name as reported by the GPT4All server. */
  model: string
  /** Maximum tokens to generate. Default: 512 */
  maxTokens?: number
  /** Sampling temperature. Default: 0.7 */
  temperature?: number
}
