import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryWorldGraph } from '../src/memory/MemoryWorldGraph'
import type { WorldNode } from '../src/interfaces'

function loc(id: string): WorldNode {
  return { id, type: 'location', properties: { name: id } }
}

function npc(id: string): WorldNode {
  return { id, type: 'npc', properties: { name: id } }
}

describe('MemoryWorldGraph', () => {
  let graph: MemoryWorldGraph

  beforeEach(() => {
    graph = new MemoryWorldGraph()
  })

  it('upserts and retrieves a node', async () => {
    await graph.upsertNode(loc('tavern'))
    const node = await graph.getNode('tavern')
    expect(node).not.toBeNull()
    expect(node!.type).toBe('location')
  })

  it('returns null for unknown node', async () => {
    expect(await graph.getNode('unknown')).toBeNull()
  })

  it('upsert replaces existing node', async () => {
    await graph.upsertNode(loc('tavern'))
    await graph.upsertNode({ id: 'tavern', type: 'location', properties: { name: 'The Rusty Flagon' } })
    const node = await graph.getNode('tavern')
    expect(node!.properties['name']).toBe('The Rusty Flagon')
  })

  it('deletes a node and its edges', async () => {
    await graph.upsertNode(loc('a'))
    await graph.upsertNode(loc('b'))
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'a', toId: 'b' })
    await graph.deleteNode('a')
    expect(await graph.getNode('a')).toBeNull()
    expect(await graph.getEdges('a')).toHaveLength(0)
  })

  it('getEdges returns outgoing edges filtered by type', async () => {
    await graph.upsertNode(npc('barmaid'))
    await graph.upsertNode(npc('innkeeper'))
    await graph.upsertNode(npc('stranger'))
    await graph.upsertEdge({ type: 'KNOWS', fromId: 'barmaid', toId: 'innkeeper' })
    await graph.upsertEdge({ type: 'HOSTILE_TO', fromId: 'barmaid', toId: 'stranger' })

    const knows = await graph.getEdges('barmaid', 'KNOWS')
    expect(knows).toHaveLength(1)
    expect(knows[0]!.toId).toBe('innkeeper')

    const all = await graph.getEdges('barmaid')
    expect(all).toHaveLength(2)
  })

  it('getNeighbors depth=1 returns direct neighbours', async () => {
    await graph.upsertNode(loc('village'))
    await graph.upsertNode(loc('forest'))
    await graph.upsertNode(loc('cave'))
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'village', toId: 'forest' })
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'forest', toId: 'cave' })

    const neighbors = await graph.getNeighbors('village', 1)
    expect(neighbors.map((n) => n.id)).toEqual(['forest'])
  })

  it('getNeighbors depth=2 returns two hops', async () => {
    await graph.upsertNode(loc('village'))
    await graph.upsertNode(loc('forest'))
    await graph.upsertNode(loc('cave'))
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'village', toId: 'forest' })
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'forest', toId: 'cave' })

    const neighbors = await graph.getNeighbors('village', 2)
    expect(neighbors.map((n) => n.id).sort()).toEqual(['cave', 'forest'])
  })

  it('getNeighbors filters by relation type', async () => {
    await graph.upsertNode(loc('village'))
    await graph.upsertNode(npc('guard'))
    await graph.upsertNode(loc('forest'))
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'village', toId: 'forest' })
    await graph.upsertEdge({ type: 'LOCATED_AT', fromId: 'village', toId: 'guard' })

    const connected = await graph.getNeighbors('village', 1, ['CONNECTED_TO'])
    expect(connected.map((n) => n.id)).toEqual(['forest'])
  })

  it('deleteEdge removes a specific edge', async () => {
    await graph.upsertNode(loc('a'))
    await graph.upsertNode(loc('b'))
    await graph.upsertEdge({ type: 'CONNECTED_TO', fromId: 'a', toId: 'b' })
    await graph.deleteEdge('a', 'b', 'CONNECTED_TO')
    expect(await graph.getEdges('a')).toHaveLength(0)
  })
})
