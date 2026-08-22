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

/** Three gridlines — top, middle, bottom — each labelled with its value. */
export function AxisGrid({
  axis,
  left,
  right,
  format,
}: {
  axis: ValueAxis
  left: number
  right: number
  format: (value: number) => string
}) {
  return (
    <>
      {[axis.max, (axis.max + axis.min) / 2, axis.min].map((value) => (
        <g key={value}>
          <line x1={left} x2={right} y1={axis.y(value)} y2={axis.y(value)} className="chart-grid" />
          <text
            x={left - TICK_GAP}
            y={axis.y(value) + TICK_BASELINE}
            className="chart-tick chart-tick-y"
          >
            {format(value)}
          </text>
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
