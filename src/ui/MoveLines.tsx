import { useMemo, useState } from 'react'
import { formatPrice, walkOf } from '../game/modes'
import { colorForSlot } from '../game/palette'
import type { Mode, RankedEntry } from '../game/types'

/**
 * Every player's walk down the board, row by row.
 *
 * The distribution chart shows where a marble *could* have finished; this shows
 * the route each one actually took — the same data a price chart is made of,
 * because that is literally what the drop is: one ±50¢ move per row.
 */
export interface MoveLinesProps {
  entries: readonly RankedEntry[]
  rows: number
  mode: Mode
  /** Shared opening price, or null when players opened at different prices. */
  openPrice: number | null
  /** Ticker symbol per player id, used to label each line's end. */
  symbols: ReadonlyMap<string, string>
}

const PAD = { top: 14, right: 62, bottom: 22, left: 44 }
const PLOT_H = 190
const WIDTH = 560

export function MoveLines({ entries, rows, mode, openPrice, symbols }: MoveLinesProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const walks = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          values: walkOf(entry.landing.flips, entry.openPrice, mode),
        }))
        // A landing recorded without its flips can't be drawn.
        .filter((walk) => walk.values.length > 1),
    [entries, mode],
  )

  if (walks.length === 0) return null

  const all = walks.flatMap((walk) => walk.values)
  const low = Math.min(...all)
  const high = Math.max(...all)
  // Never a zero-height axis, and always a little air above and below.
  const pad = Math.max((high - low) * 0.12, 0.5)
  const min = low - pad
  const max = high + pad

  const plotW = WIDTH - PAD.left - PAD.right
  const x = (row: number) => PAD.left + (row / Math.max(1, rows)) * plotW
  const y = (value: number) => PAD.top + (1 - (value - min) / (max - min)) * PLOT_H
  const height = PAD.top + PLOT_H + PAD.bottom

  const label = (value: number) => (mode === 'stock' ? formatPrice(value) : formatSlots(value))

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={`Each player's ${mode === 'stock' ? 'price' : 'position'} over ${rows} rows`}
        >
          {[max, (max + min) / 2, min].map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid"
              />
              <text x={PAD.left - 7} y={y(value) + 3.5} className="chart-tick chart-tick-y">
                {label(value)}
              </text>
            </g>
          ))}

          {/* The opening price, when everyone shares one: the line that says who
              finished up and who finished down. */}
          {openPrice !== null && (
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(mode === 'stock' ? openPrice : 0)}
              y2={y(mode === 'stock' ? openPrice : 0)}
              className="chart-open-line"
            />
          )}

          {walks.map(({ entry, values }) => {
            const points = values.map((value, row) => `${x(row)},${y(value)}`).join(' ')
            const dimmed = hovered !== null && hovered !== entry.player.id
            return (
              <g key={entry.player.id} className={dimmed ? 'move-line is-dimmed' : 'move-line'}>
                <polyline points={points} stroke={colorForSlot(entry.player.slot).hex} />
                {/* Wide invisible stroke so the line is easy to hit. */}
                <polyline
                  points={points}
                  className="move-line-hit"
                  onPointerEnter={() => setHovered(entry.player.id)}
                  onPointerLeave={() => setHovered((id) => (id === entry.player.id ? null : id))}
                />
              </g>
            )
          })}

          {/* Each line labelled where it ends, with the symbol it trades under —
              so a line is identified by name, not only by colour. */}
          {walks.map(({ entry, values }) => {
            const endY = y(values[values.length - 1])
            const dimmed = hovered !== null && hovered !== entry.player.id
            return (
              <text
                key={entry.player.id}
                x={x(rows) + 8}
                y={endY + 3.5}
                className="chart-end-label"
                fill={colorForSlot(entry.player.slot).hex}
                opacity={dimmed ? 0.25 : 1}
              >
                {symbols.get(entry.player.id)}
              </text>
            )
          })}

          <text x={PAD.left} y={height - 6} className="chart-tick">
            row 0
          </text>
          <text x={x(rows)} y={height - 6} textAnchor="end" className="chart-tick">
            row {rows}
          </text>
        </svg>

        {hovered !== null && (
          <div className="chart-tooltip chart-tooltip-corner">
            {walks
              .filter((walk) => walk.entry.player.id === hovered)
              .map(({ entry, values }) => (
                <span key={entry.player.id}>
                  <strong>{entry.player.name}</strong> {label(values[values.length - 1])}
                </span>
              ))}
          </div>
        )}
      </div>
    </figure>
  )
}

/** Slots from the centre, for Black Swan where there is no price. */
function formatSlots(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}
