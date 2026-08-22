import { describe, expect, it } from 'vitest'
import { isFloorOpen } from './ambience'

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
