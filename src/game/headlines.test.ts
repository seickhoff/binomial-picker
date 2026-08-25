import { describe, expect, it } from 'vitest'
import {
  HEADLINES,
  headlineFor,
  listOf,
  pickBySeed,
  spreadBySeed,
  type NewsTone,
} from './headlines'

const TONES: NewsTone[] = ['good', 'bad']
const EVERY_LINE = [...HEADLINES.good, ...HEADLINES.bad]

const NOVA = { symbol: 'NOVA', name: 'Nova Technologies' }
const ACME = { symbol: 'ACME', name: 'Acme Industrial' }
const ZENO = { symbol: 'ZENO', name: 'Zeno Works' }

/** A field of stand-in players, as a story's subjects. */
function subjects(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    symbol: `SY${index}`,
    name: `Company ${index}`,
  }))
}

function story(seed: string, tone: NewsTone = 'good', count = 1): string {
  return headlineFor({ tone, seed, subjects: subjects(count) })
}

/**
 * A seed for each line of a catalog, in order.
 *
 * The catalog is reached by hash rather than by index, so a test that wants a
 * particular line has to go looking for a seed that lands on it. Cheap: a few
 * hundred tries covers a hundred slots.
 */
function seedsByLine(tone: NewsTone): string[] {
  const count = HEADLINES[tone].length
  const seeds: string[] = []
  let found = 0

  for (let attempt = 0; found < count; attempt++) {
    const seed = `seed-${attempt}`
    const index = spreadBySeed(seed, count)
    if (seeds[index] === undefined) {
      seeds[index] = seed
      found++
    }
  }
  return seeds
}

const SEEDS: Record<NewsTone, string[]> = { good: seedsByLine('good'), bad: seedsByLine('bad') }

/** The seed that prints one known line, so a test can assert on its wording. */
function seedFor(tone: NewsTone, line: string): string {
  const index = HEADLINES[tone].indexOf(line)
  if (index < 0) throw new Error(`Not in the ${tone} catalog: ${line}`)
  return SEEDS[tone][index]
}

/** Every line in one catalog, printed for a field of `count`. */
function everyHeadline(tone: NewsTone, count: number): string[] {
  return SEEDS[tone].map((seed) => story(seed, tone, count))
}

describe('the headline catalogs', () => {
  it('runs a hundred a side', () => {
    for (const tone of TONES) expect(HEADLINES[tone]).toHaveLength(100)
  })

  it('never files the same line twice', () => {
    expect(new Set(EVERY_LINE).size).toBe(EVERY_LINE.length)
  })

  it('always has somebody to write about', () => {
    for (const line of EVERY_LINE) expect(line).toMatch(/\{SYM\}|\{CO\}/)
  })

  it('uses no token the filler does not know', () => {
    for (const line of EVERY_LINE) {
      expect(line.replaceAll('{SYM}', '').replaceAll('{CO}', '')).not.toMatch(/[{}]/)
    }
  })

  it('closes every bracket it opens, with exactly one alternative inside', () => {
    for (const line of EVERY_LINE) {
      // What is left once the well-formed pairs are taken out: a stray bracket or
      // a pipe outside one is a line that would print its own markup.
      expect(line.replace(/\[[^[\]|]*\|[^[\]|]*\]/g, '')).not.toMatch(/[[\]|]/)
    }
  })

  it('inflects rather than leaving the subject to disagree with its verb', () => {
    // Not every line needs a plural — some are already there ("Shares Jump") —
    // but a catalog where hardly any did would mean the markers were dropped.
    const marked = EVERY_LINE.filter((line) => line.includes('|'))
    expect(marked.length).toBeGreaterThan(150)
  })
})

describe('picking a headline', () => {
  it('fills in both names and leaves no markup behind', () => {
    for (const tone of TONES) {
      for (const count of [1, 2, 3, 5]) {
        for (const line of everyHeadline(tone, count)) {
          expect(line).not.toMatch(/[{}[\]|]/)
        }
      }
    }
  })

  it('agrees with a single subject', () => {
    const seed = seedFor(
      'good',
      '{SYM} Raise[s|] Full-Year Revenue Outlook[|s] on Strong Quarterly Demand',
    )
    expect(headlineFor({ tone: 'good', seed, subjects: [NOVA] })).toBe(
      'NOVA Raises Full-Year Revenue Outlook on Strong Quarterly Demand',
    )
  })

  it('lists the tied and agrees with all of them', () => {
    const seed = seedFor(
      'good',
      '{SYM} Raise[s|] Full-Year Revenue Outlook[|s] on Strong Quarterly Demand',
    )
    expect(headlineFor({ tone: 'good', seed, subjects: [NOVA, ACME, ZENO] })).toBe(
      'NOVA, ACME and ZENO Raise Full-Year Revenue Outlooks on Strong Quarterly Demand',
    )
  })

  it('inflects the parts a rule would get wrong', () => {
    // The subject is the noun phrase, not the token before the verb.
    const margins = seedFor('good', '{SYM} Gross Margin[|s] Expand[s|] 340 Basis Points')
    expect(headlineFor({ tone: 'good', seed: margins, subjects: [NOVA, ACME] })).toBe(
      'NOVA and ACME Gross Margins Expand 340 Basis Points',
    )

    // A possessive follows the subject it belongs to, and the token is not the
    // subject at all here.
    const highs = seedFor('bad', 'Insiders Sell Shares as {SYM} Slip[s|] From [Its|Their] Highs')
    expect(headlineFor({ tone: 'bad', seed: highs, subjects: [NOVA, ACME] })).toBe(
      'Insiders Sell Shares as NOVA and ACME Slip From Their Highs',
    )

    // An irregular one: "Rallies" is not "Rally" plus an s.
    const rally = seedFor('good', '{SYM} Rall[ies|y] as Short Interest Falls to a Two-Year Low')
    expect(headlineFor({ tone: 'good', seed: rally, subjects: [NOVA, ACME] })).toBe(
      'NOVA and ACME Rally as Short Interest Falls to a Two-Year Low',
    )
  })

  it('sets a tie in company names as well as tickers', () => {
    const seed = seedFor('good', '{CO} Win[s|] $480M Multi-Year Government Contract')
    expect(headlineFor({ tone: 'good', seed, subjects: [NOVA, ACME] })).toBe(
      'Nova Technologies and Acme Industrial Win $480M Multi-Year Government Contract',
    )
  })

  it('prints the same edition for the same session', () => {
    expect(story('p1:3:10432')).toBe(story('p1:3:10432'))
  })

  it('writes a different story for the other end of the field', () => {
    // Same seed, opposite direction: the two ends never share a catalog, so this
    // cannot come back as the same line however the hash falls.
    expect(story('p1:3:10432', 'good')).not.toBe(story('p1:3:10432', 'bad'))
  })

  it('reaches the whole catalog rather than a corner of it', () => {
    const seen = new Set(
      Array.from({ length: 2000 }, (_, index) => story(`p1:${index}:${10000 + index}`)),
    )
    // 2000 draws over 100 lines: missing more than a couple would mean the hash
    // is clumping, which is the failure this guards against.
    expect(seen.size).toBeGreaterThan(97)
  })

  it('names an issuer even when the player has not been named', () => {
    const seed = seedFor('good', '{CO} Win[s|] $480M Multi-Year Government Contract')
    expect(headlineFor({ tone: 'good', seed, subjects: [{ symbol: 'P1', name: '  ' }] })).toBe(
      'An Unnamed Issuer Wins $480M Multi-Year Government Contract',
    )
  })
})

describe('naming a group', () => {
  it('sets a list the way a headline does', () => {
    expect(listOf(['NOVA'])).toBe('NOVA')
    expect(listOf(['NOVA', 'ACME'])).toBe('NOVA and ACME')
    expect(listOf(['NOVA', 'ACME', 'ZENO'])).toBe('NOVA, ACME and ZENO')
    expect(listOf(['NOVA', 'ACME', 'ZENO', 'ORBI'])).toBe('NOVA, ACME, ZENO and ORBI')
  })

  it('counts the rest once a list stops being readable', () => {
    expect(listOf(['NOVA', 'ACME', 'ZENO', 'ORBI', 'KITE'])).toBe('NOVA, ACME, ZENO and 2 others')
    expect(listOf(Array.from({ length: 12 }, (_, i) => `S${i}`))).toBe('S0, S1, S2 and 9 others')
  })

  it('takes the page’s own word for the ones it does not name', () => {
    expect(listOf(['NOVA', 'ACME', 'ZENO', 'ORBI', 'KITE'], 'Others')).toBe(
      'NOVA, ACME, ZENO and 2 Others',
    )
  })

  it('has nothing to say about nobody', () => {
    expect(listOf([])).toBe('')
  })
})

describe('seeded choices', () => {
  it('stays inside the range', () => {
    for (let seed = 0; seed < 500; seed++) {
      const index = spreadBySeed(`seed-${seed}`, 7)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(7)
    }
  })

  it('survives an empty list rather than dividing by zero', () => {
    expect(spreadBySeed('anything', 0)).toBe(0)
  })

  it('keeps unrelated choices from moving together', () => {
    // Every seeded choice on the page prefixes its own name for this reason: two
    // catalogs of the same length drawn from the same seed would otherwise always
    // pick the same index as each other.
    const positions = Array.from({ length: 40 }, (_, index) => [
      pickBySeed([0, 1, 2, 3, 4, 5, 6, 7], `paper:${index}`),
      pickBySeed([0, 1, 2, 3, 4, 5, 6, 7], `price:${index}`),
    ])
    expect(positions.some(([a, b]) => a !== b)).toBe(true)
  })
})
