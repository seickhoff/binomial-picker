import { useState } from 'react'
import { trendOf } from '../game/modes'
import type { Candle } from '../game/series'
import type { Mode, RankedEntry } from '../game/types'
import {
  AxisGrid,
  CHART_WIDTH,
  OpeningLine,
  PLOT_HEIGHT,
  valueAxis,
  valueFormat,
} from './chartAxis'

/**
 * One candle per player, best first.
 *
 * The line chart shows how everyone got there and takes reading; this shows where
 * they ended up and takes a glance. A candle is four numbers — opened, closed,
 * and the best and worst it reached in between — and the eye compares a row of
 * them without following anything.
 *
 * Ordered by rank rather than by roster, so the winner is the leftmost candle in
 * either mode. That is the point of having it.
 *
 * Green up and red down, which is the one thing about a candlestick everybody
 * already knows. It is also the only thing colour can say here: the player
 * palette contains a green, an emerald and a coral, so identity colours on the
 * bodies were being read as gain and loss by anyone who has seen a price chart —
 * correctly, because that is what green and red mean on a candle. Identity moved
 * to the label under each candle: the symbol itself, in plain white, so the only
 * colours in the chart are the two that mean something.
 */
export interface CandleChartProps {
  /** Ranked best first; the order the candles are drawn in. */
  entries: readonly RankedEntry[]
  candles: readonly Candle[]
  mode: Mode
  /** Shared opening price, or null when players opened at different prices. */
  openPrice: number | null
  /** What to write under each candle, per player id. */
  labels: ReadonlyMap<string, string>
}

const PAD = { top: 14, right: 12, bottom: 30, left: 44 }
/** Widest a candle body gets, however few players there are. */
const MAX_BODY_WIDTH = 26
/** Narrowest it may be drawn before it stops reading as a body at all. */
const MIN_BODY_WIDTH = 3
/** Share of its lane a body fills, leaving the rest as a gap to its neighbour. */
const BODY_SHARE = 0.58
/** Below this much room per candle, the labels are turned to fit. */
const TURN_LABELS_BELOW = 30
/** Drop below the plot for the labels, clearing the axis. */
const LABEL_DROP = 14

export function CandleChart({ entries, candles, mode, openPrice, labels }: CandleChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const byId = new Map(candles.map((candle) => [candle.playerId, candle]))
  const drawn = entries
    .map((entry) => ({ entry, candle: byId.get(entry.player.id) }))
    .filter((pair): pair is { entry: RankedEntry; candle: Candle } => pair.candle !== undefined)

  if (drawn.length === 0) return null

  const axis = valueAxis(
    drawn.flatMap(({ candle }) => [candle.high, candle.low]),
    PAD.top,
  )
  const y = axis.y

  // Every candle gets an equal share of the width, so twenty fit where four do.
  const lane = (CHART_WIDTH - PAD.left - PAD.right) / drawn.length
  const bodyWidth = Math.max(MIN_BODY_WIDTH, Math.min(MAX_BODY_WIDTH, lane * BODY_SHARE))
  const centreOf = (index: number) => PAD.left + lane * (index + 0.5)
  const height = PAD.top + PLOT_HEIGHT + PAD.bottom
  const labelY = PAD.top + PLOT_HEIGHT + LABEL_DROP
  const turned = lane < TURN_LABELS_BELOW
  const label = valueFormat(mode)

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          role="img"
          aria-label={`Opening, closing, highest and lowest ${
            mode === 'stock' ? 'price' : 'position'
          } for each player, best first`}
        >
          <AxisGrid axis={axis} left={PAD.left} right={CHART_WIDTH - PAD.right} mode={mode} />
          <OpeningLine
            axis={axis}
            openPrice={openPrice}
            mode={mode}
            left={PAD.left}
            right={CHART_WIDTH - PAD.right}
          />

          {drawn.map(({ entry, candle }, index) => {
            const centre = centreOf(index)
            const bodyLow = Math.min(candle.open, candle.close)
            const bodyHigh = Math.max(candle.open, candle.close)
            // Against its own open, which is only "against $100" on day one: after
            // hours every stock carries its own price in.
            const trend = trendOf(candle.close - candle.open)
            const dimmed = hovered !== null && hovered !== entry.player.id

            return (
              <g
                key={entry.player.id}
                className={dimmed ? 'candle is-dimmed' : 'candle'}
                onPointerEnter={() => setHovered(entry.player.id)}
                onPointerLeave={() => setHovered((id) => (id === entry.player.id ? null : id))}
              >
                {/* The wick: the whole range the price ever covered. */}
                <line
                  x1={centre}
                  x2={centre}
                  y1={y(candle.high)}
                  y2={y(candle.low)}
                  className="candle-wick"
                  data-trend={trend}
                />
                {/* Open to close. */}
                <rect
                  x={centre - bodyWidth / 2}
                  y={y(bodyHigh)}
                  width={bodyWidth}
                  height={Math.max(1, y(bodyLow) - y(bodyHigh))}
                  className="candle-body"
                  data-trend={trend}
                />
                {/* A target the full lane wide, so a thin candle is still easy
                    to point at. */}
                <rect
                  x={centre - lane / 2}
                  y={PAD.top}
                  width={lane}
                  height={PLOT_HEIGHT}
                  className="candle-hit"
                />
              </g>
            )
          })}

          {/* Identity lives here, as the symbol. White, not the player's colour:
              the candles are already green and red, and a third colour scheme
              underneath them is one the eye has to be told how to read. */}
          {drawn.map(({ entry }, index) => {
            const centre = centreOf(index)
            const dimmed = hovered !== null && hovered !== entry.player.id
            return (
              <text
                key={entry.player.id}
                x={centre}
                y={labelY}
                className={entry.isWinner ? 'candle-label is-winner' : 'candle-label'}
                textAnchor={turned ? 'end' : 'middle'}
                transform={turned ? `rotate(-45 ${centre} ${labelY})` : undefined}
                opacity={dimmed ? 0.25 : 1}
              >
                {labels.get(entry.player.id)}
              </text>
            )
          })}
        </svg>

        {hovered !== null && (
          <div className="chart-tooltip chart-tooltip-corner">
            {drawn
              .filter(({ entry }) => entry.player.id === hovered)
              .map(({ entry, candle }) => (
                <span key={entry.player.id}>
                  <strong>{entry.player.name}</strong> open {label(candle.open)} · high{' '}
                  {label(candle.high)} · low {label(candle.low)} · close {label(candle.close)}
                </span>
              ))}
          </div>
        )}
      </div>
    </figure>
  )
}
