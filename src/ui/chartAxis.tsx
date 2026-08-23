import { formatPrice, formatSlots } from '../game/modes'
import type { Mode } from '../game/types'

/**
 * The vertical axis the value charts share.
 *
 * Two charts plot the same quantity against the same axis — the price a player
 * reached — and they were computing that axis, its padding and its gridlines
 * twice, identically. A third chart would have made it three times.
 *
 * The distribution chart is deliberately not a client: its axis is a probability,
 * fixed at zero to the peak, and nothing here would fit it.
 */
export const CHART_WIDTH = 560
export const PLOT_HEIGHT = 190

/** Air above and below the data, as a share of its range. */
const HEADROOM = 0.12
/** The least air to leave, for a field that barely moved. */
const MIN_HEADROOM = 0.5
/** Lifts a tick's baseline to the middle of its gridline. */
const TICK_BASELINE = 3.5
/** Gap between a tick and the axis it labels. */
const TICK_GAP = 7

export interface ValueAxis {
  readonly min: number
  readonly max: number
  /** Where a value sits vertically, in the plot's own units. */
  y(value: number): number
}

/**
 * An axis that contains `values` with a little room to spare.
 *
 * Never a zero-height axis: a field that all closed at the same price still needs
 * somewhere to draw them, and dividing by a zero range would put them nowhere.
 */
export function valueAxis(values: readonly number[], top: number): ValueAxis {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const headroom = Math.max((high - low) * HEADROOM, MIN_HEADROOM)
  const min = low - headroom
  const max = high + headroom

  return {
    min,
    max,
    y: (value) => top + (1 - (value - min) / (max - min)) * PLOT_HEIGHT,
  }
}

/** How a value reads in each mode: a price, or slots from the centre. */
export function valueFormat(mode: Mode): (value: number) => string {
  return mode === 'stock' ? formatPrice : formatSlots
}

/**
 * Rungs the gridlines may sit on, finest first, as [minor, major].
 *
 * The ladder is anchored at zero rather than at the data, which is the whole point
 * of it: a line at $100.25 is at $100.25 whatever the field did, so the reader
 * measures against round money instead of against three padded numbers that change
 * every round. It also means $100 — a whole dollar, and where every first session
 * opens — is a strong line whenever the axis reaches it, which on a first session
 * it always does, because that is where every walk began.
 *
 * Every value here is exactly representable in binary, so a multiple of a minor
 * rung lands exactly on a major one and the emphasis never wobbles.
 */
const PRICE_RUNGS = [
  [0.25, 1],
  [0.5, 2],
  [1, 5],
  [2.5, 10],
  [5, 20],
  [10, 50],
  [25, 100],
] as const

/** The same, for a board measured in slots, where a quarter of a slot is nothing. */
const SLOT_RUNGS = [
  [1, 5],
  [2, 10],
  [5, 25],
  [10, 50],
  [25, 100],
] as const

/** The least room a faint line needs, in plot pixels, before the grid reads as a wash. */
const MIN_MINOR_GAP = 9

/** A gridline, and whether it carries the emphasis and the label. */
export interface GridLine {
  readonly value: number
  readonly major: boolean
}

/**
 * The gridlines for an axis: every minor rung it spans, the round ones marked.
 *
 * Both modes are guaranteed at least one major line, so the axis is never
 * unlabelled. In stock mode the majors are whole dollars and the axis always spans
 * at least a dollar, and any interval that wide contains a whole one. In slots mode
 * every walk starts from the centre, so zero is always on the axis — and zero is a
 * multiple of everything.
 */
export function gridLines(axis: ValueAxis, mode: Mode): GridLine[] {
  const [minor, major] = rungFor(mode, axis.max - axis.min)
  const lines: GridLine[] = []

  for (let step = Math.ceil(axis.min / minor); step <= Math.floor(axis.max / minor); step++) {
    const value = step * minor
    // Tolerant of sign, not of arithmetic: -5 % 5 is -0, and every rung is exact.
    lines.push({ value, major: Math.abs(value % major) === 0 })
  }

  return lines
}

/** The finest rung whose minor lines still stand apart at this height. */
function rungFor(mode: Mode, span: number): readonly [number, number] {
  const rungs = mode === 'stock' ? PRICE_RUNGS : SLOT_RUNGS
  const roomy = rungs.find(([minor]) => (PLOT_HEIGHT * minor) / span >= MIN_MINOR_GAP)
  return roomy ?? rungs[rungs.length - 1]
}

/**
 * The horizontal grid: a faint line every minor rung, a stronger, labelled one on
 * every round value.
 *
 * Only the majors are labelled. The minors are there to be measured against, not
 * read, and a number on each of twenty of them is a wall of digits.
 */
export function AxisGrid({
  axis,
  left,
  right,
  mode,
}: {
  axis: ValueAxis
  left: number
  right: number
  mode: Mode
}) {
  const format = valueFormat(mode)

  return (
    <>
      {gridLines(axis, mode).map(({ value, major }) => (
        <g key={value}>
          <line
            x1={left}
            x2={right}
            y1={axis.y(value)}
            y2={axis.y(value)}
            className={major ? 'chart-grid is-major' : 'chart-grid is-minor'}
          />
          {major && (
            <text
              x={left - TICK_GAP}
              y={axis.y(value) + TICK_BASELINE}
              className="chart-tick chart-tick-y"
            >
              {format(value)}
            </text>
          )}
        </g>
      ))}
    </>
  )
}

/**
 * Where everyone began: the line that says who finished up and who finished down.
 *
 * Drawn only when the field shares an opening price. After hours each stock
 * carries its own price in, and a single line would be claiming otherwise.
 */
export function OpeningLine({
  axis,
  openPrice,
  mode,
  left,
  right,
}: {
  axis: ValueAxis
  openPrice: number | null
  mode: Mode
  left: number
  right: number
}) {
  if (openPrice === null) return null
  // Black Swan measures slots from the centre, so its own opening line is zero.
  const value = mode === 'stock' ? openPrice : 0

  return (
    <line x1={left} x2={right} y1={axis.y(value)} y2={axis.y(value)} className="chart-open-line" />
  )
}
