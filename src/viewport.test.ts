import { describe, expect, it } from 'vitest'
import { COMPACT_LAYOUT, COMPACT_MAX_HEIGHT, COMPACT_MAX_WIDTH, isCompact } from './viewport'

describe('the compact layout test', () => {
  it('takes a phone upright and a phone sideways', () => {
    expect(isCompact(390, 844)).toBe(true)
    expect(isCompact(844, 390)).toBe(true)
  })

  it('leaves a desk alone', () => {
    expect(isCompact(1440, 900)).toBe(false)
    expect(isCompact(1600, 900)).toBe(false)
    expect(isCompact(2560, 800)).toBe(false)
    // 900px across still has room for a card beside the board, tall as it is.
    expect(isCompact(900, 1200)).toBe(false)
  })

  it('reads the boundary the way the media query does — at, not past', () => {
    expect(isCompact(COMPACT_MAX_WIDTH, 1200)).toBe(true)
    expect(isCompact(COMPACT_MAX_WIDTH + 1, 1200)).toBe(false)
    expect(isCompact(1200, COMPACT_MAX_HEIGHT)).toBe(true)
    expect(isCompact(1200, COMPACT_MAX_HEIGHT + 1)).toBe(false)
  })

  it('builds its query from the same two numbers', () => {
    // The stylesheet is the other copy of this, and it cannot import anything —
    // so the numbers it hard-codes are checked here against the ones in use.
    expect(COMPACT_LAYOUT).toBe('(max-width: 700px), (max-height: 500px)')
  })
})
