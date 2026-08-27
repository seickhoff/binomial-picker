import { useEffect } from 'react'
import { settlementOf } from '../game/scoring'
import { useGame } from '../game/store'
import { useScoredRound } from '../result'
import type { Phase } from '../game/types'
import { PLACARD_MS, SUMMARY_MS } from './sessionTiming'

/**
 * Runs a series by itself.
 *
 * Two waits, and nothing else: long enough to read the placard before the drop,
 * and long enough to read the summary before the next session opens. Both are
 * plain timers keyed to the phase, so anything the player does — pressing the
 * button, going back to setup — cancels them by changing the phase out from
 * under them.
 */

/**
 * Whether another session should open on its own.
 *
 * Both modes, and not because it is tidier: a game that needs three rounds to
 * separate two players needs them in Black Swan exactly as much as in Stock
 * Market, and clicking through is the same chore either way. What differs is only
 * the dressing — Stock Market announces a new day, Black Swan simply drops again.
 */
export function wantsNextSession(phase: Phase, settled: boolean, autoSessions: boolean): boolean {
  return autoSessions && !settled && phase === 'results'
}

export function useSessionFlow(): void {
  const phase = useGame((s) => s.phase)
  const runToken = useGame((s) => s.runToken)
  const mode = useGame((s) => s.mode)
  const settleRule = useGame((s) => s.settleRule)
  const autoSessions = useGame((s) => s.autoSessions)
  const release = useGame((s) => s.release)
  const startTieBreak = useGame((s) => s.startTieBreak)
  const scored = useScoredRound()

  useEffect(() => {
    if (phase !== 'opening') return
    const timer = window.setTimeout(release, PLACARD_MS)
    return () => window.clearTimeout(timer)
    // `runToken` restarts the wait for each session, not just the first.
  }, [phase, runToken, release])

  // The series, not the day: past day one a result belongs to all of it.
  const { settled } = settlementOf(scored, mode, settleRule)
  const opening = wantsNextSession(phase, settled, autoSessions)

  useEffect(() => {
    if (!opening) return
    const timer = window.setTimeout(startTieBreak, SUMMARY_MS)
    return () => window.clearTimeout(timer)
  }, [opening, runToken, startTieBreak])
}
