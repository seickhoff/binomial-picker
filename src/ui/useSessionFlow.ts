import { useEffect } from 'react'
import { settlementOf } from '../game/scoring'
import { useGame } from '../game/store'

/**
 * Runs a series by itself.
 *
 * Two waits, and nothing else: long enough to read the placard before the drop,
 * and long enough to read the summary before the next session opens. Both are
 * plain timers keyed to the phase, so anything the player does — pressing the
 * button, going back to setup — cancels them by changing the phase out from
 * under them.
 */

/** Placard time. A beat to read the day, and for the bell to get going. */
const PLACARD_MS = 2400
/** Summary time, before the next session opens itself. */
const SUMMARY_MS = 5200

export function useSessionFlow(): void {
  const phase = useGame((s) => s.phase)
  const runToken = useGame((s) => s.runToken)
  const mode = useGame((s) => s.mode)
  const settleRule = useGame((s) => s.settleRule)
  const round = useGame((s) => s.round)
  const autoSessions = useGame((s) => s.autoSessions)
  const release = useGame((s) => s.release)
  const startTieBreak = useGame((s) => s.startTieBreak)

  useEffect(() => {
    if (phase !== 'opening') return
    const timer = window.setTimeout(release, PLACARD_MS)
    return () => window.clearTimeout(timer)
    // `runToken` restarts the wait for each session, not just the first.
  }, [phase, runToken, release])

  // Stock Market only, like the placards: Black Swan's tie-break is sudden
  // death rather than another day's trading, and it stays a deliberate press.
  const unsettled =
    phase === 'results' && mode === 'stock' && !settlementOf(round, mode, settleRule).settled

  useEffect(() => {
    if (!autoSessions || !unsettled) return
    const timer = window.setTimeout(startTieBreak, SUMMARY_MS)
    return () => window.clearTimeout(timer)
  }, [autoSessions, unsettled, runToken, startTieBreak])
}
