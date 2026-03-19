import type { Collection, Db } from 'mongodb'
import type { GameState } from '@autarch/engine'
import type { IStateStore } from '../interfaces.js'

type StateDoc = GameState & { _id: string }

export class MongoStateStore implements IStateStore {
  private collection: Collection<StateDoc>

  constructor(db: Db, collectionName = 'states') {
    this.collection = db.collection<StateDoc>(collectionName)
  }

  async load(gameId: string): Promise<GameState | null> {
    const doc = await this.collection.findOne({ _id: gameId } as Partial<StateDoc>)
    if (!doc) return null
    // Strip the mongo _id before returning — GameState._id is our own string key
    return doc as unknown as GameState
  }

  async save(state: GameState): Promise<void> {
    await this.collection.replaceOne(
      { _id: state._id } as Partial<StateDoc>,
      state as unknown as StateDoc,
      { upsert: true },
    )
  }
}
