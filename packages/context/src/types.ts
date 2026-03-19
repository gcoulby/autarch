/**
 * M8 — Context Model
 *
 * The ContextModel is a structured snapshot of everything the LLM needs to
 * narrate the current game moment. It is assembled from four sources:
 *   1. GameState (engine) — mode, chaos, entities, encounter/scene data
 *   2. WorldGraph (knowledge-graph) — NPC relationships, faction ties
 *   3. NarrativeStore (vector-store) — semantically relevant past narrative
 *   4. EventStore (persistence) — recent event summary
 *
 * The LLM receives a serialised form of this model. It narrates; it does not
 * decide. No game state is ever written from the context layer.
 */

export interface PlayerContext {
  id: string
  name: string
  stress: number
  maxStress: number
  /** Aspect names only — for brevity in the prompt */
  aspects: string[]
  fatePoints: number
}

export interface LocationContext {
  id: string
  name: string
  /** Aspect names only */
  aspects: string[]
  /** IDs of directly connected locations */
  connections: string[]
}

export interface NpcContext {
  id: string
  name: string
  /** Outgoing graph relationships — e.g. { type: 'KNOWS', targetId: 'innkeeper' } */
  relationships: Array<{ type: string; targetId: string }>
}

export interface EncounterEntityContext {
  id: string
  name: string
  kind: string
  stress: number
  maxStress: number
  zoneId: string
  alive: boolean
}

export interface OracleContext {
  question: string
  result: string
  randomEventTriggered: boolean
}

export interface ContextModel {
  gameId: string
  mode: string
  chaos: number

  /** The player character. Null if no PC entity exists yet. */
  player: PlayerContext | null

  // ── Scene mode ────────────────────────────────────────────────────────────
  /** Current location. Null when not in scene mode or no location is set. */
  currentLocation: LocationContext | null
  /** NPCs at the current location, with their world-graph relationships. */
  nearbyNpcs: NpcContext[]

  // ── Encounter mode ────────────────────────────────────────────────────────
  encounterEntities: EncounterEntityContext[]
  initiativeOrder: string[]
  activeEntityId: string | null

  // ── Cross-cutting ─────────────────────────────────────────────────────────
  /** Human-readable summaries of recent events, oldest first. */
  recentEvents: string[]
  /** Text of semantically relevant past narrative entries. */
  narrativeHistory: string[]

  /** Set when the most recent event is OracleAnswered. */
  latestOracle: OracleContext | null
}

export interface BuildOptions {
  /** Number of recent events to include. Default: 10 */
  recentEventCount?: number
  /**
   * Embedding of the current situation used to query the narrative store.
   * If omitted, narrativeHistory will be empty (embedding model not yet wired up).
   */
  queryEmbedding?: number[]
  /** Number of narrative entries to retrieve. Default: 3 */
  narrativeHistoryCount?: number
  /** Specific PC entity id. Defaults to the first entity with kind === 'pc'. */
  pcId?: string
}
