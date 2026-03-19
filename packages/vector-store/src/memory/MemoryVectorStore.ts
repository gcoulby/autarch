import type { INarrativeStore, NarrativeEntry } from '../interfaces.js'

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Embedding dimension mismatch')
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * In-process vector store using cosine similarity.
 * Linear scan — fine for small narrative histories (hundreds of entries).
 * Replace with Qdrant for production.
 */
export class MemoryVectorStore implements INarrativeStore {
  private entries = new Map<string, NarrativeEntry>()

  async upsert(entry: NarrativeEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, embedding: [...entry.embedding] })
  }

  async query(embedding: number[], topK = 5): Promise<NarrativeEntry[]> {
    const scored = Array.from(this.entries.values()).map((entry) => ({
      entry,
      score: cosineSimilarity(embedding, entry.embedding),
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map((s) => s.entry)
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id)
  }
}
