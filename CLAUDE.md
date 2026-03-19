# CLAUDE.md — Autarch Project

This file is the authoritative context document for Claude Code. Read it fully before making any changes. Do not skip sections.

---

## What This Project Is

Autarch is a **deterministic, event-sourced game engine for solo/GM-free tabletop RPGs**. The goal is a game that plays like Divinity: Original Sin or Baldur's Gate -- open world exploration in scene mode, then structured turn-based combat in encounter mode -- but running locally with AI-generated narrative and no human GM required.

The player controls their character. Everything else is driven by the engine, AI agents, and local LLMs.

This is not a vibe-coded prototype. The codebase is test-driven and must stay that way. Every mechanic gets tests before or alongside implementation.

---

## Repository Structure

Turborepo monorepo using PNPM workspaces.

```
autarch/
  packages/
    engine/          # Core game engine — the rules kernel (PRIMARY PACKAGE)
    ui/              # Stub only — not in active development
    eslint-config/   # Shared lint config
    typescript-config/  # Shared tsconfig
  apps/
    web/             # Next.js app — exploration/combat UI (PLANNED, not yet built)
    docs/            # Next.js stub — boilerplate, ignore
```

The `apps/docs` app is boilerplate. Do not touch it.

The `apps/web` app is planned but mostly empty. It will become the primary game UI.

The `packages/engine` package is the only package with real code. It is the rules kernel.

---

## Architecture Overview

### The Three-Layer Model

```
┌─────────────────────────────────────────────────┐
│                    apps/web                      │
│         Next.js — exploration + combat UI        │
│         Player input → Commands → Engine         │
└────────────────────┬────────────────────────────┘
                     │ Commands / State reads
┌────────────────────▼────────────────────────────┐
│              packages/engine                     │
│         Rules kernel — the only source           │
│         of truth for what is/isn't legal         │
│    Orchestrator → EventStore → Reducer → State   │
└────────────────────┬────────────────────────────┘
                     │ Reads / Writes
┌────────────────────▼────────────────────────────┐
│              Data Layer (PLANNED)                │
│  DocumentDB  │  KnowledgeGraph  │  VectorDB      │
│  (game state │  (relationships, │  (narrative     │
│   inventories│   world graph)   │   tone/memory)  │
│   items etc) │                  │                 │
└──────────────┴──────────────────┴────────────────┘
                     │ Context
┌────────────────────▼────────────────────────────┐
│           Context Model Service (PLANNED)        │
│   Reads all three stores + engine state          │
│   Assembles a structured prompt payload          │
│   LLM never sees raw data — only context model   │
└────────────────────┬────────────────────────────┘
                     │ Prompt / Response
┌────────────────────▼────────────────────────────┐
│           Local LLM (PLANNED)                    │
│           GPT4All via REST API                   │
│           Generates narrative text only          │
│           Does not make game decisions           │
└─────────────────────────────────────────────────┘
```

### Critical Boundaries

- **The engine is the sole arbiter of legal actions.** No other layer can modify game state directly. Everything goes through `Orchestrator.dispatch()`.
- **The LLM generates narrative only.** It does not decide what happens in the game. The engine decides. The LLM describes it.
- **The context model service owns prompt assembly.** The LLM receives a structured context payload derived from all data sources. It does not query stores itself.
- **The stores are read-only from the LLM's perspective.** All writes go through the engine or dedicated store services.

---

## packages/engine — Current State

### What Is Built (Milestones 1–3)

**M1 — Authority**
- `Orchestrator` class with `dispatch(gameId, command)` and `loadState(gameId)`
- Event store and state store abstractions (`EventStore`, `StateStore`) — currently in-memory only
- `applyEvent` reducer — pure function, no side effects
- `replay(gameId, events)` — derives state from scratch from the event log
- `createInitialState` — canonical empty state factory
- `InvariantError` and `assert` for guard clauses
- Full test coverage: smoke, invariant violation, replay determinism, valid actions

**M2 — Combat**
- Zone-based encounter map (`EncounterMap`, `Zone` with adjacency lists)
- `Move` command — validates adjacency, emits `EntityMoved`
- `Attack` command — melee only (same zone), flat 1 damage, emits `EntityDamaged`
- Defeat condition: `stress >= maxStress` sets `status.alive = false`
- `getValidActions(state)` — returns legal `ActionDescriptor[]` for current state
- Full test coverage: move, attack, map replay, AI guard, AI behaviour

**M3 — Advance**
- `Advance` command — single entry point for system-driven state progression
- Handles: initiative→turn transition, starting turns, running AI turns, encounter end detection
- `EncounterEnded` event with `win` / `loss` result
- `EncounterResult` is a no-op once in `resolution` phase
- Basic AI (`basic-ai.ts`): rule-based (not LLM), attacks if in same zone, moves toward closest opponent via BFS otherwise, ends turn if nothing applicable
- Full test coverage: advance variants, encounter ended win/loss, resolution no-op

### What Is Stubbed / Incomplete

- `chaos` field exists on `GameState.runtime` (default 5) but is never read or written — reserved for Fate chaos factor mechanics
- `scene` and `downtime` modes exist in types but have no logic
- `rng` field exists on `GameEvent` but is never populated — reserved for seeded dice rolls
- `npc` and `summon` entity kinds exist in types but have no distinct behaviour
- Storage is in-memory only — no persistence layer yet

### Key Types

```typescript
// Game modes
type GameMode = 'scene' | 'encounter' | 'downtime'
type GamePhase = 'setup' | 'initiative' | 'turn' | 'resolution'
type Side = 'players' | 'ai' | 'system'

// Entity
interface Entity {
  id: string
  kind: 'pc' | 'npc' | 'enemy' | 'summon'
  name: string
  status: { alive: boolean; conditions: string[] }
  position?: { zoneId: string }
  stats: {
    stress: number
    maxStress: number
    aspects: { id: string; name: string; freeInvokes: number }[]
    resources: Record<string, number>
  }
  tags: string[]
}

// Events emitted by the engine
type GameEventType =
  | 'GameCreated' | 'ModeSet' | 'PhaseSet'
  | 'EntityAdded' | 'EntityPatched'
  | 'InitiativeSet' | 'EncounterPointerSet'
  | 'RoundStarted' | 'TurnStarted' | 'TurnEnded'
  | 'ActiveEntitySet' | 'EncounterMapSet'
  | 'EntityMoved' | 'EntityDamaged' | 'EncounterEnded'

// Commands accepted by the Orchestrator
type Command =
  | { type: 'CreateGame'; schemaVersion: number; seed: string }
  | { type: 'Advance' }
  | { type: 'SetMode'; mode: GameMode }
  | { type: 'SetPhase'; phase: GamePhase }
  | { type: 'AddEntity'; entity: Entity }
  | { type: 'SetInitiative'; order: string[] }
  | { type: 'StartRound' } | { type: 'StartTurn' } | { type: 'EndTurn' }
  | { type: 'SetEncounterMap'; map: EncounterMap }
  | { type: 'Move'; entityId: string; toZoneId: string }
  | { type: 'Attack'; attackerId: string; targetId: string }
```

---

## Planned Milestones

These are the next development phases in rough priority order. Do not implement a milestone unless explicitly asked. Document new milestones here when agreed.

### M4 — Fate Mechanics

**Goal:** Implement the Fate RPG mechanical layer.

Fate uses:
- **Aspects** — descriptive phrases on entities, scenes, zones. Can be invoked (spend Fate point for +2 or reroll) or compelled (accept a complication for a Fate point).
- **Skills** — rated values used for rolls (e.g. Fight +3, Athletics +2)
- **Stunts** — special rules exceptions tied to skills
- **Stress tracks** — already stubbed in. Physical and Mental tracks typical.
- **Consequences** — named aspects that absorb overflow stress (Mild/Moderate/Severe)
- **Fate points** — resource for invocations. Add to `Entity.stats.resources`.
- **Chaos factor** — the `chaos` field on runtime. Starts at 5. Increases when players "lose" scenes, decreases when they win. Used by the AI oracle (see M6).
- **Dice** — Fate dice are 4dF (each die: -1, 0, +1). Rolls must use the seeded RNG on `GameEvent.rng`. Deterministic given the seed.

Implementation notes:
- Dice rolls go on the event, not in the command. The orchestrator rolls when processing the command and embeds the result in the event payload.
- Invoke/compel are new commands that must be validated against legal state (entity must have the aspect, must have fate points for invoke, etc.)
- Consequences are aspects with a special tag. Treat as `EntityPatched` events.

### M5 — Scene Mode

**Goal:** Implement the non-combat scene exploration mode.

Scene mode is the Divinity/BG exploration layer. The player moves between locations, triggers events, interacts with NPCs, and manages inventory/resources between encounters.

- Location graph (nodes + connections) stored in the knowledge graph
- Scene events: travel, rest, search, interact, trade
- NPC interaction triggers narrative generation via the context model service
- Scene outcomes feed the chaos factor
- Transition from scene → encounter when combat triggers

### M6 — AI Oracle (Fate-style)

**Goal:** Implement the solo RPG oracle that answers yes/no questions and generates random events.

In solo Fate, the oracle works roughly as:
1. Player asks a yes/no question ("Is the guard suspicious?")
2. Roll 2d6 + chaos factor vs a threshold
3. Result: Yes, No, Yes-but, No-but, Yes-and, No-and
4. Chaos factor modifies odds — higher chaos = more random/dramatic outcomes

The oracle is a rule in the engine (deterministic, seeded), not an LLM call. The LLM narrates the outcome. The engine decides it.

Random event table is also chaos-driven — periodically the engine fires a `RandomEventTriggered` game event that the context model service must narrate.

### M7 — Persistent Storage Layer

**Goal:** Replace in-memory stores with real persistence.

Three store types, each with a common interface that the engine already depends on:

**Document DB** — MongoDB or equivalent. Stores:
- `GameState` snapshots (replacing in-memory `StateStore`)
- `GameEvent` log (replacing in-memory `EventStore`)
- World content: location definitions, item definitions, NPC templates
- Inventories, character progression, quest state

**Knowledge Graph** — Neo4j (server) or an in-process Cypher-compatible graph.
- Node types: Location, NPC, Faction, Item, Concept
- Relationship types: CONNECTED_TO, KNOWS, MEMBER_OF, HOSTILE_TO, HOLDS, etc.
- Queried by the context model service to build relationship context
- Updated by engine events (e.g. NPC killed → remove NPC node's ALIVE relationship)

**Vector DB** — ChromaDB, Qdrant, or equivalent with a Node.js client.
- Stores scene summaries, dialogue summaries, emotional beats as embeddings
- Queried by context model service for narrative tone and continuity
- New embeddings added after each scene concludes

All three stores implement a common abstract interface. The engine itself only depends on `EventStore` and `StateStore`. The additional stores are consumed by the context model service.

### M8 — Context Model Service

**Goal:** Build the service that assembles prompts for the LLM.

The context model is a structured object assembled from:
1. Current `GameState` from the engine
2. Active scene / location data from document DB
3. Relevant NPC relationships from knowledge graph (within N hops of player)
4. Recent narrative tone from vector DB (top-K semantic neighbours to current situation)
5. Recent event log summary (last N events, human-readable)

The service outputs a `ContextModel` type that gets serialised to a prompt template. The LLM receives this and generates narrative text only — no game decisions, no state mutations.

The context model service is a separate package (`packages/context` or a microservice). It has no write access to any store.

### M9 — LLM Integration

**Goal:** Wire up GPT4All as the narrative generation layer.

- GPT4All exposes a local REST API (OpenAI-compatible endpoint)
- The LLM client is a thin wrapper — takes a `ContextModel`, returns a narrative string
- Model selection is configurable — the interface must not couple to GPT4All specifically
- The narrative layer is entirely separate from the rules layer. It can be disabled and the engine still runs.
- Response is narrative text only. No function calls, no structured output required from the LLM.
- Keep prompts small. The context model does the heavy lifting so the model does not need to reason — it narrates.

### M10 — Web App (apps/web)

**Goal:** Build the primary player-facing UI in `apps/web`.

The UI has two main modes mirroring the engine:

**Scene/Exploration view**
- Location map — visualises the location graph
- Player can navigate between connected locations
- Sidebar: character sheet (stats, aspects, stress, fate points)
- NPC list for current location
- Action panel: interact, search, rest, travel
- Narrative panel: LLM-generated scene text, scrollable history

**Encounter/Combat view**
- Zone map — renders `EncounterMap` zones with entity positions
- Initiative tracker
- Action panel: shows `getValidActions()` output for player character
- Attack/Move executed by dispatching commands to the engine
- AI turns happen automatically via `Advance`
- Stress/defeat visualised per entity

The web app dispatches Commands to the engine and reads `GameState`. It does not contain game logic. No rules live in the UI.

Tech stack for `apps/web`:
- Next.js (already scaffolded)
- TypeScript
- Tailwind CSS
- shadcn/ui for components
- No additional state management library — derive UI state from `GameState` directly

---

## Coding Standards

### Non-negotiable Rules

1. **Tests first (or alongside).** No new mechanic ships without test coverage. Tests live in `packages/engine/tests/` under the relevant milestone folder (`m4-fate/`, `m5-scene/`, etc.).

2. **The reducer is a pure function.** `applyEvent(state, event)` must have no side effects. No async, no I/O, no randomness. It takes state and event, returns new state. Always.

3. **Commands produce events, events mutate state.** The orchestrator validates commands and emits events. The reducer applies events. Nothing else mutates state.

4. **All randomness is seeded and recorded.** Dice rolls happen in the orchestrator (or a dedicated RNG utility), the results are stored in `GameEvent.rng.rolls`, and the reducer uses those stored values. This guarantees deterministic replay.

5. **`InvariantError` for illegal state.** Use `assert(condition, message)` from `domain/invariants.ts`. Do not throw raw `Error` for guard clauses.

6. **TypeScript strict mode.** No `any` except where genuinely unavoidable and marked with a comment. No implicit any. No `as unknown as X` casts without justification.

7. **No logic in the web app.** The UI dispatches commands and renders state. It contains zero game rules.

### File Conventions

```
packages/engine/src/
  domain/       # Pure functions: reducer, replay, invariants
  engine/       # Orchestrator, valid-actions, AI
    ai/         # AI implementations
  storage/      # Store interfaces and implementations
  types/        # TypeScript types — no logic

packages/engine/tests/
  m1-authority/
  m2-combat/
  m3-advance/
  m4-fate/      # (planned)
  m5-scene/     # (planned)
  helpers.ts    # Shared test utilities
```

### Test Conventions

- Use Vitest
- `describe` blocks per feature, `it` blocks per behaviour
- Test names describe the observable outcome: `'AI moves closer when not in the same zone'`
- Use `InMemoryEventStore` and `InMemoryStateStore` from `tests/helpers.ts`
- Use `makeEntity()` and `setupEncounter()` helpers where applicable — extend helpers.ts when a new pattern repeats across tests
- Tests must not depend on wall-clock time. All timestamps in tests use fixed ISO strings.
- Replay determinism tests must exist for any mechanic that touches the reducer.

---

## Technology Decisions

| Concern | Decision | Notes |
|---|---|---|
| Monorepo | Turborepo + PNPM | Already set up |
| Language | TypeScript strict | Engine is ESM (`"type": "module"`) |
| Test runner | Vitest | Root-level `vitest.config.mts` |
| UI framework | Next.js | `apps/web` — not yet built |
| UI components | shadcn/ui + Tailwind | For `apps/web` |
| Local LLM | GPT4All | Via local REST API (OpenAI-compatible) |
| Knowledge graph | Neo4j (primary) | In-process Cypher graph acceptable for dev/test |
| Document DB | TBD (MongoDB likely) | Must fit EventStore/StateStore interface |
| Vector DB | TBD (ChromaDB or Qdrant) | Node.js client required |
| RNG | Seeded deterministic | Implementation TBD — must produce reproducible sequences from a string seed |

---

## What Not To Do

- Do not add logic to `apps/web` or `apps/docs`. The docs app is boilerplate.
- Do not break the `applyEvent` reducer's purity. No async, no I/O, no Date.now(), no Math.random().
- Do not couple the engine to any specific database. The engine takes store interfaces, not concrete implementations.
- Do not let the LLM make game decisions. The LLM narrates. The engine decides.
- Do not bypass `Orchestrator.dispatch()` to mutate state directly.
- Do not remove existing tests. Refactoring is fine; deletion is not.
- Do not implement a milestone unless asked. Stubs and types are fine; full implementation waits for explicit instruction.
- Do not use `Math.random()` anywhere. All randomness must use the seeded RNG.

---

## Running the Project

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test:watch

# Build the engine
pnpm --filter @autarch/engine build

# Run a specific test file
pnpm --filter @autarch/engine vitest run tests/m2-combat/m2.end-to-end.test.ts
```

---

## Current Test Suite Status

All tests passing as of initial commit. Test files:

```

 ✓ packages/runtime/tests/m4-fate/m4.aspects.test.ts (8 tests) 9ms
   ✓ M4 InvokeAspect (5)
     ✓ consumes a free invoke when one is available 4ms
     ✓ spends a fate point when no free invokes remain 0ms
     ✓ emits an AspectInvoked event with the correct payload 1ms
     ✓ throws when no free invokes and no fate points 1ms
     ✓ throws when the aspect does not exist on the entity 0ms
   ✓ M4 CompelAspect (3)
     ✓ grants a fate point to the entity 0ms
     ✓ emits an AspectCompelled event 0ms
     ✓ throws when the aspect does not exist on the entity 0ms
 ✓ packages/runtime/tests/m4-fate/m4.consequences.test.ts (4 tests) 10ms
   ✓ M4 TakeConsequence (4)
     ✓ adds a mild consequence aspect to the entity 6ms
     ✓ adds moderate and severe consequences independently 2ms
     ✓ emits an EntityPatched event 0ms
     ✓ throws when the entity already has a consequence of the same severity 1ms
 ✓ packages/runtime/tests/combat/ai.guard.test.ts (2 tests) 11ms
   ✓ M2 AI guards (2)
     ✓ throws if runAiTurn called when it's not AI's turn 6ms
     ✓ does not attack allies 3ms
 ✓ packages/runtime/tests/advance/advance.test.ts (3 tests) 12ms
   ✓ M3 Advance (pure system driver) (3)
     ✓ Advance starts a turn when no entity is active 6ms
     ✓ Advance runs the AI turn when it is AI’s turn (same zone => attack) 3ms
     ✓ Advance does nothing on player turn 3ms
 ✓ packages/runtime/tests/combat/ai.test.ts (2 tests) 13ms
   ✓ M2 AI (zones) (2)
     ✓ AI moves closer when not in the same zone 8ms
     ✓ AI attacks when in the same zone 4ms
 ✓ packages/runtime/tests/m4-fate/m4.fate-attack.test.ts (6 tests) 17ms
   ✓ M4 FateAttack (6)
     ✓ emits RollMade event with correct fields 8ms
     ✓ applies computed shifts as stress when shifts > 0 1ms
     ✓ deals no stress on a miss (shifts <= 0) and still emits RollMade 2ms
     ✓ replay is deterministic — replaying events yields the same state 3ms
     ✓ rejects FateAttack when attacker is not the active entity 2ms
     ✓ rejects FateAttack on an ally 1ms
 ✓ packages/runtime/tests/advance/encounter-ended.test.ts (3 tests) 15ms
   ✓ M3 EncounterEnded (3)
     ✓ emits win when all enemies are dead 11ms
     ✓ emits loss when all pcs are dead 2ms
     ✓ Advance is a no-op once in resolution 1ms
 ✓ packages/runtime/tests/m4-fate/m4.chaos.test.ts (3 tests) 15ms
   ✓ M4 Chaos factor (integration) (3)
     ✓ starts at 5 4ms
     ✓ decreases by 1 on encounter win 6ms
     ✓ increases by 1 on encounter loss 3ms
 ✓ packages/engine/tests/m4-fate/m4.rng.test.ts (8 tests) 9ms
   ✓ M4 Fate RNG (8)
     ✓ produces the same rolls for the same seed and seq 1ms
     ✓ produces different rolls for different seeds 0ms
     ✓ produces different rolls for different seq numbers 0ms
     ✓ produces different rolls for different prefixes 0ms
     ✓ all results are in {-1, 0, +1} 5ms
     ✓ returns 4 dice by default with correct die names 1ms
     ✓ sumRolls sums die results 0ms
     ✓ produces a reasonably uniform distribution over many rolls 1ms
 ✓ packages/runtime/tests/advance/advance-iniative.test.ts (1 test) 7ms
   ✓ M3 Advance (initiative) (1)
     ✓ Advance in initiative moves phase to turn 6ms
 ✓ packages/runtime/tests/combat/event-log.test.ts (1 test) 7ms
   ✓ M2 event semantics (1)
     ✓ EndTurn emits TurnEnded and EncounterPointerSet but not ActiveEntitySet 6ms
 ✓ packages/runtime/tests/smoke-tests/smoke.test.ts (1 test) 9ms
   ✓ Milestone 1 smoke flow (1)
     ✓ creates game, adds entities, sets encounter mode, initiative, and advances turns 7ms
 ✓ packages/runtime/tests/combat/map-replay.test.ts (1 test) 6ms
   ✓ M2 replay includes encounter map (1)
     ✓ replay reconstructs map so Move actions exist 5ms
 ✓ packages/runtime/tests/authority/invariant-violation.test.ts (1 test) 5ms
   ✓ invariant enforcement (1)
     ✓ throws when ending a turn with no active entity 4ms
 ✓ packages/runtime/tests/end-to-end/end-to-end.test.ts (2 tests) 9ms
   ✓ M2 e2e: Move + Attack (2)
     ✓ Move updates the active entity position (adjacent zones only) 6ms
     ✓ Attack increments stress and defeats when stress >= maxStress 1ms
 ✓ packages/engine/tests/m1-authority/replay-determinism.test.ts (1 test) 4ms
   ✓ replay determinism (1)
     ✓ replaying the same events twice yields identical state 3ms
 ✓ packages/engine/tests/m1-authority/valid-actions.test.ts (3 tests) 2ms
   ✓ getValidActions (3)
     ✓ does not include end-turn in setup phase 1ms
     ✓ includes start-turn when in encounter mode, initiative set, and no active entity 0ms
     ✓ includes end-turn and excludes start-turn when an entity is active 0ms
 ✓ packages/engine/tests/m2-combat/m2.attack-move.test.ts (3 tests) 2ms
   ✓ M2 valid actions (zones) (3)
     ✓ includes Move actions to all adjacent zones for the active entity 1ms
     ✓ includes Attack only for opposing, alive targets in the same zone 0ms
     ✓ does not include Move or Attack if the map or positions are missing 0ms
 ✓ packages/engine/tests/m4-fate/m4.chaos.test.ts (4 tests) 2ms
   ✓ M4 Chaos factor (reducer) (4)
     ✓ decreases by 1 on win 1ms
     ✓ increases by 1 on loss 0ms
     ✓ does not go below 1 on win 0ms
     ✓ does not go above 9 on loss 0ms
```