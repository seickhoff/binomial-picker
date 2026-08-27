import { formatOdds } from '../game/binomial'
import { MODES, formatChange, formatPrice, trendOf } from '../game/modes'
import { openPriceOf, rankRound } from '../game/scoring'
import { sessionNumber } from '../game/series'
import { useGame } from '../game/store'
import { useScoredRound } from '../result'
import type { Player } from '../game/types'
import { PlayerDot } from './PlayerTag'

/** Live standings while the marbles are still falling. */
export function Hud() {
  const round = useGame((s) => s.round)
  const players = useGame((s) => s.players)
  const phase = useGame((s) => s.phase)
  const mode = useGame((s) => s.mode)
  const muted = useGame((s) => s.muted)
  const setMuted = useGame((s) => s.setMuted)
  const backToSetup = useGame((s) => s.backToSetup)
  const scored = useScoredRound()

  // Standings are the standings of the series, so a Black Swan player who has
  // landed today is placed on their whole run of sessions rather than on today's
  // bin alone. Anyone still falling drops through to `pending` below.
  const ranked = rankRound(scored, players, mode)
  const landedIds = new Set(round.landings.map((l) => l.playerId))
  const pending = round.entrantIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined && !landedIds.has(p.id))

  const heading = round.tieBreak
    ? `${MODES[mode].tieBreakName} · round ${sessionNumber(round)}`
    : 'Standings'

  return (
    <aside className="panel panel-hud" aria-live="polite">
      <div className="section-head">
        <h2>{heading}</h2>
        <div className="section-actions">
          <span className="hint">
            {round.landings.length}/{round.entrantIds.length} landed
          </span>
          {/* The setup panel is hidden while a round runs, so sound needs an off
              switch here too — otherwise the only way to stop it is to leave the
              round. Muting is separate from the individual settings, so it never
              forgets which sounds were wanted. */}
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute' : 'Mute all sound'}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          {/* Always available, mid-drop included, so a round can never trap you. */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={backToSetup}
            title="Back to setup (Esc)"
          >
            Setup
          </button>
        </div>
      </div>

      <ol className="standings">
        {ranked.map(({ player, landing, rank, closePrice, change }) => (
          <li key={player.id} className={rank === 0 && phase === 'results' ? 'is-leader' : ''}>
            <PlayerDot player={player} />
            <span className="standings-name">{player.name}</span>
            {mode === 'stock' ? (
              <>
                <span className="standings-bin" data-trend={trendOf(change)}>
                  {formatChange(change)}
                </span>
                <span className="standings-odds">{formatPrice(closePrice)}</span>
              </>
            ) : (
              <>
                <span className="standings-bin">bin {landing.bin}</span>
                <span className="standings-odds">{formatOdds(landing.probability)}</span>
              </>
            )}
          </li>
        ))}

        {pending.map((player) => (
          <li key={player.id} className="is-pending">
            <PlayerDot player={player} />
            <span className="standings-name">{player.name}</span>
            <span className="standings-bin">falling…</span>
            <span className="standings-odds">
              {mode === 'stock' ? formatPrice(openPriceOf(player.id, round)) : ''}
            </span>
          </li>
        ))}
      </ol>

      {/* Discoverable only if it is said somewhere, and this is the panel that is
          up while there is something to look at. */}
      <p className="hint">Hold Space to see the whole board</p>
    </aside>
  )
}
