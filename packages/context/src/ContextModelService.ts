import type { IEventStore, IStateStore } from '@autarch/persistence'
import type { IWorldGraph } from '@autarch/knowledge-graph'
import type { INarrativeStore } from '@autarch/vector-store'
import { replay } from '@autarch/engine'
import type {
  BuildOptions,
  ContextModel,
  EncounterEntityContext,
  LocationContext,
  NpcContext,
  OracleContext,
  PlayerContext,
} from './types.js'
import { summarizeEvent } from './summarize.js'

/**
 * M8 — Context Model Service
 *
 * Read-only. Assembles a ContextModel from the four data sources so the LLM
 * prompt layer (M9) has everything it needs without touching any store itself.
 *
 * This class has no write methods. It never calls append(), save(), upsert(),
 * or any mutating store operation.
 */
export class ContextModelService {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly stateStore: IStateStore,
    private readonly worldGraph: IWorldGraph,
    private readonly narrativeStore: INarrativeStore,
  ) {}

  async build(gameId: string, options: BuildOptions = {}): Promise<ContextModel> {
    const { recentEventCount = 10, queryEmbedding, narrativeHistoryCount = 3, pcId } = options

    // ── 1. Load game state ───────────────────────────────────────────────────
    const events = await this.eventStore.list(gameId)
    let state = await this.stateStore.load(gameId)
    if (!state) state = replay(gameId, events)

    // ── 2. Recent events summary ─────────────────────────────────────────────
    const recentEvents = events.slice(-recentEventCount).map(summarizeEvent)

    // ── 3. Player character ──────────────────────────────────────────────────
    const allEntities = Object.values(state.entities)
    const pcEntity = pcId
      ? (state.entities[pcId] ?? null)
      : (allEntities.find((e) => e.kind === 'pc') ?? null)

    const player: PlayerContext | null = pcEntity
      ? {
          id: pcEntity.id,
          name: pcEntity.name,
          stress: pcEntity.stats.stress,
          maxStress: pcEntity.stats.maxStress,
          aspects: pcEntity.stats.aspects.map((a) => a.name),
          fatePoints: pcEntity.stats.resources['fatePoints'] ?? 0,
        }
      : null

    // ── 4. Scene context ─────────────────────────────────────────────────────
    let currentLocation: LocationContext | null = null
    let nearbyNpcs: NpcContext[] = []

    if (state.runtime.mode === 'scene' && state.scene) {
      const locId = state.scene.locationId
      const locData = locId ? state.scene.locations[locId] : undefined

      if (locId && locData) {
        currentLocation = {
          id: locId,
          name: locData.name,
          aspects: locData.aspects.map((a) => a.name),
          connections: locData.connections,
        }

        // NPCs at current location — use entity position (zone reused as locationId in scene mode)
        const npcsHere = allEntities.filter((e) => e.kind === 'npc' && e.position?.zoneId === locId)

        nearbyNpcs = await Promise.all(
          npcsHere.map(async (npc) => {
            const edges = await this.worldGraph.getEdges(npc.id)
            return {
              id: npc.id,
              name: npc.name,
              relationships: edges.map((e) => ({ type: e.type, targetId: e.toId })),
            }
          }),
        )
      }
    }

    // ── 5. Encounter context ─────────────────────────────────────────────────
    let encounterEntities: EncounterEntityContext[] = []
    let initiativeOrder: string[] = []
    let activeEntityId: string | null = null

    if (state.runtime.mode === 'encounter') {
      encounterEntities = allEntities.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        stress: e.stats.stress,
        maxStress: e.stats.maxStress,
        zoneId: e.position?.zoneId ?? '',
        alive: e.status.alive,
      }))
      initiativeOrder = state.encounter?.initiative ?? []
      activeEntityId = state.runtime.activeEntityId
    }

    // ── 6. Narrative history (requires caller-supplied embedding) ────────────
    let narrativeHistory: string[] = []
    if (queryEmbedding) {
      const entries = await this.narrativeStore.query(queryEmbedding, narrativeHistoryCount)
      narrativeHistory = entries.map((e) => e.text)
    }

    // ── 7. Latest oracle result ───────────────────────────────────────────────
    let latestOracle: OracleContext | null = null
    const lastEvent = events.at(-1)
    if (lastEvent?.type === 'OracleAnswered') {
      const p = lastEvent.payload
      latestOracle = {
        question: String(p['question'] ?? ''),
        result: String(p['result'] ?? ''),
        randomEventTriggered: Boolean(p['randomEventTriggered']),
      }
    }

    return {
      gameId,
      mode: state.runtime.mode,
      chaos: state.runtime.chaos,
      player,
      currentLocation,
      nearbyNpcs,
      encounterEntities,
      initiativeOrder,
      activeEntityId,
      recentEvents,
      narrativeHistory,
      latestOracle,
    }
  }
}
