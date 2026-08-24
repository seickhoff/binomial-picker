import { describe, expect, it } from 'vitest'
import { binOf, drawRound } from './rounds'
import { binomialPmf } from './binomial'
import { BASE_PER_PEG, DEFAULT_VOLATILITY, bandsOf } from './modes'

const SAMPLES = 200_000

/**
 * How large a chi-square is allowed to be, for `dof` degrees of freedom.
 *
 * A flat limit was wrong, and flaked: chi-square has mean `dof` and variance
 * `2·dof`, so what counts as a large value depends on how many bins were
 * counted, and a 24-row board counts five times as many as a 4-row one. At
 * five sigma this all but never fails by chance, while still being nowhere near
 * loose enough to pass a biased board — the rigid-body version this model
 * replaced scored in the thousands.
 */
function chiSquareLimit(dof: number): number {
  return dof + 5 * Math.sqrt(2 * dof)
}

function draw(ids: readonly string[], rows: number, volatileRows = false) {
  return drawRound({ entrantIds: ids, rows, volatileRows })
}

describe.each([4, 10, 16, 24])('drawing a round of %i rows', (rows) => {
  const flips = Array.from({ length: SAMPLES }, () => draw(['p1'], rows).plan.p1)

  it('makes every decision a fair coin flip', () => {
    let count = 0
    let right = 0
    for (const sequence of flips) {
      for (const flip of sequence) {
        count += 1
        if (flip > 0) right += 1
      }
    }
    expect(count).toBe(SAMPLES * rows)
    expect(right / count).toBeCloseTo(0.5, 2)
  })

  it('lands binomially', () => {
    const counts = new Array(rows + 1).fill(0)
    for (const sequence of flips) counts[binOf(sequence)] += 1

    const pmf = binomialPmf(rows)
    const mean = counts.reduce((sum, c, k) => sum + c * k, 0) / SAMPLES
    const variance = counts.reduce((sum, c, k) => sum + c * (k - mean) ** 2, 0) / SAMPLES

    expect(mean).toBeCloseTo(rows / 2, 1)
    expect(variance).toBeCloseTo(rows * 0.25, 1)

    let chi2 = 0
    let bins = 0
    for (let k = 0; k <= rows; k++) {
      const expected = pmf[k] * SAMPLES
      // Bins too rare to have a meaningful count of their own would dominate the
      // statistic through their tiny denominators.
      if (expected < 5) continue
      chi2 += (counts[k] - expected) ** 2 / expected
      bins += 1
    }
    expect(chi2).toBeLessThan(chiSquareLimit(bins - 1))
  })

  it('gives every entrant exactly one flip per row', () => {
    const { plan } = draw(['a', 'b', 'c'], rows)
    expect(Object.keys(plan)).toEqual(['a', 'b', 'c'])
    for (const sequence of Object.values(plan)) expect(sequence).toHaveLength(rows)
  })

  it('moves every row by the plain base when volatility is off', () => {
    const { rowMoves } = draw(['a', 'b'], rows)
    expect(rowMoves).toHaveLength(rows)
    expect(new Set(rowMoves).size).toBe(1)
    expect(rowMoves[0]).toBe(BASE_PER_PEG)
  })

  it('adds a whole number of cents from inside one of the bands', () => {
    const seen = new Set<number>()
    for (let attempt = 0; attempt < 400; attempt++) {
      const { rowMoves } = draw(['a', 'b'], rows, true)
      expect(rowMoves).toHaveLength(rows)
      for (const step of rowMoves) seen.add(Math.round((step - BASE_PER_PEG) * 100))
    }

    const bands = bandsOf(DEFAULT_VOLATILITY)
    const widest = Math.max(...bands.map(([, high]) => high))
    for (const cents of seen) {
      expect(Number.isInteger(cents), `${cents}¢`).toBe(true)
      // Inside some band, which for these three is the whole range end to end.
      expect(cents, `${cents}¢`).toBeGreaterThanOrEqual(0)
      expect(cents, `${cents}¢`).toBeLessThanOrEqual(widest)
    }

    // Over that many rows every band gets drawn, and more than one figure from
    // each — the point of drawing a range rather than three fixed levels.
    for (const [low, high] of bands) {
      const fromBand = [...seen].filter((cents) => cents >= low && cents <= high)
      expect(fromBand.length, `${low}–${high}¢`).toBeGreaterThan(1)
    }
  })

  it('draws nobody a private penny on a flat market', () => {
    const { jitter } = draw(['a', 'b'], rows)
    expect(jitter).toEqual({})
  })

  it('draws every entrant their own penny per peg when volatility is on', () => {
    const { jitter } = draw(['a', 'b', 'c'], rows, true)
    expect(Object.keys(jitter)).toEqual(['a', 'b', 'c'])

    const seen = new Set<number>()
    for (let attempt = 0; attempt < 200; attempt++) {
      for (const pennies of Object.values(draw(['a', 'b', 'c'], rows, true).jitter)) {
        expect(pennies).toHaveLength(rows)
        for (const penny of pennies) seen.add(Math.round(penny * 100))
      }
    }
    // A cent either way, or nothing — and all three turn up.
    expect([...seen].sort((a, b) => a - b)).toEqual([-1, 0, 1])
  })

  it('draws from the bands it is given, not the ones it ships with', () => {
    // A market set up by hand: one mood, one figure, so every row is worth it.
    const flat = [50, 50] as const
    const { rowMoves } = drawRound({
      entrantIds: ['a'],
      rows,
      volatileRows: true,
      volatility: { calm: flat, mid: flat, wild: flat },
    })

    for (const step of rowMoves) expect(step).toBeCloseTo(BASE_PER_PEG + 0.5, 10)
  })

  it('gives two players the same market and different pennies', () => {
    // Which is the whole distinction: the rows are the session's, the pennies are
    // the player's. Over this many rows an identical pair is vanishingly unlikely.
    let same = 0
    for (let attempt = 0; attempt < 50; attempt++) {
      const { jitter } = draw(['a', 'b'], rows, true)
      if (jitter.a.join() === jitter.b.join()) same += 1
    }
    expect(same).toBeLessThan(50)
  })

  it('gives the whole field one market, which is what keeps it fair', () => {
    // One list of row values per round, not one per player: every player meets
    // the same row worth the same amount, and only their own coins differ.
    const { plan, rowMoves } = draw(['a', 'b', 'c'], rows, true)
    expect(rowMoves).toHaveLength(rows)
    for (const sequence of Object.values(plan)) expect(sequence).toHaveLength(rowMoves.length)
  })

  it('draws each entrant independently', () => {
    // One fresh draw per flip per entrant, rather than one sequence shared out.
    let draws = 0
    const ids = ['a', 'b', 'c', 'd']
    drawRound({
      entrantIds: ids,
      rows,
      volatileRows: false,
      random: () => {
        draws += 1
        return 0.25
      },
    })
    expect(draws).toBe(ids.length * rows)
  })
})
