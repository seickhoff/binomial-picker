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
 * The move at every decision, before volatility: half a slot per peg.
 *
 * Stepping one slot further right means one more right deflection and one fewer
 * left one, so a slot is two pegs — and a slot is a dollar.
 */
export const BASE_PER_PEG = 0.5
const DOLLARS_PER_SLOT = BASE_PER_PEG * 2

/**
 * What volatility adds to a row's move, in dollars: cents on top of the base.
 *
 * A row is drawn one of these when volatility is on, and every player crossing
 * that row wears it — added going right, subtracted going left, so the row is
 * simply worth a little more than half a slot. 51¢, 55¢ or 60¢ a peg.
 *
 * Cents rather than dollars because that leaves the shape of the game alone. The
 * dollars still come from the lattice, so a slot is still a dollar and the ladder
 * under the bins still means something; what the volatility decides is the small
 * change, which is exactly where a real tape carries its noise. It also puts the
 * three levels an order of magnitude apart, so a wild row is worth ten calm ones
 * and a session has a story.
 *
 * Shared per row is what keeps it fair: every player meets the same row worth the
 * same amount, with their own fair coin against it.
 */
export const ROW_VOLATILITY = {
  calm: 0.01,
  mid: 0.05,
  wild: 0.1,
} as const

export const VOLATILITY_LEVELS = [
  ROW_VOLATILITY.calm,
  ROW_VOLATILITY.mid,
  ROW_VOLATILITY.wild,
] as const

/*
 * Prices are added up in whole cents, then converted once.
 *
 * Not fussiness. Volatility moves a price by five hundredths of a dollar, and
 * neither 0.05 nor 0.1 is exact in binary, so adding them in dollars leaves
 * $100.30 as 100.29999999999998 — and worse, leaves it as a *different*
 * 100.2999…8 depending on the order the rows came in. Ties are decided by
 * comparing closing prices for equality, so two players who really did finish
 * level would have been scored as separated by a millionth of a cent.
 *
 * Integers add exactly, and equal totals convert to the identical double.
 */
const cents = (dollars: number) => Math.round(dollars * 100)
const dollars = (whole: number) => whole / 100

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
    tagline: `Every player opens at $${START_PRICE}. Highest close wins the session.`,
    rule: 'Highest close wins',
    tieBreakName: 'After hours',
    tieBreakUnit: 'session',
    resultLabel: 'Close',
  },
}

export const MODE_ORDER: readonly Mode[] = ['blackSwan', 'stock']

/**
 * Slots right of centre, which is position rather than money.
 *
 * The one thing a landing still says on its own once rows are worth different
 * amounts: a bin is a position, and only a position.
 */
export function slotOffset(bin: number, rows: number): number {
  return bin - rows / 2
}

/** Closing price for a path: the open, plus each row it crossed. */
export function closeOf(
  flips: readonly number[],
  openPrice: number,
  rowMoves: readonly number[],
): number {
  return dollars(
    flips.reduce(
      (price, flip, row) => price + flip * cents(rowMoves[row] ?? BASE_PER_PEG),
      cents(openPrice),
    ),
  )
}

/**
 * The whole walk, one entry per row plus the opening value: prices in Stock
 * Market, and slots from the centre in Black Swan, which is the same series
 * measured in the units that mode cares about.
 */
export function walkOf(
  flips: readonly number[],
  openPrice: number,
  mode: Mode,
  rowMoves: readonly number[],
): number[] {
  const walk = [mode === 'stock' ? openPrice : 0]
  let price = cents(openPrice)
  let steps = 0

  flips.forEach((flip, row) => {
    price += flip * cents(rowMoves[row] ?? BASE_PER_PEG)
    steps += flip
    // Black Swan has no prices: its walk is slots from the centre, half a slot
    // per peg, and no volatility applies to it.
    walk.push(mode === 'stock' ? dollars(price) : steps / 2)
  })
  return walk
}

/**
 * Lowest and highest price a round can reach — the axis range.
 *
 * Every row going one way, which with rows of different sizes is still just their
 * sum: the extremes are the same whatever order the market moves in.
 */
export function priceRange(openPrice: number, rowMoves: readonly number[]): [number, number] {
  const reach = rowMoves.reduce((total, step) => total + cents(step), 0)
  return [dollars(cents(openPrice) - reach), dollars(cents(openPrice) + reach)]
}

/**
 * What to write under a finishing slot.
 *
 * Lives here, beside the pricing, because both the ladder in the scene and the
 * distribution chart in the panels need exactly this decision, and those two
 * layers never import from one another.
 *
 * The slot's own worth, from the lattice: a dollar a slot, whatever the market is
 * doing. Volatility moves a marble's close by cents around this, so two marbles
 * in one bin can be a few cents apart — their own tags and the table carry that,
 * and the ladder stays the plain statement of what a position pays.
 */
export function slotLabel({
  mode,
  bin,
  rows,
  openPrice,
}: {
  mode: Mode
  bin: number
  rows: number
  openPrice: number | null
}): string {
  if (mode !== 'stock') return String(bin)

  const move = dollars(slotOffset(bin, rows) * cents(DOLLARS_PER_SLOT))
  return openPrice === null
    ? formatMove(move)
    : formatPrice(dollars(cents(openPrice) + cents(move)))
}

/**
 * A price, always to the cent.
 *
 * Never trimmed to whole dollars, even when it is one. Rows move the price by a
 * penny or two, so a column of closes reading $100, $100.07, $99.98, $100 is a
 * column that looks broken — and a quote board that drops the cents is not a
 * quote board.
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
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
function formatMove(move: number): string {
  if (move === 0) return '$0.00'
  return `${move > 0 ? '+' : '−'}$${Math.abs(move).toFixed(2)}`
}

export function formatChange(change: number): string {
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '■'
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${arrow} ${sign}${Math.abs(change).toFixed(2)}`
}

/** Direction of a move, for status colouring. Never the only cue. */
export function trendOf(change: number): 'up' | 'down' | 'flat' {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
}
