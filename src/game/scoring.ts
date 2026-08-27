/**
 * How a round is scored and ranked.
 *
 * Pure policy: given a round and a mode, who won. It knows nothing about the
 * state container that happens to hold the round, the renderer, or the UI, so
 * the rules of the game can be read — and tested — on their own.
 */
import { binomialPmf, deviation } from './binomial'
import { START_PRICE, closeOf, type Market } from './modes'
import type { Landing, Mode, Player, RankedEntry, Round, SettleRule } from './types'

/** Builds the landing record for a marble that came to rest in `bin`. */
export function landingFor(
  playerId: string,
  bin: number,
  round: Round,
  order: number,
  flips: readonly number[] = [],
): Landing {
  const pmf = binomialPmf(round.rows)
  return {
    playerId,
    bin,
    flips,
    probability: pmf[bin] ?? 0,
    deviation: deviation(bin, round.rows),
    order,
  }
}

/**
 * The market one player met in one round: the session's row values, and their own
 * pennies. The single place that knows where each half is kept.
 */
export function marketFor(round: Round, playerId: string): Market {
  return { rowMoves: round.rowMoves, jitter: round.jitter[playerId] }
}

/** What a player's stock opened this round at. */
export function openPriceOf(playerId: string, round: Round): number {
  return round.openPrices[playerId] ?? START_PRICE
}

/**
 * The price every entrant opened at, or null when they differ.
 *
 * The first round of a series opens everyone at $100, so a single price axis
 * describes every slot. A later trading day carries each stock's own price
 * forward, so there is no shared axis and callers must fall back to showing the
 * move instead.
 */
export function commonOpenPrice(round: Round): number | null {
  const opens = round.entrantIds.map((id) => openPriceOf(id, round))
  if (opens.length === 0) return START_PRICE
  return opens.every((open) => open === opens[0]) ? opens[0] : null
}

/** What it closed at — or its opening price, if it hasn't landed yet. */
export function priceAfter(playerId: string, round: Round): number {
  const landing = round.landings.find((l) => l.playerId === playerId)
  const open = openPriceOf(playerId, round)
  // From the path, not the bin: with rows worth different amounts, where a
  // marble finished no longer says what it is worth.
  return landing ? closeOf(landing.flips, open, marketFor(round, playerId)) : open
}

function closePriceOf(landing: Landing, round: Round): number {
  return closeOf(
    landing.flips,
    openPriceOf(landing.playerId, round),
    marketFor(round, landing.playerId),
  )
}

/**
 * The value a landing is ranked on, lower being better.
 *
 * Black Swan ranks on probability, so the rarest landing sorts first. Stock
 * Market negates the closing price, so the richest sorts first. Expressing both
 * as "lower wins" keeps one comparison for every mode.
 */
function scoreOf(landing: Landing, round: Round, mode: Mode): number {
  return mode === 'stock' ? -closePriceOf(landing, round) : landing.probability
}

/**
 * The winning landings. More than one means the top is level.
 *
 * Independent of the settle rule: who is joint-best doesn't change, only
 * whether that is enough to stop.
 */
export function winnersOf(round: Round, mode: Mode): readonly Landing[] {
  return settlementOf(round, mode, 'winner').winners
}

/** Which end of the field still has to be decided. */
export type Pending = 'none' | 'top' | 'bottom' | 'both'

export interface Settlement {
  /** Joint best. More than one means the top is still level. */
  readonly winners: readonly Landing[]
  /** Joint worst. More than one means the bottom is still level. */
  readonly losers: readonly Landing[]
  /**
   * What is left to decide. Callers switch on this rather than re-deriving it,
   * so the wording never has to know which settle rule is in force.
   */
  readonly pending: Pending
  readonly settled: boolean
}

/**
 * Who is top, who is bottom, and whether that is enough to stop.
 *
 * Places in the middle may always tie; only the ends the rule names have to
 * come apart — and one shot names neither, so a completed round is the result
 * whatever it says. Both ends are still reported either way: which end is level
 * is worth showing even when nothing will be done about it.
 */
export function settlementOf(round: Round, mode: Mode, rule: SettleRule): Settlement {
  const { landings } = round
  if (landings.length === 0) {
    return { winners: [], losers: [], pending: 'both', settled: false }
  }

  const scores = landings.map((l) => scoreOf(l, round, mode))
  const best = Math.min(...scores)
  const worst = Math.max(...scores)
  const winners = landings.filter((_, i) => scores[i] === best)
  const losers = landings.filter((_, i) => scores[i] === worst)

  // One shot asks nothing of either end: the round is the result, level or not.
  const topLevel = rule !== 'oneShot' && winners.length > 1
  // A field of two that has separated has no bottom left to settle, and the
  // 'winner' rule never asks about the bottom at all.
  const bottomLevel = rule === 'winnerAndLoser' && losers.length > 1
  const pending: Pending =
    topLevel && bottomLevel ? 'both' : topLevel ? 'top' : bottomLevel ? 'bottom' : 'none'

  return {
    winners,
    losers,
    pending,
    settled: isRoundComplete(round) && pending === 'none',
  }
}

/** Round results, best first. Tied entries share a rank. */
export function rankRound(round: Round, players: readonly Player[], mode: Mode): RankedEntry[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sorted = [...round.landings].sort(
    (a, b) => scoreOf(a, round, mode) - scoreOf(b, round, mode) || a.order - b.order,
  )
  const worst = sorted.length > 0 ? scoreOf(sorted[sorted.length - 1], round, mode) : 0

  const entries: RankedEntry[] = []
  let rank = 0

  sorted.forEach((landing, i) => {
    const player = byId.get(landing.playerId)
    if (!player) return
    const tiedWithPrevious =
      i > 0 && scoreOf(landing, round, mode) === scoreOf(sorted[i - 1], round, mode)
    if (!tiedWithPrevious) rank = i

    const openPrice = openPriceOf(landing.playerId, round)
    const closePrice = closePriceOf(landing, round)
    entries.push({
      player,
      landing,
      rank,
      isWinner: rank === 0,
      isLoser: scoreOf(landing, round, mode) === worst,
      openPrice,
      closePrice,
      change: closePrice - openPrice,
    })
  })

  return entries
}

export function isRoundComplete(round: Round): boolean {
  return round.entrantIds.length > 0 && round.landings.length >= round.entrantIds.length
}
