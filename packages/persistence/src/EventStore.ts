import type { GameEvent } from '@autarch/engine'

export class EventStore {
  constructor(private events: GameEvent[] = []) {}

  async append(event: GameEvent): Promise<void> {
    this.events.push(event)
  }

  async list(gameId: string): Promise<GameEvent[]> {
    // return a copy so callers can’t mutate internal store by accident
    return this.events
      .filter((e) => e.gameId === gameId)
      .slice()
      .sort((a, b) => a.seq - b.seq)
  }

  async getLastSeq(gameId: string): Promise<number> {
    let max = 0
    for (const e of this.events) {
      if (e.gameId === gameId && e.seq > max) max = e.seq
    }
    return max
  }
}
