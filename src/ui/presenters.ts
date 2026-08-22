/**
 * Wording and formatting decisions for the panels.
 *
 * These were inline nested ternaries in JSX, which is exactly where mode-
 * dependent copy becomes unreadable. Naming each one puts the two modes' phrasing
 * side by side, and keeps the components to structure.
 */
import { formatOdds, formatPercent } from '../game/binomial'
import { MODES, START_PRICE, formatChange, formatPrice, priceRange } from '../game/modes'
import type { Settlement } from '../game/scoring'
import type { Mode, Player, RankedEntry, SettleRule } from '../game/types'

/**
 * The chart's heading. Says what the axis is, and no more — the mode's rule is
 * already stated in the top nav, so repeating it here just crowded the panel.
 */
export function chartTitle(mode: Mode, openPrice: number | null): string {
  if (mode !== 'stock') return 'Possible landings'
  // After hours everyone opened somewhere different, so the axis is the move.
  return openPrice === null ? 'Possible moves' : 'Possible closes'
}

export function chartSubtitle(mode: Mode, rows: number, openPrice: number | null): string {
  const unit = mode !== 'stock' ? 'bin' : openPrice === null ? 'move' : 'close'
  return `Chance of each ${unit} over ${rows} rows`
}

/** The single big number: what the winner actually got. */
export function heroFigure(mode: Mode, top: RankedEntry): string {
  return mode === 'stock' ? formatPrice(top.closePrice) : formatOdds(top.landing.probability)
}

/**
 * The line under the name, expanding on the hero figure.
 *
 * Returns null when nothing can be said that holds for everyone named. Tied
 * players share the figure they tied on and nothing else: in Stock Market they
 * may have opened at different prices (so the move differs), and in Black Swan
 * they may be in mirror-image bins (so the bin differs).
 */
export function verdictDetail(
  mode: Mode,
  lead: RankedEntry,
  { tied, sharedOpen }: { tied: boolean; sharedOpen: boolean },
): string | null {
  if (mode === 'stock') {
    if (!sharedOpen) return null
    return `${formatChange(lead.change)} from ${formatPrice(lead.openPrice)}`
  }

  const { bin, deviation, probability } = lead.landing
  const spread = `${deviation.toFixed(1)} off centre · ${formatPercent(probability)}`
  return tied ? spread : `Bin ${bin} · ${spread}`
}

/** What this row count means, in the setup panel. */
export function rowsSummary(mode: Mode, rows: number, pmf: readonly number[]): string {
  if (mode === 'stock') {
    const [low, high] = priceRange(rows, START_PRICE)
    return `Opens at ${formatPrice(START_PRICE)} · closes between ${formatPrice(
      low,
    )} and ${formatPrice(high)}`
  }
  const likeliest = Math.max(...pmf)
  return `${rows + 1} bins · centre bin ${formatOdds(likeliest)} · edge bin ${formatOdds(pmf[0])}`
}

/**
 * The small line above each end's name. Each block reports its own end, so a
 * round with both ends level says so twice rather than in one combined phrase.
 */
export function topKicker(mode: Mode, settlement: Settlement): string {
  if (settlement.winners.length > 1) return `${settlement.winners.length} level at the top`
  return mode === 'stock' ? 'Highest close' : 'Picked'
}

export function bottomKicker(mode: Mode, settlement: Settlement): string {
  if (settlement.losers.length > 1) return `${settlement.losers.length} level at the bottom`
  return mode === 'stock' ? 'Lowest close' : 'Most expected'
}

export function resultsTableCaption(mode: Mode): string {
  return mode === 'stock'
    ? 'Closing price per player, highest first'
    : 'Landing per player, rarest first'
}

/**
 * What the re-drop button says. Which end is unsettled is already stated in the
 * verdict above it, so the button just names the action.
 */
export function tieBreakLabel(mode: Mode): string {
  return `Next ${MODES[mode].tieBreakUnit} to settle ties`
}

/** Describes a settle rule in the setup panel. */
export function settleRuleHint(rule: SettleRule): string {
  return rule === 'winner'
    ? 'Re-drop until one player stands alone at the top.'
    : 'Re-drop until first and last are both decided. Places in between may tie.'
}

export function rematchLabel(mode: Mode): string {
  return mode === 'stock' ? 'New session' : 'Drop again'
}

/**
 * Show every Nth bin label on the chart's axis. Prices are far wider than bin
 * numbers, so they need thinning sooner.
 */
export function axisLabelInterval(binCount: number, mode: Mode): number {
  if (mode !== 'stock') return binCount > 13 ? 2 : 1
  if (binCount > 13) return 4
  return binCount > 8 ? 2 : 1
}

/**
 * Ticker symbols for a field of players, guaranteed distinct.
 *
 * Taking the first four letters is not enough: "Scott C" and "Scott E" both give
 * "SCOT", and two identical symbols on the tape means neither identifies anyone.
 * Each name proposes candidates in order of how well they read, and the first
 * one nobody has taken wins — the same trick real tickers use for BRK.A/BRK.B.
 */
export function tickerSymbols(players: readonly Player[]): Map<string, string> {
  const taken = new Set<string>()
  const symbols = new Map<string, string>()

  for (const player of players) {
    const pick =
      symbolCandidates(player.name, player.slot).find((candidate) => !taken.has(candidate)) ??
      firstFreeFallback(taken, player.slot)
    taken.add(pick)
    symbols.set(player.id, pick)
  }

  return symbols
}

/** Best-reading forms first, each at most four characters. */
function symbolCandidates(name: string, slot: number): string[] {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, '').toUpperCase())
    .filter(Boolean)

  if (words.length === 0) return []

  const squashed = words.join('')
  const candidates: string[] = []

  // "Scott C" → SCOC, "Scott E" → SCOE: a shared stem plus the distinguishing
  // initial, which is how a real tape separates share classes.
  if (words.length > 1) {
    const stem = words[0].slice(0, 3)
    for (const word of words.slice(1)) candidates.push(`${stem}${word[0]}`)
    candidates.push(words.map((word) => word[0]).join('').slice(0, 4))
  }

  candidates.push(squashed.slice(0, 4))

  // Walk deeper into the name for a distinguishing final character.
  const stem = squashed.slice(0, 3)
  for (const character of squashed.slice(3)) candidates.push(`${stem}${character}`)

  candidates.push(`${stem}${slot + 1}`)
  candidates.push(`${squashed.slice(0, 2)}${slot + 1}`)

  return candidates.filter((candidate) => candidate.length >= 2)
}

/** Last resort, and always available: no two players share a slot. */
function firstFreeFallback(taken: ReadonlySet<string>, slot: number): string {
  let attempt = slot + 1
  while (taken.has(`P${attempt}`)) attempt += 1
  return `P${attempt}`
}
