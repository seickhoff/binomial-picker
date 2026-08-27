import { useMemo } from 'react'
import { scoredRound } from './game/series'
import { useGame } from './game/store'
import type { Round } from './game/types'

/**
 * The round a result is read off: the series so far, not just today.
 *
 * At the top level rather than inside `ui/`, for the same reason as `viewport`:
 * the scene asks the question too — the board lights the winning slot — and
 * `three/` cannot reach into the panels' own modules. It is a React hook, so it
 * cannot live in `game/`, which is rules and holds no framework.
 *
 * Memoised, and not only to save work. It builds a round, so read straight
 * through a selector it would be a new object every time, which React treats as
 * a change and re-renders on for ever.
 */
export function useScoredRound(): Round {
  const round = useGame((s) => s.round)
  const history = useGame((s) => s.history)
  const mode = useGame((s) => s.mode)
  return useMemo(() => scoredRound(history, round, mode), [history, round, mode])
}
