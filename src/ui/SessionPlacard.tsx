import { tradingDayAfter } from '../game/calendar'
import { sessionNumber } from '../game/series'
import { useGame } from '../game/store'
import { sessionPlacard } from './presenters'

/**
 * The card that opens a session.
 *
 * Shown over the board with the marbles held at the funnel, so a series reads as
 * a run of dated days rather than one drop repeated until it comes out tidy.
 *
 * Clicking it drops the marbles early. Nobody should have to wait out an
 * animation they have already read, and the placard covers the whole screen, so
 * clicking it is what anyone impatient will try first.
 */
export function SessionPlacard() {
  const round = useGame((s) => s.round)
  const seriesStart = useGame((s) => s.seriesStart)
  const release = useGame((s) => s.release)

  // Session one is day one; each tie-break that follows is the next trading day.
  const day = sessionNumber(round)
  const { kicker, title, date } = sessionPlacard(
    day,
    tradingDayAfter(new Date(seriesStart), round.index),
  )

  return (
    <button
      type="button"
      className="placard"
      onClick={release}
      aria-label={`${title}. Start the session`}
    >
      <span className="placard-card">
        <span className="placard-kicker">{kicker}</span>
        <span className="placard-title">{title}</span>
        <span className="placard-date">{date}</span>
      </span>
    </button>
  )
}
