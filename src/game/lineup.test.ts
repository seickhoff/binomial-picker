import { describe, expect, it } from 'vitest'
import { releaseOrder } from './lineup'
import { BASE_PER_PEG, START_PRICE } from './modes'
import { tickerSymbols } from './symbols'
import type { Player, Round } from './types'

const FIELD = ['Zara', 'Ada', 'Mike', 'Bea'].map((name, slot): Player => ({
  id: `p${slot}`,
  slot,
  name,
  active: true,
}))

const idOf = (name: string) => FIELD.find((player) => player.name === name)!.id

/** A session about to be dropped: only the opening prices matter here. */
function sessionOf(openPrices: Record<string, number>, index = 0): Round {
  const rows = 4
  return {
    index,
    rows,
    entrantIds: FIELD.map((player) => player.id),
    landings: [],
    tieBreak: index > 0,
    rowMoves: Array.from({ length: rows }, () => BASE_PER_PEG),
    plan: {},
    jitter: {},
    openPrices,
  }
}

function orderedNames(round: Round): string[] {
  return releaseOrder({
    entrants: FIELD,
    round,
    mode: 'stock',
    symbols: tickerSymbols(FIELD),
  }).map((player) => player.name)
}

const flatOpen = Object.fromEntries(FIELD.map((player) => [player.id, START_PRICE]))

describe('the order a Stock Market field is released in', () => {
  it('opens day one alphabetically, since the whole field is on one price', () => {
    expect(orderedNames(sessionOf(flatOpen))).toEqual(['Ada', 'Bea', 'Mike', 'Zara'])
  })

  it('leads with the highest price once the field has come apart', () => {
    const opens = {
      [idOf('Zara')]: 103,
      [idOf('Ada')]: 98.5,
      [idOf('Mike')]: 101.25,
      [idOf('Bea')]: 99,
    }
    expect(orderedNames(sessionOf(opens, 1))).toEqual(['Zara', 'Mike', 'Bea', 'Ada'])
  })

  it('falls back to the ticker for stocks level on price', () => {
    const opens = {
      [idOf('Zara')]: 101,
      [idOf('Ada')]: 99,
      [idOf('Mike')]: 101,
      [idOf('Bea')]: 99,
    }
    expect(orderedNames(sessionOf(opens, 1))).toEqual(['Mike', 'Zara', 'Ada', 'Bea'])
  })

  it('is by ticker rather than by name, which can disagree', () => {
    // A two-word name trades under a stem plus an initial, so "Jo Zeta" is JOZ
    // and sorts after JOAN — the other way round from the names themselves.
    const players: Player[] = [
      { id: 'a', slot: 0, name: 'Jo Zeta', active: true },
      { id: 'b', slot: 1, name: 'Joanna', active: true },
    ]
    const symbols = tickerSymbols(players)
    expect([...symbols.values()]).toEqual(['JOZ', 'JOAN'])
    expect('Jo Zeta'.localeCompare('Joanna')).toBeLessThan(0)

    const round = { ...sessionOf({ a: START_PRICE, b: START_PRICE }), entrantIds: ['a', 'b'] }
    const order = releaseOrder({ entrants: players, round, mode: 'stock', symbols })
    expect(order.map((player) => player.name)).toEqual(['Joanna', 'Jo Zeta'])
  })

  it('leaves the field it was handed alone', () => {
    const before = [...FIELD]
    orderedNames(sessionOf(flatOpen))
    expect(FIELD).toEqual(before)
  })
})

describe('the order a Black Swan field is released in', () => {
  const blackSwan = (entrants: readonly Player[], round: Round) =>
    releaseOrder({ entrants, round, mode: 'blackSwan', symbols: tickerSymbols(entrants) }).map(
      (player) => player.name,
    )

  it('goes by name, the order the roster is filed in', () => {
    expect(blackSwan(FIELD, sessionOf(flatOpen))).toEqual(['Ada', 'Bea', 'Mike', 'Zara'])
  })

  it('ignores the prices, which Black Swan never scores on', () => {
    const opens = {
      [idOf('Zara')]: 140,
      [idOf('Ada')]: 60,
      [idOf('Mike')]: 120,
      [idOf('Bea')]: 80,
    }
    expect(blackSwan(FIELD, sessionOf(opens, 1))).toEqual(['Ada', 'Bea', 'Mike', 'Zara'])
  })

  it('files a numbered roster the way a person would', () => {
    // The default names, which a plain string sort files 1, 10, 2.
    const numbered = Array.from({ length: 11 }, (_, slot): Player => ({
      id: `n${slot}`,
      slot,
      name: `Player ${slot + 1}`,
      active: true,
    }))
    const round = { ...sessionOf({}), entrantIds: numbered.map((player) => player.id) }
    expect(blackSwan(numbered, round).slice(0, 3)).toEqual(['Player 1', 'Player 2', 'Player 3'])
  })
})
