import { formatTapePercent, formatTapePrice, totalTrendOf } from '../game/modes'
import type { RankedEntry } from '../game/types'

/**
 * A single quote in the tape's own typeface and colours — the same look as the
 * ticker, standing still.
 *
 * Shares the `.tape` class with the ticker items rather than restating the LED
 * styling, so the two can't drift apart.
 */
export function TapeQuote({
  entry,
  symbol,
  size = 'large',
}: {
  entry: RankedEntry
  /** Omitted when the quote covers more than one player. */
  symbol?: string
  size?: 'large' | 'small'
}) {
  // Against the common start, so tied players always show the same figure.
  const trend = totalTrendOf(entry.closePrice)

  return (
    <span className={`tape tape-quote tape-quote-${size}`} data-trend={trend}>
      {symbol && <span className="tape-symbol">{symbol}</span>}
      <span className="tape-price" data-trend={trend}>
        {formatTapePrice(entry.closePrice)}
      </span>
      <span className="tape-percent" data-trend={trend}>
        {formatTapePercent(entry.closePrice)}
      </span>
    </span>
  )
}
