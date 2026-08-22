import { describe, expect, it } from 'vitest'
import { MAX_ROWS, boardGeometry } from '../game/geometry'
import { rowOfPeg, voiceForPeg } from './plinks'

/** Index of the peg at `withinRow` in `row`, as the board numbers them. */
const pegIndex = (row: number, withinRow: number) => (row * (row + 1)) / 2 + withinRow

describe('reading a peg index back', () => {
  it('recovers the row of every peg on the deepest board', () => {
    const geo = boardGeometry(MAX_ROWS)
    geo.pegs.forEach((peg, index) => {
      expect(rowOfPeg(index), `peg ${index}`).toBe(peg.row)
    })
  })
})

describe('the note a peg rings', () => {
  it('puts the middle of an even row at the centre pitch, panned centre', () => {
    // Row 2 has three pegs, so the middle one is dead centre.
    const middle = voiceForPeg(pegIndex(2, 1))
    expect(middle.pan).toBe(0)
    expect(middle.frequency).toBeCloseTo(880, 5)
  })

  it('rings higher to the right and lower to the left', () => {
    const row = 8
    const pitches = Array.from({ length: row + 1 }, (_, k) => voiceForPeg(pegIndex(row, k)).frequency)

    for (let k = 1; k < pitches.length; k++) {
      expect(pitches[k], `peg ${k} of row ${row}`).toBeGreaterThan(pitches[k - 1])
    }
  })

  it('pans the same way the pitch runs', () => {
    const row = 8
    const left = voiceForPeg(pegIndex(row, 0))
    const right = voiceForPeg(pegIndex(row, row))

    expect(left.pan).toBeLessThan(0)
    expect(right.pan).toBeGreaterThan(0)
    expect(right.pan).toBeCloseTo(-left.pan, 10)
  })

  it('keeps the narrow top rows near the middle of the room', () => {
    // Row 1 is two pegs wide. Panning it by its own width would throw the second
    // strike of every drop hard to one side.
    const edge = voiceForPeg(pegIndex(1, 1))
    expect(Math.abs(edge.pan)).toBeLessThan(0.2)
  })

  it('stays inside a musical range on the widest board', () => {
    const geo = boardGeometry(MAX_ROWS)
    const pitches = geo.pegs.map((_, index) => voiceForPeg(index).frequency)

    // Clamped, so a 24-row board doesn't run off into inaudibility at the edges.
    expect(Math.min(...pitches)).toBeGreaterThan(200)
    expect(Math.max(...pitches)).toBeLessThan(4000)
  })

  it('never pans beyond the speakers', () => {
    const geo = boardGeometry(MAX_ROWS)
    for (const [index] of geo.pegs.entries()) {
      expect(Math.abs(voiceForPeg(index).pan)).toBeLessThanOrEqual(1)
    }
  })
})
