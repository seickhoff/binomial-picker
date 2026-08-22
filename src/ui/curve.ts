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

export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const start = `M ${round(points[0].x)} ${round(points[0].y)}`
  if (points.length === 1) return start

  const slopes = monotoneSlopes(points)
  let path = start

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    // Hermite to Bézier: the control points sit a third of the way along, at the
    // height each end's tangent would carry them to.
    const third = (to.x - from.x) / 3
    path +=
      ` C ${round(from.x + third)} ${round(from.y + slopes[i] * third)}` +
      ` ${round(to.x - third)} ${round(to.y - slopes[i + 1] * third)}` +
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

  // Fritsch–Carlson: hold each tangent within three times its secant, or the
  // curve bows out sideways between two points it is only joining.
  for (let i = 0; i < count - 1; i++) {
    if (secants[i] === 0) {
      slopes[i] = 0
      slopes[i + 1] = 0
      continue
    }
    const before = slopes[i] / secants[i]
    const after = slopes[i + 1] / secants[i]
    const size = before * before + after * after
    if (size > 9) {
      const scale = 3 / Math.sqrt(size)
      slopes[i] = scale * before * secants[i]
      slopes[i + 1] = scale * after * secants[i]
    }
  }

  return slopes
}
