import { describe, expect, it } from 'vitest'
import { binCapacity, buildDropPath, planDrops, samplePath } from './drop'
import { MARBLE_RADIUS, boardGeometry } from './geometry'

const SAMPLES = 20_000

/** Flips are drawn in rounds.ts; these tests only need some. */
function someFlips(rows: number): number[] {
  return Array.from({ length: rows }, () => (Math.random() < 0.5 ? -1 : 1))
}

describe.each([4, 10, 16, 24])('drop model, %i rows', (rows) => {
  const geo = boardGeometry(rows)

  const paths = Array.from({ length: SAMPLES }, () =>
    buildDropPath(geo, { releaseX: 0, flips: someFlips(rows), reserveSlot: () => 0 }),
  )

  it('puts the bin where the flips say', () => {
    for (const path of paths) {
      const rights = path.flips.filter((f) => f > 0).length
      expect(path.bin).toBe(rights)
    }
  })

  it('carries the flips it was handed, unchanged', () => {
    const flips = someFlips(rows)
    const path = buildDropPath(geo, { releaseX: 0, flips })
    expect(path.flips).toEqual(flips)
    expect(path.netAfter).toHaveLength(rows + 1)
  })

  it('always reaches the floor, on the bin center', () => {
    for (const path of paths.slice(0, 5_000)) {
      const end = samplePath(path, path.duration)
      expect(end.x).toBeCloseTo(geo.binCenters[path.bin], 10)
      expect(end.y).toBeCloseTo(geo.floorY + MARBLE_RADIUS, 10)

      // It is on the floor at the moment it is scored, not still in the air.
      const touchdown = samplePath(path, path.landingTime)
      expect(touchdown.y).toBeCloseTo(geo.floorY + MARBLE_RADIUS, 10)
    }
  })

  it('never falls through the board or stalls', () => {
    for (const path of paths.slice(0, 2_000)) {
      expect(path.duration).toBeGreaterThan(0.5)
      // The widest board still has to finish in a watchable time.
      expect(path.duration).toBeLessThan(12)

      let previous = Number.POSITIVE_INFINITY
      for (let step = 0; step <= 60; step++) {
        const { x, y } = samplePath(path, (path.landingTime * step) / 60)
        expect(Number.isFinite(x)).toBe(true)
        expect(y).toBeGreaterThanOrEqual(geo.floorY - 1e-9)
        expect(Math.abs(x)).toBeLessThanOrEqual(geo.halfWidth)
        previous = y
      }
      expect(previous).toBeLessThan(geo.dropY)
    }
  })
})

/** A field of `count` marbles, each with its own flips. */
function fieldOf(count: number, rows: number): number[][] {
  return Array.from({ length: count }, () => someFlips(rows))
}

describe('planning a whole round', () => {
  const geo = boardGeometry(10)

  it('always rests the first marble in a bin on the floor', () => {
    // Regression: slots used to be claimed per marble during React's render
    // pass, which double-booked bins and left whole stacks floating in mid-air.
    for (let attempt = 0; attempt < 500; attempt++) {
      const paths = planDrops(geo, fieldOf(12, geo.rows))
      const lowestPerBin = new Map<number, number>()
      for (const path of paths) {
        const lowest = lowestPerBin.get(path.bin)
        if (lowest === undefined || path.restY < lowest) {
          lowestPerBin.set(path.bin, path.restY)
        }
      }
      for (const restY of lowestPerBin.values()) {
        expect(restY).toBeCloseTo(geo.floorY + MARBLE_RADIUS, 10)
      }
    }
  })

  it('stacks each bin contiguously upward, one marble per slot', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const paths = planDrops(geo, fieldOf(20, geo.rows))
      const byBin = new Map<number, number[]>()
      for (const path of paths) {
        byBin.set(path.bin, [...(byBin.get(path.bin) ?? []), path.restY])
      }
      const capacity = binCapacity(geo)
      for (const heights of byBin.values()) {
        const sorted = [...heights].sort((a, b) => a - b)
        sorted.forEach((restY, slot) => {
          // Its own slot until the bin is full, and the top slot thereafter.
          const filled = Math.min(slot, capacity - 1)
          expect(restY).toBeCloseTo(geo.floorY + MARBLE_RADIUS + filled * MARBLE_RADIUS * 2, 10)
        })
        // Distinct heights for as many as the bin can actually hold.
        const stacked = sorted.slice(0, capacity)
        expect(new Set(stacked.map((h) => h.toFixed(6))).size).toBe(stacked.length)
      }
    }
  })

  it('plans one path per entrant and every one lands', () => {
    const paths = planDrops(geo, fieldOf(20, geo.rows))
    expect(paths).toHaveLength(20)
    for (const path of paths) {
      expect(path.bin).toBeGreaterThanOrEqual(0)
      expect(path.bin).toBeLessThanOrEqual(geo.rows)
      expect(samplePath(path, path.duration).y).toBeCloseTo(path.restY, 10)
    }
  })

  it('lands a whole field piled into one bin, without losing any of it', () => {
    /*
     * Regression, and a bad one. A bin holds about eight marbles; a twenty-player
     * board can easily put ten in the same one, and the tenth used to come to
     * rest above the last peg row. Falling a negative distance made the duration
     * NaN, which made every position NaN, which made the marble not draw at all —
     * so a marble was simply missing, with nothing on screen to say why.
     */
    const rows = geo.rows
    const allToTheRight = Array.from({ length: 20 }, () => Array.from({ length: rows }, () => 1))
    const paths = planDrops(geo, allToTheRight)
    const ceiling = geo.floorY + MARBLE_RADIUS + (binCapacity(geo) - 1) * MARBLE_RADIUS * 2

    expect(paths).toHaveLength(20)
    for (const path of paths) {
      expect(Number.isFinite(path.duration)).toBe(true)
      expect(Number.isFinite(path.restY)).toBe(true)
      expect(samplePath(path, path.duration).y).toBeCloseTo(path.restY, 10)
      // Nothing rests above what the bin can hold.
      expect(path.restY).toBeLessThanOrEqual(ceiling + 1e-9)
    }
  })

  it('keeps every peg-to-peg fall a real number, at every depth', () => {
    for (const rows of [4, 10, 24]) {
      const board = boardGeometry(rows)
      const field = Array.from({ length: 20 }, () => Array.from({ length: rows }, () => -1))
      for (const path of planDrops(board, field)) {
        for (const segment of path.segments) {
          expect(Number.isFinite(segment.duration), `${rows} rows`).toBe(true)
        }
      }
    }
  })

  it('keeps every release point inside the funnel mouth', () => {
    const paths = planDrops(geo, fieldOf(20, geo.rows))
    for (const path of paths) {
      expect(Math.abs(path.segments[0].x0)).toBeLessThan(geo.halfWidth)
    }
  })
})

describe('bin stacking', () => {
  it('rests marbles on top of one another', () => {
    const geo = boardGeometry(10)
    let slot = 0
    const heights = Array.from(
      { length: 4 },
      () =>
        buildDropPath(geo, {
          releaseX: 0,
          flips: someFlips(geo.rows),
          reserveSlot: () => slot++,
        }).restY,
    )
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i] - heights[i - 1]).toBeCloseTo(MARBLE_RADIUS * 2, 10)
    }
  })
})
