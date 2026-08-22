import { describe, expect, it } from 'vitest'
import { binomialPmf } from './binomial'
import { START_PRICE, BASE_PER_PEG } from './modes'
import { seriesCandles, seriesOf, seriesTotals, seriesWalks } from './series'
import { loadGame } from './testing'
import type { Round } from './types'

/**
 * Plays a Stock Market series, landing every entrant in the given bin each day.
 * Returns the sessions in order, as the results panel sees them.
 */
async function playDays(binsPerDay: readonly number[][]) {
  const { useGame } = await loadGame()
  useGame.getState().setMode('stock')
  // Dollar figures below assume every row is worth the same.
  useGame.getState().setVolatileRows(false)
  useGame.getState().start()

  for (const [day, bins] of binsPerDay.entries()) {
    useGame.getState().release()
    const ids = useGame.getState().round.entrantIds
    // Flips that actually land in that bin, so the walk and the bin agree.
    ids.forEach((id, i) => {
      const bin = bins[i]
      const rows = useGame.getState().round.rows
      const flips = Array.from({ length: rows }, (_, row) => (row < bin ? 1 : -1))
      useGame.getState().recordLanding(id, bin, flips)
    })
    if (day < binsPerDay.length - 1) useGame.getState().startTieBreak()
  }

  const state = useGame.getState()
  return { sessions: seriesOf(state.history, state.round), ids: state.round.entrantIds }
}

/**
 * A session, built by hand.
 *
 * Four tests need a round with particular landings on it, and each was spelling
 * the whole shape out — nine fields, most of them the same nine every time. The
 * differences are what those tests are about, so only the differences are named
 * here.
 */
function sessionOf({
  rows = 4,
  entrantIds,
  landings,
  index = 0,
}: {
  rows?: number
  entrantIds: string[]
  landings: Round['landings']
  index?: number
}): Round {
  return {
    index,
    rows,
    entrantIds,
    landings,
    tieBreak: index > 0,
    rowMoves: Array.from({ length: rows }, () => BASE_PER_PEG),
    plan: {},
    openPrices: Object.fromEntries(entrantIds.map((id) => [id, START_PRICE])),
  }
}

/** A landing, with only the parts a series reads spelled out. */
function landingOf(playerId: string, bin: number, flips: number[]): Round['landings'][number] {
  return { playerId, bin, flips, probability: 0, deviation: 0, order: 0 }
}

describe('a series as one price history', () => {
  it('joins the sessions into one continuous line', async () => {
    const { sessions, ids } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const walks = seriesWalks(sessions, 'stock')
    const first = walks.find((walk) => walk.playerId === ids[0])!
    const rows = sessions[0].rows

    // One opening value, then every row of both days.
    expect(first.values).toHaveLength(rows * 2 + 1)
    expect(first.values[0]).toBe(START_PRICE)
    // No gap at the join: day two opens exactly where day one closed.
    expect(first.values[rows]).toBe(sessions[1].openPrices[ids[0]])
  })

  it('marks where each day begins', async () => {
    const tie = [6, 6, 4, 4]
    const { sessions } = await playDays([tie, tie, [7, 5, 4, 4]])
    const rows = sessions[0].rows

    for (const walk of seriesWalks(sessions, 'stock')) {
      expect(walk.dayBreaks).toEqual([rows, rows * 2])
    }
  })

  it('ends where the results table says the player ended', async () => {
    const { sessions, ids } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const walks = seriesWalks(sessions, 'stock')
    const last = sessions[sessions.length - 1]

    for (const id of ids) {
      const walk = walks.find((w) => w.playerId === id)!
      const closed = walk.values[walk.values.length - 1]
      const landing = last.landings.find((l) => l.playerId === id)!
      // The line's final point is the closing price the table shows. Two pegs to
      // a slot, and on a steady market every row is worth the same.
      const expected = last.openPrices[id] + (2 * landing.bin - last.rows) * BASE_PER_PEG
      expect(closed).toBeCloseTo(expected, 10)
    }
  })

  it('stops a line at a session with nothing recorded yet', () => {
    const rows = 4
    const landed = [landingOf('a', 3, [1, 1, 1, -1])]
    const walks = seriesWalks(
      [
        sessionOf({ entrantIds: ['a'], landings: landed }),
        sessionOf({ entrantIds: ['a'], landings: [], index: 1 }),
      ],
      'stock',
    )
    // Day one only: an unfinished day is not drawn as though it were flat.
    expect(walks[0].values).toHaveLength(rows + 1)
    expect(walks[0].dayBreaks).toEqual([])
  })
})

describe('a series as one longer drop', () => {
  it('adds the rows and the steps up', async () => {
    const { sessions, ids } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const totals = seriesTotals(sessions)

    expect(totals.rows).toBe(sessions[0].rows * 2)
    const first = totals.landings.find((l) => l.playerId === ids[0])!
    // Bin 6 then bin 7 is 13 steps right out of 20 rows.
    expect(first.bin).toBe(13)
    expect(first.flips).toHaveLength(totals.rows)
  })

  it('prices the total against the binomial for the whole series', async () => {
    const { sessions } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const totals = seriesTotals(sessions)
    const pmf = binomialPmf(totals.rows)

    for (const landing of totals.landings) {
      expect(landing.probability).toBeCloseTo(pmf[landing.bin], 12)
      expect(landing.deviation).toBeCloseTo(Math.abs(landing.bin - totals.rows / 2), 12)
    }
    // Odds over twenty rows, not over ten: a series total is rarer than a day's.
    expect(Math.max(...pmf)).toBeLessThan(Math.max(...binomialPmf(sessions[0].rows)))
  })

  it('leaves a single session exactly as it was', async () => {
    const { sessions } = await playDays([[6, 5, 4, 4]])
    const totals = seriesTotals(sessions)

    expect(totals.rows).toBe(sessions[0].rows)
    expect(totals.landings.map((l) => l.bin)).toEqual(sessions[0].landings.map((l) => l.bin))
  })

  it('drops anyone whose series is incomplete', () => {
    const partial = sessionOf({
      entrantIds: ['a', 'b'],
      landings: [landingOf('a', 2, [1, 1, -1, -1])],
    })

    const totals = seriesTotals([partial])
    expect(totals.landings.map((l) => l.playerId)).toEqual(['a'])
  })
})

describe('a series as one candle per player', () => {
  it('takes its four numbers from the walk', async () => {
    const { sessions, ids } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const candles = seriesCandles(sessions, 'stock')
    const walks = seriesWalks(sessions, 'stock')

    expect(candles).toHaveLength(walks.length)
    for (const candle of candles) {
      const { values } = walks.find((walk) => walk.playerId === candle.playerId)!
      expect(candle.open).toBe(values[0])
      expect(candle.close).toBe(values[values.length - 1])
      expect(candle.high).toBe(Math.max(...values))
      expect(candle.low).toBe(Math.min(...values))
    }
    expect(candles.map((c) => c.playerId).sort()).toEqual([...ids].sort())
  })

  it('never draws a body outside its own wick', () => {
    // What makes it a candle rather than two unrelated marks: the open and the
    // close are both prices the walk actually passed through.
    const session = sessionOf({
      entrantIds: ['a', 'b'],
      landings: [landingOf('a', 3, [1, 1, 1, -1]), landingOf('b', 1, [-1, -1, 1, -1])],
    })

    for (const candle of seriesCandles([session], 'stock')) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
    }
  })

  it('opens every candle at the price the series opened at', async () => {
    const { sessions } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    // Day one opened the whole field at $100, and a candle spans the series.
    for (const candle of seriesCandles(sessions, 'stock')) {
      expect(candle.open).toBe(START_PRICE)
    }
  })

  it('measures Black Swan in slots from the centre, opening at zero', () => {
    const session = sessionOf({ entrantIds: ['a'], landings: [landingOf('a', 4, [1, 1, 1, 1])] })

    const [candle] = seriesCandles([session], 'blackSwan')
    expect(candle.open).toBe(0)
    expect(candle.low).toBe(0)
    expect(candle.close).toBe(2)
    expect(candle.high).toBe(2)
  })
})
