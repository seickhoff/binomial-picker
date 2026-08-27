import { describe, expect, it } from 'vitest'
import { binomialPmf, deviation, formatOdds, formatOddsCompact } from './binomial'
import { MAX_ROWS, MIN_ROWS } from './geometry'

/** The distinct chances on a board — mirror bins share one, and should. */
function chanceLevels(rows: number): number[] {
  return [...new Set(binomialPmf(rows).filter((p) => p > 0))]
}

describe('reading odds off a board', () => {
  it('separates one slot off center from two, over a long series', () => {
    // A 96-row series — four sessions of 24, say. These are the two figures
    // that both printed "1 in 13" while the table placed one above the other.
    const pmf = binomialPmf(96)
    expect(deviation(49, 96)).toBe(1)
    expect(deviation(50, 96)).toBe(2)
    expect(formatOdds(pmf[49])).toBe('1 in 12.6')
    expect(formatOdds(pmf[50])).toBe('1 in 13.4')
  })

  it('says the same thing about bins that really are as likely as each other', () => {
    // Mirror images: three slots left is exactly three slots right.
    const pmf = binomialPmf(96)
    expect(formatOdds(pmf[45])).toBe(formatOdds(pmf[51]))
  })

  it('never prints two different chances the same way, on any board reachable', () => {
    // Every session board, and every series up to a couple of dozen of them.
    const boards = new Set<number>()
    for (let rows = MIN_ROWS; rows <= MAX_ROWS; rows++) {
      boards.add(rows)
      for (let days = 2; days <= 24; days++) boards.add(rows * days)
    }

    for (const rows of boards) {
      const printed = chanceLevels(rows).map(formatOdds)
      expect(new Set(printed).size, `${rows} rows`).toBe(printed.length)
    }
  })

  it('keeps whole numbers where a decimal would be noise', () => {
    // Out in the tail the gaps run to tens, and 1 in 3,187.0 says nothing that
    // 1 in 3,187 does not.
    const pmf = binomialPmf(24)
    expect(formatOdds(pmf[2])).not.toContain('.')
    expect(formatOdds(1 / 3187)).toBe(`1 in ${(3187).toLocaleString()}`)
  })

  it('drops a trailing zero rather than printing it', () => {
    // The hero figure on the results card is this string at 40px.
    expect(formatOdds(1 / 66)).toBe('1 in 66')
    expect(formatOdds(1 / 13)).toBe('1 in 13')
    expect(formatOdds(1 / 2)).toBe('1 in 2')
  })

  it('has something to say about an impossible bin', () => {
    expect(formatOdds(0)).toBe('—')
  })
})

describe('odds narrow enough for a ladder', () => {
  it('abbreviates what the full form spells out', () => {
    const pmf = binomialPmf(24)
    // The edge slot of the deepest board: one path in sixteen million.
    expect(formatOdds(pmf[0])).toBe(`1 in ${(16777216).toLocaleString()}`)
    expect(formatOddsCompact(pmf[0])).toBe('1 in 17M')
    expect(formatOddsCompact(pmf[1])).toBe('1 in 699k')
    expect(formatOddsCompact(pmf[4])).toBe('1 in 1.6k')
  })

  it('spells out anything under a thousand, where there is room', () => {
    const pmf = binomialPmf(24)
    expect(formatOddsCompact(pmf[6])).toBe('1 in 125')
    expect(formatOddsCompact(pmf[12])).toBe('1 in 6.2')
  })

  it('says exactly what the full form says, until it has to abbreviate', () => {
    // The ladder and the results table are read together: a slot labeled
    // "1 in 13" under a player the table calls 1 in 12.8 is one figure
    // disagreeing with itself.
    const pmf = binomialPmf(24)
    for (const bin of [5, 6, 7, 9, 12]) {
      expect(formatOddsCompact(pmf[bin]), `bin ${bin}`).toBe(formatOdds(pmf[bin]))
    }
    // Past a thousand it has to give, and says so plainly.
    expect(formatOddsCompact(pmf[4])).toBe('1 in 1.6k')
    expect(formatOdds(pmf[4])).toBe(`1 in ${(1579).toLocaleString()}`)
  })

  it('fits a ladder on the deepest board there is', () => {
    // Twenty-five labels across one board, so the widest one is the constraint.
    for (let rows = MIN_ROWS; rows <= MAX_ROWS; rows++) {
      const widest = Math.max(...binomialPmf(rows).map((p) => formatOddsCompact(p).length))
      expect(widest, `${rows} rows`).toBeLessThanOrEqual(9)
    }
  })

  it('drops a trailing zero here too', () => {
    expect(formatOddsCompact(1 / 4)).toBe('1 in 4')
    expect(formatOddsCompact(1 / 1000)).toBe('1 in 1k')
    expect(formatOddsCompact(0)).toBe('—')
  })
})
