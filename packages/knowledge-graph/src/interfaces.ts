/**
 * M7 — World Knowledge Graph interface
 *
 * Abstracts over Neo4j (production) and the in-memory implementation (dev/test).
 * Consumed by the context model service (M8) — not by the engine directly.
 *
 * Node types mirror the world model:
 *   location | npc | faction | item | concept
 *
 * Relationship types (examples):
 *   CONNECTED_TO, KNOWS, MEMBER_OF, HOSTILE_TO, HOLDS, LOCATED_AT
 */

export type NodeType = 'location' | 'npc' | 'faction' | 'item' | 'concept'

export interface WorldNode {
  id: string
  type: NodeType
  properties: Record<string, unknown>
}

export interface WorldEdge {
  type: string        // e.g. 'CONNECTED_TO', 'KNOWS'
  fromId: string
  toId: string
  properties?: Record<string, unknown>
}

export interface IWorldGraph {
  /** Insert or replace a node. */
  upsertNode(node: WorldNode): Promise<void>

  /** Insert or replace a directed edge between two nodes. */
  upsertEdge(edge: WorldEdge): Promise<void>

  /** Remove a node and all its edges. */
  deleteNode(id: string): Promise<void>

  /** Remove a specific directed edge. */
  deleteEdge(fromId: string, toId: string, type: string): Promise<void>

  /** Retrieve a single node by id. */
  getNode(id: string): Promise<WorldNode | null>

  /**
   * Retrieve nodes reachable from the given node within `depth` hops.
   * Optionally filter by relationship types.
   */
  getNeighbors(id: string, depth?: number, relationTypes?: string[]): Promise<WorldNode[]>

  /** Retrieve all outgoing edges from a node, optionally filtered by type. */
  getEdges(fromId: string, type?: string): Promise<WorldEdge[]>
}
