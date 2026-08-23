import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Trail } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import { planDrops, samplePath, type DropPath } from '../game/drop'
import { MARBLE_RADIUS, type BoardGeometry } from '../game/geometry'
import { colorForSlot } from '../game/palette'
import { openPriceOf } from '../game/scoring'
import { useGame } from '../game/store'
import { formatPrice, trendOf, walkOf } from '../game/modes'
import type { DropMode, Player } from '../game/types'
import { flashPeg } from '../live/pegFlashes'
import { clearMarbleFocus, dropMarbleFocus, reportMarbleY } from '../live/cameraFocus'
import { clearQuotes, closeQuote, publishPrice } from '../live/priceFeed'
import { overlayScale } from './framing'

/** Gap between releases when everyone drops at once, and the total it fits in. */
const TOGETHER_GAP_MS = 220
const TOGETHER_BUDGET_MS = 1800
/**
 * Gap in one-at-a-time mode.
 *
 * This used to wait for each marble to land before releasing the next, which on
 * a 24-row board is ten seconds each — a minute and a half for nine players. A
 * fixed beat keeps the pacing watchable however deep the board is.
 */
const SEQUENTIAL_GAP_MS = 2000
/** Marbles are spread slightly in depth so they don't sit inside one another. */
const DEPTH_SPREAD = 0.5

/*
 * Every name tag sits centred on its own marble — on it, not above it.
 *
 * Lifting the tag clear of the marble looks tidier in isolation but reads wrong
 * as soon as marbles stack in a bin: each tag then floats over the marble above
 * its own, so every name appears attached to the wrong ball. Sitting the tag on
 * the marble it names removes the ambiguity, and stacked marbles are further
 * apart than a tag is tall, so the tags stack in the same order as the balls.
 */
const LABEL_LIFT = 0

/** Gap between one release and the next. */
function staggerFor(count: number, dropMode: DropMode): number {
  if (count < 2) return 0
  if (dropMode === 'sequential') return SEQUENTIAL_GAP_MS
  // Tighten the stagger for a big roster so the round doesn't drag.
  return Math.min(TOGETHER_GAP_MS, TOGETHER_BUDGET_MS / (count - 1))
}

/** Fisher-Yates, so every release order is equally likely. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Turns the round's drawn flips into flight paths.
 *
 * The outcomes are decided in the game layer before the round starts — the row
 * count itself can depend on them — so nothing here chooses anything. Paths are
 * still built for the whole field at once: claiming resting slots one marble at
 * a time during render was a bug, because React may render a component more
 * than once, which double-booked bins and left marbles resting in mid-air.
 */
interface RoundPlan {
  readonly paths: Map<string, DropPath>
  /** Entrants in the order they are released — shuffled every round. */
  readonly order: readonly Player[]
}

function planRound(
  entrants: readonly Player[],
  geo: BoardGeometry,
  plan: Readonly<Record<string, readonly number[]>>,
): RoundPlan {
  // Nobody goes first two rounds running, in either release mode.
  const order = shuffled(entrants)
  /*
   * Planned in release order, because that is the order the marbles arrive in:
   * every path takes the same time to fall, so the stagger between releases is
   * the whole of the difference.
   *
   * `planDrops` hands out resting slots from the bottom of each bin upward as it
   * goes, so planning in any other order stacked the bins back to front — the
   * first marble down would be given a slot above marbles that had not been
   * released yet, and then sit there while they slid in underneath it.
   */
  const paths = planDrops(
    geo,
    order.map((player) => plan[player.id] ?? []),
  )
  return {
    paths: new Map(order.map((player, i) => [player.id, paths[i]])),
    order,
  }
}

export function Marbles({ geo }: { geo: BoardGeometry }) {
  const phase = useGame((s) => s.phase)
  const runToken = useGame((s) => s.runToken)
  const round = useGame((s) => s.round)
  const players = useGame((s) => s.players)
  const dropMode = useGame((s) => s.dropMode)
  const fancy = useGame((s) => s.fancyGraphics)
  const showLabels = useGame((s) => s.showLabels)
  const recordLanding = useGame((s) => s.recordLanding)
  const mode = useGame((s) => s.mode)

  const entrants = useMemo(
    () =>
      round.entrantIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p !== undefined),
    [round.entrantIds, players],
  )

  // Name tags read at their own pixel size however deep the board is.
  const size = useThree((s) => s.size)
  const labelScale = useMemo(
    () => overlayScale(geo, size.width / size.height, size.height),
    [geo, size.width, size.height],
  )

  /*
   * Planned when the drop starts, not when the session opens.
   *
   * Held in a ref keyed by runToken, so a repeat render reuses the same plan —
   * re-planning mid-round would change outcomes already recorded. And built no
   * earlier than the release, so the last round's marbles stay in their slots
   * while the next session's placard is up: they give way to the new field when
   * it is actually dropped, not a placard beforehand.
   */
  const plan = useRef<{ token: number; round: RoundPlan } | null>(null)
  if (phase === 'running' && plan.current?.token !== runToken) {
    plan.current = { token: runToken, round: planRound(entrants, geo, round.plan) }
  }

  /*
   * How many of the planned marbles have been let go, and of which plan.
   *
   * Tied together because they change at different moments: the plan is replaced
   * during a render and the count is reset by an effect afterwards, so a count
   * left over from the previous round would briefly be applied to the new one —
   * a frame of new marbles appearing at the funnel before the drop begins.
   */
  const [released, setReleased] = useState({ token: 0, count: 0 })

  // Child cleanups run first, so this clears anything they left behind.
  useEffect(
    () => () => {
      clearMarbleFocus()
      clearQuotes()
    },
    [runToken],
  )

  useEffect(() => {
    // Held until the session actually opens. Starting the stagger under the
    // placard would drop the first marbles behind it, and they would be halfway
    // down by the time it cleared.
    if (phase !== 'running') return

    setReleased({ token: runToken, count: 0 })
    const gap = staggerFor(entrants.length, dropMode)
    const timers = entrants.map((_, i) =>
      window.setTimeout(
        () =>
          setReleased((seen) =>
            seen.token === runToken
              ? { token: runToken, count: Math.max(seen.count, i + 1) }
              : seen,
          ),
        i * gap,
      ),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [dropMode, entrants.length, runToken, phase])

  // Setup clears the board; nothing has been planned before the first drop.
  if (phase === 'setup' || !plan.current) return null

  const { paths, order } = plan.current.round
  const timedReleases = released.token === plan.current.token ? released.count : 0

  const spread = entrants.length > 1 ? DEPTH_SPREAD : 0

  return (
    <group>
      {order.slice(0, timedReleases).map((player, i) => {
        const path = paths.get(player.id)
        if (!path) return null
        return (
          <Marble
            key={`${runToken}:${player.id}`}
            player={player}
            geo={geo}
            path={path}
            z={(i / Math.max(1, entrants.length - 1) - 0.5) * spread}
            fancy={fancy}
            showLabel={showLabels}
            labelScale={labelScale}
            // Stock Market: the tag ticks the running price as it falls.
            openPrice={mode === 'stock' ? openPriceOf(player.id, round) : null}
            rowMoves={round.rowMoves}
            onLand={recordLanding}
          />
        )
      })}
    </group>
  )
}

interface MarbleProps {
  player: Player
  geo: BoardGeometry
  /** Decided up front by planRound; the marble only plays it back. */
  path: DropPath
  z: number
  fancy: boolean
  showLabel: boolean
  /** World size of the name tag; see `overlayScale`. */
  labelScale: number
  /** What each row is worth, so the tag ticks the price the path is making. */
  rowMoves: readonly number[]
  /** Non-null in Stock Market mode: what this player's stock opened at. */
  openPrice: number | null
  onLand: (playerId: string, bin: number, flips: readonly number[]) => void
}

function Marble({
  player,
  geo,
  path,
  z,
  fancy,
  showLabel,
  labelScale,
  openPrice,
  rowMoves,
  onLand,
}: MarbleProps) {
  const group = useRef<Group>(null)
  const mesh = useRef<Mesh>(null!)
  const label = useRef<HTMLSpanElement>(null)
  const clock = useRef(0)
  const nextSegment = useRef(0)
  const shownRow = useRef(Number.NaN)
  const scored = useRef(false)

  const color = colorForSlot(player.slot).hex

  /*
   * This marble's price at every row, worked out once.
   *
   * A running total of steps is no longer enough to price a marble: rows are
   * worth different amounts, so what matters is which rows it went right on, not
   * how many. The walk holds that, and the tag reads it by row as it falls.
   */
  const walk = useMemo(
    () => (openPrice === null ? [] : walkOf(path.flips, openPrice, 'stock', rowMoves)),
    [path, openPrice, rowMoves],
  )

  // Stop steering the camera the moment this marble leaves the board.
  useEffect(() => () => dropMarbleFocus(player.id), [player.id])

  useFrame((_, dt) => {
    const node = group.current
    if (!node) return

    clock.current += dt
    const t = clock.current
    const { x, y } = samplePath(path, t)
    const height = Math.max(y, path.restY)
    node.position.set(x, height, z)
    reportMarbleY(player.id, height)
    // Roll the sphere, not the group: the group also carries the name tag,
    // which would otherwise orbit the marble as it spins.
    if (mesh.current) mesh.current.rotation.z = -x / MARBLE_RADIUS

    // Light up each peg as it is struck, and tick the price with it.
    while (nextSegment.current < path.segments.length) {
      const seg = path.segments[nextSegment.current]
      if (t < seg.t0 + seg.duration) break
      if (seg.pegIndex !== null) flashPeg(seg.pegIndex)
      nextSegment.current += 1

      if (openPrice !== null && seg.decisions !== shownRow.current) {
        shownRow.current = seg.decisions
        const price = walk[seg.decisions] ?? openPrice
        // Feed the ticker, which lives outside the Canvas.
        publishPrice(player.id, price)
        const node = label.current
        if (node) {
          // Written straight to the DOM: a per-frame React update for every
          // marble would cost far more than the text is worth.
          node.textContent = `${player.name} ${formatPrice(price)}`
          // Against the open, not the step count: a marble can be several steps
          // right of centre and still down, having gone left on the wild row.
          node.dataset.trend = trendOf(price - openPrice)
        }
      }
    }

    if (!scored.current && t >= path.landingTime) {
      scored.current = true
      if (openPrice !== null) {
        closeQuote(player.id, walk[walk.length - 1] ?? openPrice)
      }
      onLand(player.id, path.bin, path.flips)
    }
  })

  return (
    <>
      <group ref={group} position={[path.segments[0].x0, geo.dropY, z]}>
        <mesh ref={mesh} castShadow>
          <sphereGeometry args={[MARBLE_RADIUS, 32, 32]} />
          <meshPhysicalMaterial
            color={color}
            metalness={0.32}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.08}
            emissive={color}
            emissiveIntensity={0.5}
            envMapIntensity={1.5}
          />
        </mesh>
        {showLabel && (
          <Html
            center
            position={[0, LABEL_LIFT, 0]}
            distanceFactor={labelScale}
            // Below every panel's stacking order; see .panel in styles.css.
            zIndexRange={[9, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span ref={label} className="marble-label" style={{ '--chip': color } as CSSProperties}>
              {openPrice === null ? player.name : `${player.name} ${formatPrice(openPrice)}`}
            </span>
          </Html>
        )}
      </group>

      {/* Trails live outside the moving group so they're drawn in world space. */}
      {fancy && (
        <Trail
          target={mesh}
          width={2.4}
          length={5}
          decay={1.6}
          color={color}
          attenuation={(w) => w * w}
        />
      )}
    </>
  )
}
