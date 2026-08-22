/**
 * Board geometry, in world units. One unit = the horizontal gap between two
 * neighbouring pegs in the same row.
 *
 * Layout, top to bottom:
 *   funnel — the upside-down triangle marbles are poured into, converging on
 *     the apex peg
 *   → `rows` peg rows, each one peg wider than the last
 *   → `rows + 1` bins between vertical dividers
 *   → floor
 *
 * The side walls are vertical, at the outer edge of the end bins, and that is
 * deliberate. A marble deflected outward moves half a space per row — exactly
 * the rate at which the lattice itself widens — so it always arrives on top of
 * the next row's outermost peg and faces another even choice. Angling the walls
 * inward to "hug" the lattice instead opens a peg-free chute along the edge
 * that a marble slides straight down, skipping the remaining rows and piling
 * into the end bins. Vertical walls are only ever touched in the far tail.
 *
 * Everything is derived from `rows`, so the whole device rescales from one knob.
 */

export const SPACING = 1
export const ROW_GAP = 0.9
export const PEG_RADIUS = 0.13
export const MARBLE_RADIUS = 0.2
/** Thickness along z. The simulation is planar; this is for looks. */
export const BOARD_DEPTH = 1.1
export const WALL_THICKNESS = 0.32
export const FLOOR_THICKNESS = 0.6
/**
 * Half-width of the funnel throat, level with the apex peg. Narrow enough that
 * marbles enter the lattice near the top, wide enough for two abreast.
 */
export const THROAT_HALF_WIDTH = 0.85

export const MIN_ROWS = 4
/**
 * 24 rows is 300 pegs and 25 slots — the edge slot is then a 1-in-16.7-million
 * landing. The practical ceiling is the drop taking about ten seconds, not the
 * lattice: the pegs are one instanced draw whatever the count.
 */
export const MAX_ROWS = 24

export interface Peg {
  readonly x: number
  readonly y: number
  /** 0-based peg row, top to bottom. */
  readonly row: number
}

/** A wall segment, as a line between two points in the board plane. */
export interface WallSegment {
  readonly from: readonly [number, number]
  readonly to: readonly [number, number]
}

export interface BoardGeometry {
  readonly rows: number
  readonly pegs: readonly Peg[]
  readonly binCount: number
  /** World x of each bin's centre, index 0…rows. */
  readonly binCenters: readonly number[]
  /** World x of each interior bin divider. */
  readonly dividerX: readonly number[]
  readonly binWidth: number
  readonly binWallHeight: number
  /** y of the top of the bin dividers. */
  readonly binTopY: number
  /** Half the playfield width at the bins, to the inside face of the walls. */
  readonly halfWidth: number
  readonly apexY: number
  readonly lastRowY: number
  readonly floorY: number
  /** y a marble is released from. */
  readonly dropY: number
  /** Half-width of the funnel's throat, level with the apex peg. */
  readonly throatHalfWidth: number
  readonly funnelTopY: number
  /** Right-hand wall, apex to floor. The left wall is its mirror. */
  readonly wall: readonly WallSegment[]
  readonly topY: number
  /** Full height of the device, funnel mouth to floor. */
  readonly height: number
  readonly width: number
  /** y of the device's midpoint — what the camera should look at. */
  readonly centerY: number
}

export function boardGeometry(rows: number): BoardGeometry {
  const apexY = 0

  const pegs: Peg[] = []
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i <= row; i++) {
      pegs.push({ x: (i - row / 2) * SPACING, y: apexY - row * ROW_GAP, row })
    }
  }

  const lastRowY = apexY - (rows - 1) * ROW_GAP
  const bins = rows + 1
  // Bin k sits under the gap the marble falls through, so bin centres continue
  // the peg lattice half a step out from the widest row.
  const binCenters = Array.from({ length: bins }, (_, k) => (k - rows / 2) * SPACING)
  const dividerX = Array.from({ length: bins - 1 }, (_, m) => binCenters[m] + SPACING / 2)

  const binWallHeight = ROW_GAP * 3
  const binTopY = lastRowY - ROW_GAP * 0.7
  const floorY = binTopY - binWallHeight
  const halfWidth = (bins / 2) * SPACING

  const throatHalfWidth = THROAT_HALF_WIDTH
  const funnelTopY = apexY + Math.max(ROW_GAP * 2, halfWidth * 0.6)
  const dropY = funnelTopY - ROW_GAP * 0.3
  const topY = funnelTopY + ROW_GAP * 0.4

  // Right-hand wall: one vertical run the length of the device, plus the funnel
  // cheek angling in from the mouth to the throat.
  const wall: WallSegment[] = [
    { from: [halfWidth, funnelTopY], to: [halfWidth, floorY] },
    { from: [halfWidth, funnelTopY], to: [throatHalfWidth, apexY] },
  ]

  return {
    rows,
    pegs,
    binCount: bins,
    binCenters,
    dividerX,
    binWidth: SPACING,
    binWallHeight,
    binTopY,
    halfWidth,
    apexY,
    lastRowY,
    floorY,
    dropY,
    throatHalfWidth,
    funnelTopY,
    wall,
    topY,
    height: topY - floorY,
    width: halfWidth * 2,
    centerY: (topY + floorY) / 2,
  }
}

/**
 * Release points for `count` marbles, spread across the funnel mouth so
 * simultaneous drops never spawn inside one another. The funnel gathers them
 * back to the throat on the way down.
 */
export function releasePoints(count: number, geo: BoardGeometry): number[] {
  if (count <= 1) return [0]
  const usable = geo.halfWidth * 0.9
  const step = Math.min(usable / (count - 1), MARBLE_RADIUS * 3.5)
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
}
