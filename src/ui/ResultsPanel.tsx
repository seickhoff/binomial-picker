import { useMemo } from 'react'
import { formatOdds } from '../game/binomial'
import { MODES, formatChange, formatPrice, trendOf } from '../game/modes'
import { commonOpenPrice, rankRound, settlementOf } from '../game/scoring'
import { seriesCandles, seriesOf, seriesTotals } from '../game/series'
import { useGame } from '../game/store'
import type { Mode, RankedEntry } from '../game/types'
import { CandleChart } from './CandleChart'
import { DistributionChart } from './DistributionChart'
import { MoveLines } from './MoveLines'
import { PlayerDot, PlayerName } from './PlayerTag'
import { TapeQuote } from './TapeQuote'
import { useDraggable } from './useDraggable'
import {
  autoSessionHint,
  bottomKicker,
  lineLabels,
  heroFigure,
  rematchLabel,
  resultsTableCaption,
  tickerSymbols,
  tieBreakLabel,
  topKicker,
  verdictDetail,
} from './presenters'

const CHART_VIEWS = [
  { id: 'distribution', label: 'Distribution' },
  { id: 'moves', label: 'Every move' },
  { id: 'candles', label: 'Candles' },
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
  const rematch = useGame((s) => s.rematch)
  const backToSetup = useGame((s) => s.backToSetup)

  const ranked = rankRound(round, players, mode)
  const settlement = settlementOf(round, mode, settleRule)
  const { winners, settled } = settlement
  const top = ranked.find((entry) => entry.isWinner)
  const symbols = tickerSymbols(players)
  // The bottom is only its own result when it isn't also the top — a field where
  // everyone tied has one end, not two.
  const losers = ranked.filter((entry) => entry.isLoser && !entry.isWinner)
  const bottom = losers[0]

  /*
   * The whole series, when there is one.
   *
   * Stock Market prices carry forward, so a series that took four days is one
   * price history and one longer drop — forty flips at ten rows a day — and both
   * charts read better over the whole thing than over the last day of it. Black
   * Swan starts each round from the centre, so there is nothing to accumulate.
   */
  const sessions = useMemo(
    () => (mode === 'stock' ? seriesOf(history, round) : [round]),
    [mode, history, round],
  )
  const totals = useMemo(() => seriesTotals(sessions), [sessions])
  const acrossDays = sessions.length > 1

  // A series always opens at the same price for everyone, even though a single
  // after-hours session does not.
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

  return (
    <section className="panel panel-results" aria-live="polite" ref={panel}>
      {/* Drag handle. The verdict sits inside it, so the whole top of the card
          is the grab area rather than a thin strip. */}
      <div className="panel-grip" ref={handle}>
        <span className="panel-grip-bar" aria-hidden="true" />

        {top && (
          <VerdictBlock
            kicker={topKicker(mode, settlement)}
            named={ranked.filter((entry) => entry.isWinner)}
            lead={top}
            mode={mode}
            symbols={symbols}
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
          <div className="chart-switch" role="radiogroup" aria-label="Chart">
            {CHART_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                role="radio"
                aria-checked={chartView === view.id}
                className={chartView === view.id ? 'is-active' : ''}
                onClick={() => setChartView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {chartOpen &&
        (chartView === 'candles' ? (
          <CandleChart
            entries={ranked}
            candles={seriesCandles(sessions, mode)}
            mode={mode}
            openPrice={seriesOpenPrice}
            labels={lineLabels(mode, players)}
          />
        ) : chartView === 'moves' ? (
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
                  Off centre
                </th>
              </>
            )}
            <th scope="col" className="results-num">
              {MODES[mode].resultLabel}
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
}: {
  kicker: string
  named: readonly RankedEntry[]
  lead: RankedEntry
  mode: Mode
  symbols: ReadonlyMap<string, string>
}) {
  const tied = named.length > 1
  // A tie is a tie on one figure only; anything derived from the opening price
  // is per-player unless they all opened together.
  const sharedOpen = named.every((entry) => entry.openPrice === lead.openPrice)
  const detail = verdictDetail(mode, lead, { tied, sharedOpen })

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
