/**
 * A run of sessions, read as one thing.
 *
 * Stock Market prices carry forward — a session opens where the last one closed
 * — so a series that took four days to settle is one price history four days
 * long, and charting only the final day throws away everything that got the
 * field there.
 *
 * It is also, exactly, one longer drop. Four sessions of ten rows is a walk of
 * forty fair coin flips, so the distribution of where a series can end is
 * `Binomial(rows × days, 1/2)` and nothing here has to approximate it.
 *
 * Black Swan carries nothing forward: its tie-break is a fresh drop from the
 * centre, so joining those rounds into one line would draw a continuity that
 * does not exist. Callers pass a single round for that mode, and get the same
 * shape back.
 */
import { binomialPmf } from './binomial'
import { walkOf } from './modes'
import { binOf } from './rounds'
import type { Landing, Mode, Round } from './types'

export interface SeriesWalk {
  readonly playerId: string
  /** The opening value, then one per row crossed across every session. */
  readonly values: readonly number[]
  /** Row offsets where each session after the first begins. */
  readonly dayBreaks: readonly number[]
}

/** Sessions oldest first, the current one last. */
export function seriesOf(history: readonly Round[], round: Round): Round[] {
  return [...history, round]
}

/** Every player's whole series as one line, for the moves chart. */
export function seriesWalks(sessions: readonly Round[], mode: Mode): SeriesWalk[] {
  const last = sessions[sessions.length - 1]
  if (!last) return []

  return last.entrantIds
    .map((playerId) => walkThrough(playerId, sessions, mode))
    .filter((walk) => walk.values.length > 1)
}

function walkThrough(playerId: string, sessions: readonly Round[], mode: Mode): SeriesWalk {
  const values: number[] = []
  const dayBreaks: number[] = []

  for (const session of sessions) {
    const flips = flipsIn(session, playerId)
    // A session this player has no recorded landing for — still falling, or sat
    // out — ends the line rather than being skipped over, which would join two
    // sessions that aren't adjacent.
    if (flips.length === 0) break

    const walk = walkOf(flips, session.openPrices[playerId] ?? 0, mode)
    if (values.length === 0) values.push(walk[0])
    else dayBreaks.push(values.length - 1)
    values.push(...walk.slice(1))
  }

  return { playerId, values, dayBreaks }
}

function flipsIn(session: Round, playerId: string): readonly number[] {
  return session.landings.find((landing) => landing.playerId === playerId)?.flips ?? []
}

export interface SeriesTotals {
  /** Rows crossed across the whole series. */
  readonly rows: number
  /** One landing per player, standing for their entire series. */
  readonly landings: Landing[]
}

/**
 * The series as a single drop, for the distribution chart.
 *
 * Each player's flips from every session are laid end to end, which is what they
 * are: the series' closing price is the sum of all of them, and its odds are the
 * odds of that total over every row crossed.
 */
export function seriesTotals(sessions: readonly Round[]): SeriesTotals {
  const last = sessions[sessions.length - 1]
  if (!last) return { rows: 0, landings: [] }

  const rows = sessions.reduce((total, session) => total + session.rows, 0)
  const pmf = binomialPmf(rows)

  const landings = last.entrantIds
    .map((playerId, index) => {
      const flips = sessions.flatMap((session) => [...flipsIn(session, playerId)])
      const bin = binOf(flips)
      return {
        playerId,
        bin,
        flips,
        probability: pmf[bin] ?? 0,
        deviation: Math.abs(bin - rows / 2),
        // Finish order within the last session is the only order a series has.
        order: last.landings.findIndex((landing) => landing.playerId === playerId) ?? index,
      }
    })
    // Anyone whose sessions aren't all recorded has no total to place.
    .filter((landing) => landing.flips.length === rows)

  return { rows, landings }
}
