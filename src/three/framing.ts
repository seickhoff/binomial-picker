/**
 * What the camera frames, as arithmetic.
 *
 * Kept free of three and React so the geometry can be checked directly: every
 * framing bug this board has had has been in this arithmetic rather than in the
 * rig that applies it.
 */
import { BOARD_DEPTH, FLOOR_THICKNESS, ROW_GAP, type BoardGeometry } from '../game/geometry'
import { CAMERA_FOV } from './fit'

/**
 * How far the camera sits above the point it looks at. Small — the drama comes
 * from the wide field of view, not from craning over the board.
 */
export const PITCH_DEG = 10

/**
 * Peg rows kept in frame below the apex at the start of a drop.
 *
 * Counted below the apex, rather than as a flat frame height, because the funnel
 * scales with the board's width: at 24 rows its mouth is 7.9 units tall on its
 * own. A fixed height therefore spent the entire opening shot on funnel and left
 * 0.3 of a peg row visible, where a 10-row board got nearly five.
 */
const CLOSE_ROWS = 5

/** Space left between the device and the frame edge it is anchored to. */
const EDGE_MARGIN_PX = 16

/**
 * Air around the device in the held-space overview, as a multiplier on its size.
 *
 * Enough that the board is clearly inside the frame rather than touching it: the
 * point of the shot is to see the whole thing at once, and a device pressed
 * against the edges doesn't read as whole.
 */
const OVERVIEW_MARGIN = 1.18

/** The two framings the rig moves between, plus the points it looks at. */
export interface Shot {
  readonly closeHeight: number
  readonly wideHeight: number
  readonly entryY: number
  /** Look-at height for the finished board. */
  readonly endY: number
  /** The whole device at once: look-at and framed height for the overview. */
  readonly overviewY: number
  readonly overviewHeight: number
  readonly halfFovTan: number
}

/**
 * How far above the look-at the frame's `side` edge falls (+1 top, −1 bottom),
 * for a point at depth `z`.
 *
 * Two things make this more than "half the framed height".
 *
 * The camera is pitched down, so the top of the screen meets the board nearer
 * the look-at than half a frame, and the bottom meets it further away.
 *
 * And depth matters: the plinth's front face is most of a unit nearer the camera
 * than the board's centre plane, and anything nearer projects further from the
 * centre of frame. Solving at z = 0 therefore put the real front edge below the
 * bottom of the screen — which is exactly how it once got cropped.
 */
function edgeRise(framedHeight: number, halfFovTan: number, side: 1 | -1, z = 0): number {
  const pitch = (PITCH_DEG * Math.PI) / 180
  const sinP = Math.sin(pitch)
  const cosP = Math.cos(pitch)
  const distance = framedHeight / 2 / halfFovTan

  return (
    (side * halfFovTan * distance + z * (sinP - side * halfFovTan * cosP)) /
    (cosP + side * halfFovTan * sinP)
  )
}

/** World height that lands on the frame's `side` edge, at depth `z`. */
export function frameEdgeY(
  lookAtY: number,
  framedHeight: number,
  halfFovTan: number,
  side: 1 | -1,
  z = 0,
): number {
  return lookAtY + edgeRise(framedHeight, halfFovTan, side, z)
}

/** Look-at that leaves a margin between a point on the device and one edge. */
function anchorTo(
  point: { y: number; z: number },
  framedHeight: number,
  halfFovTan: number,
  viewportHeight: number,
  side: 1 | -1,
): number {
  // Push the target out past the device, so the gap lands inside the frame.
  const margin = (EDGE_MARGIN_PX / Math.max(1, viewportHeight)) * framedHeight
  return point.y + side * margin - edgeRise(framedHeight, halfFovTan, side, point.z)
}

/**
 * World size that draws an HTML overlay at its own CSS pixel size, once the
 * board is framed for the end of the drop.
 *
 * drei scales an `Html` by `distanceFactor` divided by the world height the
 * camera frames at that point, so handing it the framed height cancels out and
 * leaves the element at 1:1 — a 13px name is 13 screen pixels, on a 10-row board
 * and a 24-row one alike.
 *
 * That is the property worth holding. An overlay is text: what matters is how
 * big it lands on screen, not how big it is in world units. Sizing it off the
 * device's height instead made a deep board's tags nearly two bins wide, because
 * the board grows taller with every row while the marble each tag names and the
 * bin it lands in stay exactly one peg-space across.
 */
export function overlayScale(geo: BoardGeometry, aspect: number, viewportHeight: number): number {
  return shotFor(geo, aspect, viewportHeight).wideHeight
}

export function shotFor(geo: BoardGeometry, aspect: number, viewportHeight: number): Shot {
  const halfFovTan = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)

  // The funnel plus the first few rows of pegs.
  const funnelShot = geo.topY - geo.apexY + CLOSE_ROWS * ROW_GAP
  /*
   * Enough to read every bin at the end — and never tighter than the opening, so
   * the shot only ever widens.
   *
   * On a very wide viewport the bins are cheap to fit, so this floor is what
   * settles it. Clamping the opening down to meet it instead would put the
   * lattice back off screen on exactly the deep boards this is here to fix.
   */
  const wideHeight = Math.max(geo.binWallHeight * 3.4, (geo.width * 1.12) / aspect, funnelShot)
  /*
   * The opening is the funnel and the first rows of pegs, at every shape of window.
   *
   * It was briefly capped so it could never be more than half again tighter than
   * the closing shot, to stop the name tags — sized once, against the closing frame
   * — opening several times too large on a phone. That fixed the tags by taking the
   * drop's whole zoom out of the deep boards: fitting a 24-row board across 390px
   * takes 61 units of height at the end, and a frame 40 units tall at the funnel is
   * already taller than the entire board, so the shot opened wide and stayed there.
   *
   * The tags are dealt with where they are drawn instead — on a narrow screen they
   * are given a fixed pixel size rather than one derived from the framing — which
   * leaves the camera free to do the thing it is for.
   */
  const closeHeight = funnelShot

  // The nearest, lowest corner the device draws: the bottom of the plinth's front
  // face, which the price ladder sits on rather than below.
  const deviceBottom = { y: geo.floorY - FLOOR_THICKNESS, z: BOARD_DEPTH * 0.65 }
  // The funnel walls' front edge, at the top.
  const deviceTop = { y: geo.topY, z: BOARD_DEPTH / 2 }

  return {
    // Zoomed in: a handful of rows, not the whole board.
    closeHeight,
    // Zoomed out just enough to read every bin at the end.
    wideHeight,
    /*
     * Both shots hang the device off the edge the action is at, rather than
     * centring on it — centring leaves half a frame of empty backdrop on the far
     * side and pushes the board away from where the eye is. The drop starts at
     * the funnel, so that shot hangs from the top; it ends in the bins, so that
     * one sits on the bottom.
     */
    entryY: anchorTo(deviceTop, closeHeight, halfFovTan, viewportHeight, 1),
    /*
     * Anchored to the bottom while the frame is tighter than the device; centred
     * on it once the frame is the roomier of the two.
     *
     * Hanging it off the bottom is right whenever something has to be cut: what
     * goes off screen should be the far end, not the end the marbles are arriving
     * at. But a phone held upright has to frame 27 units of height to fit an
     * 11-unit board across, and a 15-unit board pinned to the bottom of that
     * leaves a void above it taller than the board — the look-at lands above the
     * top of the funnel, and the bins are pressed into the bottom edge, which on a
     * phone is where the round bar is.
     *
     * Once everything fits there is no far end to sacrifice, so the device sits in
     * the middle and the surplus splits evenly above and below it. The two agree at
     * the crossover — a frame exactly as tall as the device is both anchored and
     * centred — so nothing jumps as a window is resized past it.
     */
    endY:
      wideHeight >= geo.height
        ? geo.centerY
        : anchorTo(deviceBottom, wideHeight, halfFovTan, viewportHeight, -1),
    /*
     * Centred on the device rather than hung off an edge, because for once the
     * whole thing is meant to be in view and there is no action to favour.
     *
     * Fitted to whichever dimension is tighter: a deep board is taller than it
     * is wide, a shallow one the other way about, and on a wide window it is the
     * height that runs out first either way.
     */
    overviewY: geo.centerY,
    overviewHeight: Math.max(geo.height * OVERVIEW_MARGIN, (geo.width * OVERVIEW_MARGIN) / aspect),
    halfFovTan,
  }
}
