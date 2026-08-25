/**
 * Wording and formatting decisions for the panels.
 *
 * These were inline nested ternaries in JSX, which is exactly where mode-
 * dependent copy becomes unreadable. Naming each one puts the two modes' phrasing
 * side by side, and keeps the components to structure.
 */
import { formatOdds, formatPercent } from '../game/binomial'
import { tradingDayAfter } from '../game/calendar'
import { headlineFor, listOf, pickBySeed, spreadBySeed, type NewsTone } from '../game/headlines'
import {
  BASE_PER_PEG,
  MODES,
  START_PRICE,
  MAX_JITTER,
  VOLATILITY_MOODS,
  widestPerPeg,
  type VolatilityBands,
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
 * Nothing in Stock Market. The quote beside the name already carries the price
 * and the move, the table below repeats both against the open, and a third
 * statement of the same session — in a third format — was the one thing in the
 * header that nobody was reading.
 *
 * Black Swan has no quote, so its landing is said here or not at all. Returns
 * null when nothing can be said that holds for everyone named: tied players
 * share the figure they tied on and nothing else, and in Black Swan they may be
 * in mirror-image bins, so the bin differs.
 */
export function verdictDetail(
  mode: Mode,
  lead: RankedEntry,
  { tied }: { tied: boolean },
): string | null {
  if (mode === 'stock') return null

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

/* ---------- The front page ---------- */

/*
 * The morning after the session, in newsprint.
 *
 * The paper is decoration, but it is not fiction about the figures: the headline
 * is drawn from the catalog by the direction the day went, and everything under
 * it — the price, the move, where it finished in the field — is the session's own
 * arithmetic, said the way a market report says it. The made-up part is only ever
 * the reason.
 *
 * Every choice is seeded, so a finished session has one front page and keeps it.
 * Dragging the card, opening the chart, or a re-render for any other reason must
 * not print a second edition.
 */

const PAPERS: readonly string[] = [
  'The Wall Street Journal',
  "Barron's",
  "Investor's Business Daily",
  'Bloomberg',
  'CNBC',
  'MarketWatch',
  'Fortune',
  'Forbes',
]

const EDITIONS: readonly string[] = ['Late Edition', 'Final Edition', 'City Edition', 'Extra']
const VOLUMES: readonly string[] = ['LXXVI', 'LXXXVIII', 'XCIV', 'CI', 'CXII', 'CXXVII', 'CXL']
const COVER_PRICES: readonly string[] = ['One Dollar', 'Fifty Cents', 'Two Dollars']

/** Issues to a volume: a daily paper, less the weekends and a few holidays. */
const ISSUES_A_VOLUME = 280

/** What each end of the field is called, in the two places the page names it. */
const TONES = {
  good: { kicker: 'Market Leaders', end: 'top', extreme: 'highest' },
  bad: { kicker: 'Market Laggards', end: 'bottom', extreme: 'lowest' },
} as const

export interface Masthead {
  readonly title: string
  readonly edition: string
  /** The small print either side of the date: volume and issue, and the price. */
  readonly volume: string
  readonly date: string
  readonly price: string
}

/** The top of the page. One paper per session, whichever stories are on it. */
function masthead(seed: string, date: Date): Masthead {
  return {
    title: pickBySeed(PAPERS, `paper:${seed}`),
    edition: pickBySeed(EDITIONS, `edition:${seed}`),
    volume: `Vol. ${pickBySeed(VOLUMES, `volume:${seed}`)} · No. ${
      spreadBySeed(`issue:${seed}`, ISSUES_A_VOLUME) + 1
    }`,
    date: date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    price: pickBySeed(COVER_PRICES, `price:${seed}`),
  }
}

export interface FrontPageStory {
  /** Which end of the field this is — the page sets the two in different inks. */
  readonly tone: NewsTone
  /** The section label above the headline. */
  readonly kicker: string
  readonly headline: string
  /** The line under it, which is the only part made of real figures. */
  readonly deck: string
}

/** A player as the page needs them: how their session went, and their ticker. */
export interface FrontPagePlayer {
  readonly entry: RankedEntry
  readonly symbol: string
}

/** One end of the field, as the page is handed it. */
export interface FrontPageEnd {
  /**
   * Everyone at that end, best first: usually one player, and all of them when
   * they are level.
   */
  readonly players: readonly FrontPagePlayer[]
  readonly tone: NewsTone
}

export interface FrontPage {
  readonly masthead: Masthead
  readonly stories: readonly FrontPageStory[]
}

/**
 * The whole page, from the plain facts of a session.
 *
 * The one thing the panel calls. Everything the page is made of — which paper it
 * is, what day it is, what the stories say — is decided here, so the component
 * that draws it has nothing to decide and nothing to get wrong. It also means the
 * page can be read in a test without rendering anything.
 *
 * The paper is dated the morning after the session it reports on, which is the
 * next trading day: the same walk down the calendar the placards take, one day
 * further on.
 */
export function frontPage({
  seriesStart,
  roundIndex,
  fieldSize,
  ends,
}: {
  /** When the series began, as epoch milliseconds. */
  seriesStart: number
  roundIndex: number
  /** How many players were in the session, which is what a placing is out of. */
  fieldSize: number
  ends: readonly FrontPageEnd[]
}): FrontPage {
  // Every choice on the page hangs off this, so one session is one edition.
  const seed = `${seriesStart}:${roundIndex}`

  return {
    masthead: masthead(seed, tradingDayAfter(new Date(seriesStart), roundIndex + 1)),
    stories: ends.map((end) => frontPageStory({ ...end, fieldSize, seed })),
  }
}

/**
 * One story: who it is about, which way their day went, and what it cost them.
 *
 * A tie is reported as a tie — the headline names them all and agrees with them,
 * and the figures below are the ones they are level on. Naming one of several and
 * calling them the winner would be the paper printing something the session
 * didn't say.
 */
function frontPageStory({
  players,
  tone,
  fieldSize,
  seed,
}: FrontPageEnd & {
  fieldSize: number
  /** Identifies the session, so the same session keeps the same page. */
  seed: string
}): FrontPageStory {
  // Whoever leads the group anchors the seed, so the page survives a re-render
  // without depending on the order the rest of them are listed in.
  const lead = players[0].entry
  const storySeed = `${seed}:${lead.player.id}:${Math.round(lead.closePrice * 100)}:${tone}`

  return {
    tone,
    kicker: TONES[tone].kicker,
    headline: headlineFor({
      tone,
      seed: storySeed,
      subjects: players.map(({ entry, symbol }) => ({ symbol, name: entry.player.name })),
    }),
    deck: storyDeck({ lead, symbols: players.map((player) => player.symbol), tone, fieldSize }),
  }
}

/**
 * The figures, in a market report's words: where they closed, and where that left
 * them.
 *
 * One price for however many names, because that is what being tied means here —
 * a Stock Market tie is an equal close, and a round opens everyone at the same
 * price, so the move is shared too.
 */
function storyDeck({
  lead,
  symbols,
  tone,
  fieldSize,
}: {
  lead: RankedEntry
  symbols: readonly string[]
  tone: NewsTone
  fieldSize: number
}): string {
  const { end, extreme } = TONES[tone]
  const standing =
    symbols.length > 1
      ? `level at the ${end} of a field of ${fieldSize}`
      : `the ${extreme} close of the ${fieldSize} names on the tape`

  return `${listOf(symbols)} finished at ${formatPrice(lead.closePrice)}, ${moveWords(
    lead.change,
  )} — ${standing}.`
}

/** A session's move as prose rather than an arrow: the deck is a sentence. */
function moveWords(change: number): string {
  if (change === 0) return 'unchanged on the session'
  const direction = change > 0 ? 'up' : 'down'
  return `${direction} $${Math.abs(change).toFixed(2)} on the session`
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
