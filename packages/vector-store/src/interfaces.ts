/**
 * M7 — Narrative Vector Store interface
 *
 * Abstracts over Qdrant (production) and the in-memory implementation (dev/test).
 * Consumed by the context model service (M8) — not by the engine directly.
 *
 * Entries are textual narrative passages (scene summaries, dialogue beats,
 * emotional moments) stored alongside their embedding vectors so the context
 * model service can retrieve semantically relevant history.
 */

export interface NarrativeEntry {
  id: string
  text: string
  /** Dense embedding vector — dimensionality must match the embedding model. */
  embedding: number[]
  metadata: Record<string, unknown>
}

export interface INarrativeStore {
  /** Insert or replace an entry. */
  upsert(entry: NarrativeEntry): Promise<void>

  /**
   * Retrieve the top-K entries most similar to the given embedding.
   * Similarity is measured by cosine similarity (higher = more similar).
   */
  query(embedding: number[], topK?: number): Promise<NarrativeEntry[]>

  /** Remove an entry by id. */
  delete(id: string): Promise<void>
}
