import { describe, expect, it } from 'vitest'
import { smoothPath, type Point } from './curve'

/** The cubic segments of a path, as numbers. */
function segments(path: string): number[][] {
  return path
    .split('C')
    .slice(1)
    .map((piece) => piece.trim().split(/\s+/).map(Number))
}

const startOf = (path: string) => path.split('C')[0].trim().split(/\s+/).slice(1).map(Number)

/** A walk that turns every step, which is the shape a price line actually has. */
const sawtooth = (count: number): Point[] =>
  Array.from({ length: count }, (_, i) => ({ x: i * 10, y: i % 2 === 0 ? 100 : 90 }))

describe('smoothing a line', () => {
  it('handles having nothing, or one point, to draw', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([{ x: 3, y: 4 }])).toBe('M 3 4')
  })

  it('passes exactly through every point', () => {
    const points = sawtooth(9)
    const path = smoothPath(points)
    const ends = segments(path).map((numbers) => numbers.slice(4))

    expect(startOf(path)).toEqual([points[0].x, points[0].y])
    expect(ends).toEqual(points.slice(1).map((point) => [point.x, point.y]))
  })

  it('draws one curve per gap', () => {
    expect(segments(smoothPath(sawtooth(2)))).toHaveLength(1)
    expect(segments(smoothPath(sawtooth(20)))).toHaveLength(19)
  })

  it('never bulges past the points it joins', () => {
    // A cubic lies inside its own control hull, so control points within the
    // segment's range prove the curve cannot draw a price that never happened.
    const points = sawtooth(24)
    segments(smoothPath(points)).forEach((numbers, index) => {
      const low = Math.min(points[index].y, points[index + 1].y)
      const high = Math.max(points[index].y, points[index + 1].y)
      const [, firstY, , secondY] = numbers

      expect(firstY, `segment ${index}`).toBeGreaterThanOrEqual(low)
      expect(firstY, `segment ${index}`).toBeLessThanOrEqual(high)
      expect(secondY, `segment ${index}`).toBeGreaterThanOrEqual(low)
      expect(secondY, `segment ${index}`).toBeLessThanOrEqual(high)
    })
  })

  it('stays inside the data on a long random walk', () => {
    // The real case: a hundred-odd rows of coin flips.
    let value = 100
    const points: Point[] = [{ x: 0, y: value }]
    for (let row = 1; row <= 120; row++) {
      value += row % 3 === 0 ? 0.5 : -0.5
      points.push({ x: row * 4, y: value })
    }

    const lowest = Math.min(...points.map((p) => p.y))
    const highest = Math.max(...points.map((p) => p.y))
    for (const numbers of segments(smoothPath(points))) {
      for (const y of [numbers[1], numbers[3], numbers[5]]) {
        expect(y).toBeGreaterThanOrEqual(lowest)
        expect(y).toBeLessThanOrEqual(highest)
      }
    }
  })

  it('keeps a straight run straight', () => {
    // Three points on a line: the tangents match the slope, so the control
    // points land on it too and the curve is the line.
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ])
    for (const numbers of segments(path)) {
      expect(numbers[1]).toBeCloseTo(numbers[0], 6)
      expect(numbers[3]).toBeCloseTo(numbers[2], 6)
    }
  })
})
