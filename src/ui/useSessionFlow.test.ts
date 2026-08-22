import { describe, expect, it } from 'vitest'
import { wantsNextSession } from './useSessionFlow'

describe('opening the next session unasked', () => {
  it('opens one when a finished round is still level', () => {
    expect(wantsNextSession('results', false, true)).toBe(true)
  })

  it('stops as soon as the round settles', () => {
    expect(wantsNextSession('results', true, true)).toBe(false)
  })

  it('waits when the setting is off', () => {
    expect(wantsNextSession('results', false, false)).toBe(false)
  })

  it('never fires before a round is over', () => {
    for (const phase of ['setup', 'opening', 'running'] as const) {
      expect(wantsNextSession(phase, false, true), phase).toBe(false)
    }
  })
})
