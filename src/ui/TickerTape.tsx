import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatTapePercent, formatTapePrice, totalTrendOf } from '../game/modes'
import { openPriceOf } from '../game/scoring'
import { useGame } from '../game/store'
import type { Player } from '../game/types'
import { quoteOf, subscribeQuotes } from '../live/priceFeed'
import { tickerSymbols } from '../game/symbols'

/**
 * Trading-floor ticker across the top of the screen in Stock Market mode.
 *
 * Prices move live: each marble publishes its running total as it strikes a peg.
 * The tape is deliberately *not* re-rendered when they do — the text is written
 * straight to the DOM instead.
 *
 * Two things keep the marquee smooth. React never touches the animated subtree
 * mid-round, so no style recalculation competes with the animation; and the
 * numeric columns are fixed-width (see `.ticker-price` and friends), so a price
 * going from "$98" to "$104" cannot reflow the row. Without that, every tick
 * resized the strip — and the strip's own width is what `translateX(-50%)` is
 * measured against, so the whole marquee jumped.
 */
export function TickerTape() {
  // Selecting the entrant list rather than the whole round keeps this from
  // re-rendering on every landing: its identity is stable for a round's life.
  const entrantIds = useGame((s) => s.round.entrantIds)
  const players = useGame((s) => s.players)
  const round = useGame((s) => s.round)

  const entrants = entrantIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined)
  const openPrices = entrants.map((player) => openPriceOf(player.id, round))
  // Derived from the whole roster, not just this round's entrants: a sit-out
  // must not change anyone's symbol, or the tape and the setup list disagree.
  const symbols = tickerSymbols(players)

  // Every cell showing a given player, across both marquee copies.
  const cells = useRef(new Map<string, TickerCells[]>())

  useEffect(() => {
    const paint = () => {
      entrants.forEach((player, i) => {
        const open = openPrices[i]
        const quote = quoteOf(player.id)
        const price = quote?.price ?? open
        // Both cells read against the common $100 start, so the number and its
        // colour agree.
        const trend = totalTrendOf(price)
        for (const cell of cells.current.get(player.id) ?? []) {
          cell.price.textContent = formatTapePrice(price)
          cell.percent.textContent = formatTapePercent(price)
          // On the item, so the symbol inherits it too.
          cell.item.dataset.trend = trend
          cell.price.dataset.trend = trend
          cell.percent.dataset.trend = trend
        }
      })
    }

    paint()
    return subscribeQuotes(paint)
    // Re-subscribing only matters when the field changes, once per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrantIds, players])

  const { viewport, group, repeats, duration } = useMarqueeFill(entrantIds.length)

  if (entrants.length === 0) return null

  return (
    <div className="ticker" aria-hidden="true" ref={viewport}>
      <div className="ticker-run" style={{ animationDuration: `${duration}s` } as CSSProperties}>
        {/* Two identical halves of `repeats` groups each, scrolled by exactly
            one half — so the loop is seamless and always covers the screen. */}
        {Array.from({ length: repeats * 2 }, (_, copy) => (
          <div className="ticker-group" key={copy} ref={copy === 0 ? group : undefined}>
            {entrants.map((player, i) => (
              <TickerItem
                key={`${copy}:${player.id}`}
                player={player}
                openPrice={openPrices[i]}
                symbol={symbols.get(player.id) ?? ''}
                registry={cells.current}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pixels per second the tape travels, whatever it's carrying. */
const SCROLL_SPEED = 55

/**
 * Repeats the run enough times to cover the screen.
 *
 * Two copies is plenty for a full roster, but a two-player tie-break would
 * leave most of the strip empty. Measuring one group tells us how many it takes
 * to fill the viewport; the duration is then derived from the distance so the
 * tape moves at the same speed with two names as with twenty.
 */
function useMarqueeFill(entrantCount: number) {
  const viewport = useRef<HTMLDivElement>(null)
  const group = useRef<HTMLDivElement>(null)
  const [fill, setFill] = useState({ repeats: 1, duration: 20 })

  useEffect(() => {
    const measure = () => {
      const across = viewport.current?.clientWidth ?? 0
      const groupWidth = group.current?.offsetWidth ?? 0
      if (across === 0 || groupWidth === 0) return

      const repeats = Math.max(1, Math.ceil(across / groupWidth))
      setFill((current) => {
        const duration = (groupWidth * repeats) / SCROLL_SPEED
        return current.repeats === repeats && Math.abs(current.duration - duration) < 0.01
          ? current
          : { repeats, duration }
      })
    }

    measure()

    // Watches both the strip and one group: the viewport changes on resize, and
    // the group's width changes when a webfont lands or the roster changes.
    const observer = new ResizeObserver(measure)
    if (viewport.current) observer.observe(viewport.current)
    if (group.current) observer.observe(group.current)
    return () => observer.disconnect()
  }, [entrantCount])

  return { viewport, group, ...fill }
}

interface TickerCells {
  item: HTMLSpanElement
  price: HTMLSpanElement
  percent: HTMLSpanElement
}

function TickerItem({
  player,
  openPrice,
  symbol,
  registry,
}: {
  player: Player
  openPrice: number
  symbol: string
  registry: Map<string, TickerCells[]>
}) {
  const item = useRef<HTMLSpanElement>(null)
  const price = useRef<HTMLSpanElement>(null)
  const percent = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!item.current || !price.current || !percent.current) return

    const cell: TickerCells = {
      item: item.current,
      price: price.current,
      percent: percent.current,
    }
    registry.set(player.id, [...(registry.get(player.id) ?? []), cell])

    return () => {
      registry.set(
        player.id,
        (registry.get(player.id) ?? []).filter((c) => c !== cell),
      )
    }
  }, [player.id, registry])

  return (
    <span className="ticker-item tape" ref={item} data-trend={totalTrendOf(openPrice)}>
      <span className="ticker-tag">{symbol}</span>
      <span className="ticker-price" ref={price} data-trend={totalTrendOf(openPrice)}>
        {formatTapePrice(openPrice)}
      </span>
      <span className="ticker-percent" ref={percent} data-trend={totalTrendOf(openPrice)}>
        {formatTapePercent(openPrice)}
      </span>
    </span>
  )
}
