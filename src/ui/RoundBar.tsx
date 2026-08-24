import { useEffect } from 'react'
import { useGame } from '../game/store'

/**
 * The running round's controls on a phone: one bar along the bottom.
 *
 * The standings are deliberately not here. As a card on a phone they covered most
 * of the board, and the board is the entire thing worth watching while the marbles
 * are falling — every figure that card held is on the results a few seconds later,
 * on a screen with nothing to hide behind it.
 *
 * What has to stay reachable is what a round cannot be left without: how far along
 * the drop is; sound, since the setup panel that holds the sound switches is gone;
 * the way out; and the wide shot, which on a phone has no space bar to be held
 * down on.
 */
export function RoundBar() {
  const round = useGame((s) => s.round)
  const muted = useGame((s) => s.muted)
  const setMuted = useGame((s) => s.setMuted)
  const overview = useGame((s) => s.overview)
  const setOverview = useGame((s) => s.setOverview)
  const backToSetup = useGame((s) => s.backToSetup)

  /*
   * A held key comes back up by itself; a latch does not. Leaving the round with
   * the wide shot still on would hand the results screen a camera pulled right
   * back, and nothing on that screen brings it in again.
   */
  useEffect(() => () => setOverview(false), [setOverview])

  return (
    <nav className="round-bar" aria-label="Round controls">
      <span className="round-bar-count" aria-live="polite">
        {round.landings.length}/{round.entrantIds.length} landed
      </span>

      {/*
       * A latch rather than a press-and-hold. Holding is right for a key, which
       * springs back on its own and leaves the other hand free; holding a finger
       * on a phone means covering the very thing being looked at, and invites the
       * long-press menu on top of it.
       */}
      <button
        type="button"
        className="btn btn-ghost"
        aria-pressed={overview}
        onClick={() => setOverview(!overview)}
      >
        Whole board
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={backToSetup}>
        Setup
      </button>
    </nav>
  )
}
