/**
 * Drawing a round.
 *
 * Every outcome is `rows` fair coin flips per player, and they are drawn here —
 * once, up front, and stored on the round. Drawing them in the scene instead
 * would mean a re-render could re-roll a marble that is already in flight.
 */

export interface DrawRequest {
  readonly entrantIds: readonly string[]
  readonly rows: number
  readonly random?: () => number
}

/** Where a sequence of flips lands: the number of steps taken right. */
export function binOf(flips: readonly number[]): number {
  return flips.reduce((count, flip) => count + (flip > 0 ? 1 : 0), 0)
}

const coin = (random: () => number) => (random() < 0.5 ? -1 : 1)

/** One ±1 per row for every entrant. */
export function drawRound({
  entrantIds,
  rows,
  random = Math.random,
}: DrawRequest): Record<string, readonly number[]> {
  return Object.fromEntries(
    entrantIds.map((id) => [id, Array.from({ length: rows }, () => coin(random))]),
  )
}
