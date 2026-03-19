import type { Collection, Db } from 'mongodb'
import type { GameEvent } from '@autarch/engine'
import type { IEventStore } from '../interfaces.js'

export class MongoEventStore implements IEventStore {
  private collection: Collection<GameEvent>

  constructor(db: Db, collectionName = 'events') {
    this.collection = db.collection<GameEvent>(collectionName)
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ gameId: 1, seq: 1 }, { unique: true })
  }

  async append(event: GameEvent): Promise<void> {
    await this.collection.insertOne(event as GameEvent & { _id?: unknown })
  }

  async list(gameId: string): Promise<GameEvent[]> {
    return this.collection.find({ gameId }).sort({ seq: 1 }).toArray()
  }

  async getLastSeq(gameId: string): Promise<number> {
    const doc = await this.collection.findOne({ gameId }, { sort: { seq: -1 }, projection: { seq: 1 } })
    return doc?.seq ?? 0
  }
}
