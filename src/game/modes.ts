/**
 * The two ways to win.
 *
 * Both modes run the identical board — the same rows, the same fair coin flip
 * per row. Only the scoring differs, which is the point: one rewards the
 * improbable, the other rewards direction.
 */
import type { Mode } from './types'

/** Every stock opens here on the first round of a series. */
export const START_PRICE = 100

/**
 * Dollars between neighbouring finishing slots.
 *
 * A peg is worth *half* a slot, which is not a fudge: stepping one slot further
 * right means one more right deflection and one fewer left one, so a slot is
 * always two pegs' worth of movement. Pricing the slot at $1 therefore prices
 * the peg at 50¢.
 */
export const DOLLARS_PER_SLOT = 1
export const DOLLARS_PER_PEG = DOLLARS_PER_SLOT / 2

export interface ModeInfo {
  readonly id: Mode
  readonly name: string
  /** One line, shown under the mode toggle. */
  readonly tagline: string
  /** How the winner is chosen, in the player's words. */
  readonly rule: string
  /** What a re-drop to settle the ends is called, as a heading. */
  readonly tieBreakName: string
  /** The same thing as a noun, for prose: "next {unit} to settle ties". */
  readonly tieBreakUnit: string
  /** Column heading for the per-player result. */
  readonly resultLabel: string
}

export const MODES: Record<Mode, ModeInfo> = {
  blackSwan: {
    id: 'blackSwan',
    name: 'Black Swan',
    tagline: 'The least likely landing wins. Dead centre wins nothing.',
    rule: 'Rarest bin wins',
    tieBreakName: 'Sudden death',
    tieBreakUnit: 'round',
    resultLabel: 'Odds',
  },
  stock: {
    id: 'stock',
    name: 'Stock Market',
    tagline: `Every player opens at $${START_PRICE}. Slots are a dollar apart — each peg moves 50¢.`,
    rule: 'Highest close wins',
    tieBreakName: 'After hours',
    tieBreakUnit: 'session',
    resultLabel: 'Close',
  },
}

export const MODE_ORDER: readonly Mode[] = ['blackSwan', 'stock']

/**
 * Net dollar move for a landing. The centre slot is unchanged, and each slot
 * out from there is another dollar — up to the right, down to the left.
 */
export function netMove(bin: number, rows: number): number {
  return (bin - rows / 2) * DOLLARS_PER_SLOT
}

/** Closing price for a landing, given where the stock opened. */
export function closingPrice(bin: number, rows: number, openPrice: number): number {
  return openPrice + netMove(bin, rows)
}

/**
 * Price part-way down, from the running total of ±1 deflections. Lands on
 * exactly `closingPrice` once every row has been resolved.
 */
export function priceAfterSteps(openPrice: number, netSteps: number): number {
  return openPrice + netSteps * DOLLARS_PER_PEG
}

/**
 * The whole walk, one entry per row plus the opening value: prices in Stock
 * Market, and slots from the centre in Black Swan, which is the same series
 * measured in the units that mode cares about.
 */
export function walkOf(flips: readonly number[], openPrice: number, mode: Mode): number[] {
  const walk = [mode === 'stock' ? openPrice : 0]
  let steps = 0
  for (const flip of flips) {
    steps += flip
    walk.push(mode === 'stock' ? priceAfterSteps(openPrice, steps) : steps * DOLLARS_PER_PEG)
  }
  return walk
}

/** Lowest and highest price reachable in a round — the axis range. */
export function priceRange(rows: number, openPrice: number): [number, number] {
  const reach = (rows / 2) * DOLLARS_PER_SLOT
  return [openPrice - reach, openPrice + reach]
}

/** Whole dollars stay whole; a half-dollar shows its cents. */
export function formatPrice(price: number): string {
  return `$${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)}`
}

/**
 * Ticker convention: no currency mark and always two decimals, the way a real
 * tape prints it. Constant width is a bonus — the strip must not reflow.
 */
export function formatTapePrice(price: number): string {
  return price.toFixed(2)
}

/**
 * Percentage move for the tape, measured from where everyone began rather than
 * from this round's open.
 *
 * That makes it comparable: after hours, players carry different prices in, so a
 * per-round percentage puts one player's "+2%" off $104 next to another's off
 * $98 and invites reading them as equal. Against a common $100 the figure is a
 * pure function of the price, so it is the same for anyone on the same price —
 * which is also why a tie can always show it.
 *
 * The sign is the non-colour cue, so this always carries one.
 */
export function formatTapePercent(price: number): string {
  const percent = ((price - START_PRICE) / START_PRICE) * 100
  if (percent === 0) return '0.00%'
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent).toFixed(2)}%`
}

/** Direction of a price against the common starting point. */
export function totalTrendOf(price: number): 'up' | 'down' | 'flat' {
  return trendOf(price - START_PRICE)
}

/**
 * A slot's move rather than its price, for when players opened at different
 * prices and no single price axis can describe a slot.
 */
export function formatMove(move: number): string {
  if (move === 0) return '$0'
  return `${move > 0 ? '+' : '−'}$${Math.abs(move)}`
}

export function formatChange(change: number): string {
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '■'
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  const size = Math.abs(change)
  return `${arrow} ${sign}${Number.isInteger(size) ? size.toFixed(0) : size.toFixed(2)}`
}

/** Direction of a move, for status colouring. Never the only cue. */
export function trendOf(change: number): 'up' | 'down' | 'flat' {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
}
