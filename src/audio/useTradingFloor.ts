import { useEffect } from 'react'
import { useGame } from '../game/store'
import { isFloorOpen } from './ambience'
import { closeFloor, holdFloor, openFloor } from './tradingFloor'

/**
 * Runs the trading floor for as long as the game wants it.
 *
 * The whole hook is one boolean's worth of behaviour, which is the point: the
 * rule lives in `isFloorOpen` and the sound lives in `tradingFloor`, so this
 * only has to notice when the answer changes.
 */
export function useTradingFloor(): void {
  const enabled = useGame((s) => s.floorSound)
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const open = isFloorOpen(mode, phase, enabled)

  useEffect(() => {
    if (!open) return
    openFloor()
    return closeFloor
  }, [open])

  // A tab in the background has no business making noise, and a suspended
  // context also stops costing anything to run.
  useEffect(() => {
    if (!open) return
    function onVisibilityChange() {
      holdFloor(document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [open])
}
