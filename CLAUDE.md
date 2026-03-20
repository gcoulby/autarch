# CLAUDE.md — Autarch Project

Read this fully before touching anything. Do not skim.

---

## What This Project Is

Autarch is a deterministic, event-sourced game engine for solo/GM-free tabletop RPGs. The target experience is Divinity: Original Sin or Baldur's Gate — open world scene exploration transitioning into structured turn-based combat — running locally with AI-generated narrative and no human GM.

The player controls their character. Everything else is driven by the engine, rule-based AI, and a local LLM for narration only.

This is a test-driven codebase. Every mechanic gets tests before or alongside implementation.

---

## Actual Repository Structure

```
autarch/
  packages/
    engine/           # Types, domain (reducer, replay, invariants, RNG, oracle), valid-actions, basic-ai
    runtime/          # Orchestrator — dispatches commands, creates events
    persistence/      # IEventStore / IStateStore interfaces + MemoryEventStore, MemoryStateStore, MongoDB stubs
    knowledge-graph/  # IWorldGraph interface + MemoryWorldGraph
    vector-store/     # INarrativeStore interface + MemoryVectorStore
    context/          # ContextModelService (M8) — assembles prompts from all four data sources
    llm/              # NarrativeService (M9), GPT4AllClient, StubLLMClient
    ui/               # shadcn/ui component library
    tailwind-config/  # Shared design tokens and CSS variables
    eslint-config/    # Shared lint config
    typescript-config/
  apps/
    web/              # Next.js — the actual game UI (running, not a stub)
    docs/             # Boilerplate — do not touch
```

The `apps/docs` directory is boilerplate. Do not touch it.

---

## What Is Actually Built

### M1 — Authority (complete)
- `Orchestrator.dispatch(gameId, command)` and `loadState(gameId)` in `packages/runtime`
- `IEventStore` / `IStateStore` interfaces in `packages/persistence`, with `MemoryEventStore` and `MemoryStateStore`
- `applyEvent(state, event)` — pure reducer, no side effects (`packages/engine/src/domain/reducer.ts`)
- `replay(gameId, events)` — derives state from event log
- `createInitialState` — canonical empty state factory
- `assert`, `requireEntity`, `InvariantError` in `domain/invariants.ts`

### M2 — Combat (complete)
- Zone-based encounter map (`EncounterMap`, `Zone` with adjacency lists)
- `Move` command — validates adjacency, emits `EntityMoved`
- `Attack` command — melee only (same zone), flat 1 damage, emits `EntityDamaged`
- Defeat condition: `stress >= maxStress` sets `status.alive = false`
- `getValidActions(state)` — returns legal `ActionDescriptor[]`

### M3 — Advance (complete)
- `Advance` command — system-driven state progression
- Handles initiative→turn transition, starting turns, running AI turns, encounter end detection
- `EncounterEnded` event with `win`/`loss` result
- Basic rule-based AI (`engine/src/engine/ai/basic-ai.ts`): BFS toward closest opponent, attack if in same zone, end turn otherwise

### M4 — Fate Mechanics (complete)
- `rng.ts`: FNV-1a + Mulberry32 PRNG — `rollFateDice(seed, seq, count, prefix)` returns `RollResult[]`, `rollD6Pair()` for oracle
- `Skill { id, name, rating }` and `Stunt { id, name, description, skillId? }` on `Entity.stats`
- `Aspect.consequenceSeverity?: 'mild' | 'moderate' | 'severe'`
- `GameState.meta.seed` — stored for orchestrator dice rolls
- Event types: `RollMade`, `AspectInvoked`, `AspectCompelled`
- Commands: `FateAttack` (4dF+Fight vs 4dF+Athletics, emits `RollMade` always, `EntityDamaged` on positive shifts), `InvokeAspect`, `CompelAspect`, `TakeConsequence`
- Chaos factor: `EncounterEnded win` → `max(1, chaos-1)`, loss → `min(9, chaos+1)`

### M5 — Scene Mode (complete)
- `Location { id, name, tags, aspects, connections }` and `SceneState { locationId, locations }`
- `scene?: SceneState` on `GameState` — persists across mode switches
- Event types: `SceneStarted`, `LocationAdded`, `LocationChanged`, `LocationAspectAdded`, `Rested`, `Interacted`, `SceneEnded`
- Commands: `AddLocation`, `SetLocation` (setup teleport), `Travel` (validates connections), `Rest` (restores PC stress via EntityPatched), `Search` (adds discovered aspect with 1 free invoke), `Interact` (validates NPC at current location), `EndScene` (success/failure, updates chaos)
- `getValidActions` extended for scene mode: travel per connection, rest, search, interact per NPC at current location
- Entity `position.zoneId` doubles as locationId in scene mode — intentional

### M6 — AI Oracle (complete)
- `domain/oracle.ts`: pure `resolveOracle(d1, d2, likelihood, chaos)` → `OracleResult`, `isRandomEvent(d1, d2, chaos)`
- `OracleLikelihood`: `'very-likely' | 'likely' | '50-50' | 'unlikely' | 'very-unlikely'`
- `OracleResult`: `'exceptional-yes' | 'yes-and' | 'yes' | 'no-but' | 'no' | 'exceptional-no'`
- `AskOracle` command rolls 2d6 via seeded RNG, resolves deterministically, emits `OracleAnswered`
- Random event fires alongside oracle answer when `die1 === die2 && die1 <= chaos`, emits `RandomEventTriggered`
- Oracle result is in the event payload — the LLM narrates it, does not decide it

### M7 — Persistence (partially complete)
- Interface layer in `packages/persistence/src/interfaces.ts` (`IEventStore`, `IStateStore`)
- `MemoryEventStore` and `MemoryStateStore` — used everywhere currently
- MongoDB stubs exist (`MongoEventStore`, `MongoStateStore`) but are not wired in and are untested at runtime
- `MemoryWorldGraph` in `packages/knowledge-graph` — in-memory node/edge store, used in the web app
- `MemoryVectorStore` in `packages/vector-store` — in-memory cosine-similarity store, used in the web app

### M8 — Context Model Service (complete)
- `packages/context/src/ContextModelService.ts` — assembles `ContextModel` from all four data sources
- `packages/context/src/prompt.ts` — `toPrompt(model)` serialises to a compact prompt string
- `packages/context/src/summarize.ts` — `summarizeEvent(event)` produces human-readable event summaries
- The service is read-only. It never writes to any store.

### M9 — LLM Integration (complete)
- `packages/llm/src/NarrativeService.ts` — orchestrates: build context → serialise → call LLM → store narrative
- `packages/llm/src/clients/GPT4AllClient.ts` — OpenAI-compatible REST client (works with GPT4All, LM Studio, Ollama, llama.cpp)
- `packages/llm/src/clients/StubLLMClient.ts` — returns deterministic placeholder text, used when no LLM URL is configured
- `ILLMClient` interface — swap implementations without touching the rest of the stack

### M10 — Web App (substantially complete, but with known gaps — see below)
- `apps/web/app/page.tsx` — main layout, top bar, mode routing
- `apps/web/app/hooks/useGame.ts` — `useGame()` hook managing game session, dispatch, and narration
- `apps/web/app/lib/game.ts` — singletons: `orchestrator`, `contextService`, `makeNarrativeService(url?)`
- `apps/web/app/components/SceneView.tsx` — location card, NPC list, connections, character sidebar, known locations
- `apps/web/app/components/EncounterView.tsx` — zone map with occupants, initiative tracker, combatant stress bars
- `apps/web/app/components/NarrativePanel.tsx` — narrative display with loading state and prompt inspector
- `apps/web/app/components/ActionPanel.tsx` — action buttons with inline forms for oracle, search, and end-scene
- `apps/web/app/components/ChaosMeter.tsx` — chaos factor visualisation
- `apps/web/app/components/LlmSettings.tsx` — LLM URL configuration

---

## Architecture

```
┌────────────────────────────────────────┐
│             apps/web                    │
│  Next.js — scene + encounter UI        │
│  useGame() -> dispatch() -> Orchestrator│
└──────────────┬─────────────────────────┘
               | Commands / State reads
┌──────────────v─────────────────────────┐
│          packages/runtime               │
│  Orchestrator.dispatch()               │
│  The sole path for state mutation      │
└──────────────┬─────────────────────────┘
               | Event append / replay
┌──────────────v─────────────────────────┐
│          packages/engine                │
│  applyEvent reducer (pure)             │
│  getValidActions                       │
│  domain: rng, oracle, invariants       │
└──────────────┬─────────────────────────┘
               |
┌──────────────v─────────────────────────┐
│  packages/persistence                   │  packages/knowledge-graph
│  IEventStore / IStateStore             │  IWorldGraph
│  Memory implementations (current)      │  MemoryWorldGraph (current)
│  MongoDB stubs (not yet active)        │
└──────────────┬─────────────────────────┘
               |                          packages/vector-store
               |                          INarrativeStore
               |                          MemoryVectorStore (current)
┌──────────────v─────────────────────────┐
│          packages/context               │
│  ContextModelService.build()           │
│  Read-only — no writes                 │
│  Assembles ContextModel from all stores│
└──────────────┬─────────────────────────┘
               | ContextModel -> toPrompt()
┌──────────────v─────────────────────────┐
│          packages/llm                   │
│  NarrativeService.narrate()            │
│  GPT4AllClient | StubLLMClient         │
│  Generates narrative text only         │
└────────────────────────────────────────┘
```

### Non-negotiable boundaries

- The engine is the sole arbiter of legal actions. Nothing mutates game state except through `Orchestrator.dispatch()`.
- The LLM generates narrative text only. It does not decide what happens. The engine decides; the LLM describes it.
- `ContextModelService` is read-only. It never appends events, saves state, or writes to any store.
- The web app dispatches commands and renders state. Zero game rules live in the UI.
- `applyEvent` is a pure function. No async, no I/O, no `Date.now()`, no `Math.random()` — ever.

---

## Package Import Map

| Import | Package | Notes |
|---|---|---|
| `@autarch/engine` | `packages/engine` | Types, reducer, replay, RNG, oracle, valid-actions, basic-ai |
| `@autarch/runtime` | `packages/runtime` | `Orchestrator`, `Command` type |
| `@autarch/persistence` | `packages/persistence` | `IEventStore`, `IStateStore`, `MemoryEventStore`, `MemoryStateStore` |
| `@autarch/knowledge-graph` | `packages/knowledge-graph` | `IWorldGraph`, `MemoryWorldGraph` |
| `@autarch/vector-store` | `packages/vector-store` | `INarrativeStore`, `MemoryVectorStore` |
| `@autarch/context` | `packages/context` | `ContextModelService`, `toPrompt`, `ContextModel` |
| `@autarch/llm` | `packages/llm` | `NarrativeService`, `GPT4AllClient`, `StubLLMClient` |

After changing `packages/engine` source, rebuild before tests pick it up:
```bash
pnpm --filter @autarch/engine build
```

---

## Known Problems in the Web App

Fix these before building new features.

### 1. No game setup flow

When a new game is created, the player lands in `scene` mode with no character, no location, and no entities. The only actions available are oracle and end-scene, dispatching against a blank context.

There is no way through the UI to add a player character, add a starting location, or place the PC at it. This is why the game feels broken immediately after creating one.

Fix: add a setup wizard or inline setup panel that activates when scene mode is active and no PC entity or scene location exists. Minimum required inputs: character name, starting location name. Optionally: aspects, skills. On confirm, dispatch `AddEntity`, `AddLocation`, `SetLocation` in sequence. Only show the normal scene actions once this is complete.

Note: `AddEntity` requires `phase === 'setup'`. The game starts in setup phase, so this is valid immediately. Do not advance the phase before setup is complete.

### 2. The LLM narrates too broadly and too often

`NarrativeService.narrate()` is called after every dispatch, rebuilding the full context prompt each time. The prompt covers everything — mode, chaos, player, location, NPCs, encounter, recent events, oracle — and asks the model to "narrate the current moment."

For a slow local model on CPU this means multiple seconds of wait per action. The model tends to regenerate a general scene description rather than reacting to what just happened, because the prompt gives it no focus.

Fix: add a `triggerEvent` field to `BuildOptions` and surface it in `toPrompt()` as a focused directive at the bottom, replacing the generic "Narrate the current moment" with something like `NARRATE THIS EVENT: Kira travelled from Market Square to The Docks`. This dramatically reduces model wandering.

Additionally, only call `narrate()` for semantically meaningful events. Skip it for purely mechanical ones:
- Call narrate for: `Travel`, `Interact`, `OracleAnswered`, `FateAttack`, `EntityDamaged`, `EncounterEnded`, `Rest`, `Search`, `SceneEnded`
- Skip narrate for: `GameCreated`, `ModeSet`, `SetPhase`, `AddEntity`, `AddLocation`, `SetLocation`, `InitiativeSet`, `SetEncounterMap`

### 3. Oracle likelihood values are wrong

`ActionPanel.tsx` defines `LIKELIHOOD_OPTIONS` with values `'certain'`, `'nearly-certain'`, `'likely'`, `'fifty-fifty'`, `'unlikely'`, `'nearly-impossible'`, `'impossible'`. These do not match `OracleLikelihood` in `packages/engine/src/domain/oracle.ts`, which is `'very-likely' | 'likely' | '50-50' | 'unlikely' | 'very-unlikely'`.

The command is currently cast with `as any`, so it dispatches without a type error. The orchestrator then silently fails to find the likelihood modifier and produces a broken adjusted value.

Fix: replace the `LIKELIHOOD_OPTIONS` array in `ActionPanel.tsx` with the five correct values. Remove the `as any` cast.

```typescript
const LIKELIHOOD_OPTIONS = [
  { value: 'very-likely',   label: 'Very Likely' },
  { value: 'likely',        label: 'Likely' },
  { value: '50-50',         label: '50/50' },
  { value: 'unlikely',      label: 'Unlikely' },
  { value: 'very-unlikely', label: 'Very Unlikely' },
] as const
```

### 4. Oracle result is not shown in the UI

When `AskOracle` succeeds, the `OracleAnswered` event payload contains: the question, the oracle result (`yes`, `no-but`, etc.), the die values, the chaos modifier, and whether a random event fired. None of this is surfaced to the player — they only see what the LLM generates, which may not make the mechanical result clear.

Fix: after an oracle dispatch, read the last `OracleAnswered` event from the event store and display the result as a distinct UI element — separate from LLM prose. Show at minimum: question, result label (e.g. "YES, BUT..."), and a random event indicator if triggered. This is the game decision the engine made. The narrative supplements it; it does not replace it.

### 5. Narrative history is not preserved

Each narration call replaces `session.narrative`. The player cannot see what happened earlier in the session.

Fix: change `session.narrative` from `string` to `NarrativeEntry[]` where:
```typescript
interface NarrativeEntry {
  text: string
  eventType: string
  ts: string
}
```
Append each new narration rather than replacing. Render as a scrollable list in `NarrativePanel`, newest at the bottom, auto-scrolling on new entries.

### 6. New game can be created while a game is active

`createGame()` immediately overwrites the current session with no confirmation.

Fix: if a session exists, prompt the player to confirm before creating a new game.

---

## Test Structure

Tests are split between packages:

```
packages/engine/tests/
  m1-authority/         # replay-determinism, valid-actions
  m2-combat/            # attack-move
  m4-fate/              # chaos (reducer), rng
  m5-scene/             # valid-actions (scene mode)
  m6-oracle/            # oracle resolution

packages/runtime/tests/
  advance/              # advance, advance-initiative, encounter-ended
  authority/            # invariant-violation
  combat/               # ai, ai-guard, event-log, map-replay, end-to-end
  end-to-end/
  m4-fate/              # aspects, chaos (integration), consequences, fate-attack
  m5-scene/             # scene (integration)
  m6-oracle/            # oracle (integration)
  smoke-tests/
  helpers.ts            # makeEntity(), setupEncounter(), shared stores

packages/context/tests/context.test.ts
packages/knowledge-graph/tests/memory.test.ts
packages/vector-store/tests/memory.test.ts
packages/llm/tests/narrative.test.ts
packages/persistence/tests/memory.test.ts
packages/persistence/tests/mongodb.test.ts   # requires running MongoDB
```

### Test conventions

- Vitest throughout
- `describe` per feature, `it` per observable behaviour
- Test names describe the outcome: `'AI moves closer when not in the same zone'`
- Use helpers from `packages/runtime/tests/helpers.ts`: `makeEntity()`, `setupEncounter()`
- Extend helpers when a pattern repeats across more than two tests
- No wall-clock time in tests — fixed ISO strings for all timestamps
- Replay determinism tests required for any mechanic that touches the reducer
- Engine tests import from `@autarch/engine` (built dist) — rebuild after source changes
- Runtime tests import from `@autarch/runtime` directly

---

## Coding Standards

### Non-negotiable

1. Tests first or alongside. No new mechanic ships without coverage.
2. `applyEvent` is pure. No async, no I/O, no randomness, no `Date.now()`, no `Math.random()`.
3. Commands produce events, events mutate state. Nothing else.
4. All randomness is seeded and recorded in `GameEvent.rng`. The reducer reads stored rolls, never calls the RNG itself.
5. Use `assert(condition, message)` from `domain/invariants.ts` for guard clauses. Not raw `Error`.
6. TypeScript strict mode. No `any` without a comment. No `as any` to paper over type mismatches — fix the types.
7. No logic in `apps/web`. The UI dispatches commands and renders state.

### Milestone discipline

Do not implement a milestone unless explicitly asked. Adding types or interfaces for a future milestone is fine. Full implementation waits for explicit instruction.

### File locations

```
packages/engine/src/
  domain/       # Pure functions: reducer, replay, invariants, rng, oracle
  engine/       # valid-actions, state, ai/basic-ai
  types/        # TypeScript types (game.ts, index.ts, actions.ts) — no logic
  index.ts      # Re-exports everything

packages/runtime/src/
  orchestrator.ts   # Orchestrator class, Command type
  index.ts

packages/persistence/src/
  interfaces.ts         # IEventStore, IStateStore
  memory/               # MemoryEventStore, MemoryStateStore
  mongodb/              # MongoEventStore, MongoStateStore (stubs)
  index.ts
```

---

## Running the Project

```bash
# Install
pnpm install

# Run all tests
pnpm test:run

# Run engine tests only
pnpm --filter @autarch/engine test:run

# Run runtime tests only
pnpm --filter @autarch/runtime test:run

# Build engine (required after source changes before runtime/web pick them up)
pnpm --filter @autarch/engine build

# Run the web app
pnpm --filter web dev

# Run a specific test file
pnpm --filter @autarch/runtime vitest run tests/m4-fate/m4.aspects.test.ts
```

---

## Planned Milestones

Do not implement these unless explicitly asked.

### M11 — Real Persistence

Replace in-memory stores with durable backends.

**MongoDB**: wire up `MongoEventStore` and `MongoStateStore`. Make them configurable via `MONGO_URI` environment variable. The `MemoryEventStore`/`MemoryStateStore` remain as the default when no URI is set.

**Knowledge Graph**: a Neo4j implementation behind `IWorldGraph`. `MemoryWorldGraph` stays as the dev default.

**Vector Store**: ChromaDB or Qdrant behind `INarrativeStore`. `MemoryVectorStore` stays as the dev default.

All three implement existing interfaces. Engine and context service do not change.

### M12 — Character Creation UI

A proper in-game creation flow dispatching `AddEntity`, `AddLocation`, `SetLocation`.

- Character name, high concept aspect, trouble aspect
- Skill selection (Fate pyramid: one at +4, two at +3, three at +2, four at +1)
- Starting location name and optional NPC
- Must complete before normal scene actions are available

### M13 — Encounter Setup UI

A flow to configure and enter combat from scene mode.

- Define zones and adjacency
- Place enemies in zones
- Set initiative order
- Dispatches `SetEncounterMap`, `AddEntity`, `SetInitiative`, `SetMode`

### M14 — Inventory and Items

Items as typed objects. Inventory on Entity. Commands to pick up, drop, use, trade. Not yet scoped in detail.

---

## Technology Decisions

| Concern | Decision |
|---|---|
| Monorepo | Turborepo + PNPM workspaces |
| Language | TypeScript strict, ESM throughout |
| Test runner | Vitest (per-package and root configs) |
| UI framework | Next.js (`apps/web`) |
| UI components | shadcn/ui (`packages/ui`) + Tailwind |
| Design tokens | `packages/tailwind-config` — CSS custom properties |
| Local LLM | OpenAI-compatible REST API (GPT4All, LM Studio, Ollama, llama.cpp) |
| Knowledge graph | `MemoryWorldGraph` (now), Neo4j interface available |
| Document DB | Memory stores (now), MongoDB stubs ready |
| Vector DB | `MemoryVectorStore` (now), ChromaDB/Qdrant interface available |
| RNG | FNV-1a + Mulberry32, seeded per event sequence number |