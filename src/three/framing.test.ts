import { describe, expect, it } from 'vitest'
import { MAX_ROWS, MIN_ROWS, ROW_GAP, boardGeometry } from '../game/geometry'
import { frameEdgeY, shotFor } from './framing'

/** Every row count the slider offers. */
const ALL_ROWS = Array.from({ length: MAX_ROWS - MIN_ROWS + 1 }, (_, i) => MIN_ROWS + i)
/** Landscape, a tall window, and an ultrawide. */
const VIEWPORTS = [
  { width: 1600, height: 900 },
  { width: 900, height: 1200 },
  { width: 2560, height: 800 },
]

describe.each(VIEWPORTS)('framing at $width×$height', ({ width, height }) => {
  const shots = ALL_ROWS.map((rows) => {
    const geo = boardGeometry(rows)
    return { rows, geo, shot: shotFor(geo, width / height, height) }
  })

  it('opens on the funnel plus several rows of pegs, at every depth', () => {
    for (const { rows, geo, shot } of shots) {
      const bottom = frameEdgeY(shot.entryY, shot.closeHeight, shot.halfFovTan, -1)
      const rowsShown = (geo.apexY - bottom) / ROW_GAP
      // The funnel grows with the board's width, so a flat frame height used to
      // leave a 24-row board showing no lattice at all.
      expect(rowsShown, `${rows} rows`).toBeGreaterThan(3)
    }
  })

  it('keeps the funnel mouth in the opening frame', () => {
    for (const { rows, geo, shot } of shots) {
      const top = frameEdgeY(shot.entryY, shot.closeHeight, shot.halfFovTan, 1)
      expect(top, `${rows} rows`).toBeGreaterThanOrEqual(geo.topY)
    }
  })

  it('never opens wider than it finishes', () => {
    for (const { rows, shot } of shots) {
      expect(shot.closeHeight, `${rows} rows`).toBeLessThanOrEqual(shot.wideHeight)
    }
  })

  it('finishes with every bin and the whole plinth in frame', () => {
    for (const { rows, geo, shot } of shots) {
      const bottom = frameEdgeY(shot.endY, shot.wideHeight, shot.halfFovTan, -1)
      // Solved at the plinth's front face, which sits nearer the camera than the
      // board plane and so projects lower — the crop that caught us before.
      expect(bottom, `${rows} rows`).toBeLessThan(geo.floorY)
      const top = frameEdgeY(shot.endY, shot.wideHeight, shot.halfFovTan, 1)
      expect(top, `${rows} rows`).toBeGreaterThan(geo.binTopY)
    }
  })

  it('leaves a gap at the edge it anchors to, never a crop', () => {
    for (const { rows, geo, shot } of shots) {
      const bottom = frameEdgeY(shot.endY, shot.wideHeight, shot.halfFovTan, -1)
      const gap = geo.floorY - bottom
      expect(gap, `${rows} rows`).toBeGreaterThan(0)
      // A margin, not a chasm: a fraction of the framed height.
      expect(gap, `${rows} rows`).toBeLessThan(shot.wideHeight * 0.25)
    }
  })
})
