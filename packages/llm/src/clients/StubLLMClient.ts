import type { ILLMClient } from '../interfaces.js'

/**
 * A non-networking LLM client that returns a fixed or callback-generated string.
 *
 * Useful for:
 *   - Unit and integration tests — avoids any network dependency
 *   - Offline development — lets the full narrate pipeline run without GPT4All
 *   - Prompt inspection — pass a callback that captures the prompt for assertions
 */
export class StubLLMClient implements ILLMClient {
  private readonly respond: (prompt: string) => string

  constructor(responseOrFn: string | ((prompt: string) => string) = '') {
    this.respond = typeof responseOrFn === 'function' ? responseOrFn : () => responseOrFn
  }

  async complete(prompt: string): Promise<string> {
    return this.respond(prompt)
  }
}
