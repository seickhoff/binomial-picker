import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS } from '../game/palette'
import { tagStack } from './tagStack'

/** A price book, as the live feed would have it. */
const book = (prices: Record<string, number>) => (id: string) => prices[id]

describe('stacking the name tags', () => {
  it('puts the highest price in front', () => {
    const stack = tagStack(['a', 'b', 'c'], book({ a: 99, b: 101, c: 100 }))

    expect(stack.get('b')).toBeGreaterThan(stack.get('c')!)
    expect(stack.get('c')).toBeGreaterThan(stack.get('a')!)
  })

  it('keeps every tag under the panels and above the board', () => {
    const ids = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}`)
    const stack = tagStack(ids, book(Object.fromEntries(ids.map((id, i) => [id, 100 + i]))))

    for (const [id, z] of stack) {
      expect(z, id).toBeGreaterThanOrEqual(1)
      // The panels start at 20, and a tag over the results card would be a tag
      // over the thing it is read against.
      expect(z, id).toBeLessThan(20)
    }
  })

  it('treats a marble with no quote yet as the lowest', () => {
    const stack = tagStack(['fallen', 'waiting'], book({ fallen: 100 }))

    expect(stack.get('fallen')).toBeGreaterThan(stack.get('waiting')!)
  })
})
