import { describe, expect, it } from 'vitest'
import type { RankedEntry } from '../game/types'
import type { NewsTone } from '../game/headlines'
import { chartViewsFor, frontPage, shownChartView, type FrontPageEnd } from './presenters'

/** A Thursday, so the paper that reports on it is Friday's. */
const SESSION_START = new Date(2026, 7, 20, 9, 30).getTime()

function entryAt(closePrice: number, change: number, id = 'p1'): RankedEntry {
  return {
    player: { id, slot: 0, name: 'Nova Technologies', active: true },
    landing: { playerId: id, bin: 7, flips: [], probability: 0.1, deviation: 2, order: 0 },
    rank: 0,
    isWinner: true,
    isLoser: false,
    openPrice: closePrice - change,
    closePrice,
    change,
  }
}

type Page = Parameters<typeof frontPage>[0]

function pageFor(over: Partial<Page> = {}) {
  return frontPage({
    seriesStart: SESSION_START,
    roundIndex: 0,
    fieldSize: 4,
    ends: [end('good', [entryAt(104.32, 4.32), 'NOVA'])],
    ...over,
  })
}

/** One end of the field, as the panel hands it over: entries with their tickers. */
function end(tone: NewsTone, ...players: [RankedEntry, string][]): FrontPageEnd {
  return { tone, players: players.map(([entry, symbol]) => ({ entry, symbol })) }
}

/** The lead story's deck, which is where the session's figures end up. */
function deckFor(ends: readonly FrontPageEnd[], over: Partial<Page> = {}) {
  return pageFor({ ends, ...over }).stories[0].deck
}

describe('the front page', () => {
  it('reports the session it is about', () => {
    expect(deckFor([end('good', [entryAt(104.32, 4.32), 'NOVA'])])).toBe(
      'NOVA finished at $104.32, up $4.32 on the session — the highest close of the 4 names on the tape.',
    )
  })

  it('says which way a losing day went', () => {
    const deck = deckFor([end('bad', [entryAt(96.1, -3.9), 'NOVA'])])
    expect(deck).toContain('down $3.90 on the session')
    expect(deck).toContain('the lowest close of the 4 names')
  })

  it('has a word for a day that went nowhere', () => {
    expect(deckFor([end('good', [entryAt(100, 0), 'NOVA'])])).toContain('unchanged on the session')
  })

  it('names everyone level at the top, on the one price they are level on', () => {
    expect(
      deckFor([
        end('good', [entryAt(104.32, 4.32, 'p1'), 'NOVA'], [entryAt(104.32, 4.32, 'p2'), 'ACME']),
      ]),
    ).toBe(
      'NOVA and ACME finished at $104.32, up $4.32 on the session — level at the top of a field of 4.',
    )
  })

  it('does the same at the other end', () => {
    expect(
      deckFor(
        [
          end(
            'bad',
            [entryAt(96.1, -3.9, 'p3'), 'ZENO'],
            [entryAt(96.1, -3.9, 'p4'), 'ORBI'],
            [entryAt(96.1, -3.9, 'p5'), 'KITE'],
          ),
        ],
        { fieldSize: 6 },
      ),
    ).toContain('ZENO, ORBI and KITE finished at $96.10')
  })

  it('writes a tied headline in the plural', () => {
    const [story] = pageFor({
      ends: [
        end('good', [entryAt(104.32, 4.32, 'p1'), 'NOVA'], [entryAt(104.32, 4.32, 'p2'), 'ACME']),
      ],
    }).stories
    expect(story.headline).toContain('NOVA and ACME')
    expect(story.headline).not.toMatch(/[{}[\]|]/)
  })

  it('carries both ends, in the order it was given them', () => {
    const page = pageFor({
      ends: [
        end('good', [entryAt(104.32, 4.32, 'p1'), 'NOVA']),
        end('bad', [entryAt(96.1, -3.9, 'p2'), 'ACME']),
      ],
    })
    expect(page.stories.map((story) => story.tone)).toEqual(['good', 'bad'])
    expect(page.stories.map((story) => story.kicker)).toEqual(['Market Leaders', 'Market Laggards'])
  })

  it('prints one edition per session, however often it is rendered', () => {
    expect(pageFor({ roundIndex: 2 })).toEqual(pageFor({ roundIndex: 2 }))
  })

  it('writes a new page for the next session', () => {
    const headlines = Array.from(
      { length: 12 },
      (_, day) => pageFor({ roundIndex: day }).stories[0].headline,
    )
    // Not all twelve need differ — a hundred lines will repeat eventually — but a
    // series that printed one headline over and over would be the bug.
    expect(new Set(headlines).size).toBeGreaterThan(6)
  })

  it('is dated the morning after, and skips the weekend to get there', () => {
    // Day one is Thursday, so its paper is Friday's; day two is Friday's session,
    // and its paper is Monday's.
    expect(pageFor({ roundIndex: 0 }).masthead.date).toContain('August 21, 2026')
    expect(pageFor({ roundIndex: 1 }).masthead.date).toContain('August 24, 2026')
  })

  it('keeps its own small print', () => {
    const { masthead } = pageFor()
    expect(masthead.volume).toMatch(/^Vol\. [IVXLCDM]+ · No\. \d+$/)
    expect(masthead.title).not.toBe('')
    expect(masthead.edition).not.toBe('')
    expect(masthead.price).not.toBe('')
  })
})

describe('which charts a mode offers', () => {
  const idsFor = (mode: 'stock' | 'blackSwan') => chartViewsFor(mode).map((view) => view.id)

  it('gives Black Swan the distribution and nothing else', () => {
    // The other three are about a price going somewhere over time, and Black
    // Swan has no price and no series to draw as one line.
    expect(idsFor('blackSwan')).toEqual(['distribution'])
  })

  it('gives Stock Market all four', () => {
    expect(idsFor('stock')).toEqual(['distribution', 'moves', 'candles', 'frontPage'])
  })

  it('falls back when the remembered view belongs to the other mode', () => {
    // The choice is remembered across modes, so it can name one this mode has
    // not got — leaving Stock Market on the paper and playing a round of swan.
    expect(shownChartView('blackSwan', 'frontPage')).toBe('distribution')
    expect(shownChartView('blackSwan', 'candles')).toBe('distribution')
    // And it is only a fallback: switch back and the paper is there again.
    expect(shownChartView('stock', 'frontPage')).toBe('frontPage')
    expect(shownChartView('blackSwan', 'distribution')).toBe('distribution')
  })
})
