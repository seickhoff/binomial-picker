import { describe, expect, it } from 'vitest'
import { isFloorOpen, isMarketClosed } from './ambience'

describe('when the trading floor is audible', () => {
  it('opens for a live Stock Market drop', () => {
    expect(isFloorOpen('stock', 'running', true)).toBe(true)
  })

  it('shuts once the round is over', () => {
    expect(isFloorOpen('stock', 'results', true)).toBe(false)
    expect(isFloorOpen('stock', 'setup', true)).toBe(false)
  })

  it('never opens in Black Swan, whatever the phase', () => {
    for (const phase of ['setup', 'running', 'results'] as const) {
      expect(isFloorOpen('blackSwan', phase, true)).toBe(false)
    }
  })

  it('stays shut when the setting is off', () => {
    expect(isFloorOpen('stock', 'running', false)).toBe(false)
  })
})

describe('when the closing bell rings', () => {
  it('rings on the results, where the floor has just gone quiet', () => {
    expect(isMarketClosed('stock', 'results', true)).toBe(true)
    // The two never overlap: one hands over to the other.
    expect(isFloorOpen('stock', 'results', true)).toBe(false)
  })

  it('does not ring mid-drop, before setup, or in Black Swan', () => {
    expect(isMarketClosed('stock', 'running', true)).toBe(false)
    expect(isMarketClosed('stock', 'setup', true)).toBe(false)
    expect(isMarketClosed('blackSwan', 'results', true)).toBe(false)
  })

  it('is silenced by the same setting as the floor', () => {
    expect(isMarketClosed('stock', 'results', false)).toBe(false)
  })
})
