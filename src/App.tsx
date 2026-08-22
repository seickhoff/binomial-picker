import { useEffect } from 'react'
import { GameCanvas } from './three/GameCanvas'
import { Hud } from './ui/Hud'
import { ResultsPanel } from './ui/ResultsPanel'
import { SessionPlacard } from './ui/SessionPlacard'
import { SetupPanel } from './ui/SetupPanel'
import { useSessionFlow } from './ui/useSessionFlow'
import { TickerTape } from './ui/TickerTape'
import { MODES } from './game/modes'
import { useGame } from './game/store'
import { useGameAudio } from './audio/useGameAudio'

export default function App() {
  useGameAudio()
  useSessionFlow()

  const phase = useGame((s) => s.phase)
  const mode = useGame((s) => s.mode)
  const backToSetup = useGame((s) => s.backToSetup)
  const setOverview = useGame((s) => s.setOverview)
  const info = MODES[mode]

  /*
   * Space and Esc. Neither fires while a text field has focus.
   *
   * Space pulls the camera back to take in the whole board for as long as it is
   * held, and does nothing else. It used to start a round as well, which made
   * looking at a finished board throw it away and drop again — a keypress meant
   * to inspect something is a poor place to put an irreversible action. Rounds
   * start from the Drop button, the placard, or the buttons on the results.
   */
  useEffect(() => {
    function typing(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    }

    function onKeyDown(event: KeyboardEvent) {
      if (typing(event)) return

      if (event.code === 'Escape' && phase !== 'setup') {
        event.preventDefault()
        backToSetup()
        return
      }
      if (event.code === 'Space') {
        /*
         * Also stops the browser pressing a focused button with the same
         * keystroke, which is the other way space restarted rounds: after
         * clicking "New session" that button keeps focus, so a space meant for
         * the camera pressed it again.
         *
         * The cost is that space no longer activates buttons anywhere in the app.
         * Enter still does, so nothing becomes unreachable from the keyboard, and
         * a focused checkbox is untouched — the guard above lets inputs keep it.
         */
        event.preventDefault()
        setOverview(true)
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
    <div className="app" data-mode={mode}>
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
          and a tall results card would otherwise collide with it. */}
      {phase === 'setup' && <SetupPanel />}
      {(phase === 'opening' || phase === 'running') && <Hud />}
      {phase === 'results' && <ResultsPanel />}

      {/* Over everything, including the standings: it is what the session is
          waiting on. */}
      {phase === 'opening' && <SessionPlacard />}
    </div>
  )
}
