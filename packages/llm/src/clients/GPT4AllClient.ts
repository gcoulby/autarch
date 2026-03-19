import type { GPT4AllConfig, ILLMClient } from '../interfaces.js'

const DEFAULT_BASE_URL = 'http://localhost:4891/v1'
const DEFAULT_MAX_TOKENS = 512
const DEFAULT_TEMPERATURE = 0.7

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Calls GPT4All's local OpenAI-compatible REST API.
 *
 * GPT4All must be running with the API server enabled (default port 4891).
 * The interface is OpenAI-compatible so this client works with any local model
 * server that exposes the same API (LM Studio, Ollama, llama.cpp server, etc.)
 * by changing `baseUrl` in the config.
 *
 * Throws if the HTTP request fails or the response is malformed.
 */
export class GPT4AllClient implements ILLMClient {
  private readonly baseUrl: string
  private readonly model: string
  private readonly maxTokens: number
  private readonly temperature: number

  constructor(config: GPT4AllConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.model = config.model
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE
  }

  async complete(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    })

    if (!response.ok) {
      throw new Error(`GPT4All request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as ChatCompletionResponse
    const content = data?.choices?.[0]?.message?.content

    if (typeof content !== 'string') {
      throw new Error('GPT4All response missing choices[0].message.content')
    }

    return content.trim()
  }
}
