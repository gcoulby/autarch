'use client'

import { useMemo, useState } from 'react'
import { Button } from '@autarch/ui/components/ui/button'
import styles from './page.module.css'

import { Orchestrator } from '@autarch/runtime'
import { EventStore } from '@autarch/persistence'
import type { Entity, GameEvent, GameState, EncounterMap } from '@autarch/engine'
import { Card, CardContent, CardHeader } from '@autarch/ui/components/ui/card'

function pretty(x: unknown) {
  return JSON.stringify(x, null, 2)
}

function makeDemoMap(): EncounterMap {
  return {
    zones: {
      a: { id: 'a', name: 'Zone A', adjacent: ['b'] },
      b: { id: 'b', name: 'Zone B', adjacent: ['a'] },
    },
  } as any
}

function makePc(id: string, zoneId: string): Entity {
  return {
    id,
    kind: 'pc',
    name: 'PC-1',
    status: { alive: true, conditions: [] },
    position: { zoneId },
    stats: {},
  } as any
}

function makeEnemy(id: string, zoneId: string): Entity {
  return {
    id,
    kind: 'enemy',
    name: 'Enemy-1',
    status: { alive: true, conditions: [] },
    position: { zoneId },
    stats: {},
  } as any
}

export default function Home() {
  const eventStore = useMemo(() => new EventStore(), [])
  const orch = useMemo(() => new Orchestrator(eventStore), [eventStore])

  const [gameId, setGameId] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refresh(id: string) {
    const [s, e] = await Promise.all([orch.loadState(id), eventStore.list(id)])
    setState(s)
    setEvents(e)
  }

  async function createGame() {
    setError(null)
    try {
      const id = crypto.randomUUID()
      await orch.dispatch(id, { type: 'CreateGame', schemaVersion: 1, seed: 'web-demo' })
      setGameId(id)
      await refresh(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function setupEncounter() {
    if (!gameId) return
    setError(null)
    try {
      const pcId = 'pc-1'
      const enemyId = 'enemy-1'

      await orch.dispatch(gameId, { type: 'SetMode', mode: 'encounter' })
      await orch.dispatch(gameId, { type: 'SetEncounterMap', map: makeDemoMap() })

      await orch.dispatch(gameId, { type: 'AddEntity', entity: makePc(pcId, 'a') })
      await orch.dispatch(gameId, { type: 'AddEntity', entity: makeEnemy(enemyId, 'a') })

      await orch.dispatch(gameId, { type: 'SetInitiative', order: [pcId, enemyId] })
      await orch.dispatch(gameId, { type: 'SetPhase', phase: 'initiative' })

      await refresh(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function startTurn() {
    if (!gameId) return
    setError(null)
    try {
      await orch.dispatch(gameId, { type: 'StartTurn' })
      await refresh(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function attack() {
    if (!gameId) return
    setError(null)
    try {
      await orch.dispatch(gameId, { type: 'Attack', attackerId: 'pc-1', targetId: 'enemy-1' })
      await refresh(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function endTurn() {
    if (!gameId) return
    setError(null)
    try {
      await orch.dispatch(gameId, { type: 'EndTurn' })
      await refresh(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Card className="p-4">
          <CardHeader></CardHeader>
          <CardContent className="flex gap-10 p-4">
            <Button className="bg-muted hover:bg-muted/40 p-2 cursor-pointer" onClick={createGame}>
              Create game
            </Button>
            <Button className="bg-muted hover:bg-muted/40 p-2 cursor-pointer" onClick={setupEncounter} disabled={!gameId}>
              Setup encounter
            </Button>
            <Button className="bg-muted hover:bg-muted/40 p-2 cursor-pointer" onClick={startTurn} disabled={!gameId}>
              Start turn
            </Button>
            <Button className="bg-muted hover:bg-muted/40 p-2 cursor-pointer" onClick={attack} disabled={!gameId}>
              Attack
            </Button>
            <Button className="bg-muted hover:bg-muted/40 p-2 cursor-pointer" onClick={endTurn} disabled={!gameId}>
              End turn
            </Button>
          </CardContent>
        </Card>
        <div className={styles.ctas} style={{ gap: 10 }}></div>

        {error ? <pre style={{ whiteSpace: 'pre-wrap', padding: 12, border: '1px solid #f00' }}>{error}</pre> : null}

        <h3 style={{ marginTop: 24 }}>Session</h3>
        <pre style={{ padding: 12, border: '1px solid #333' }}>{pretty({ gameId, eventCount: events.length })}</pre>

        <h3 style={{ marginTop: 24 }}>GameState</h3>
        <pre style={{ padding: 12, border: '1px solid #333', overflow: 'auto', maxHeight: 340 }}>{state ? pretty(state) : 'No state yet'}</pre>

        <h3 style={{ marginTop: 24 }}>Events</h3>
        <pre style={{ padding: 12, border: '1px solid #333', overflow: 'auto', maxHeight: 340 }}>
          {events.length ? pretty(events) : 'No events yet'}
        </pre>
      </main>
    </div>
  )
}
