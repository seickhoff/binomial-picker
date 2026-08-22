/**
 * Drawing a round.
 *
 * Every outcome is `rows` fair coin flips per player, and they are drawn here —
 * once, up front, and stored on the round. Drawing them in the scene instead
 * would mean a re-render could re-roll a marble that is already in flight.
 *
 * The session's market conditions are drawn here too, for the same reason.
 */
import { BASE_PER_PEG, VOLATILITY_LEVELS } from './modes'

export interface DrawRequest {
  readonly entrantIds: readonly string[]
  readonly rows: number
  /** Add volatility to each row, rather than moving every row by the base. */
  readonly volatileRows: boolean
  readonly random?: () => number
}

export interface RoundDraw {
  readonly plan: Record<string, readonly number[]>
  /**
   * What each row's peg is worth, one per row: the base move, plus the cents
   * volatility drew for that row.
   */
  readonly rowMoves: number[]
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
  random = Math.random,
}: DrawRequest): RoundDraw {
  return {
    plan: Object.fromEntries(
      entrantIds.map((id) => [id, Array.from({ length: rows }, () => coin(random))]),
    ),
    rowMoves: Array.from(
      { length: rows },
      () => BASE_PER_PEG + (volatileRows ? pick(VOLATILITY_LEVELS, random) : 0),
    ),
  }
}

function pick<T>(options: readonly T[], random: () => number): T {
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))]
}
