import { useEffect } from 'react'
import { GameCanvas } from './three/GameCanvas'
import { Hud } from './ui/Hud'
import { ResultsPanel } from './ui/ResultsPanel'
import { SetupPanel } from './ui/SetupPanel'
import { TickerTape } from './ui/TickerTape'
import { MODES } from './game/modes'
import { useGame } from './game/store'

export default function App() {
  const phase = useGame((s) => s.phase)
  const start = useGame((s) => s.start)
  const mode = useGame((s) => s.mode)
  const backToSetup = useGame((s) => s.backToSetup)
  const info = MODES[mode]

  // Space re-drops, Esc always gets you back to setup. Neither fires while a
  // text field has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (event.code === 'Escape' && phase !== 'setup') {
        event.preventDefault()
        backToSetup()
        return
      }
      if (event.code === 'Space' && phase !== 'running') {
        event.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, start, backToSetup])

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
      {phase === 'running' && <Hud />}
      {phase === 'results' && <ResultsPanel />}
    </div>
  )
}
