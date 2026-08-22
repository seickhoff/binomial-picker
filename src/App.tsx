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
  const start = useGame((s) => s.start)
  const release = useGame((s) => s.release)
  const mode = useGame((s) => s.mode)
  const backToSetup = useGame((s) => s.backToSetup)
  const setOverview = useGame((s) => s.setOverview)
  const info = MODES[mode]

  /*
   * Space and Esc. Neither fires while a text field has focus.
   *
   * Space does two things at once, which is deliberate: it gets the round going,
   * and it pulls the camera back to take in the whole board for as long as it is
   * held. So holding it through the start of a round both drops the marbles and
   * watches them from far enough away to see every peg, and letting go returns to
   * the close follow shot.
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
        event.preventDefault()
        setOverview(true)
        // Held keys repeat, and a repeat is not a second press: without this,
        // holding space in setup restarted the round many times a second.
        if (event.repeat) return
        if (phase === 'opening') release()
        else if (phase !== 'running') start()
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
  }, [phase, start, release, backToSetup, setOverview])

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
