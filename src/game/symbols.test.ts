import { describe, expect, it } from 'vitest'
import { tickerSymbols } from './presenters'
import type { Player } from '../game/types'

function field(...names: string[]): Player[] {
  return names.map((name, slot) => ({ id: `p${slot + 1}`, slot, name, active: true }))
}

function symbolsFor(...names: string[]): string[] {
  const players = field(...names)
  const symbols = tickerSymbols(players)
  return players.map((player) => symbols.get(player.id) ?? '')
}

describe('ticker symbols', () => {
  it('reads the obvious way for distinct names', () => {
    expect(symbolsFor('Braden', 'Mariela', 'Jonathan')).toEqual(['BRAD', 'MARI', 'JONA'])
  })

  it('separates names that share their first letters', () => {
    // The bug this exists for: both used to collapse to "SCOT".
    const [first, second] = symbolsFor('Scott C', 'Scott E')
    expect(first).not.toBe(second)
    expect(first).toBe('SCOC')
    expect(second).toBe('SCOE')
  })

  it('separates single words that share a stem', () => {
    const symbols = symbolsFor('Mariano', 'Mariela')
    expect(new Set(symbols).size).toBe(2)
    expect(symbols[0]).toBe('MARI')
  })

  it('separates outright duplicate names', () => {
    const symbols = symbolsFor('Sam', 'Sam', 'Sam')
    expect(new Set(symbols).size).toBe(3)
  })

  it('never exceeds four characters', () => {
    for (const symbol of symbolsFor('Bartholomew', 'Anne-Marie de la Cruz', 'Xiu')) {
      expect(symbol.length).toBeGreaterThanOrEqual(2)
      expect(symbol.length).toBeLessThanOrEqual(4)
    }
  })

  it('copes with names that have no usable letters', () => {
    const symbols = symbolsFor('***', '', '   ', 'Ada')
    expect(new Set(symbols).size).toBe(4)
    for (const symbol of symbols) expect(symbol).not.toBe('')
  })

  it('stays distinct across a full roster of similar names', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Player ${i + 1}`)
    const symbols = symbolsFor(...names)
    expect(new Set(symbols).size).toBe(20)
  })

  it('is deterministic for the same field', () => {
    const names = ['Scott C', 'Scott E', 'Scott', 'Scotty']
    expect(symbolsFor(...names)).toEqual(symbolsFor(...names))
  })
})
