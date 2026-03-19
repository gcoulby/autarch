import type { IWorldGraph, WorldEdge, WorldNode } from '../interfaces.js'

/**
 * In-process adjacency-map implementation of IWorldGraph.
 * No server required — suitable for dev and tests.
 * BFS is used for multi-hop neighbour queries.
 */
export class MemoryWorldGraph implements IWorldGraph {
  private nodes = new Map<string, WorldNode>()
  // edges keyed by `${fromId}::${type}::${toId}`
  private edges = new Map<string, WorldEdge>()

  private edgeKey(fromId: string, toId: string, type: string): string {
    return `${fromId}::${type}::${toId}`
  }

  async upsertNode(node: WorldNode): Promise<void> {
    this.nodes.set(node.id, { ...node })
  }

  async upsertEdge(edge: WorldEdge): Promise<void> {
    this.edges.set(this.edgeKey(edge.fromId, edge.toId, edge.type), { ...edge })
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes.delete(id)
    for (const [key, edge] of this.edges) {
      if (edge.fromId === id || edge.toId === id) this.edges.delete(key)
    }
  }

  async deleteEdge(fromId: string, toId: string, type: string): Promise<void> {
    this.edges.delete(this.edgeKey(fromId, toId, type))
  }

  async getNode(id: string): Promise<WorldNode | null> {
    return this.nodes.get(id) ?? null
  }

  async getNeighbors(id: string, depth = 1, relationTypes?: string[]): Promise<WorldNode[]> {
    const visited = new Set<string>([id])
    let frontier = [id]
    const result: WorldNode[] = []

    for (let d = 0; d < depth; d++) {
      const next: string[] = []
      for (const nodeId of frontier) {
        for (const edge of this.edges.values()) {
          if (edge.fromId !== nodeId) continue
          if (relationTypes && !relationTypes.includes(edge.type)) continue
          if (visited.has(edge.toId)) continue
          visited.add(edge.toId)
          next.push(edge.toId)
          const node = this.nodes.get(edge.toId)
          if (node) result.push(node)
        }
      }
      frontier = next
      if (frontier.length === 0) break
    }

    return result
  }

  async getEdges(fromId: string, type?: string): Promise<WorldEdge[]> {
    const result: WorldEdge[] = []
    for (const edge of this.edges.values()) {
      if (edge.fromId !== fromId) continue
      if (type && edge.type !== type) continue
      result.push(edge)
    }
    return result
  }
}
