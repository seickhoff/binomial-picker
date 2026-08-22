/**
 * A smooth path through a set of points.
 *
 * Nothing here moves a point or averages anything away: the zigzag in a price
 * line is real, one 50¢ move per row, and smoothing it away would be drawing a
 * different game. All this replaces is the straight ink *between* points with a
 * curve that still passes through every one of them.
 *
 * The interpolation is monotone cubic (Fritsch–Carlson) rather than the more
 * usual Catmull-Rom, for one reason: Catmull-Rom bulges past a turning point,
 * and here that would draw a high the price never reached — on a chart sitting
 * beside a table of exact closes. Monotone cubic is flat at every turn instead,
 * which is both honest and what turns a run of alternating rows into a wave
 * rather than a saw.
 */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Two decimals is finer than a pixel here, and keeps the path strings short. */
const round = (value: number) => Math.round(value * 100) / 100

/**
 * How far along each gap the control points sit, and so how round the curve is.
 *
 * A half is the most this can be. At exactly a half the two control points meet
 * in the middle of the gap, which is the roundest a cubic through both endpoints
 * can be; past that they cross over and the curve kinks back on itself.
 *
 * It is not a free knob — it sets the tangent limit below. A control point sits
 * `slope × gap × reach` from its end, so the further out it reaches, the smaller
 * the steepest tangent that still keeps it between the two points it is joining.
 * Reach and limit multiply to one, and that is what keeps the curve inside the
 * data at any roundness.
 */
const REACH = 0.5
const TANGENT_LIMIT = 1 / REACH

export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const start = `M ${round(points[0].x)} ${round(points[0].y)}`
  if (points.length === 1) return start

  const slopes = monotoneSlopes(points)
  let path = start

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    // Hermite to Bézier: each control point reaches along the gap, at the height
    // that end's tangent would carry it to.
    const reach = (to.x - from.x) * REACH
    path +=
      ` C ${round(from.x + reach)} ${round(from.y + slopes[i] * reach)}` +
      ` ${round(to.x - reach)} ${round(to.y - slopes[i + 1] * reach)}` +
      ` ${round(to.x)} ${round(to.y)}`
  }

  return path
}

/** A tangent at each point that keeps the curve inside its own data. */
function monotoneSlopes(points: readonly Point[]): number[] {
  const count = points.length
  const secants: number[] = []

  for (let i = 0; i < count - 1; i++) {
    const run = points[i + 1].x - points[i].x
    secants.push(run === 0 ? 0 : (points[i + 1].y - points[i].y) / run)
  }

  const slopes = new Array<number>(count)
  slopes[0] = secants[0]
  slopes[count - 1] = secants[count - 2]

  for (let i = 1; i < count - 1; i++) {
    // A turning point has secants of opposite sign. Flattening the tangent there
    // is what stops the curve from carrying on past the peak.
    slopes[i] = secants[i - 1] * secants[i] <= 0 ? 0 : (secants[i - 1] + secants[i]) / 2
  }

  // Fritsch–Carlson, with the limit set by how far the control points reach:
  // hold each tangent inside it, or the curve bows out past the two points it is
  // only meant to be joining.
  for (let i = 0; i < count - 1; i++) {
    if (secants[i] === 0) {
      slopes[i] = 0
      slopes[i + 1] = 0
      continue
    }
    const before = slopes[i] / secants[i]
    const after = slopes[i + 1] / secants[i]
    const size = before * before + after * after
    if (size > TANGENT_LIMIT * TANGENT_LIMIT) {
      const scale = TANGENT_LIMIT / Math.sqrt(size)
      slopes[i] = scale * before * secants[i]
      slopes[i + 1] = scale * after * secants[i]
    }
  }

  return slopes
}
