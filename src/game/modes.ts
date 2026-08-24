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
 * What volatility adds to a row's move: a mood, then a figure inside it.
 *
 * A row is drawn calm, mid or wild — evenly, one in three — and then a whole
 * number of cents from inside that band, both ends included. Every player crossing
 * the row wears the same figure, added going right and subtracted going left, so
 * the row is simply worth a little more than half a slot.
 *
 * Two draws rather than one because three fixed figures made every session the
 * same three sessions. A band keeps the character of a mood — a calm row is worth
 * a few cents, a wild one a fifth of a slot — while no two wild rows are quite
 * alike, which is what a tape actually looks like. A calm row may draw nothing at
 * all, and that is the point of calling it calm.
 *
 * Cents, not dollars, because that leaves the shape of the game alone: the dollars
 * still come from the lattice, so a slot is still a dollar and the ladder under the
 * bins still means something. What volatility decides is the small change, which is
 * exactly where a real tape carries its noise.
 *
 * Shared per row is part of what keeps it fair: every player meets the same row
 * worth the same amount, with their own fair coin against it. The other part is
 * `JITTER_PER_PEG`, which is not shared — see there for why that is fair too.
 */
export const DEFAULT_VOLATILITY = {
  calm: [0, 5],
  mid: [6, 10],
  wild: [11, 25],
} as const

/** A band's ends, in whole cents, both included. */
export type VolatilityBand = readonly [number, number]

/** The three moods, in the order they are drawn and shown. */
export const VOLATILITY_MOODS = ['calm', 'mid', 'wild'] as const
export type VolatilityMood = (typeof VOLATILITY_MOODS)[number]

/** The three bands as set up — the defaults above, or whatever was configured. */
export type VolatilityBands = Readonly<Record<VolatilityMood, VolatilityBand>>

/**
 * The widest a band may be set to.
 *
 * 50¢ on top of the 50¢ base is a peg worth a whole slot, which is already past
 * the point where the ladder under the bins means anything. It also keeps the
 * sliders usable: a 50-step track has twice the room per cent that a 99-step one
 * does, and these are set in single cents.
 */
export const MAX_VOLATILITY_CENTS = 50

/** The bands in draw order, which is all the draw needs of them. */
export function bandsOf(volatility: VolatilityBands): readonly VolatilityBand[] {
  return VOLATILITY_MOODS.map((mood) => volatility[mood])
}

/** The most a row's peg can be worth, which is what bounds a session's range. */
export function widestPerPeg(volatility: VolatilityBands): number {
  const widest = Math.max(...VOLATILITY_MOODS.map((mood) => volatility[mood][1]))
  return BASE_PER_PEG + widest / 100
}

/**
 * A player's own penny, drawn per peg when volatility is on: −1¢, 0 or +1¢.
 *
 * Added to the price whichever way the marble went, rather than to the size of the
 * move, so it does not cancel out for a marble that finishes level. That is what
 * it is for: the row values are shared by the field, so two players who took
 * mirror-image paths through the same market close at exactly the same price. This
 * is the private penny that separates them.
 *
 * Still fair, and for the same reason as everything else here: every player draws
 * from this same symmetric set at every peg, so every player's close has the
 * identical distribution. Fairness has never rested on the market being shared —
 * it rests on the distributions matching.
 */
export const JITTER_PER_PEG = [-0.01, 0, 0.01] as const
/** The widest a single peg's private penny can be, either way. */
export const MAX_JITTER = 0.01

/**
 * What a session's pegs are worth, and to whom.
 *
 * The row moves belong to the session and are the same for everyone in it; the
 * jitter is one player's own. Passed together because pricing a walk needs both,
 * and separately from the flips because neither is the player's own doing.
 */
export interface Market {
  /** What each row of pegs is worth, in dollars, one per row. */
  readonly rowMoves: readonly number[]
  /** This player's private penny per peg, if the market has any. */
  readonly jitter?: readonly number[]
}

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
export function closeOf(flips: readonly number[], openPrice: number, market: Market): number {
  return dollars(
    flips.reduce((price, flip, row) => price + moveOf(market, flip, row), cents(openPrice)),
  )
}

/**
 * What one peg does to a price, in cents: the row's move in the direction taken,
 * plus the player's own penny whichever way that was.
 */
function moveOf(market: Market, flip: number, row: number): number {
  return flip * cents(market.rowMoves[row] ?? BASE_PER_PEG) + cents(market.jitter?.[row] ?? 0)
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
  market: Market,
): number[] {
  const walk = [mode === 'stock' ? openPrice : 0]
  let price = cents(openPrice)
  let steps = 0

  flips.forEach((flip, row) => {
    price += moveOf(market, flip, row)
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

/**
 * A value in slots from the centre, for Black Swan, which has no prices.
 *
 * Halves are real: a walk crosses half a slot per peg, so a marble sits between
 * slots for every odd row it has crossed.
 */
export function formatSlots(slots: number): string {
  const rounded = Math.round(slots * 10) / 10
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
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
