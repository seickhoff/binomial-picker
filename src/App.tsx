import { useEffect } from 'react'
import { GameCanvas } from './three/GameCanvas'
import { Hud } from './ui/Hud'
import { ResultsPanel } from './ui/ResultsPanel'
import { RoundBar } from './ui/RoundBar'
import { SessionPlacard } from './ui/SessionPlacard'
import { SetupPanel } from './ui/SetupPanel'
import { useCompactLayout } from './viewport'
import { useSessionFlow } from './ui/useSessionFlow'
import { TickerTape } from './ui/TickerTape'
import { MODES } from './game/modes'
import { useGame } from './game/store'
import { useGameAudio } from './audio/useGameAudio'
import { ownsSpace, typing } from './ui/keys'

export default function App() {
  useGameAudio()
  useSessionFlow()

  const phase = useGame((s) => s.phase)
  const mode = useGame((s) => s.mode)
  const backToSetup = useGame((s) => s.backToSetup)
  const setOverview = useGame((s) => s.setOverview)
  const compact = useCompactLayout()
  const info = MODES[mode]

  /*
   * Space and Esc.
   *
   * Space pulls the camera back to take in the whole board for as long as it is
   * held, and does nothing else. It used to start a round as well, which made
   * looking at a finished board throw it away and drop again — a keystroke meant
   * to inspect something is a poor place for an irreversible action. Rounds start
   * from the Drop button, the placard, or the buttons on the results.
   *
   * It works wherever the focus happens to be, save for the few controls that
   * have a real claim on the key — see `ownsSpace`. Esc stays out of text fields
   * entirely, where it means "never mind this edit" rather than "leave the round".
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null

      if (event.code === 'Space' && !ownsSpace(target)) {
        /*
         * Also stops the browser pressing a focused button with the same
         * keystroke, which is the other way space restarted rounds: after
         * clicking "New session" that button keeps focus, so a space meant for
         * the camera pressed it again.
         *
         * The cost is that space no longer activates buttons. Enter still does,
         * so nothing becomes unreachable from the keyboard.
         */
        event.preventDefault()
        setOverview(true)
        return
      }

      if (typing(target)) return

      if (event.code === 'Escape' && phase !== 'setup') {
        event.preventDefault()
        backToSetup()
        return
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setOverview(false)
    }

    // A key held while the window loses focus never reports going up, and the
    // camera would stay out at the wide shot with nothing to bring it back.
    function onBlur() {
      setOverview(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [phase, backToSetup, setOverview])

  const tickerRunning = mode === 'stock' && phase !== 'setup'

  return (
    // `data-ticker` is what the compact layout keys the tape's own row off: the
    // nav is a row taller when there is a tape, and every panel below it is
    // positioned off that height.
    <div className="app" data-mode={mode} data-ticker={tickerRunning ? '' : undefined}>
      <GameCanvas />

      {/* Brand on the left, tape on the right. Always present, so nothing below
          it has to guess how much room the header needs. */}
      <header className="topnav">
        <div className="topnav-brand">
          <span className="topnav-logo">
            Binomial<span>Picker</span>
          </span>
          <span className="topnav-mode">{info.name}</span>
        </div>
        {tickerRunning ? <TickerTape /> : <p className="topnav-rule">{info.rule}</p>}
      </header>

      {/* One panel at a time: the results table supersedes the live standings,
          and a tall results card would otherwise collide with it.

          On a phone the running round shows a bar instead of the standings card,
          which there covered the board it was reporting on. The choice lives here,
          with the rest of what-goes-where, rather than inside either component. */}
      {phase === 'setup' && <SetupPanel />}
      {(phase === 'opening' || phase === 'running') && (compact ? <RoundBar /> : <Hud />)}
      {phase === 'results' && <ResultsPanel />}

      {/* Over everything, including the standings: it is what the session is
          waiting on. */}
      {phase === 'opening' && <SessionPlacard />}
    </div>
  )
}
