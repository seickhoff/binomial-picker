import { useEffect } from 'react'
import { useGame } from '../game/store'
import { onPegStrike } from '../live/pegFlashes'
import { isFloorOpen, isMarketClosed } from './ambience'
import { ringClosingBell, ringOpeningBell } from './bell'
import { holdAudio, setMuted } from './context'
import { plinkPeg } from './plinks'
import { closeFloor, openFloor } from './tradingFloor'

/**
 * Runs every sound the game makes.
 *
 * Each effect here is one sound's whole lifetime, and none of them decides
 * anything: the rules live in `isFloorOpen` and in the settings, so this only has
 * to notice when an answer changes.
 */
export function useGameAudio(): void {
  const muted = useGame((s) => s.muted)
  const floorSound = useGame((s) => s.floorSound)
  const plinkSound = useGame((s) => s.plinkSound)
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const runToken = useGame((s) => s.runToken)

  const floorOpen = isFloorOpen(mode, phase, floorSound)
  const marketClosed = isMarketClosed(mode, phase, floorSound)

  useEffect(() => {
    setMuted(muted)
  }, [muted])

  useEffect(() => {
    if (!floorOpen) return
    openFloor()
    return closeFloor
  }, [floorOpen])

  // One ring per round, tie-breaks included — `runToken` changes for every
  // release, so a second session rings in and out again.
  useEffect(() => {
    if (floorOpen) ringOpeningBell()
  }, [floorOpen, runToken])

  useEffect(() => {
    if (marketClosed) ringClosingBell()
  }, [marketClosed, runToken])

  // Subscribed only while marbles are actually falling, so nothing is listening
  // to the board the rest of the time.
  useEffect(() => {
    if (!plinkSound || phase !== 'running') return
    return onPegStrike(plinkPeg)
  }, [plinkSound, phase])

  useEffect(() => {
    function onVisibilityChange() {
      holdAudio(document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
