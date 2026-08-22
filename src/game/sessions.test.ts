import { describe, expect, it } from 'vitest'
import { tradingDayAfter } from './calendar'
import { loadGame } from './testing'

/**
 * A Stock Market series, played the way the screen plays it: each session opens
 * on a placard, the marbles are released, and every entrant lands.
 */
async function playSeries(sessions: number, binsPerSession: readonly number[][]) {
  const { useGame, settlementOf } = await loadGame()
  useGame.getState().setMode('stock')
  // Dollar figures below assume every row is worth the same.
  useGame.getState().setVolatileRows(false)
  useGame.getState().setSettleRule('winner')
  useGame.getState().start()

  const days: { day: number; phaseAtOpen: string }[] = []

  for (let session = 0; session < sessions; session++) {
    const before = useGame.getState()
    days.push({ day: before.round.index + 1, phaseAtOpen: before.phase })

    useGame.getState().release()
    const ids = useGame.getState().round.entrantIds
    ids.forEach((id, i) => useGame.getState().recordLanding(id, binsPerSession[session][i]))

    if (session < sessions - 1) useGame.getState().startTieBreak()
  }

  const state = useGame.getState()
  return {
    days,
    round: state.round,
    seriesStart: state.seriesStart,
    settled: settlementOf(state.round, 'stock', 'winner').settled,
  }
}

describe('a Stock Market series', () => {
  it('opens every session on a placard, with the marbles held', async () => {
    // Two sessions: the first ties at the top, the second breaks it.
    const { days } = await playSeries(2, [
      [6, 6, 3, 4],
      [7, 5, 4, 4],
    ])

    expect(days).toEqual([
      { day: 1, phaseAtOpen: 'opening' },
      { day: 2, phaseAtOpen: 'opening' },
    ])
  })

  it('numbers the days from one, however long the series runs', async () => {
    const tie = [6, 6, 3, 4]
    const { days, round } = await playSeries(4, [tie, tie, tie, [7, 5, 4, 4]])

    expect(days.map((d) => d.day)).toEqual([1, 2, 3, 4])
    // Day numbering is the round's index, so it cannot drift from the history.
    expect(round.index + 1).toBe(4)
  })

  it('dates each session a trading day after the one before', async () => {
    const { days, seriesStart } = await playSeries(3, [
      [6, 6, 3, 4],
      [6, 6, 3, 4],
      [7, 5, 4, 4],
    ])

    const dates = days.map((d) => tradingDayAfter(new Date(seriesStart), d.day - 1))
    expect(dates).toHaveLength(3)

    // Day one is today, whatever today is — including a weekend, if that is when
    // the game is being played.
    expect(dates[0].toDateString()).toBe(new Date(seriesStart).toDateString())

    // Strictly forward, never the same day twice, and every day after the first
    // is one the market would actually be open on.
    expect(dates[1].getTime()).toBeGreaterThan(dates[0].getTime())
    expect(dates[2].getTime()).toBeGreaterThan(dates[1].getTime())
    for (const date of dates.slice(1)) {
      expect(date.getDay()).not.toBe(0)
      expect(date.getDay()).not.toBe(6)
    }
  })

  it('stops once the series settles', async () => {
    const { settled, round } = await playSeries(2, [
      [6, 6, 3, 4],
      [7, 5, 4, 4],
    ])

    expect(settled).toBe(true)
    expect(round.tieBreak).toBe(true)
  })

  it('starts a new series back at day one', async () => {
    const { useGame } = await loadGame()
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
    useGame.getState().start()
    useGame.getState().release()

    const ids = useGame.getState().round.entrantIds
    ids.forEach((id, i) => useGame.getState().recordLanding(id, [6, 6, 3, 4][i]))
    useGame.getState().startTieBreak()
    expect(useGame.getState().round.index + 1).toBe(2)

    // "New session" is a fresh series, not the next day of this one.
    useGame.getState().rematch()
    expect(useGame.getState().round.index + 1).toBe(1)
    expect(useGame.getState().round.tieBreak).toBe(false)
    expect(useGame.getState().history).toHaveLength(0)
  })

  it('drops straight away in Black Swan, which has no calendar', async () => {
    const { useGame } = await loadGame()
    useGame.getState().setMode('blackSwan')
    useGame.getState().start()
    expect(useGame.getState().phase).toBe('running')
  })

  it('ignores a release when no session is waiting on one', async () => {
    const { useGame } = await loadGame()
    useGame.getState().release()
    expect(useGame.getState().phase).toBe('setup')
  })
})
