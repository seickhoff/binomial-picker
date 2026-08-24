import { useEffect } from 'react'
import { binomialPmf } from '../game/binomial'
import { MAX_ROWS, MIN_ROWS } from '../game/geometry'
import { MAX_VOLATILITY_CENTS, MODES, MODE_ORDER, VOLATILITY_MOODS } from '../game/modes'
import { MAX_PLAYERS, MIN_PLAYERS, colorForSlot } from '../game/palette'
import { useGame } from '../game/store'
import { PlayerDot } from './PlayerTag'
import { tickerSymbols } from '../game/symbols'
import {
  autoSessionsHint,
  autoSessionsLabel,
  rowsSummary,
  settleRuleHint,
  volatilityHint,
} from './presenters'

/**
 * One end of a volatility band, in whole cents.
 *
 * A slider rather than a typed number. As a number field it was near enough
 * unusable: the value is controlled by the store, which clamps a band the moment
 * it stops making sense, so a digit typed against an existing one gave 51¢ before
 * you could reach the 2, and correcting it meant selecting four characters in a
 * four-character box. Dragged, every position is valid on the way past.
 *
 * The figure is not repeated beside each slider — the band's own heading already
 * reads "0–5¢", which is the pair the reader wants rather than either end alone.
 */
function CentsSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (cents: number) => void
}) {
  return (
    <input
      className="band-slider"
      type="range"
      min={0}
      max={MAX_VOLATILITY_CENTS}
      step={1}
      value={value}
      aria-label={label}
      aria-valuetext={`${value} cents`}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function SetupPanel() {
  const rows = useGame((s) => s.rows)
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)
  const players = useGame((s) => s.players)
  const dropMode = useGame((s) => s.dropMode)
  const showLabels = useGame((s) => s.showLabels)
  const fancyGraphics = useGame((s) => s.fancyGraphics)
  const setRows = useGame((s) => s.setRows)
  const setDropMode = useGame((s) => s.setDropMode)
  const setShowLabels = useGame((s) => s.setShowLabels)
  const setFancyGraphics = useGame((s) => s.setFancyGraphics)
  const floorSound = useGame((s) => s.floorSound)
  const setFloorSound = useGame((s) => s.setFloorSound)
  const plinkSound = useGame((s) => s.plinkSound)
  const setPlinkSound = useGame((s) => s.setPlinkSound)
  const addPlayer = useGame((s) => s.addPlayer)
  const removePlayer = useGame((s) => s.removePlayer)
  const renamePlayer = useGame((s) => s.renamePlayer)
  const setPlayerActive = useGame((s) => s.setPlayerActive)
  const sortRoster = useGame((s) => s.sortRoster)
  const volatileRows = useGame((s) => s.volatileRows)
  const setVolatileRows = useGame((s) => s.setVolatileRows)
  const volatility = useGame((s) => s.volatility)
  const setVolatilityBand = useGame((s) => s.setVolatilityBand)
  const resetVolatility = useGame((s) => s.resetVolatility)
  const settleRule = useGame((s) => s.settleRule)
  const setSettleRule = useGame((s) => s.setSettleRule)
  const autoSessions = useGame((s) => s.autoSessions)
  const setAutoSessions = useGame((s) => s.setAutoSessions)
  const start = useGame((s) => s.start)

  /*
   * Filed on the way in and on the way out.
   *
   * On the way in so the list is tidy every time setup opens, and on the way out
   * to catch a name finished with the Enter key or the Drop button, neither of
   * which blurs the field first.
   */
  useEffect(() => {
    sortRoster()
    return sortRoster
  }, [sortRoster])

  const playing = players.filter((p) => p.active)
  const enoughPlayers = playing.length >= MIN_PLAYERS

  const pmf = binomialPmf(rows)
  const symbols = tickerSymbols(players)

  return (
    <aside className="panel panel-setup">
      <section className="panel-section">
        <h2>Game</h2>
        <div className="segmented" role="radiogroup" aria-label="Game mode">
          {MODE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              className={mode === id ? 'is-active' : ''}
              onClick={() => setMode(id)}
            >
              {MODES[id].name}
            </button>
          ))}
        </div>
        <p className="hint">{MODES[mode].tagline}</p>
      </section>

      <section className="panel-section">
        <div className="field">
          <label className="field-label" htmlFor="rows">
            Peg rows
            <output className="field-value">{rows}</output>
          </label>
          <input
            id="rows"
            type="range"
            min={MIN_ROWS}
            max={MAX_ROWS}
            step={1}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
          />
          <p className="hint">{rowsSummary(mode, rows, pmf, volatileRows, volatility)}</p>
        </div>
      </section>

      <section className="panel-section panel-section-players">
        <div className="section-head">
          <h2>
            Players <span className="section-count">{playing.length} in</span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={addPlayer}
            disabled={players.length >= MAX_PLAYERS}
            title={
              players.length >= MAX_PLAYERS
                ? `${MAX_PLAYERS} players is the maximum`
                : 'Add a player'
            }
          >
            + Add
          </button>
        </div>

        <ul className="player-list">
          {players.map((player) => {
            const color = colorForSlot(player.slot)
            return (
              <li key={player.id} className={`player-row${player.active ? '' : ' is-out'}`}>
                <input
                  type="checkbox"
                  className="player-active"
                  checked={player.active}
                  onChange={(e) => setPlayerActive(player.id, e.target.checked)}
                  aria-label={`${player.name} takes part`}
                  title={player.active ? `Sit ${player.name} out` : `Bring ${player.name} back in`}
                />
                <PlayerDot player={player} />
                <input
                  className="player-name"
                  value={player.name}
                  maxLength={20}
                  aria-label={`Name for player ${player.slot + 1} (${color.label})`}
                  onChange={(e) => renamePlayer(player.id, e.target.value)}
                  // Filed once the name is finished. Sorting on every keystroke
                  // would slide the row away from the cursor mid-word.
                  onBlur={sortRoster}
                />
                {/* A ticker symbol is a Stock Market idea. Black Swan has no
                    tape, no quotes and no symbol column in its results, so one
                    here was the only place it leaked in. */}
                {mode === 'stock' && (
                  <span className="player-symbol" title={`Ticker symbol for ${player.name}`}>
                    {symbols.get(player.id)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => removePlayer(player.id)}
                  disabled={players.length <= MIN_PLAYERS}
                  aria-label={`Remove ${player.name}`}
                  title={
                    players.length <= MIN_PLAYERS
                      ? `Need at least ${MIN_PLAYERS} players`
                      : `Remove ${player.name}`
                  }
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
        <p className="hint">Saved on this device. Untick to sit a round out.</p>
      </section>

      <section className="panel-section">
        <h2>Settle until</h2>
        <div className="segmented" role="radiogroup" aria-label="Settle rule">
          <button
            type="button"
            role="radio"
            aria-checked={settleRule === 'winner'}
            className={settleRule === 'winner' ? 'is-active' : ''}
            onClick={() => setSettleRule('winner')}
          >
            One winner
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settleRule === 'winnerAndLoser'}
            className={settleRule === 'winnerAndLoser' ? 'is-active' : ''}
            onClick={() => setSettleRule('winnerAndLoser')}
          >
            Winner &amp; loser
          </button>
        </div>
        <p className="hint">{settleRuleHint(settleRule)}</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={autoSessions}
            onChange={(e) => setAutoSessions(e.target.checked)}
          />
          {autoSessionsLabel(mode)}
        </label>
        <p className="hint">{autoSessionsHint(mode, autoSessions)}</p>
      </section>

      <section className="panel-section">
        <h2>Release</h2>
        <div className="segmented" role="radiogroup" aria-label="Release mode">
          <button
            type="button"
            role="radio"
            aria-checked={dropMode === 'together'}
            className={dropMode === 'together' ? 'is-active' : ''}
            onClick={() => setDropMode('together')}
          >
            All at once
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={dropMode === 'sequential'}
            className={dropMode === 'sequential' ? 'is-active' : ''}
            onClick={() => setDropMode('sequential')}
          >
            One at a time
          </button>
        </div>
        <p className="hint">
          {dropMode === 'together'
            ? 'All together — more spectacle.'
            : 'One every two seconds — easier to follow.'}
        </p>
      </section>

      <section className="panel-section">
        <label className="toggle">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          Name tags on marbles
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={fancyGraphics}
            onChange={(e) => setFancyGraphics(e.target.checked)}
          />
          Bloom, shadows &amp; trails
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={plinkSound}
            onChange={(e) => setPlinkSound(e.target.checked)}
          />
          Plink on every peg
        </label>
        {/* Only offered in the mode that has a floor to stand on. */}
        {mode === 'stock' && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={floorSound}
              onChange={(e) => setFloorSound(e.target.checked)}
            />
            Trading floor &amp; opening bell
          </label>
        )}
      </section>

      {/* Last, and its own section: only Stock Market prices anything, so only it
          has a market to set — and the three bands are more card than the settings
          above them, which have to stay reachable. */}
      {mode === 'stock' && (
        <section className="panel-section">
          <h2>Volatility</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={volatileRows}
              onChange={(e) => setVolatileRows(e.target.checked)}
            />
            Each row moves its own amount
          </label>

          {/* Only while it is on: three bands are a lot of card to spend on a
              setting that is doing nothing. */}
          {volatileRows && (
            <div className="bands">
              {VOLATILITY_MOODS.map((mood) => {
                const [low, high] = volatility[mood]
                return (
                  <div className="band" key={mood}>
                    <div className="band-head">
                      <span className="band-name">{mood}</span>
                      <span className="band-range">
                        {low}–{high}¢
                      </span>
                    </div>
                    <CentsSlider
                      label={`${mood} band, from`}
                      value={low}
                      onChange={(cents) => setVolatilityBand(mood, [cents, high])}
                    />
                    <CentsSlider
                      label={`${mood} band, to`}
                      value={high}
                      onChange={(cents) => setVolatilityBand(mood, [low, cents])}
                    />
                  </div>
                )
              })}
              <button type="button" className="btn btn-ghost" onClick={resetVolatility}>
                Reset bands
              </button>
            </div>
          )}
          <p className="hint">{volatilityHint(volatileRows, volatility)}</p>
        </section>
      )}

      {/* Wrapped so the compact layout has something to make sticky: as a sheet,
          this panel is one long scroll, and the button that starts the round is
          the one control that must never be scrolled away from. */}
      <footer className="panel-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={start}
          disabled={!enoughPlayers}
        >
          {enoughPlayers ? `Drop ${playing.length} marbles` : `Need ${MIN_PLAYERS} players in`}
        </button>
      </footer>
    </aside>
  )
}
