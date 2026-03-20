# Autarch

> **⚠ EXPERIMENT — READ THIS FIRST**
>
> This project was built as an experiment in using LLMs and agentic coding tools (Claude Code) to design and implement a non-trivial software system from scratch. The architecture, engine, test suite, persistence layer, LLM integration, and web UI were all produced through iterative prompting sessions — not written by hand.
>
> The codebase is in active development and has known gaps. It is shared as a record of what that process produces, not as a polished product. If something is broken, that is probably why.

---

A deterministic, event-sourced game engine for solo / GM-free tabletop RPGs, built on the [Fate](https://fate-srd.com/) system. The goal is a Divinity: Original Sin / Baldur's Gate style experience — open world scene exploration transitioning into structured turn-based combat — running entirely locally with a local LLM generating the narrative and no human GM required.

The player controls their character. Everything else is driven by the engine, rule-based AI, and the local model.

---

## Running it

```bash
docker-compose up -d --build
```

Then open [http://localhost:3000](http://localhost:3000).

That single command starts:

| Service | What it does |
|---|---|
| `web` | Next.js game UI on port 3000 |
| `ollama` | Local LLM server on port 11434 |
| `ollama-init` | Pulls the default model (`mistral`) on first run |
| `mongo` | MongoDB on port 27017 (persistence, not yet wired into the app) |
| `neo4j` | Neo4j on port 7474 / 7687 (knowledge graph, not yet wired in) |
| `qdrant` | Qdrant vector store on port 6333 (narrative memory, not yet wired in) |

The first run will take a few minutes while Ollama downloads the model. Subsequent starts are fast.

### Changing the model

Edit `.env` (copy from `.env.example`):

```bash
OLLAMA_MODEL=llama3.2:3b   # faster, lighter
# OLLAMA_MODEL=phi3:mini   # very fast, ~2 GB
# OLLAMA_MODEL=mistral     # default, better quality, ~4 GB
```

Then restart:

```bash
docker-compose up -d --build
```

### GPU acceleration (NVIDIA)

Uncomment the `deploy` block in `docker-compose.yml` under the `ollama` service:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

### Without Docker

```bash
pnpm install
pnpm --filter @autarch/engine build
pnpm --filter web dev
```

You will need to point the app at an LLM server manually. Set `NEXT_PUBLIC_LLM_URL` to any OpenAI-compatible endpoint — GPT4All, LM Studio, Ollama running locally, llama.cpp server, etc. If the variable is not set, the app uses a stub that returns placeholder text so the engine still runs.

---

## What it does

The engine is a fully deterministic, event-sourced rules kernel. Every game action produces events, events are stored in a log, and state is always derived by replaying that log. This means any game session is perfectly reproducible given its initial seed.

The LLM only ever narrates — it reads the context model and produces prose. It never decides what happens. The engine decides; the model describes it.

### Scene mode

The player explores a location graph. Each location has aspects (descriptive Fate-style phrases), connected exits, and potentially NPCs. Available actions: travel to connected locations, rest (restores stress), search (discovers a new aspect), interact with NPCs, or ask the oracle.

### The oracle

The solo RPG oracle answers yes/no questions using the Fate chaos mechanic. The player asks a question and sets a likelihood. The engine rolls 2d6 with seeded RNG, applies the chaos modifier, and resolves to one of: exceptional-yes, yes-and, yes, no-but, no, exceptional-no. The chaos factor increases when scenes go badly and decreases when they go well, so higher chaos means more unpredictable and dramatic outcomes. If both dice show the same face and that value is at or below the chaos factor, a random event fires alongside the answer.

The engine decides the result. The LLM narrates it.

### Encounter / combat

Zone-based turn-order combat using Fate dice (4dF). The player's character and enemies take turns. Enemies are driven by a rule-based AI: move toward the closest opponent via BFS, attack if in the same zone, end turn otherwise. Attacks roll 4dF + Fight skill vs 4dF + Athletics skill; the difference in shifts is applied as stress. Stress at or above max stress defeats the entity.

### Chaos factor

Starts at 5. Decreases (min 1) when the player wins an encounter or ends a scene successfully. Increases (max 9) on loss or failure. Affects oracle odds throughout.

---

## Architecture

```
apps/web          Next.js UI — dispatches commands, renders state
packages/runtime  Orchestrator — the only path to mutate game state
packages/engine   Rules kernel — reducer (pure), RNG, oracle, valid-actions, AI
packages/persistence  EventStore / StateStore (memory now, MongoDB stubs ready)
packages/knowledge-graph  World graph (memory now, Neo4j interface ready)
packages/vector-store     Narrative store (memory now, Qdrant interface ready)
packages/context  ContextModelService — assembles LLM prompts, read-only
packages/llm      NarrativeService, GPT4AllClient, StubLLMClient
packages/ui       shadcn/ui component library
```

The engine is the sole arbiter of what is and is not a legal action. Nothing bypasses `Orchestrator.dispatch()`. The LLM has no write access to anything.

---

## Development

```bash
pnpm install

# Run all tests
pnpm test:run

# Watch mode
pnpm test:watch

# After changing packages/engine source, rebuild before tests pick it up
pnpm --filter @autarch/engine build
```

The codebase is test-driven. Tests live in `packages/engine/tests/` and `packages/runtime/tests/`, organised by milestone. Every mechanic has coverage. Do not ship mechanics without tests.

---

## Stack

- **Monorepo**: Turborepo + PNPM workspaces
- **Language**: TypeScript strict, ESM throughout
- **Tests**: Vitest
- **UI**: Next.js, Tailwind, shadcn/ui
- **LLM**: Any OpenAI-compatible local server (default: Ollama + Mistral)
- **Persistence**: MongoDB (stubbed), Neo4j (stubbed), Qdrant (stubbed) — all currently in-memory

---

## Known gaps

The web UI is functional but incomplete. There is no character creation or world setup flow — the game starts in an empty state and requires manual engine commands to populate a character and starting location. Oracle likelihood values in the UI are currently mismatched against the engine types. Narrative history is not preserved across actions. These are documented in `CLAUDE.md` for the next development session.