/**
 * Wording and formatting decisions for the panels.
 *
 * These were inline nested ternaries in JSX, which is exactly where mode-
 * dependent copy becomes unreadable. Naming each one puts the two modes' phrasing
 * side by side, and keeps the components to structure.
 */
import { formatOdds, formatPercent } from '../game/binomial'
import {
  BASE_PER_PEG,
  MODES,
  START_PRICE,
  MAX_JITTER,
  VOLATILITY_MOODS,
  widestPerPeg,
  type VolatilityBands,
  formatChange,
  formatPrice,
  priceRange,
} from '../game/modes'
import type { Settlement } from '../game/scoring'
import { tickerSymbols } from '../game/symbols'
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

/**
 * What the volatility setting does, said plainly — including its cost.
 *
 * Two things are worth stating outright. It is fair either way, because the
 * row values are shared by the field: everyone meets the same row worth the same
 * amount. And it takes the prices off the ladder under the bins, because once
 * rows differ a slot no longer has one.
 */
export function volatilityHint(on: boolean, volatility: VolatilityBands): string {
  const bands = VOLATILITY_MOODS.map(
    (mood) => `${mood} ${volatility[mood][0]}–${volatility[mood][1]}¢`,
  ).join(', ')
  return on
    ? `Each row is drawn ${bands} and adds that to its move, the same row for everyone — and every player picks up a penny either way at each peg, so no two marbles in a bin close alike.`
    : `Every row moves the same ${Math.round(BASE_PER_PEG * 100)}¢ a peg, so every marble in a bin closes at the same price.`
}

/** What this row count means, in the setup panel. */
export function rowsSummary(
  mode: Mode,
  rows: number,
  pmf: readonly number[],
  volatileRows: boolean,
  volatility: VolatilityBands,
): string {
  if (mode === 'stock') {
    // The widest a session can be: every row going one way, and with volatility
    // on, every row drawn wild with the player's own penny going with them.
    const worstCase = Array.from({ length: rows }, () =>
      volatileRows ? widestPerPeg(volatility) + MAX_JITTER : BASE_PER_PEG,
    )
    const [low, high] = priceRange(START_PRICE, worstCase)
    return `Opens at ${formatPrice(START_PRICE)} · ${
      volatileRows ? 'closes no wider than' : 'closes between'
    } ${formatPrice(low)} and ${formatPrice(high)}`
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
 * What a session's placard says.
 *
 * `day` is 1-based. The kicker is the only part that changes down a series: the
 * first session opens the market, and every one after it is there because
 * yesterday's did not settle — worth saying, or a second placard just looks like
 * the game starting over.
 */
export function sessionPlacard(
  day: number,
  date: Date,
): {
  kicker: string
  title: string
  date: string
} {
  return {
    kicker: day === 1 ? 'Opening bell' : 'Ties unsettled — trading resumes',
    title: `Day ${day}`,
    date: date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  }
}

/** Says that the next session is coming without being asked for. */
export function autoSessionHint(mode: Mode): string {
  return `The next ${MODES[mode].tieBreakUnit} opens by itself in a moment.`
}

/**
 * The setting that runs a series unattended.
 *
 * Both modes have it, since clicking through re-drops is the same chore either
 * way, but they are not doing the same thing: Stock Market is running a calendar
 * of trading days, Black Swan is simply dropping again until the field comes
 * apart. The wording follows whichever it is.
 */
export function autoSessionsLabel(mode: Mode): string {
  return mode === 'stock' ? 'Run the days automatically' : 'Re-drop automatically'
}

export function autoSessionsHint(mode: Mode, on: boolean): string {
  if (mode === 'stock') {
    return on
      ? 'Each day opens on its own placard, and an unsettled close rolls into tomorrow by itself.'
      : 'Each day opens on its own placard. An unsettled close waits for you.'
  }
  return on
    ? `A level round goes to ${MODES.blackSwan.tieBreakName.toLowerCase()} by itself, and keeps going until the field comes apart.`
    : `A level round waits for you to send it to ${MODES.blackSwan.tieBreakName.toLowerCase()}.`
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
 * What labels the end of each line on the moves chart.
 *
 * A ticker symbol in Stock Market, where the field is trading. In Black Swan
 * there is no tape and nothing trades, so a symbol there is a costume borrowed
 * from the other mode — the name does the same job and is what the player
 * actually answers to.
 *
 * Either way it is a text label, which is the point: the lines are told apart by
 * colour, and colour is never allowed to be the only channel.
 */
export function lineLabels(mode: Mode, players: readonly Player[]): Map<string, string> {
  if (mode === 'stock') return tickerSymbols(players)
  return new Map(players.map((player) => [player.id, chartName(player.name)]))
}

/** As much of a name as fits in the chart's right-hand margin. */
function chartName(name: string): string {
  const [first = ''] = name.trim().split(/\s+/)
  // Eight characters of the 10px tape face is about the 62 units left for it.
  return first.length > 8 ? `${first.slice(0, 7)}…` : first
}
