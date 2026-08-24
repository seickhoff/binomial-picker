import { useLayoutEffect, useMemo, useRef } from 'react'
import { binomialPmf, formatOdds, formatPercent } from '../game/binomial'
import { slotLabel } from '../game/modes'
import { colorForSlot } from '../game/palette'
import { popupLeft, useChartPick } from './chartPick'
import { axisLabelInterval, chartSubtitle, chartTitle } from './presenters'
import type { Landing, Mode, Player } from '../game/types'

/**
 * Expected distribution as bars (one series — the title names it, so no legend
 * box), with the actual landings as a labelled rug beneath the axis. Bars and
 * badges never share a scale: the badges mark identity in a bin, not a value.
 */
export interface DistributionChartProps {
  rows: number
  landings: readonly Landing[]
  players: readonly Player[]
  winnerBins: readonly number[]
  mode: Mode
  /**
   * Stock Market mode: the price every entrant opened at, or null when they
   * differ — after hours, each stock carries its own price forward, so slots are
   * labelled by their move instead.
   */
  openPrice: number | null
}

const PAD = { top: 14, right: 10, bottom: 20, left: 38 }
const PLOT_H = 132
const BADGE = 9
const BADGE_ROW = 22

export function DistributionChart({
  rows,
  landings,
  players,
  winnerBins,
  mode,
  openPrice,
}: DistributionChartProps) {
  const stock = mode === 'stock'
  const labelFor = (bin: number) => slotLabel({ mode, bin, rows, openPrice })
  const { picked, marks } = useChartPick<number>()
  const pmf = useMemo(() => binomialPmf(rows), [rows])
  const peak = Math.max(...pmf)

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const byBin = useMemo(() => {
    const map = new Map<number, { player: Player; landing: Landing }[]>()
    for (const landing of landings) {
      const player = playersById.get(landing.playerId)
      if (!player) continue
      const list = map.get(landing.bin) ?? []
      list.push({ player, landing })
      map.set(landing.bin, list)
    }
    return map
  }, [landings, playersById])

  const stackDepth = Math.max(1, ...[...byBin.values()].map((l) => l.length))
  const rugH = stackDepth * BADGE_ROW
  const width = 560
  const height = PAD.top + PLOT_H + PAD.bottom + rugH
  const plotW = width - PAD.left - PAD.right
  const colW = plotW / pmf.length
  const barW = Math.max(3, colW - 3)
  const baselineY = PAD.top + PLOT_H

  const ticks = [0, peak / 2, peak]
  const columnX = (bin: number) => PAD.left + bin * colW
  const columnCenter = (bin: number) => columnX(bin) + colW / 2
  const labelEvery = axisLabelInterval(pmf.length, mode)

  const pickedInfo =
    picked === null
      ? null
      : {
          bin: picked,
          probability: pmf[picked],
          landed: byBin.get(picked) ?? [],
          /* Where the column sits across the plot, as a fraction — the SVG is
             scaled to whatever width it is given, so user units mean nothing to
             a popup measured in CSS pixels. */
          x: columnCenter(picked) / width,
        }

  /*
   * The popup is placed against the plot's real width rather than left to a
   * percentage and a half-width translate, which put the first bar's popup off
   * the left edge of the card and the last bar's off the right — and the card
   * clips, so what hung over was simply lost.
   *
   * Measured and clamped in a layout effect, so the popup is already in place at
   * the first paint. Re-measured on resize because a tapped popup outlives the
   * gesture that opened it: the card can be dragged and the phone's address bar
   * comes and goes underneath it.
   */
  const plotRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const anchor = pickedInfo === null ? null : pickedInfo.x

  useLayoutEffect(() => {
    const plot = plotRef.current
    const popup = popupRef.current
    if (plot === null || popup === null || anchor === null) return

    const place = () => {
      const room = plot.clientWidth
      popup.style.left = `${popupLeft(anchor * room, popup.offsetWidth, room)}px`
    }

    place()
    const observer = new ResizeObserver(place)
    observer.observe(plot)
    return () => observer.disconnect()
  }, [anchor])

  return (
    <figure className="chart">
      <div className="chart-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${chartTitle(mode, openPrice)}. ${chartSubtitle(mode, rows, openPrice)}`}
        >
          {/* Recessive gridlines and y ticks. */}
          {ticks.map((t) => {
            const y = baselineY - (t / peak) * PLOT_H
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="chart-grid" />
                <text x={PAD.left - 7} y={y + 3.5} className="chart-tick chart-tick-y">
                  {formatPercent(t)}
                </text>
              </g>
            )
          })}

          {/* Expected-probability bars. */}
          {pmf.map((p, bin) => {
            const h = Math.max(2, (p / peak) * PLOT_H)
            const isWinner = winnerBins.includes(bin)
            const isPicked = picked === bin
            return (
              <rect
                key={bin}
                x={columnX(bin) + (colW - barW) / 2}
                y={baselineY - h}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                className={`chart-bar${isWinner ? ' is-winner' : ''}${isPicked ? ' is-picked' : ''}`}
              />
            )
          })}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={baselineY}
            y2={baselineY}
            className="chart-baseline"
          />

          {/* Bin labels. */}
          {pmf.map((_, bin) =>
            bin % labelEvery === 0 || winnerBins.includes(bin) ? (
              <text
                key={bin}
                x={columnCenter(bin)}
                y={baselineY + 14}
                className={`chart-tick${winnerBins.includes(bin) ? ' is-winner' : ''}`}
                textAnchor="middle"
              >
                {labelFor(bin)}
              </text>
            ) : null,
          )}

          {/* The rug: who actually landed where. Number badge carries identity
              alongside colour. */}
          {[...byBin.entries()].map(([bin, entries]) =>
            entries.map(({ player }, depth) => {
              const cx = columnCenter(bin)
              const cy = baselineY + PAD.bottom + depth * BADGE_ROW + BADGE + 2
              return (
                <g key={`${bin}:${player.id}`} className="chart-badge">
                  {/* 2px surface ring, so neighbouring colours never touch. */}
                  <circle cx={cx} cy={cy} r={BADGE + 1.5} className="chart-badge-ring" />
                  <circle cx={cx} cy={cy} r={BADGE} fill={colorForSlot(player.slot).hex} />
                </g>
              )
            }),
          )}

          {/* Hit targets, deliberately wider and taller than the marks. A finger
              gets the whole column, rug included. */}
          {pmf.map((_, bin) => (
            <rect
              key={bin}
              x={columnX(bin)}
              y={PAD.top}
              width={colW}
              height={PLOT_H + PAD.bottom + rugH}
              fill="transparent"
              {...marks(bin)}
            />
          ))}
        </svg>

        {pickedInfo && (
          <div className="chart-tooltip" ref={popupRef}>
            <strong>{stock ? labelFor(pickedInfo.bin) : `Bin ${pickedInfo.bin}`}</strong>
            <span>
              {formatPercent(pickedInfo.probability)} · {formatOdds(pickedInfo.probability)}
            </span>
            {pickedInfo.landed.length > 0 && (
              <span className="chart-tooltip-players">
                {pickedInfo.landed.map(({ player }) => player.name).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </figure>
  )
}
