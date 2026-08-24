import { describe, expect, it } from 'vitest'
import {
  BOARD_DEPTH,
  FLOOR_THICKNESS,
  MAX_ROWS,
  MIN_ROWS,
  ROW_GAP,
  boardGeometry,
} from '../game/geometry'
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

  it('fits the entire device in the overview, at every depth', () => {
    for (const { rows, geo, shot } of shots) {
      const { overviewY: y, overviewHeight: h, halfFovTan } = shot

      // Measured at the faces that actually crop: the plinth's front face is
      // nearer the camera than the board plane, so it projects lowest.
      const bottom = frameEdgeY(y, h, halfFovTan, -1, BOARD_DEPTH * 0.65)
      const top = frameEdgeY(y, h, halfFovTan, 1, BOARD_DEPTH / 2)

      expect(bottom, `${rows} rows`).toBeLessThan(geo.floorY - FLOOR_THICKNESS)
      expect(top, `${rows} rows`).toBeGreaterThan(geo.topY)
    }
  })

  it('shows more of the world in the overview than any other shot', () => {
    for (const { rows, shot } of shots) {
      expect(shot.overviewHeight, `${rows} rows`).toBeGreaterThan(shot.wideHeight)
      expect(shot.overviewHeight, `${rows} rows`).toBeGreaterThan(shot.closeHeight)
    }
  })

  it('fits the device across as well as down', () => {
    for (const { rows, geo, shot } of shots) {
      // The frame's width is its height times the aspect; the board has to sit
      // inside it, which on a narrow window is the harder of the two fits.
      const framedWidth = shot.overviewHeight * (width / height)
      expect(framedWidth, `${rows} rows`).toBeGreaterThan(geo.width)
    }
  })

  it('leaves a gap at the edge it anchors to, never a crop', () => {
    for (const { rows, geo, shot } of shots) {
      const bottom = frameEdgeY(shot.endY, shot.wideHeight, shot.halfFovTan, -1)
      const gap = geo.floorY - bottom
      expect(gap, `${rows} rows`).toBeGreaterThan(0)
      // A margin, not a chasm — but only while the shot is anchored at all. A
      // frame roomier than the device has surplus by definition, and centres it.
      if (shot.wideHeight < geo.height) {
        expect(gap, `${rows} rows`).toBeLessThan(shot.wideHeight * 0.25)
      }
    }
  })

  /*
   * The upright-phone case, and the one place the two rules differ.
   *
   * Fitting an 11-unit board across a 390px-wide screen takes 27 units of height
   * for a board 15 tall. Anchored to the bottom, all 12 units of surplus went above
   * it: the board sat in the lower half with its bins jammed into the bottom edge
   * and a void over the funnel.
   */
  it('centres the finished shot when the frame is roomier than the device', () => {
    for (const { rows, geo, shot } of shots) {
      if (shot.wideHeight < geo.height) continue
      expect(shot.endY, `${rows} rows`).toBeCloseTo(geo.centerY)
    }
  })

  it('still hangs it off the bottom when the frame is the tighter of the two', () => {
    for (const { rows, geo, shot } of shots) {
      if (shot.wideHeight >= geo.height) continue
      // Every desk-shaped window lands here, and must keep landing here.
      expect(shot.endY, `${rows} rows`).toBeLessThan(geo.centerY)
    }
  })
})

/**
 * The guard on the two rules that only bite on a narrow window: a desk is framed
 * exactly as it was before either of them existed.
 */
describe('a landscape window', () => {
  const LANDSCAPE = [
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 2560, height: 800 },
    { width: 844, height: 390 },
  ]

  it.each(LANDSCAPE)('centres only the boards that fit, at $width×$height', (viewport) => {
    for (const rows of ALL_ROWS) {
      const geo = boardGeometry(rows)
      const shot = shotFor(geo, viewport.width / viewport.height, viewport.height)

      /*
       * The bins alone set a floor of nine units on the closing frame, which is
       * taller than a four-row board — so the shallowest two boards fit inside
       * their own closing shot on any window, and are centred in it. Everything
       * from six rows up is hung off the bottom edge, exactly as it always was.
       */
      expect(shot.wideHeight >= geo.height, `${rows} rows`).toBe(rows <= 5)
    }
  })
})
