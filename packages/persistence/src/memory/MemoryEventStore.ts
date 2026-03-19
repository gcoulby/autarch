import type { GameEvent } from '@autarch/engine'
import type { IEventStore } from '../interfaces.js'

export class MemoryEventStore implements IEventStore {
  private events: GameEvent[] = []

  async append(event: GameEvent): Promise<void> {
    this.events.push(event)
  }

  async list(gameId: string): Promise<GameEvent[]> {
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
