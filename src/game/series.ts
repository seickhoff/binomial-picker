/**
 * A run of sessions, read as one thing.
 *
 * A series that took four days to settle is one longer drop, exactly: four
 * sessions of ten rows is a walk of forty fair coin flips, so the distribution
 * of where a series can end is `Binomial(rows × days, 1/2)` and nothing here has
 * to approximate it.
 *
 * Both modes carry forward, and that is the whole of what a re-drop means — but
 * they carry different things, because they pay in different currencies. Stock
 * Market carries the price: a session opens where the last one closed, and a
 * stock that gives back what it made is back where it started, which is what a
 * market does. Black Swan pays in improbability, and improbability does not give
 * itself back. Its sessions stay separate drops and their odds multiply, so
 * three slots right on Monday and three slots left on Tuesday is 1 in 13 twice
 * over — 1 in 169 — and not, as it would be if the walk carried, a marble sitting
 * at dead center having been scored as the dullest result on the board.
 *
 * Something has to accumulate, or the mode cannot settle. Black Swan's score is
 * a bin's probability, and on a symmetric board bin k and bin rows−k are exactly
 * as likely — so two players tie whenever they land in mirror images of each
 * other, and a fresh drop scored on its own has the same chance of doing it
 * again however many times it already has. Twenty players on a four-row board
 * took five sessions to come apart, one series in 250 never did at all, and the
 * fifth session was no more decisive than the first. Multiplying the sessions
 * settles the same twenty in under three.
 */
import { binomialPmf } from './binomial'
import { walkOf } from './modes'
import { marketFor } from './scoring'
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

/**
 * Which session this is, counting from one.
 *
 * Written once because there are two routes to it — a round's own index, and the
 * length of the history behind it — and a placard, a heading and a column label
 * all have to agree about what day it is. Two routes to one number is one route
 * too many.
 */
export function sessionNumber(round: Round): number {
  return round.index + 1
}

/**
 * The round a result is read off — which, past day one, is the whole series.
 *
 * Stock Market needs nothing done to it: the price carries on the round itself,
 * so today's close is already the series' figure and today's landing is already
 * the thing to rank. Black Swan's carry is in the odds, and it is put together
 * here: a landing keeps everything it had, and its probability becomes the
 * probability of the whole run of sessions that produced it.
 *
 * The result is a round in every sense that matters to `scoring.ts`, so
 * everything downstream ranks and settles the series without knowing it is
 * looking at more than a day.
 */
export function scoredRound(history: readonly Round[], round: Round, mode: Mode): Round {
  if (mode === 'stock' || history.length === 0) return round
  return { ...round, landings: rarityAcross(seriesOf(history, round)) }
}

/**
 * Today's landings, priced on the whole series: how unlikely all of it was.
 *
 * Sessions multiply rather than joining up, and that is the point. Laid end to
 * end, a marble three slots right on Monday and three slots left on Tuesday is
 * back at dead center, which is the likeliest place on the board — two wild days
 * scored as the dullest possible result. Multiplied, the same player is 1 in 13
 * twice over and therefore 1 in 169: straying is straying, whichever way it went.
 *
 * It also leaves each session its own drop, which is what the board shows. The
 * bin and the distance off center stay today's, so they still name a slot on the
 * board in front of you; only the odds speak for the series.
 */
function rarityAcross(sessions: readonly Round[]): Landing[] {
  // Each session with the odds of its own board: they are quadratic in the row
  // count, and every player in the field reads the same ones.
  const days = sessions.map((session) => ({ session, chances: binomialPmf(session.rows) }))
  const today = sessions[sessions.length - 1]

  return today.landings.flatMap((landing) => {
    const run = runOf(landing.playerId, days)
    return run ? [{ ...landing, probability: productOf(run) }] : []
  })
}

/**
 * What this player's chances were, one per session — or nothing at all.
 *
 * Nothing when a session has no landing for them: they sat one out, or it is
 * still being played. Either way there is no series to price yet, and a partial
 * product would rank them against players who have finished.
 */
function runOf(playerId: string, days: readonly SessionChances[]): number[] | null {
  const run: number[] = []
  for (const { session, chances } of days) {
    const bin = binIn(session, playerId)
    if (bin === undefined) return null
    run.push(chances[bin] ?? 0)
  }
  return run
}

interface SessionChances {
  readonly session: Round
  /** The odds of every bin on that session's board. */
  readonly chances: readonly number[]
}

/**
 * Multiplied smallest first, so that two players who really did have the same
 * run of sessions come out bit-for-bit level.
 *
 * Floating multiplication is not associative, and these are ties decided by
 * comparing for equality — the same trap the cent arithmetic in `modes.ts` is
 * written around. Three sessions on a 24-row board are safe either way, but from
 * four sessions on, one player's 1-in-13-then-1-in-6 and another's 1-in-6-then-
 * 1-in-13 start landing a single bit apart, and by six sessions two thirds of
 * runs do. Sorting first makes the order the same for everyone holding the same
 * numbers, which is exactly when the answer has to match.
 */
function productOf(chances: readonly number[]): number {
  return [...chances].sort((a, b) => a - b).reduce((product, chance) => product * chance, 1)
}

function binIn(session: Round, playerId: string): number | undefined {
  return session.landings.find((landing) => landing.playerId === playerId)?.bin
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

    // Each session at the scale it was played at, so a series charted across
    // days is continuous even if the setting has since changed.
    const walk = walkOf(
      flips,
      openingOf(playerId, session, mode),
      mode,
      marketFor(session, playerId),
    )
    if (values.length === 0) values.push(walk[0])
    else dayBreaks.push(values.length - 1)
    values.push(...walk.slice(1))
  }

  return { playerId, values, dayBreaks }
}

/**
 * Where a session's line starts.
 *
 * A price for Stock Market, which carries: a day opens where the last one
 * closed. Dead center for Black Swan, every time — its sessions are separate
 * drops down the same board, and only the odds of them accumulate.
 */
function openingOf(playerId: string, session: Round, mode: Mode): number {
  return mode === 'stock' ? (session.openPrices[playerId] ?? 0) : 0
}

function flipsIn(session: Round, playerId: string): readonly number[] {
  return session.landings.find((landing) => landing.playerId === playerId)?.flips ?? []
}

export interface Candle {
  readonly playerId: string
  /** Where the series opened, and where it ended. */
  readonly open: number
  readonly close: number
  /** The best and worst the price ever got to on the way. */
  readonly high: number
  readonly low: number
}

/**
 * Each player's series as one candle.
 *
 * A candlestick wants four numbers and a walk has exactly them: it opened
 * somewhere, it closed somewhere, and in between it reached a best and a worst.
 * Nothing is aggregated or bucketed — the high is simply the highest the price
 * actually was, which is the one thing the line chart makes you trace to find.
 */
export function seriesCandles(sessions: readonly Round[], mode: Mode): Candle[] {
  return seriesWalks(sessions, mode).map(({ playerId, values }) => ({
    playerId,
    open: values[0],
    close: values[values.length - 1],
    high: Math.max(...values),
    low: Math.min(...values),
  }))
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
