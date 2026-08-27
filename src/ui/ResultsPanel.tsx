import { useMemo, type CSSProperties } from 'react'
import { formatOdds } from '../game/binomial'
import { formatChange, formatPrice, trendOf } from '../game/modes'
import { commonOpenPrice, rankRound, settlementOf } from '../game/scoring'
import { seriesCandles, seriesOf, seriesTotals, sessionNumber } from '../game/series'
import { useGame } from '../game/store'
import { useScoredRound } from '../result'
import type { Mode, RankedEntry } from '../game/types'
import { CandleChart } from './CandleChart'
import { DistributionChart } from './DistributionChart'
import { MoveLines } from './MoveLines'
import { Newspaper } from './Newspaper'
import { PlayerDot, PlayerName } from './PlayerTag'
import { TapeQuote } from './TapeQuote'
import { useDraggable } from './useDraggable'
import { SUMMARY_FADE_MS, SUMMARY_MS } from './sessionTiming'
import { tickerSymbols } from '../game/symbols'
import {
  autoSessionHint,
  bottomKicker,
  lineLabels,
  heroFigure,
  rematchLabel,
  resultsTableCaption,
  tieBreakLabel,
  topKicker,
  resultColumnLabel,
  verdictDetail,
  type FrontPageEnd,
} from './presenters'

/*
 * The four ways to look at a finished session.
 *
 * The front page is not a chart and does not pretend to be one; it sits on the
 * same switch because it answers the same question as the other three — what
 * happened — and because it is the tallest thing in the card after them. Behind
 * the disclosure it costs nothing until it is asked for. It needs a market to
 * report on, so Black Swan is not offered it.
 *
 * One word each. Four labels share a row that is a phone wide, and the two that
 * were two words ("Every move", "Front page") each took two lines there, which
 * made the switch taller than the button that opens it.
 */
const CHART_VIEWS = [
  { id: 'distribution', label: 'Distribution' },
  { id: 'moves', label: 'Moves' },
  { id: 'candles', label: 'Candles' },
  { id: 'frontPage', label: 'Paper', stockOnly: true },
] as const

export function ResultsPanel() {
  const round = useGame((s) => s.round)
  const history = useGame((s) => s.history)
  const players = useGame((s) => s.players)
  const mode = useGame((s) => s.mode)
  const settleRule = useGame((s) => s.settleRule)
  const chartView = useGame((s) => s.chartView)
  const setChartView = useGame((s) => s.setChartView)
  const chartOpen = useGame((s) => s.chartOpen)
  const setChartOpen = useGame((s) => s.setChartOpen)
  const startTieBreak = useGame((s) => s.startTieBreak)
  const autoSessions = useGame((s) => s.autoSessions)
  const seriesStart = useGame((s) => s.seriesStart)
  const rematch = useGame((s) => s.rematch)
  const backToSetup = useGame((s) => s.backToSetup)

  // Past day one the result belongs to the series, in both modes — Stock Market
  // because the price carried, Black Swan because the odds multiplied.
  const scored = useScoredRound()
  const days = sessionNumber(round)
  const ranked = rankRound(scored, players, mode)
  const settlement = settlementOf(scored, mode, settleRule)
  const { winners, settled } = settlement
  const symbols = tickerSymbols(players)
  const leaders = ranked.filter((entry) => entry.isWinner)
  const top = leaders[0]
  // The bottom is only its own result when it isn't also the top — a field where
  // everyone tied has one end, not two.
  const losers = ranked.filter((entry) => entry.isLoser && !entry.isWinner)
  const bottom = losers[0]

  /*
   * Who the morning paper writes about: the two ends of the field, each with the
   * story their session earned. Whole ends rather than the leading name, so a tie
   * is reported as one — the headline names everyone level and reads in the
   * plural.
   */
  const named = (entries: readonly RankedEntry[]) =>
    entries.map((entry) => ({ entry, symbol: symbols.get(entry.player.id) ?? '' }))
  const ends: FrontPageEnd[] = []
  if (top) ends.push({ players: named(leaders), tone: 'good' })
  if (bottom) ends.push({ players: named(losers), tone: 'bad' })

  /*
   * Which views this mode offers, and which of them is showing.
   *
   * The choice is remembered across rounds and across modes, so it can name a
   * view this mode does not have — leaving Stock Market on the front page and
   * playing a round of Black Swan. Falling back beats hiding the panel's
   * contents, and it costs nothing: switch back and the paper is there again.
   */
  const views = CHART_VIEWS.filter((option) => !('stockOnly' in option) || mode === 'stock')
  const view = views.some((option) => option.id === chartView) ? chartView : 'distribution'

  /*
   * The whole series, when there is one — and only Stock Market has one to draw.
   *
   * Its prices carry forward, so four days is one price history and one longer
   * drop, forty flips at ten rows a day, and both charts read better over the
   * whole thing than over the last day of it. Black Swan's sessions are separate
   * drops from the center: only their odds accumulate, and odds are not a line.
   * Drawing them joined would claim a continuity the scoring deliberately does
   * not have.
   */
  const sessions = useMemo(
    () => (mode === 'stock' ? seriesOf(history, round) : [round]),
    [mode, history, round],
  )
  const totals = useMemo(() => seriesTotals(sessions), [sessions])
  const acrossDays = sessions.length > 1

  // A series always opens at the same price for everyone, even though a single
  // day past the first does not.
  const seriesOpenPrice = commonOpenPrice(sessions[0])
  const distribution = acrossDays
    ? {
        rows: totals.rows,
        landings: totals.landings,
        winnerBins: totals.landings
          .filter((landing) => winners.some((winner) => winner.playerId === landing.playerId))
          .map((landing) => landing.bin),
      }
    : { rows: round.rows, landings: round.landings, winnerBins: winners.map((l) => l.bin) }

  const { panel, handle } = useDraggable<HTMLElement, HTMLDivElement>()

  /*
   * The card knows it is on its way out.
   *
   * When the series is running itself, this one is replaced by the next session's
   * placard on a timer nobody pressed, and disappearing mid-sentence reads as a
   * glitch rather than as a turn ending. So it spends its last moment fading, on
   * the flow's own clock — the fade is timed to finish as the placard arrives.
   *
   * CSS runs it, off two custom properties, rather than a second timer in here
   * racing the one that actually changes the phase.
   */
  const leaving = !settled && autoSessions

  return (
    <section
      className="panel panel-results"
      aria-live="polite"
      ref={panel}
      data-leaving={leaving ? '' : undefined}
      style={
        leaving
          ? ({
              '--leave-delay': `${SUMMARY_MS - SUMMARY_FADE_MS}ms`,
              '--leave-ms': `${SUMMARY_FADE_MS}ms`,
            } as CSSProperties)
          : undefined
      }
    >
      {/* Drag handle. The verdict sits inside it, so the whole top of the card
          is the grab area rather than a thin strip. */}
      <div className="panel-grip" ref={handle}>
        <span className="panel-grip-bar" aria-hidden="true" />

        {top && (
          <VerdictBlock
            kicker={topKicker(mode, settlement)}
            named={leaders}
            lead={top}
            mode={mode}
            symbols={symbols}
            days={days}
          />
        )}

        {bottom && (
          <>
            <hr className="verdict-rule" />
            <VerdictBlock
              kicker={bottomKicker(mode, settlement)}
              named={losers}
              lead={bottom}
              mode={mode}
              symbols={symbols}
              days={days}
            />
          </>
        )}
      </div>

      <div className="chart-header">
        <button
          type="button"
          className="chart-toggle"
          aria-expanded={chartOpen}
          onClick={() => setChartOpen(!chartOpen)}
        >
          <span className="chart-caret" aria-hidden="true">
            ▸
          </span>
          Chart
        </button>

        {chartOpen && (
          <div className="chart-switch" role="radiogroup" aria-label="View">
            {views.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={view === option.id}
                className={view === option.id ? 'is-active' : ''}
                onClick={() => setChartView(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {chartOpen &&
        (view === 'frontPage' ? (
          <Newspaper
            ends={ends}
            fieldSize={ranked.length}
            roundIndex={round.index}
            seriesStart={seriesStart}
          />
        ) : view === 'candles' ? (
          <CandleChart
            entries={ranked}
            candles={seriesCandles(sessions, mode)}
            mode={mode}
            openPrice={seriesOpenPrice}
            labels={lineLabels(mode, players)}
          />
        ) : view === 'moves' ? (
          <MoveLines
            entries={ranked}
            sessions={sessions}
            mode={mode}
            openPrice={seriesOpenPrice}
            labels={lineLabels(mode, players)}
          />
        ) : (
          <DistributionChart
            rows={distribution.rows}
            landings={distribution.landings}
            players={players}
            winnerBins={distribution.winnerBins}
            mode={mode}
            openPrice={seriesOpenPrice}
          />
        ))}

      <table className="results-table">
        <caption className="sr-only">{resultsTableCaption(mode)}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Player</th>
            {mode === 'stock' ? (
              <>
                <th scope="col">Sym</th>
                <th scope="col" className="results-num">
                  Open
                </th>
                <th scope="col" className="results-num">
                  Change
                </th>
              </>
            ) : (
              <>
                <th scope="col" className="results-num">
                  Bin
                </th>
                <th scope="col" className="results-num">
                  Off center
                </th>
              </>
            )}
            <th scope="col" className="results-num">
              {resultColumnLabel(mode, days)}
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry) => (
            <ResultRow
              key={entry.player.id}
              entry={entry}
              mode={mode}
              symbol={symbols.get(entry.player.id) ?? ''}
            />
          ))}
        </tbody>
      </table>

      <div className="actions">
        {!settled && (
          <button type="button" className="btn btn-primary btn-alert" onClick={startTieBreak}>
            {tieBreakLabel(mode)}
          </button>
        )}
        <button
          type="button"
          className={settled ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={rematch}
        >
          {rematchLabel(mode)}
        </button>
        <button type="button" className="btn btn-ghost" onClick={backToSetup}>
          Setup
        </button>
      </div>

      {/* Says so, rather than letting the screen change on its own and look like
          it took the decision away. */}
      {!settled && autoSessions && <p className="hint">{autoSessionHint(mode)}</p>}
    </section>
  )
}

/** One end of the field: its label, who is there, and their figures. */
function VerdictBlock({
  kicker,
  named,
  lead,
  mode,
  symbols,
  days,
}: {
  kicker: string
  named: readonly RankedEntry[]
  lead: RankedEntry
  mode: Mode
  symbols: ReadonlyMap<string, string>
  days: number
}) {
  const tied = named.length > 1
  const detail = verdictDetail(mode, lead, { tied, days })

  return (
    <div className="verdict-block">
      <p className="verdict-kicker">{kicker}</p>
      <div className="verdict-hero">
        <h2 className="verdict-name">
          {named.map((entry) => (
            <span key={entry.player.id} className="verdict-chip">
              <PlayerName player={entry.player} />
            </span>
          ))}
        </h2>
        {mode === 'stock' ? (
          // The tape's own look, standing still: the same quote the ticker was
          // showing a moment ago. No symbol when it speaks for more than one
          // player — showing one of them would read as that player's quote.
          <TapeQuote entry={lead} symbol={tied ? undefined : symbols.get(lead.player.id)} />
        ) : (
          <p className="verdict-figure">{heroFigure(mode, lead)}</p>
        )}
      </div>
      {detail && <p className="verdict-detail">{detail}</p>}
    </div>
  )
}

function ResultRow({ entry, mode, symbol }: { entry: RankedEntry; mode: Mode; symbol: string }) {
  const { player, landing, rank, isWinner, isLoser, openPrice, closePrice, change } = entry

  return (
    <tr className={isWinner ? 'is-winner' : isLoser ? 'is-loser' : ''}>
      <td>{rank + 1}</td>
      <td>
        <PlayerDot player={player} />
        {player.name}
      </td>
      {mode === 'stock' ? (
        <>
          <td className="results-symbol">{symbol}</td>
          <td className="results-num">{formatPrice(openPrice)}</td>
          <td className="results-num" data-trend={trendOf(change)}>
            {formatChange(change)}
          </td>
          <td className="results-num">{formatPrice(closePrice)}</td>
        </>
      ) : (
        <>
          <td className="results-num">{landing.bin}</td>
          <td className="results-num">{landing.deviation.toFixed(1)}</td>
          <td className="results-num">{formatOdds(landing.probability)}</td>
        </>
      )}
    </tr>
  )
}
