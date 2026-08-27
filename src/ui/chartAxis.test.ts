import { describe, expect, it } from 'vitest'
import type { Mode } from '../game/types'
import { PLOT_HEIGHT, gridLines, valueAxis } from './chartAxis'

const majors = (axis: ReturnType<typeof valueAxis>, mode: Mode) =>
  gridLines(axis, mode)
    .filter((line) => line.major)
    .map((line) => line.value)

const values = (axis: ReturnType<typeof valueAxis>, mode: Mode) =>
  gridLines(axis, mode).map((line) => line.value)

/** The gap between neighboring lines, in plot pixels. */
const spacing = (axis: ReturnType<typeof valueAxis>, mode: Mode) => {
  const drawn = gridLines(axis, mode)
  return Math.abs(axis.y(drawn[1].value) - axis.y(drawn[0].value))
}

describe('the value grid', () => {
  it('rules whole dollars strongly and quarters faintly', () => {
    const axis = valueAxis([99.5, 100.5], 0)

    expect(values(axis, 'stock')).toEqual([99, 99.25, 99.5, 99.75, 100, 100.25, 100.5, 100.75, 101])
    expect(majors(axis, 'stock')).toEqual([99, 100, 101])
  })

  it('rules the whole dollars in view, and only those', () => {
    // A round that barely moved, and one that opened somewhere untidy days later.
    expect(majors(valueAxis([100], 0), 'stock')).toEqual([100])
    expect(majors(valueAxis([100.02, 99.98], 0), 'stock')).toEqual([100])
    expect(majors(valueAxis([101.19, 101.23], 0), 'stock')).toEqual([101])
  })

  it('always has a line to hang a label on', () => {
    for (let close = 90; close <= 110; close += 0.25) {
      expect(majors(valueAxis([close], 0), 'stock').length).toBeGreaterThan(0)
    }
  })

  it('coarsens the ladder rather than crowding it', () => {
    const wide = valueAxis([80, 120], 0)

    expect(spacing(wide, 'stock')).toBeGreaterThanOrEqual(9)
    expect(majors(wide, 'stock')).toEqual([80, 90, 100, 110, 120])
  })

  it('never rules a fraction of a slot', () => {
    const axis = valueAxis([-6, 6], 0)

    expect(values(axis, 'blackSwan').every(Number.isInteger)).toBe(true)
    expect(majors(axis, 'blackSwan')).toEqual([-5, 0, 5])
    expect(spacing(axis, 'blackSwan')).toBeGreaterThanOrEqual(9)
  })

  it('keeps every line inside the plot', () => {
    const axis = valueAxis([97.3, 101.7], 0)

    for (const value of values(axis, 'stock')) {
      expect(axis.y(value)).toBeGreaterThanOrEqual(0)
      expect(axis.y(value)).toBeLessThanOrEqual(PLOT_HEIGHT)
    }
  })
})
