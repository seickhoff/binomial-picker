import { describe, expect, it } from 'vitest'
import { formatOddsCompact } from './binomial'
import {
  START_PRICE,
  BASE_PER_PEG,
  closeOf,
  formatPrice,
  priceRange,
  slotLabel,
  slotOffset,
  trendOf,
  walkOf,
} from './modes'
import { loadGame } from './testing'
import type { SettleRule } from './types'

/** Flips that land in `bin` over `rows`: the rights first, then the lefts. */
const pathTo = (bin: number, rows: number) =>
  Array.from({ length: rows }, (_, row) => (row < bin ? 1 : -1))

/** Every row worth the same, the way the game prices things with volatility off. */
const steady = (rows: number) => Array.from({ length: rows }, () => BASE_PER_PEG)

/**
 * What a landing in `bin` closes at on a steady market.
 *
 * Stated as the relationship rather than a figure, deliberately: the scale of a
 * row has changed twice now, and every test that spelled its answer out in
 * dollars had to be recomputed by hand each time. This has to be rewritten only
 * if the rule changes — two pegs to a slot, one row's worth per peg.
 */
const closeAt = (bin: number, rows: number, openPrice = START_PRICE) =>
  // In cents, like the game does it: adding nickels in floating point drifts, and
  // a test that drifts differently from the code it checks proves nothing.
  (Math.round(openPrice * 100) + (2 * bin - rows) * Math.round(BASE_PER_PEG * 100)) / 100

describe('stock price arithmetic, with every row worth the same', () => {
  const rows = 10
  const flat = steady(rows)

  it('puts neighboring slots exactly two pegs apart', () => {
    for (let bin = 1; bin <= rows; bin++) {
      const step =
        closeOf(pathTo(bin, rows), START_PRICE, { rowMoves: flat }) -
        closeOf(pathTo(bin - 1, rows), START_PRICE, { rowMoves: flat })
      expect(step).toBeCloseTo(2 * BASE_PER_PEG, 10)
    }
  })

  it('measures position from the center slot', () => {
    expect(slotOffset(10, 10)).toBe(5)
    expect(slotOffset(0, 10)).toBe(-5)
    expect(slotOffset(5, 10)).toBe(0)
    expect(slotOffset(6, 10)).toBe(1)
  })

  it('closes at the open plus the net move', () => {
    expect(closeOf(pathTo(10, rows), START_PRICE, { rowMoves: flat })).toBeCloseTo(
      closeAt(10, rows),
      10,
    )
    expect(closeOf(pathTo(0, rows), START_PRICE, { rowMoves: flat })).toBeCloseTo(
      closeAt(0, rows),
      10,
    )
    // Half and half is the open, exactly.
    expect(closeOf(pathTo(5, rows), START_PRICE, { rowMoves: flat })).toBeCloseTo(START_PRICE, 10)
    // Carrying a price forward from a previous session.
    expect(closeOf(pathTo(7, rows), 104, { rowMoves: flat })).toBeCloseTo(closeAt(7, rows, 104), 10)
  })

  it('moves the row it is crossing per peg, arriving at the close', () => {
    const walk = walkOf(pathTo(6, rows), START_PRICE, 'stock', { rowMoves: flat })
    expect(walk[0]).toBe(START_PRICE)
    expect(walk[1]).toBeCloseTo(START_PRICE + BASE_PER_PEG, 10)
    // A quote board always shows the cents, even on a round number.
    expect(formatPrice(START_PRICE)).toBe('$100.00')
    // The walk ends exactly where the close says it does.
    for (let bin = 0; bin <= rows; bin++) {
      const path = pathTo(bin, rows)
      const steps = walkOf(path, START_PRICE, 'stock', { rowMoves: flat })
      expect(steps).toHaveLength(rows + 1)
      expect(steps[steps.length - 1]).toBe(closeOf(path, START_PRICE, { rowMoves: flat }))
    }
  })

  it('bounds the round by the rows it has to cross', () => {
    const [low, high] = priceRange(START_PRICE, flat)
    expect(low).toBeCloseTo(START_PRICE - rows * BASE_PER_PEG, 10)
    expect(high).toBeCloseTo(START_PRICE + rows * BASE_PER_PEG, 10)
    // Every row one way is the widest it goes, whatever the open.
    expect(priceRange(120, steady(16))[1]).toBeCloseTo(120 + 16 * BASE_PER_PEG, 10)
  })

  it('prices a slot from the lattice, a dollar at a time', () => {
    const label = (bin: number) => slotLabel({ mode: 'stock', bin, rows, openPrice: START_PRICE })
    expect(label(10)).toBe(formatPrice(closeAt(10, rows)))
    expect(label(5)).toBe(formatPrice(START_PRICE))
    // No shared open, so a slot can only be a move.
    expect(slotLabel({ mode: 'stock', bin: 10, rows, openPrice: null })).toBe(
      `+$${(rows * BASE_PER_PEG).toFixed(2)}`,
    )
  })

  it('writes a slot on the ladder in the currency its mode pays in', async () => {
    const { ladderLabel } = await import('./modes')
    const { binomialPmf } = await import('./binomial')
    const pmf = binomialPmf(rows)
    const label = (mode: 'stock' | 'blackSwan', bin: number) =>
      ladderLabel({ mode, bin, rows, openPrice: START_PRICE, chance: pmf[bin] })

    // Stock Market pays dollars, so the ladder says what the slot closes at.
    expect(label('stock', 10)).toBe(formatPrice(closeAt(10, rows)))
    // Black Swan pays improbability, so it says how unlikely the slot is — and
    // never a bin number, which means nothing without knowing the board.
    expect(label('blackSwan', 10)).toBe(formatOddsCompact(pmf[10]))
    expect(label('blackSwan', 10)).not.toBe('10')
  })

  it('reads direction for coloring', () => {
    expect(trendOf(3)).toBe('up')
    expect(trendOf(-3)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })
})

describe('stock price arithmetic, with volatility on top of the base', () => {
  const rows = 4
  // A quiet start, then the day gets away from everyone.
  // Figures a draw could actually produce: one from inside each band.
  const CALM = 0.02
  const MID = 0.08
  const WILD = 0.2
  const market = [BASE_PER_PEG + CALM, BASE_PER_PEG + MID, BASE_PER_PEG + WILD, BASE_PER_PEG + CALM]

  it('adds the drawn cents to the base move, in the direction taken', () => {
    // All four rows right: four base moves, plus what each row drew.
    const total = market.reduce((sum, step) => sum + step, 0)
    expect(closeOf([1, 1, 1, 1], START_PRICE, { rowMoves: market })).toBeCloseTo(
      START_PRICE + total,
      10,
    )
    expect(closeOf([-1, -1, -1, -1], START_PRICE, { rowMoves: market })).toBeCloseTo(
      START_PRICE - total,
      10,
    )
    // The dollars are still the lattice's: four pegs is two slots, two dollars.
    expect(closeOf([1, 1, 1, 1], START_PRICE, { rowMoves: market }) - START_PRICE).toBeGreaterThan(
      2,
    )
    expect(closeOf([1, 1, 1, 1], START_PRICE, { rowMoves: market }) - START_PRICE).toBeLessThan(2.5)
  })

  it("adds each player's own penny whichever way their marble went", () => {
    // Two players, the same market, mirror-image paths: level on the lattice and
    // level on the shared rows, so only their own pennies can separate them.
    const flat = { rowMoves: [BASE_PER_PEG, BASE_PER_PEG] }
    const lucky = { ...flat, jitter: [0.01, 0.01] }
    const unlucky = { ...flat, jitter: [-0.01, -0.01] }

    expect(closeOf([1, -1], START_PRICE, lucky)).toBeCloseTo(START_PRICE + 0.02, 10)
    expect(closeOf([1, -1], START_PRICE, unlucky)).toBeCloseTo(START_PRICE - 0.02, 10)
    // Added to the price, not to the size of the move: a marble that went left
    // wears its penny the same way as one that went right.
    expect(closeOf([-1, 1], START_PRICE, lucky)).toBeCloseTo(START_PRICE + 0.02, 10)
  })

  it('separates a bin that the shared rows leave level', () => {
    const market = { rowMoves: [BASE_PER_PEG, BASE_PER_PEG, BASE_PER_PEG, BASE_PER_PEG] }
    const level = [1, 1, -1, -1]
    const tied = closeOf(level, START_PRICE, market)
    const nudged = closeOf(level, START_PRICE, { ...market, jitter: [0, 0.01, 0, 0] })

    expect(tied).toBe(START_PRICE)
    expect(nudged).toBeCloseTo(START_PRICE + 0.01, 10)
  })

  it('closes two marbles in the same bin a few cents apart', () => {
    // Both end level — two rows each way — but only one caught the wild row going
    // the right way. This is the whole difference the setting makes.
    const caughtIt = closeOf([1, -1, 1, -1], START_PRICE, { rowMoves: market })
    const missedIt = closeOf([-1, 1, -1, 1], START_PRICE, { rowMoves: market })

    expect(caughtIt).toBeGreaterThan(missedIt)
    // Cents apart, not dollars: the base cancels out for a level marble.
    expect(caughtIt).toBeCloseTo(START_PRICE + (WILD - MID), 10)
    expect(missedIt).toBeCloseTo(START_PRICE - (WILD - MID), 10)
    expect(caughtIt - missedIt).toBeLessThan(0.25)
  })

  it('still prices the slots in whole dollars, since the lattice has not changed', () => {
    const label = (bin: number) => slotLabel({ mode: 'stock', bin, rows, openPrice: START_PRICE })
    // A slot is a dollar whatever the market did; the cents are the marble's own.
    expect(label(4)).toBe('$102.00')
    expect(label(2)).toBe('$100.00')
    expect(label(0)).toBe('$98.00')
  })

  it('gives every player the same distribution of closes', () => {
    /*
     * The fairness of the whole idea, stated as a sum: a player's close depends
     * only on their own flips against row values everyone shares. So the set of
     * closes reachable is identical for everyone, and so are their chances.
     */
    const paths = [
      [1, 1, -1, -1],
      [-1, -1, 1, 1],
      [1, -1, -1, 1],
    ]
    for (const path of paths) {
      const mirrored = path.map((flip) => -flip)
      expect(closeOf(path, START_PRICE, { rowMoves: market }) - START_PRICE).toBe(
        START_PRICE - closeOf(mirrored, START_PRICE, { rowMoves: market }),
      )
    }
  })

  it('bounds the round by the sum of its rows, in any order', () => {
    const shuffled = [market[2], market[0], market[3], market[1]]
    expect(priceRange(START_PRICE, shuffled)).toEqual(priceRange(START_PRICE, market))
  })

  it('leaves Black Swan measured in slots, whatever the market did', () => {
    const walk = walkOf([1, 1, -1, -1], 0, 'blackSwan', { rowMoves: market })
    // Half a slot per peg, and no dollar anywhere near it.
    expect(walk).toEqual([0, 0.5, 1, 0.5, 0])
  })
})

describe('scoring differs by mode', () => {
  /** bin 8 → $103, bin 2 → $97; both are equally improbable. */
  const BINS = [8, 2, 5, 5]

  async function playRound(mode: 'stock' | 'blackSwan') {
    const { useGame, winnersOf, rankRound } = await loadGame()
    useGame.getState().setMode(mode)
    // The dollar figures here are the point of the comparison, so the market is
    // held at one price per row.
    useGame.getState().setVolatileRows(false)
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
    const stockOrder = stock
      .rankRound(stock.round, stock.players, 'stock')
      .map((e) => e.landing.bin)
    const swanOrder = swan
      .rankRound(swan.round, swan.players, 'blackSwan')
      .map((e) => e.landing.bin)

    expect(stockOrder[0]).toBe(8)
    // Highest close first, so the center bins beat the $94 loser.
    expect(stockOrder[stockOrder.length - 1]).toBe(2)
    // Rarest first, so the center bins come last.
    expect(swanOrder.slice(0, 2).sort()).toEqual([2, 8])
  })

  it('reports open, close and change per player', async () => {
    const { round, players, rankRound } = await playRound('stock')
    const top = rankRound(round, players, 'stock')[0]
    expect(top.openPrice).toBe(START_PRICE)
    expect(top.closePrice).toBe(closeAt(8, round.rows))
    expect(top.change).toBe(closeAt(8, round.rows) - START_PRICE)
  })
})

describe('stock ties carry the price forward', () => {
  it('reopens the tied players at the price they reached', async () => {
    const { useGame, winnersOf } = await loadGame()
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
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
    const rows = next.rows
    expect(next.openPrices[ids[0]]).toBe(closeAt(7, rows))
    expect(next.openPrices[ids[1]]).toBe(closeAt(7, rows))
    expect(next.openPrices[ids[2]]).toBe(closeAt(3, rows))
    expect(next.openPrices[ids[3]]).toBe(closeAt(4, rows))

    // The next day opens on its placard, and the marbles are held until it is
    // done with.
    expect(useGame.getState().phase).toBe('opening')
    useGame.getState().release()
    expect(useGame.getState().phase).toBe('running')
  })

  it('has no shared price axis once the field is spread out', async () => {
    const { useGame, commonOpenPrice } = await loadGame()
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds

    // Opening round: everyone at $100, so a single price axis describes it.
    expect(commonOpenPrice(useGame.getState().round)).toBe(100)
    ;[7, 7, 3, 4].forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    useGame.getState().startTieBreak()

    // Day two: prices have diverged, so slots can only show the move.
    expect(commonOpenPrice(useGame.getState().round)).toBeNull()
  })

  it('lets a trailing stock win an extra day', async () => {
    const { useGame, rankRound, winnersOf } = await loadGame()
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
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
    // Opened lowest, then took ten of ten rows to the right.
    expect(rankRound(round, players, 'stock')[0].closePrice).toBe(
      closeAt(10, round.rows, closeAt(3, round.rows)),
    )
  })

  it('settles the second session from the carried price', async () => {
    const { useGame, rankRound } = await loadGame()
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
    useGame.getState().start()
    const ids = useGame.getState().round.entrantIds
    ;[7, 7, 3, 4].forEach((bin, i) => useGame.getState().recordLanding(ids[i], bin))
    useGame.getState().startTieBreak()

    const field = useGame.getState().round.entrantIds
    const rows = useGame.getState().round.rows
    // Carried in at the close of bins 7, 7, 3, 4, then this session's bins.
    useGame.getState().recordLanding(field[0], 8)
    useGame.getState().recordLanding(field[1], 4)
    useGame.getState().recordLanding(field[2], 5)
    useGame.getState().recordLanding(field[3], 5)

    const { round, players } = useGame.getState()
    const ranked = rankRound(round, players, 'stock')
    expect(useGame.getState().phase).toBe('results')
    expect(ranked[0].openPrice).toBe(closeAt(7, rows))
    expect(ranked[0].closePrice).toBe(closeAt(8, rows, closeAt(7, rows)))
    // Second place opened level with the leader and gave a slot back.
    expect(ranked[1].closePrice).toBe(closeAt(4, rows, closeAt(7, rows)))
  })
})

describe('settling both ends', () => {
  /** Lands the given bins and returns the resulting settlement. */
  async function play(
    mode: 'stock' | 'blackSwan',
    bins: number[],
    rule: SettleRule = 'winnerAndLoser',
  ) {
    const { useGame, settlementOf, rankRound } = await loadGame()
    useGame.getState().setMode(mode)
    useGame.getState().setSettleRule(rule)
    /*
     * A flat market, because these are tests about ties.
     *
     * With volatility on every player also draws their own penny at every peg, so
     * two players landing in the same bin close a cent or two apart and the tie
     * these tests are about does not exist. That is the setting working as
     * intended — it just makes it the wrong setting to test settling under.
     */
    useGame.getState().setVolatileRows(false)
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
    // Rarest wins, so the center bin is the wooden spoon. Bins must not be
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

  it('takes a level top as the result under "one shot"', async () => {
    // $103, $103, $100, $99 — joint first, and under this rule that is the end
    // of it. The tie is still reported; it is simply not something to settle.
    const { settlement } = await play('stock', [8, 8, 5, 4], 'oneShot')
    expect(settlement.settled).toBe(true)
    expect(settlement.pending).toBe('none')
    expect(settlement.winners).toHaveLength(2)
  })

  it('settles a wholly level field under "one shot"', async () => {
    const { settlement } = await play('stock', [5, 5, 5, 5], 'oneShot')
    expect(settlement.settled).toBe(true)
    expect(settlement.winners).toHaveLength(4)
    expect(settlement.losers).toHaveLength(4)
  })

  it('never opens a second session under "one shot", in either mode', async () => {
    for (const mode of ['stock', 'blackSwan'] as const) {
      // A level top in both: joint rarest in Black Swan, joint highest in Stock.
      const { useGame } = await play(mode, [8, 8, 5, 4], 'oneShot')
      useGame.getState().startTieBreak()
      expect(useGame.getState().phase).toBe('results')
      expect(useGame.getState().round.index).toBe(0)
      expect(useGame.getState().round.tieBreak).toBe(false)
    }
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
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
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
    const walk = walkOf(flips, START_PRICE, 'stock', { rowMoves: steady(flips.length) })

    expect(walk).toHaveLength(flips.length + 1)
    expect(walk[0]).toBe(START_PRICE)
    // Peaks after the run of rights, then gives some back: a 6–4 split is not
    // break-even, since the net is +2 pegs.
    expect(Math.max(...walk)).toBe(START_PRICE + 6 * BASE_PER_PEG)
    expect(walk[walk.length - 1]).toBe(closeAt(6, flips.length))

    // Five and five is the flat case.
    const even = walkOf([1, 1, 1, 1, 1, -1, -1, -1, -1, -1], START_PRICE, 'stock', {
      rowMoves: steady(10),
    })
    expect(even[even.length - 1]).toBe(START_PRICE)
  })

  it('moves half a slot per row, never a whole one', async () => {
    const { walkOf } = await import('./modes')
    const walk = walkOf([1, 1, -1, 1], START_PRICE, 'stock', { rowMoves: steady(4) })
    for (let i = 1; i < walk.length; i++) {
      expect(Math.abs(walk[i] - walk[i - 1])).toBeCloseTo(BASE_PER_PEG, 10)
    }
  })

  it('measures slots from the center in Black Swan', async () => {
    const { walkOf } = await import('./modes')
    const walk = walkOf([1, 1, 1, 1], 0, 'blackSwan', { rowMoves: steady(4) })
    // Four rights is two slots right of center, from an open of dead center.
    expect(walk[0]).toBe(0)
    expect(walk[walk.length - 1]).toBe(2)
  })

  it('resumes a Black Swan walk from where the last session left it', async () => {
    const { walkOf } = await import('./modes')
    // Day two for a player already two slots right: the same four rights again
    // put them at four, not back at two.
    const walk = walkOf([1, 1, 1, 1], 2, 'blackSwan', { rowMoves: steady(4) })
    expect(walk).toEqual([2, 2.5, 3, 3.5, 4])
  })

  it('ends where the landing says it did', async () => {
    const { useGame, rankRound } = await loadGame()
    const { walkOf, closeOf } = await import('./modes')
    useGame.getState().setMode('stock')
    // Dollar figures below assume every row is worth the same.
    useGame.getState().setVolatileRows(false)
    useGame.getState().start()

    const ids = useGame.getState().round.entrantIds
    // Eight rights and two lefts: bin 8 over ten rows.
    const flips = [1, 1, 1, 1, 1, 1, 1, 1, -1, -1]
    ids.forEach((id) => useGame.getState().recordLanding(id, 8, flips))

    const { round, players } = useGame.getState()
    const [top] = rankRound(round, players, 'stock')
    const walk = walkOf(top.landing.flips, top.openPrice, 'stock', { rowMoves: round.rowMoves })
    expect(walk[walk.length - 1]).toBe(
      closeOf(top.landing.flips, top.openPrice, { rowMoves: round.rowMoves }),
    )
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
    // The point of a common denominator: on a later day these two carried in
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
