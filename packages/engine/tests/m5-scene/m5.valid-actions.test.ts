import { describe, it, expect } from 'vitest'
import { getValidActions } from '../../src/engine/valid-actions'
import { createInitialState } from '../../src/engine/state'
import type { GameState, Location } from '../../src/types/game'

function sceneState(overrides: Partial<GameState> = {}): GameState {
  const s = createInitialState('game-1', 1, '2024-01-01T00:00:00.000Z')
  s.runtime.mode = 'scene'
  s.scene = { locationId: null, locations: {} }
  return { ...s, ...overrides }
}

function makeLocation(id: string, connections: string[] = []): Location {
  return { id, name: `Location ${id}`, tags: [], aspects: [], connections }
}

function ids(actions: ReturnType<typeof getValidActions>): string[] {
  return actions.map((a) => a.id)
}

describe('M5 getValidActions — scene mode', () => {
  it('returns no scene actions when no current location is set', () => {
    const state = sceneState()
    const actions = getValidActions(state)
    expect(ids(actions)).not.toContain('travel')
    expect(ids(actions)).not.toContain('rest')
    expect(ids(actions)).not.toContain('search')
    expect(ids(actions)).not.toContain('interact')
  })

  it('returns rest and search when at a location', () => {
    const state = sceneState()
    state.scene!.locations['town'] = makeLocation('town')
    state.scene!.locationId = 'town'

    const actions = getValidActions(state)
    expect(ids(actions)).toContain('rest')
    expect(ids(actions)).toContain('search')
  })

  it('returns travel actions for each connected location', () => {
    const state = sceneState()
    state.scene!.locations['town'] = makeLocation('town', ['forest', 'cave'])
    state.scene!.locations['forest'] = makeLocation('forest', ['town'])
    state.scene!.locations['cave'] = makeLocation('cave', ['town'])
    state.scene!.locationId = 'town'

    const actions = getValidActions(state)
    const travelActions = actions.filter((a) => a.id === 'travel')
    expect(travelActions).toHaveLength(2)
    const destinations = travelActions.map((a) => (a.command as any).toLocationId)
    expect(destinations).toContain('forest')
    expect(destinations).toContain('cave')
  })

  it('does not include travel to locations not in scene graph even if listed in connections', () => {
    const state = sceneState()
    // 'ghost-location' is in connections but not in scene.locations
    state.scene!.locations['town'] = makeLocation('town', ['ghost-location'])
    state.scene!.locationId = 'town'

    const actions = getValidActions(state)
    expect(actions.filter((a) => a.id === 'travel')).toHaveLength(0)
  })

  it('returns interact action for each NPC at the current location', () => {
    const state = sceneState()
    state.scene!.locations['town'] = makeLocation('town')
    state.scene!.locationId = 'town'

    state.entities['npc-1'] = {
      id: 'npc-1',
      kind: 'npc',
      name: 'Old Merchant',
      status: { alive: true, conditions: [] },
      stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
      tags: [],
      position: { zoneId: 'town' },
    }
    state.entities['npc-2'] = {
      id: 'npc-2',
      kind: 'npc',
      name: 'Guard',
      status: { alive: true, conditions: [] },
      stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
      tags: [],
      position: { zoneId: 'forest' }, // different location — should not appear
    }

    const actions = getValidActions(state)
    const interactActions = actions.filter((a) => a.id === 'interact')
    expect(interactActions).toHaveLength(1)
    expect((interactActions[0].command as any).entityId).toBe('npc-1')
  })

  it('does not include interact for PCs or enemies', () => {
    const state = sceneState()
    state.scene!.locations['town'] = makeLocation('town')
    state.scene!.locationId = 'town'

    state.entities['pc-1'] = {
      id: 'pc-1',
      kind: 'pc',
      name: 'Hero',
      status: { alive: true, conditions: [] },
      stats: { stress: 0, maxStress: 6, aspects: [], resources: {} },
      tags: [],
      position: { zoneId: 'town' },
    }
    state.entities['e-1'] = {
      id: 'e-1',
      kind: 'enemy',
      name: 'Bandit',
      status: { alive: true, conditions: [] },
      stats: { stress: 0, maxStress: 3, aspects: [], resources: {} },
      tags: [],
      position: { zoneId: 'town' },
    }

    const actions = getValidActions(state)
    expect(actions.filter((a) => a.id === 'interact')).toHaveLength(0)
  })

  it('does not return scene actions in encounter mode', () => {
    const state = sceneState()
    state.runtime.mode = 'encounter'
    state.scene!.locations['town'] = makeLocation('town')
    state.scene!.locationId = 'town'

    const actions = getValidActions(state)
    expect(ids(actions)).not.toContain('travel')
    expect(ids(actions)).not.toContain('rest')
    expect(ids(actions)).not.toContain('search')
  })
})
