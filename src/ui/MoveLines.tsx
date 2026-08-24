import { useMemo } from 'react'
import { colorForSlot } from '../game/palette'
import { seriesWalks } from '../game/series'
import {
  AxisGrid,
  CHART_WIDTH,
  OpeningLine,
  PLOT_HEIGHT,
  valueAxis,
  valueFormat,
} from './chartAxis'
import { useChartPick } from './chartPick'
import { smoothPath } from './curve'
import type { Mode, RankedEntry, Round } from '../game/types'

/**
 * Every player's walk down the board, row by row.
 *
 * The distribution chart shows where a marble *could* have finished; this shows
 * the route each one actually took — the same data a price chart is made of,
 * because that is literally what the drop is: one ±50¢ move per row.
 */
export interface MoveLinesProps {
  entries: readonly RankedEntry[]
  /**
   * Every session of the series, oldest first. A Stock Market series that took
   * four days to settle draws as one line four days long, because that is what
   * the prices did.
   */
  sessions: readonly Round[]
  mode: Mode
  /** Shared opening price, or null when players opened at different prices. */
  openPrice: number | null
  /** What to write at each line's end, per player id. See `lineLabels`. */
  labels: ReadonlyMap<string, string>
}

const PAD = { top: 14, right: 62, bottom: 22, left: 44 }

export function MoveLines({ entries, sessions, mode, openPrice, labels }: MoveLinesProps) {
  const { picked, marks } = useChartPick<string>()

  const walks = useMemo(() => {
    const byId = new Map(entries.map((entry) => [entry.player.id, entry]))
    return seriesWalks(sessions, mode)
      .map((walk) => ({ ...walk, entry: byId.get(walk.playerId) }))
      .filter((walk): walk is typeof walk & { entry: RankedEntry } => walk.entry !== undefined)
  }, [entries, sessions, mode])

  if (walks.length === 0) return null

  // The longest line sets the axis; a player still mid-series has a shorter one.
  const rows = Math.max(...walks.map((walk) => walk.values.length - 1))
  const dayBreaks = walks[0].dayBreaks

  const axis = valueAxis(
    walks.flatMap((walk) => walk.values),
    PAD.top,
  )
  const y = axis.y
  const plotW = CHART_WIDTH - PAD.left - PAD.right
  const x = (row: number) => PAD.left + (row / Math.max(1, rows)) * plotW
  const height = PAD.top + PLOT_HEIGHT + PAD.bottom
  const label = valueFormat(mode)

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          role="img"
          aria-label={`Each player's ${mode === 'stock' ? 'price' : 'position'} over ${rows} rows${
            dayBreaks.length > 0 ? ` across ${dayBreaks.length + 1} sessions` : ''
          }`}
        >
          <AxisGrid axis={axis} left={PAD.left} right={CHART_WIDTH - PAD.right} mode={mode} />

          {/* Where one session ended and the next opened. Without these the line
              is a single long walk, and the days it took to get there — the whole
              reason the series ran on — are invisible. */}
          {dayBreaks.map((row, index) => (
            <g key={row} className="chart-day-break">
              <line x1={x(row)} x2={x(row)} y1={PAD.top} y2={PAD.top + PLOT_HEIGHT} />
              <text x={x(row) + 4} y={PAD.top + 9} className="chart-tick">
                Day {index + 2}
              </text>
            </g>
          ))}

          <OpeningLine
            axis={axis}
            openPrice={openPrice}
            mode={mode}
            left={PAD.left}
            right={CHART_WIDTH - PAD.right}
          />

          {walks.map(({ entry, values }) => {
            const path = smoothPath(values.map((value, row) => ({ x: x(row), y: y(value) })))
            const dimmed = picked !== null && picked !== entry.player.id
            return (
              <g key={entry.player.id} className={dimmed ? 'move-line is-dimmed' : 'move-line'}>
                <path d={path} stroke={colorForSlot(entry.player.slot).hex} />
                {/* Wide invisible stroke so the line is easy to hit. */}
                <path d={path} className="move-line-hit" {...marks(entry.player.id)} />
              </g>
            )
          })}

          {/* Each line labelled where it ends — so a line is identified by more
              than its colour. */}
          {walks.map(({ entry, values }) => {
            const endY = y(values[values.length - 1])
            const dimmed = picked !== null && picked !== entry.player.id
            return (
              <text
                key={entry.player.id}
                x={x(rows) + 8}
                y={endY + 3.5}
                className="chart-end-label"
                fill={colorForSlot(entry.player.slot).hex}
                opacity={dimmed ? 0.25 : 1}
              >
                {labels.get(entry.player.id)}
              </text>
            )
          })}

          <text x={PAD.left} y={height - 6} className="chart-tick">
            {dayBreaks.length > 0 ? 'Day 1' : 'row 0'}
          </text>
          <text x={x(rows)} y={height - 6} textAnchor="end" className="chart-tick">
            {dayBreaks.length > 0 ? `${dayBreaks.length + 1} days · ${rows} rows` : `row ${rows}`}
          </text>
        </svg>

        {picked !== null && (
          <div className="chart-tooltip chart-tooltip-corner">
            {walks
              .filter((walk) => walk.entry.player.id === picked)
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
