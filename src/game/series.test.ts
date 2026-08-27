import { describe, expect, it } from 'vitest'
import { binomialPmf } from './binomial'
import { START_PRICE, BASE_PER_PEG } from './modes'
import { scoredRound, seriesCandles, seriesOf, seriesTotals, seriesWalks } from './series'
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
 * Plays a Black Swan series, landing every entrant in the given bin each day.
 *
 * Returns the store, so a test can ask what it settled on as well as what it
 * scored. Black Swan has no placard, so `release` is a no-op here — the drop
 * begins the moment the session opens.
 */
async function playSwanDays(binsPerDay: readonly number[][]) {
  const game = await loadGame()
  const { useGame } = game
  useGame.getState().setMode('blackSwan')
  useGame.getState().setSettleRule('winner')
  useGame.getState().start()

  for (const [day, bins] of binsPerDay.entries()) {
    const ids = useGame.getState().round.entrantIds
    ids.forEach((id, i) => {
      const bin = bins[i]
      const rows = useGame.getState().round.rows
      const flips = Array.from({ length: rows }, (_, row) => (row < bin ? 1 : -1))
      useGame.getState().recordLanding(id, bin, flips)
    })
    if (day < binsPerDay.length - 1) useGame.getState().startTieBreak()
  }

  const { history, round } = useGame.getState()
  return { ...game, history, round, ids: round.entrantIds }
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
    jitter: {},
    openPrices: Object.fromEntries(entrantIds.map((id) => [id, START_PRICE])),
  }
}

/** Flips that land in `bin`: the rights taken first. */
const pathOf = (bin: number, rows: number) =>
  Array.from({ length: rows }, (_, row) => (row < bin ? 1 : -1))

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

describe('a Black Swan series as sessions multiplied together', () => {
  /*
   * Ten rows, so dead center is bin 5. Bin 8 is three slots right and bin 2 is
   * three slots left, and the two are exactly as likely — 1 in 23 each — which is
   * the tie a fresh drop can go on producing for ever.
   */
  const chanceOf = (bin: number) => binomialPmf(10)[bin]
  const seriesOdds = (scored: Round, id: string) =>
    scored.landings.find((l) => l.playerId === id)!.probability

  it('multiplies a stray in, whichever way it went', async () => {
    // Player one strays three right, then three left. Player two strays three
    // right, then finds the middle.
    const { history, round, ids } = await playSwanDays([
      [8, 8, 5, 5],
      [2, 5, 5, 5],
    ])
    const scored = scoredRound(history, round, 'blackSwan')

    // Laid end to end the first player would be at bin 10 of 20 — dead center,
    // the likeliest place on the board, having strayed twice to get there.
    expect(seriesOdds(scored, ids[0])).toBeCloseTo(chanceOf(8) * chanceOf(2), 15)
    expect(seriesOdds(scored, ids[1])).toBeCloseTo(chanceOf(8) * chanceOf(5), 15)
    // Rarer is better, and two strays beat one.
    expect(seriesOdds(scored, ids[0])).toBeLessThan(seriesOdds(scored, ids[1]))
  })

  it('picks the player who strayed and came back over the one who settled', async () => {
    const { history, round, ids, settlementOf } = await playSwanDays([
      [8, 8, 5, 5],
      [2, 5, 5, 5],
    ])
    const series = settlementOf(scoredRound(history, round, 'blackSwan'), 'blackSwan', 'winner')

    expect(series.settled).toBe(true)
    expect(series.winners.map((w) => w.playerId)).toEqual([ids[0]])
  })

  it('does not care which side of the board a stray was on', async () => {
    // One goes right then left, the other right then right. Same two chances.
    const { history, round, ids } = await playSwanDays([
      [8, 8, 5, 5],
      [2, 8, 5, 5],
    ])
    const scored = scoredRound(history, round, 'blackSwan')

    expect(seriesOdds(scored, ids[0])).toBe(seriesOdds(scored, ids[1]))
  })

  it('keeps the bin and the distance on the board in front of you', async () => {
    const { history, round, ids } = await playSwanDays([
      [8, 8, 5, 5],
      [2, 5, 5, 5],
    ])
    const scored = scoredRound(history, round, 'blackSwan')
    const landing = scored.landings.find((l) => l.playerId === ids[0])!

    // Today's slot, on today's board — only the odds speak for the series.
    expect(scored.rows).toBe(round.rows)
    expect(landing.bin).toBe(2)
    expect(landing.deviation).toBe(3)
  })

  it('gives two players with the same run the same figure, whatever its order', () => {
    /*
     * On a 24-row board these four sessions multiply to a different double
     * depending on the order they are taken in — 1.2368465701858982e-7 one way,
     * …898e-7 the other — and a tie is decided by comparing for equality.
     */
    const runs = { a: [6, 6, 8, 8], b: [8, 8, 6, 6] }
    const sessions = runs.a.map((_, day) =>
      sessionOf({
        rows: 24,
        entrantIds: ['a', 'b'],
        index: day,
        landings: (['a', 'b'] as const).map((id) =>
          landingOf(id, runs[id][day], pathOf(runs[id][day], 24)),
        ),
      }),
    )
    const scored = scoredRound(sessions.slice(0, -1), sessions[sessions.length - 1], 'blackSwan')

    expect(seriesOdds(scored, 'a')).toBe(seriesOdds(scored, 'b'))
  })

  it('settles the series rather than the day', async () => {
    const { history, round, useGame } = await playSwanDays([
      [8, 8, 5, 5],
      [2, 5, 5, 5],
    ])
    expect(history).toHaveLength(1)

    // Settled, so the store refuses another session — the game is over.
    useGame.getState().startTieBreak()
    expect(useGame.getState().round.index).toBe(round.index)
  })

  it('still ties a field that stayed level, which is honest', async () => {
    // Two players, the same two chances each. Nothing separates them.
    const { history, round, settlementOf } = await playSwanDays([
      [8, 2, 5, 5],
      [8, 2, 5, 5],
    ])
    const series = settlementOf(scoredRound(history, round, 'blackSwan'), 'blackSwan', 'winner')

    expect(series.settled).toBe(false)
    expect(series.winners).toHaveLength(2)
  })

  it('leaves day one exactly as it was', async () => {
    const { history, round } = await playSwanDays([[8, 2, 5, 5]])
    expect(history).toHaveLength(0)
    expect(scoredRound(history, round, 'blackSwan')).toBe(round)
  })

  it('leaves Stock Market alone, whose price carried on the round already', async () => {
    const { sessions } = await playDays([
      [6, 6, 4, 4],
      [7, 5, 4, 4],
    ])
    const today = sessions[sessions.length - 1]
    expect(scoredRound(sessions.slice(0, -1), today, 'stock')).toBe(today)
  })

  it('draws every session as its own drop from the center', async () => {
    const { history, round } = await playSwanDays([
      [8, 2, 5, 5],
      [8, 8, 5, 5],
    ])
    const [walk] = seriesWalks(seriesOf(history, round), 'blackSwan')

    // Day two opens back at dead center, because that is where its marble was
    // released — nothing about day one is carried into the line.
    expect(walk.values[0]).toBe(0)
    expect(walk.values[walk.dayBreaks[0]]).toBe(3)
    expect(walk.values[walk.dayBreaks[0] + 1]).toBe(0.5)
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

  it('measures Black Swan in slots from the center, opening at zero', () => {
    const session = sessionOf({ entrantIds: ['a'], landings: [landingOf('a', 4, [1, 1, 1, 1])] })

    const [candle] = seriesCandles([session], 'blackSwan')
    expect(candle.open).toBe(0)
    expect(candle.low).toBe(0)
    expect(candle.close).toBe(2)
    expect(candle.high).toBe(2)
  })
})
