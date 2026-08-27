import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_VOLATILITY, MAX_VOLATILITY_CENTS } from './modes'
import { STORAGE_KEY, loadGame } from './testing'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the volatility bands', () => {
  it('keeps a band the right way round, whatever is typed into it', async () => {
    const { useGame } = await loadGame()

    // A high end under the low one would be a range nothing can be drawn from.
    useGame.getState().setVolatilityBand('mid', [20, 3])
    expect(useGame.getState().volatility.mid).toEqual([20, 20])

    useGame.getState().setVolatilityBand('calm', [2, 9])
    expect(useGame.getState().volatility.calm).toEqual([2, 9])
  })

  it('takes whole cents, inside the ceiling', async () => {
    const { useGame } = await loadGame()

    useGame.getState().setVolatilityBand('wild', [-5, 7.6])
    expect(useGame.getState().volatility.wild).toEqual([0, 8])

    useGame.getState().setVolatilityBand('wild', [0, 4000])
    expect(useGame.getState().volatility.wild).toEqual([0, MAX_VOLATILITY_CENTS])
  })

  it('puts the shipped bands back', async () => {
    const { useGame } = await loadGame()

    useGame.getState().setVolatilityBand('calm', [40, 41])
    useGame.getState().resetVolatility()
    expect(useGame.getState().volatility).toEqual(DEFAULT_VOLATILITY)
  })

  it('leaves the other two alone', async () => {
    const { useGame } = await loadGame()
    const before = useGame.getState().volatility

    useGame.getState().setVolatilityBand('mid', [7, 8])
    expect(useGame.getState().volatility.calm).toEqual(before.calm)
    expect(useGame.getState().volatility.wild).toEqual(before.wild)
  })
})

describe('roster persistence', () => {
  it('writes renamed players to localStorage', async () => {
    const { storage, useGame } = await loadGame()
    const [first] = useGame.getState().players
    useGame.getState().renamePlayer(first.id, 'Ada')

    const saved = JSON.parse(storage.get(STORAGE_KEY) ?? '{}')
    expect(saved.state.players[0].name).toBe('Ada')
  })

  it('remembers names and sit-outs across a reload', async () => {
    const session = await loadGame()
    const players = session.useGame.getState().players
    session.useGame.getState().renamePlayer(players[0].id, 'Ada')
    session.useGame.getState().renamePlayer(players[1].id, 'Grace')
    session.useGame.getState().setPlayerActive(players[2].id, false)
    session.useGame.getState().setRows(14)
    const persisted = session.storage.get(STORAGE_KEY)
    expect(persisted).toBeDefined()

    const reloaded = await loadGame(persisted)
    const restored = reloaded.useGame.getState()
    expect(restored.players.map((p) => p.name).slice(0, 2)).toEqual(['Ada', 'Grace'])
    expect(restored.players[2].active).toBe(false)
    expect(restored.rows).toBe(14)
    // A reload always lands back on setup, never mid-round.
    expect(restored.phase).toBe('setup')
  })

  it('does not persist an in-flight round', async () => {
    const session = await loadGame()
    session.useGame.getState().start()
    expect(session.useGame.getState().phase).toBe('running')

    const reloaded = await loadGame(session.storage.get(STORAGE_KEY))
    expect(reloaded.useGame.getState().phase).toBe('setup')
    expect(reloaded.useGame.getState().round.landings).toHaveLength(0)
  })

  it('treats a roster saved before sit-out existed as all active', async () => {
    const legacy = JSON.stringify({
      version: 0,
      state: {
        rows: 10,
        dropMode: 'together',
        showLabels: true,
        fancyGraphics: true,
        players: [
          { id: 'p1', slot: 0, name: 'Ada' },
          { id: 'p2', slot: 1, name: 'Grace' },
        ],
      },
    })
    const { useGame } = await loadGame(legacy)
    expect(useGame.getState().players.every((p) => p.active)).toBe(true)
    expect(useGame.getState().canStart()).toBe(true)
  })

  it('keeps new players from colliding with restored ids', async () => {
    const session = await loadGame()
    session.useGame.getState().addPlayer()
    const persisted = session.storage.get(STORAGE_KEY)

    const reloaded = await loadGame(persisted)
    reloaded.useGame.getState().addPlayer()
    const ids = reloaded.useGame.getState().players.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('roster size', () => {
  it('grows to the maximum and stops', async () => {
    const { useGame } = await loadGame()
    const { MAX_PLAYERS } = await import('./palette')
    for (let i = 0; i < MAX_PLAYERS + 5; i++) useGame.getState().addPlayer()

    const { players } = useGame.getState()
    expect(players).toHaveLength(MAX_PLAYERS)
    expect(new Set(players.map((p) => p.id)).size).toBe(MAX_PLAYERS)
    expect(new Set(players.map((p) => p.slot)).size).toBe(MAX_PLAYERS)
  })

  it('gives every player a distinct color, and a distinct number', async () => {
    const { useGame } = await loadGame()
    const { colorForSlot, MAX_PLAYERS } = await import('./palette')
    for (let i = 0; i < MAX_PLAYERS; i++) useGame.getState().addPlayer()

    const { players } = useGame.getState()
    expect(players).toHaveLength(MAX_PLAYERS)
    // No repeats: a full roster never sees the same color twice.
    expect(new Set(players.map((p) => colorForSlot(p.slot).hex)).size).toBe(MAX_PLAYERS)
    expect(new Set(players.map((p) => colorForSlot(p.slot).label)).size).toBe(MAX_PLAYERS)
    // Slot numbers are the identity channel, so they must never repeat either.
    expect(new Set(players.map((p) => p.slot + 1)).size).toBe(players.length)
  })

  it('never drops below the minimum roster', async () => {
    const { useGame } = await loadGame()
    const { MIN_PLAYERS } = await import('./palette')
    for (const p of [...useGame.getState().players]) useGame.getState().removePlayer(p.id)
    expect(useGame.getState().players).toHaveLength(MIN_PLAYERS)
  })
})

describe('sitting a round out', () => {
  it('leaves inactive players out of the round', async () => {
    const { useGame } = await loadGame()
    const players = useGame.getState().players
    useGame.getState().setPlayerActive(players[1].id, false)
    useGame.getState().start()

    const { round } = useGame.getState()
    expect(round.entrantIds).not.toContain(players[1].id)
    expect(round.entrantIds).toHaveLength(players.length - 1)
  })

  it('still finishes the round with a player sitting out', async () => {
    const { useGame } = await loadGame()
    const players = useGame.getState().players
    useGame.getState().setPlayerActive(players[0].id, false)
    useGame.getState().start()

    for (const id of useGame.getState().round.entrantIds) {
      useGame.getState().recordLanding(id, 3)
    }
    expect(useGame.getState().phase).toBe('results')
  })

  it('refuses to start with fewer than two players in', async () => {
    const { useGame } = await loadGame()
    const players = useGame.getState().players
    for (const p of players.slice(1)) useGame.getState().setPlayerActive(p.id, false)

    expect(useGame.getState().canStart()).toBe(false)
    useGame.getState().start()
    expect(useGame.getState().phase).toBe('setup')
  })

  it('ignores a landing from someone who is not in the round', async () => {
    const { useGame } = await loadGame()
    const players = useGame.getState().players
    useGame.getState().setPlayerActive(players[3].id, false)
    useGame.getState().start()
    useGame.getState().recordLanding(players[3].id, 5)
    expect(useGame.getState().round.landings).toHaveLength(0)
  })
})

describe('the round a start draws', () => {
  it('plans one flip per row of the board, for every entrant', async () => {
    const { useGame } = await loadGame()
    useGame.getState().setRows(7)
    useGame.getState().start()

    const { round } = useGame.getState()
    expect(round.rows).toBe(7)
    for (const id of round.entrantIds) {
      expect(round.plan[id]).toHaveLength(7)
    }
  })

  it('plays out to the bin each plan chose', async () => {
    const { useGame } = await loadGame()
    const { binOf } = await import('./rounds')
    useGame.getState().setRows(6)
    useGame.getState().start()

    const { round } = useGame.getState()
    for (const id of round.entrantIds) {
      useGame.getState().recordLanding(id, binOf(round.plan[id] ?? []), round.plan[id])
    }

    const played = useGame.getState()
    expect(played.phase).toBe('results')
    for (const landing of played.round.landings) {
      expect(landing.bin).toBe(binOf(round.plan[landing.playerId] ?? []))
      expect(landing.bin).toBeLessThanOrEqual(6)
    }
  })

  it('re-draws a tie-break at the same depth', async () => {
    const { useGame } = await loadGame()
    useGame.getState().setRows(5)
    useGame.getState().start()

    // Everyone level, so the round cannot settle on its own.
    for (const id of useGame.getState().round.entrantIds) {
      useGame.getState().recordLanding(id, 2)
    }
    useGame.getState().startTieBreak()

    const { round } = useGame.getState()
    expect(round.tieBreak).toBe(true)
    expect(round.rows).toBe(5)
    for (const id of round.entrantIds) expect(round.plan[id]).toHaveLength(5)
  })
})
