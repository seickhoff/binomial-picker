import { describe, expect, it } from 'vitest'
import {
  START_PRICE,
  closingPrice,
  formatPrice,
  netMove,
  priceAfterSteps,
  priceRange,
  trendOf,
} from './modes'
import { loadGame } from './testing'

describe('stock price arithmetic', () => {
  it('puts neighbouring slots exactly a dollar apart', () => {
    const rows = 10
    for (let bin = 1; bin <= rows; bin++) {
      const step = closingPrice(bin, rows, START_PRICE) - closingPrice(bin - 1, rows, START_PRICE)
      expect(step).toBe(1)
    }
  })

  it('measures the move from the centre slot', () => {
    expect(netMove(10, 10)).toBe(5)
    expect(netMove(0, 10)).toBe(-5)
    expect(netMove(5, 10)).toBe(0)
    expect(netMove(6, 10)).toBe(1)
  })

  it('closes at the open plus the net move', () => {
    expect(closingPrice(10, 10, START_PRICE)).toBe(105)
    expect(closingPrice(0, 10, START_PRICE)).toBe(95)
    expect(closingPrice(5, 10, START_PRICE)).toBe(100)
    // Carrying a price forward from a previous session.
    expect(closingPrice(7, 10, 104)).toBe(106)
  })

  it('moves half a slot per peg, arriving at the close', () => {
    // Six rights and four lefts over ten rows: net +2 steps, so +$1.
    expect(priceAfterSteps(START_PRICE, 2)).toBe(101)
    expect(priceAfterSteps(START_PRICE, -2)).toBe(99)
    // A single peg is 50 cents, and half-dollars are real prices mid-flight.
    expect(priceAfterSteps(START_PRICE, 1)).toBe(100.5)
    expect(formatPrice(priceAfterSteps(START_PRICE, 1))).toBe('$100.50')
    expect(formatPrice(START_PRICE)).toBe('$100')
    // Whatever the flips, the running total lands on the closing price.
    const rows = 10
    for (let bin = 0; bin <= rows; bin++) {
      expect(priceAfterSteps(START_PRICE, 2 * bin - rows)).toBe(
        closingPrice(bin, rows, START_PRICE),
      )
    }
  })

  it('bounds the round by the row count', () => {
    expect(priceRange(10, START_PRICE)).toEqual([95, 105])
    expect(priceRange(16, 120)).toEqual([112, 128])
  })

  it('reads direction for colouring', () => {
    expect(trendOf(3)).toBe('up')
    expect(trendOf(-3)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })
})

describe('scoring differs by mode', () => {
  /** bin 8 → $103, bin 2 → $97; both are equally improbable. */
  const BINS = [8, 2, 5, 5]

  async function playRound(mode: 'stock' | 'blackSwan') {
    const { useGame, winnersOf, rankRound } = await loadGame()
    useGame.getState().setMode(mode)
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds
    ids.forEach((id, i) => useGame.getState().recordLanding(id, BINS[i]))
    const { round, players } = useGame.getState()
    return { useGame, round, players, winnersOf, rankRound }
  }

  it('Stock Market picks the highest close outright', async () => {
    const { round, winnersOf } = await playRound('stock')
    const winners = winnersOf(round, 'stock')
    expect(winners).toHaveLength(1)
    expect(winners[0].bin).toBe(8)
  })

  it('Black Swan ties the two equally improbable landings', async () => {
    const { round, winnersOf } = await playRound('blackSwan')
    const winners = winnersOf(round, 'blackSwan')
    // bin 2 and bin 8 are mirror images, so they are exactly as rare.
    expect(winners.map((w) => w.bin).sort()).toEqual([2, 8])
  })

  it('ranks the same round differently in each mode', async () => {
    const stock = await playRound('stock')
    const swan = await playRound('blackSwan')
    const stockOrder = stock.rankRound(stock.round, stock.players, 'stock').map((e) => e.landing.bin)
    const swanOrder = swan.rankRound(swan.round, swan.players, 'blackSwan').map((e) => e.landing.bin)

    expect(stockOrder[0]).toBe(8)
    // Highest close first, so the centre bins beat the $94 loser.
    expect(stockOrder[stockOrder.length - 1]).toBe(2)
    // Rarest first, so the centre bins come last.
    expect(swanOrder.slice(0, 2).sort()).toEqual([2, 8])
  })

  it('reports open, close and change per player', async () => {
    const { round, players, rankRound } = await playRound('stock')
    const top = rankRound(round, players, 'stock')[0]
    expect(top.openPrice).toBe(START_PRICE)
    expect(top.closePrice).toBe(103)
    expect(top.change).toBe(3)
  })
})

describe('stock ties carry the price forward', () => {
  it('reopens the tied players at the price they reached', async () => {
    const { useGame, winnersOf } = await loadGame()
    useGame.getState().setMode('stock')
    useGame.getState().start()

    // Two players tie at $102, the others fall behind.
    const ids = useGame.getState().round.entrantIds
    const bins = [7, 7, 3, 4]
    ids.forEach((id, i) => useGame.getState().recordLanding(id, bins[i]))

    const tied = winnersOf(useGame.getState().round, 'stock')
    expect(tied).toHaveLength(2)

    useGame.getState().startTieBreak()
    const next = useGame.getState().round
    expect(next.tieBreak).toBe(true)
    // The whole field trades on, not just the two who tied.
    expect(next.entrantIds).toEqual(ids)
    // Everyone resumes from the price they reached, not from $100.
    expect(next.openPrices[ids[0]]).toBe(102)
    expect(next.openPrices[ids[1]]).toBe(102)
    expect(next.openPrices[ids[2]]).toBe(98)
    expect(next.openPrices[ids[3]]).toBe(99)
    expect(useGame.getState().phase).toBe('running')
  })

  it('has no shared price axis once the field is spread out', async () => {
    const { useGame, commonOpenPrice } = await loadGame()
    useGame.getState().setMode('stock')
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds

    // Opening round: everyone at $100, so a single price axis describes it.
    expect(commonOpenPrice(useGame.getState().round)).toBe(100)
    ;[7, 7, 3, 4].forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    useGame.getState().startTieBreak()

    // After hours: prices have diverged, so slots can only show the move.
    expect(commonOpenPrice(useGame.getState().round)).toBeNull()
  })

  it('lets a trailing stock win the after-hours session', async () => {
    const { useGame, rankRound, winnersOf } = await loadGame()
    useGame.getState().setMode('stock')
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds
    ;[7, 7, 3, 4].forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    useGame.getState().startTieBreak()

    // The stock that opened lowest ($98) rallies past the two leaders.
    useGame.getState().recordLanding(ids[0], 5) // 102 + 0
    useGame.getState().recordLanding(ids[1], 4) // 102 - 1
    useGame.getState().recordLanding(ids[2], 10) //  98 + 5
    useGame.getState().recordLanding(ids[3], 5) //  99 + 0

    const { round, players } = useGame.getState()
    const winners = winnersOf(round, 'stock')
    expect(winners).toHaveLength(1)
    expect(winners[0].playerId).toBe(ids[2])
    expect(rankRound(round, players, 'stock')[0].closePrice).toBe(103)
  })

  it('settles the second session from the carried price', async () => {
    const { useGame, rankRound } = await loadGame()
    useGame.getState().setMode('stock')
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds
    ;[7, 7, 3, 4].forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    useGame.getState().startTieBreak()

    const field = useGame.getState().round.entrantIds
    useGame.getState().recordLanding(field[0], 8) // 102 + 3
    useGame.getState().recordLanding(field[1], 4) // 102 - 1
    useGame.getState().recordLanding(field[2], 5) //  98 + 0
    useGame.getState().recordLanding(field[3], 5) //  99 + 0

    const { round, players } = useGame.getState()
    const ranked = rankRound(round, players, 'stock')
    expect(useGame.getState().phase).toBe('results')
    expect(ranked[0].closePrice).toBe(105)
    expect(ranked[0].openPrice).toBe(102)
    expect(ranked[1].closePrice).toBe(101)
  })
})

describe('settling both ends', () => {
  /** Lands the given bins and returns the resulting settlement. */
  async function play(
    mode: 'stock' | 'blackSwan',
    bins: number[],
    rule: 'winner' | 'winnerAndLoser' = 'winnerAndLoser',
  ) {
    const { useGame, settlementOf, rankRound } = await loadGame()
    useGame.getState().setMode(mode)
    useGame.getState().setSettleRule(rule)
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds
    bins.forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    const { round, players } = useGame.getState()
    return {
      useGame,
      ids,
      settlement: settlementOf(round, mode, rule),
      ranked: rankRound(round, players, mode),
    }
  }

  it('is settled when first and last are each one player', async () => {
    // $103, $102, $102, $99 — one clear top, one clear bottom, a tie between.
    const { settlement } = await play('stock', [8, 7, 7, 4])
    expect(settlement.settled).toBe(true)
    expect(settlement.winners).toHaveLength(1)
    expect(settlement.losers).toHaveLength(1)
  })

  it('allows the places in between to tie', async () => {
    const { settlement, ranked } = await play('stock', [8, 7, 7, 4])
    // Two players share second, which is fine.
    expect(ranked.filter((e) => e.rank === 1)).toHaveLength(2)
    expect(settlement.settled).toBe(true)
  })

  it('is unsettled when the top is level', async () => {
    // $103, $103, $100, $99 — joint first.
    const { settlement } = await play('stock', [8, 8, 5, 4])
    expect(settlement.settled).toBe(false)
    expect(settlement.winners).toHaveLength(2)
    expect(settlement.losers).toHaveLength(1)
  })

  it('is unsettled when only the bottom is level', async () => {
    // $103, $100, $99, $99 — clear winner, but joint last.
    const { settlement } = await play('stock', [8, 5, 4, 4])
    expect(settlement.settled).toBe(false)
    expect(settlement.winners).toHaveLength(1)
    expect(settlement.losers).toHaveLength(2)
  })

  it('is unsettled when the whole field is level', async () => {
    const { settlement } = await play('stock', [5, 5, 5, 5])
    expect(settlement.settled).toBe(false)
    expect(settlement.winners).toHaveLength(4)
    expect(settlement.losers).toHaveLength(4)
  })

  it('marks the bottom of the field', async () => {
    const { ranked } = await play('stock', [8, 7, 7, 4])
    expect(ranked.filter((e) => e.isLoser)).toHaveLength(1)
    expect(ranked[ranked.length - 1].isLoser).toBe(true)
    expect(ranked[0].isWinner).toBe(true)
  })

  it('sends the whole field again, in either mode', async () => {
    // Each leaves the bottom level, but "the bottom" differs by mode: the
    // lowest close in Stock Market, the *most likely* landing in Black Swan.
    const unsettled = { stock: [8, 5, 4, 4], blackSwan: [8, 5, 5, 4] } as const

    for (const mode of ['stock', 'blackSwan'] as const) {
      const { useGame, ids, settlement } = await play(mode, [...unsettled[mode]])
      expect(settlement.settled).toBe(false)
      expect(settlement.losers).toHaveLength(2)

      useGame.getState().startTieBreak()
      expect(useGame.getState().round.entrantIds).toEqual(ids)
      expect(useGame.getState().round.tieBreak).toBe(true)
    }
  })

  it('counts the most likely landing as last in Black Swan', async () => {
    // Rarest wins, so the centre bin is the wooden spoon. Bins must not be
    // mirror images of each other: bin 8 and bin 2 are exactly as rare.
    const { settlement, ranked } = await play('blackSwan', [9, 3, 5, 4])
    expect(settlement.settled).toBe(true)
    expect(ranked[0].landing.bin).toBe(9)
    expect(ranked[ranked.length - 1].landing.bin).toBe(5)
  })

  it('stops at a clear winner under the "winner" rule', async () => {
    // $103, $100, $99, $99 — joint last, which this rule does not care about.
    const { settlement } = await play('stock', [8, 5, 4, 4], 'winner')
    expect(settlement.settled).toBe(true)
    expect(settlement.pending).toBe('none')
    // The bottom is still reported, just not required to separate.
    expect(settlement.losers).toHaveLength(2)
  })

  it('keeps going on the same round under "winner and loser"', async () => {
    const { settlement } = await play('stock', [8, 5, 4, 4], 'winnerAndLoser')
    expect(settlement.settled).toBe(false)
    expect(settlement.pending).toBe('bottom')
  })

  it('still needs a clear top under the "winner" rule', async () => {
    const { settlement } = await play('stock', [8, 8, 5, 4], 'winner')
    expect(settlement.settled).toBe(false)
    expect(settlement.pending).toBe('top')
  })

  it('refuses to re-drop a settled round', async () => {
    const { useGame } = await play('stock', [8, 7, 7, 4])
    useGame.getState().startTieBreak()
    expect(useGame.getState().phase).toBe('results')
    expect(useGame.getState().round.tieBreak).toBe(false)
  })

  it('keeps going until both ends separate', async () => {
    const { useGame, settlementOf } = await loadGame()
    useGame.getState().setMode('stock')
    useGame.getState().setSettleRule('winnerAndLoser')
    useGame.getState().start()

    // Two sessions where the bottom stays level, then one that separates it.
    const sessions = [
      [8, 5, 4, 4],
      [8, 5, 5, 5],
      [8, 6, 5, 4],
    ]
    for (const bins of sessions) {
      const ids = useGame.getState().round.entrantIds
      bins.forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
      const settled = settlementOf(useGame.getState().round, 'stock', 'winnerAndLoser').settled
      if (!settled) useGame.getState().startTieBreak()
    }

    const final = settlementOf(useGame.getState().round, 'stock', 'winnerAndLoser')
    expect(final.settled).toBe(true)
    expect(useGame.getState().round.index).toBe(2)
  })
})

describe('the walk behind a landing', () => {
  it('traces one point per row, starting at the open', async () => {
    const { walkOf } = await import('./modes')
    // Six rights then four lefts: it peaks at +$3 after the run of rights, and
    // closes at +$1 — a 6–4 split is not break-even, because a peg is half a
    // slot and the net is +2 steps.
    const flips = [1, 1, 1, 1, 1, 1, -1, -1, -1, -1]
    const walk = walkOf(flips, START_PRICE, 'stock')

    expect(walk).toHaveLength(flips.length + 1)
    expect(walk[0]).toBe(START_PRICE)
    expect(Math.max(...walk)).toBe(103)
    expect(walk[walk.length - 1]).toBe(101)

    // Five and five is the flat case.
    const even = walkOf([1, 1, 1, 1, 1, -1, -1, -1, -1, -1], START_PRICE, 'stock')
    expect(even[even.length - 1]).toBe(START_PRICE)
  })

  it('moves half a slot per row, never a whole one', async () => {
    const { walkOf } = await import('./modes')
    const walk = walkOf([1, 1, -1, 1], START_PRICE, 'stock')
    for (let i = 1; i < walk.length; i++) {
      expect(Math.abs(walk[i] - walk[i - 1])).toBeCloseTo(0.5, 10)
    }
  })

  it('measures slots from the centre in Black Swan', async () => {
    const { walkOf } = await import('./modes')
    const walk = walkOf([1, 1, 1, 1], START_PRICE, 'blackSwan')
    // Four rights is two slots right of centre, and the open is zero.
    expect(walk[0]).toBe(0)
    expect(walk[walk.length - 1]).toBe(2)
  })

  it('ends where the landing says it did', async () => {
    const { useGame, rankRound } = await loadGame()
    const { walkOf, closingPrice } = await import('./modes')
    useGame.getState().setMode('stock')
    useGame.getState().start()

    const ids = useGame.getState().round.entrantIds
    // Eight rights and two lefts: bin 8 over ten rows.
    const flips = [1, 1, 1, 1, 1, 1, 1, 1, -1, -1]
    ids.forEach((id) => useGame.getState().recordLanding(id, 8, flips))

    const { round, players } = useGame.getState()
    const [top] = rankRound(round, players, 'stock')
    const walk = walkOf(top.landing.flips, top.openPrice, 'stock')
    expect(walk[walk.length - 1]).toBe(closingPrice(8, round.rows, top.openPrice))
    expect(walk[walk.length - 1]).toBe(top.closePrice)
  })
})

describe('tape percentages', () => {
  it('measures from the common start, not from this round', async () => {
    const { formatTapePercent } = await import('./modes')
    expect(formatTapePercent(102)).toBe('+2.00%')
    expect(formatTapePercent(98)).toBe('−2.00%')
    expect(formatTapePercent(START_PRICE)).toBe('0.00%')
    expect(formatTapePercent(100.5)).toBe('+0.50%')
  })

  it('gives the same figure to anyone on the same price', async () => {
    const { formatTapePercent, totalTrendOf } = await import('./modes')
    // The point of a common denominator: after hours these two carried in
    // different prices, but a tie on the close is a tie on the percentage.
    expect(formatTapePercent(103)).toBe(formatTapePercent(103))
    expect(totalTrendOf(103)).toBe('up')
    expect(totalTrendOf(97)).toBe('down')
    expect(totalTrendOf(START_PRICE)).toBe('flat')
  })

  it('reads the total, not the session, when a stock carried a price in', async () => {
    const { formatTapePercent, totalTrendOf } = await import('./modes')
    // Opened this session at $104 and fell to $102: down for the session, but
    // still up two percent on where it began.
    expect(formatTapePercent(102)).toBe('+2.00%')
    expect(totalTrendOf(102)).toBe('up')
  })
})
