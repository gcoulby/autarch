export type { IEventStore, IStateStore } from './interfaces.js'

export { MemoryEventStore } from './memory/MemoryEventStore.js'
export { MemoryStateStore } from './memory/MemoryStateStore.js'

export { MongoEventStore } from './mongodb/MongoEventStore.js'
export { MongoStateStore } from './mongodb/MongoStateStore.js'

// Backward-compatible aliases — the orchestrator and existing tests import these names
export { MemoryEventStore as EventStore } from './memory/MemoryEventStore.js'
export { MemoryStateStore as StateStore } from './memory/MemoryStateStore.js'
