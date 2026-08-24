/**
 * Drawing a round.
 *
 * Every outcome is `rows` fair coin flips per player, and they are drawn here —
 * once, up front, and stored on the round. Drawing them in the scene instead
 * would mean a re-render could re-roll a marble that is already in flight.
 *
 * The session's market conditions are drawn here too, for the same reason.
 */
import {
  BASE_PER_PEG,
  DEFAULT_VOLATILITY,
  JITTER_PER_PEG,
  bandsOf,
  type VolatilityBand,
  type VolatilityBands,
} from './modes'

export interface DrawRequest {
  readonly entrantIds: readonly string[]
  readonly rows: number
  /** Add volatility to each row, rather than moving every row by the base. */
  readonly volatileRows: boolean
  /** The bands to draw a row's mood from. Defaults to the ones shipped. */
  readonly volatility?: VolatilityBands
  readonly random?: () => number
}

export interface RoundDraw {
  readonly plan: Record<string, readonly number[]>
  /**
   * What each row's peg is worth, one per row: the base move, plus the cents
   * volatility drew for that row.
   */
  readonly rowMoves: number[]
  /** Each entrant's own penny per peg. Empty when the market is flat. */
  readonly jitter: Record<string, readonly number[]>
}

/** Where a sequence of flips lands: the number of steps taken right. */
export function binOf(flips: readonly number[]): number {
  return flips.reduce((count, flip) => count + (flip > 0 ? 1 : 0), 0)
}

const coin = (random: () => number) => (random() < 0.5 ? -1 : 1)

/**
 * A session: one ±1 per row for every entrant, and what each row is worth.
 *
 * The row values are drawn once and shared by the whole field, which is what
 * keeps a varying market fair. Every player meets the same row worth the same
 * amount and tosses their own coin against it, so all of them have the identical
 * distribution of closes — a market can be jumpy without being rigged.
 */
export function drawRound({
  entrantIds,
  rows,
  volatileRows,
  volatility = DEFAULT_VOLATILITY,
  random = Math.random,
}: DrawRequest): RoundDraw {
  const bands = bandsOf(volatility)
  return {
    plan: Object.fromEntries(
      entrantIds.map((id) => [id, Array.from({ length: rows }, () => coin(random))]),
    ),
    rowMoves: Array.from({ length: rows }, () =>
      volatileRows ? volatileMove(bands, random) : BASE_PER_PEG,
    ),
    // Nothing to draw when the market is flat: every marble in a bin then closes
    // at the same price, which is what "no volatility" is meant to mean.
    jitter: volatileRows
      ? Object.fromEntries(
          entrantIds.map((id) => [
            id,
            Array.from({ length: rows }, () => pick(JITTER_PER_PEG, random)),
          ]),
        )
      : {},
  }
}

/**
 * One row's worth: the base move, plus the cents its band drew.
 *
 * Two draws, in this order: which mood the row is in, then where in that mood it
 * fell. Drawing the cents straight out of 0–25 instead would make a wild row no
 * more likely than a quiet one, and the moods are the part with a story in them.
 */
function volatileMove(bands: readonly VolatilityBand[], random: () => number): number {
  const [low, high] = pick(bands, random)
  // Whole cents: prices are added up in cents, so a fraction of one would be
  // rounded away by the time anybody saw it.
  const cents = Math.min(high, low + Math.floor(random() * (high - low + 1)))
  return BASE_PER_PEG + cents / 100
}

function pick<T>(options: readonly T[], random: () => number): T {
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))]
}
