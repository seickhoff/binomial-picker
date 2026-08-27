import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { boardGeometry } from '../game/geometry'
import { commonOpenPrice, winnersOf } from '../game/scoring'
import { useGame } from '../game/store'
import { useScoredRound } from '../result'
import { Board } from './Board'
import { CameraRig } from './CameraRig'
import { Marbles } from './Marbles'
import { Lights, SceneBackdrop, StudioEnvironment } from './Stage'
import { CAMERA_FOV } from './fit'

/**
 * Rendering keeps running this long after the action stops, to let the camera
 * finish its move and the peg flashes fade — then the loop idles.
 */
const COAST_MS = 1900

export function GameCanvas() {
  const rows = useGame((s) => s.rows)
  const mode = useGame((s) => s.mode)
  const fancy = useGame((s) => s.fancyGraphics)
  const phase = useGame((s) => s.phase)
  const runToken = useGame((s) => s.runToken)
  const round = useGame((s) => s.round)
  const players = useGame((s) => s.players)
  const overview = useGame((s) => s.overview)

  // The round's own depth once a round is under way, since the marbles follow
  // the flips it drew and the board has to have a row for each. The slider
  // drives the preview while setting up.
  const activeRows = phase === 'setup' ? rows : round.rows
  const geo = useMemo(() => boardGeometry(activeRows), [activeRows])
  /*
   * Which slots to light, once the drop is over.
   *
   * Who won is a question about the series — past day one a Black Swan winner is
   * whoever's whole run of sessions is rarest, not whoever strayed furthest
   * today. The slot is still today's: a scored round keeps the bin its marble
   * actually landed in, and only its odds speak for the series.
   */
  const scored = useScoredRound()
  const winnerBins = useMemo(
    () => (phase === 'results' ? winnersOf(scored, mode).map((l) => l.bin) : []),
    [phase, scored, mode],
  )
  // The overview is a camera move, so the loop has to be awake for it — on the
  // results screen it has usually idled by the time anyone holds space.
  const rendering = useRenderWhileActive(phase, runToken, activeRows, overview)

  return (
    <Canvas
      frameloop={rendering ? 'always' : 'demand'}
      // "percentage" = PCFShadowMap; three has deprecated the PCFSoft default.
      shadows={fancy ? 'percentage' : false}
      // Retina panels would otherwise render ~10 megapixels a frame, which is
      // what makes a laptop's fans spin up. Bloom hides the difference.
      dpr={[1, fancy ? 1.5 : 1]}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 500, position: [0, 0, 30] }}
      gl={{
        antialias: !fancy,
        toneMapping: ACESFilmicToneMapping,
        // Not 'high-performance': that pins a dual-GPU laptop to its discrete
        // card, which runs hot for no visible gain here.
        powerPreference: 'default',
      }}
    >
      <color attach="background" args={['#05060b']} />

      <CameraRig geo={geo} />
      <SceneBackdrop geo={geo} theme={mode === 'stock' ? 'stock' : 'blackSwan'} />
      <Lights geo={geo} fancy={fancy} />

      <Suspense fallback={null}>
        <Board
          geo={geo}
          landings={round.landings}
          players={players}
          winnerBins={winnerBins}
          fancy={fancy}
          mode={mode}
          openPrice={commonOpenPrice(round)}
        />
        <Marbles geo={geo} />
      </Suspense>

      <StudioEnvironment />

      {fancy && (
        <EffectComposer enableNormalPass={false} multisampling={2}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.6} luminanceSmoothing={0.28} />
          <Vignette offset={0.3} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

/**
 * True while the scene needs real frames.
 *
 * Marbles falling, a camera still gliding, or a fresh board all do; a settled
 * board does not, and idling there is what keeps the GPU — and the fans — quiet.
 * `runToken` and `rows` restart the coast so a new round or board re-renders.
 */
function useRenderWhileActive(
  phase: string,
  runToken: number,
  rows: number,
  overview: boolean,
): boolean {
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    setRendering(true)
    if (phase === 'running') return
    const timer = window.setTimeout(() => setRendering(false), COAST_MS)
    return () => window.clearTimeout(timer)
  }, [phase, runToken, rows, overview])

  return rendering
}
