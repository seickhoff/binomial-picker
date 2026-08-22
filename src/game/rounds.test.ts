import { describe, expect, it } from 'vitest'
import { binOf, drawRound } from './rounds'
import { binomialPmf } from './binomial'

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

function draw(ids: readonly string[], rows: number) {
  return drawRound({ entrantIds: ids, rows })
}

describe.each([4, 10, 16, 24])('drawing a round of %i rows', (rows) => {
  const flips = Array.from({ length: SAMPLES }, () => draw(['p1'], rows).p1)

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
    const drawn = draw(['a', 'b', 'c'], rows)
    expect(Object.keys(drawn)).toEqual(['a', 'b', 'c'])
    for (const sequence of Object.values(drawn)) expect(sequence).toHaveLength(rows)
  })

  it('draws each entrant independently', () => {
    // One fresh draw per flip per entrant, rather than one sequence shared out.
    let draws = 0
    const ids = ['a', 'b', 'c', 'd']
    drawRound({
      entrantIds: ids,
      rows,
      random: () => {
        draws += 1
        return 0.25
      },
    })
    expect(draws).toBe(ids.length * rows)
  })
})
