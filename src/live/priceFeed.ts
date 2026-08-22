/**
 * Live quotes, published by falling marbles and read by the ticker.
 *
 * Marbles are inside the Canvas and update on every peg strike; the ticker is
 * plain DOM outside it. This is the channel between them.
 *
 * Readers are notified at most once per animation frame, so twenty marbles all
 * ticking at once cost one update rather than twenty. Nothing here goes through
 * React state — a re-render per tick is exactly what makes a marquee stutter.
 */
export interface Quote {
  readonly price: number
  /** True once the marble has landed and the price is final. */
  readonly closed: boolean
}

const quotes = new Map<string, Quote>()
const listeners = new Set<() => void>()

let flushQueued = false

function queueFlush(): void {
  if (flushQueued) return
  flushQueued = true
  const flush = () => {
    flushQueued = false
    for (const listener of listeners) listener()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush)
  else flush()
}

export function publishPrice(id: string, price: number): void {
  const current = quotes.get(id)
  if (current?.price === price) return
  quotes.set(id, { price, closed: current?.closed ?? false })
  queueFlush()
}

/** Marks a quote final. The price stays whatever was last published. */
export function closeQuote(id: string, price: number): void {
  const current = quotes.get(id)
  if (current?.closed && current.price === price) return
  quotes.set(id, { price, closed: true })
  queueFlush()
}

export function clearQuotes(): void {
  if (quotes.size === 0) return
  quotes.clear()
  queueFlush()
}

export function quoteOf(id: string): Quote | undefined {
  return quotes.get(id)
}

export function subscribeQuotes(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
