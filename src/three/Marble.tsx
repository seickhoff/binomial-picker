/**
 * One marble: its flight, its trail, and the tag that names it.
 *
 * Plays back a path decided before the round began — nothing here chooses
 * anything — and reports what it passes as it goes: the peg it struck, the price
 * it reached, the height it is at for the camera to follow, and finally its
 * landing. The field that owns it is `Marbles`, next door.
 *
 * The moving parts are written straight to three objects and to the DOM inside
 * `useFrame`, never through React state: at sixty frames a second, for twenty
 * marbles at once, a re-render per tick is the whole frame budget.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Trail } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import { samplePath, type DropPath } from '../game/drop'
import { MARBLE_RADIUS, type BoardGeometry } from '../game/geometry'
import { formatPrice, trendOf, walkOf, type Market } from '../game/modes'
import { colorForSlot } from '../game/palette'
import type { Player } from '../game/types'
import { dropMarbleFocus, reportMarbleY } from '../live/cameraFocus'
import { closeQuote, publishPrice } from '../live/priceFeed'
import { flashPeg } from '../live/pegFlashes'

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
  /** What the tag says: a name, or a ticker symbol where there is less room. */
  label: string
  /** Whether the tag carries the running price beside that. */
  showPrice: boolean
  /** A narrow screen, where the tag takes a fixed pixel size. */
  compact: boolean
  /**
   * The tag's z-index band, written through as prices move; see `tagStack`. The
   * same array for the tag's whole life, so a reorder costs no render.
   */
  tagRange?: [number, number]
  /** What the pegs are worth to this player, so the tag ticks the right price. */
  market: Market
  /** Non-null in Stock Market mode: what this player's stock opened at. */
  openPrice: number | null
  onLand: (playerId: string, bin: number, flips: readonly number[]) => void
}

export function Marble({
  player,
  geo,
  path,
  z,
  fancy,
  showLabel,
  labelScale,
  label: tag,
  showPrice,
  compact,
  tagRange,
  openPrice,
  market,
  onLand,
}: MarbleProps) {
  const group = useRef<Group>(null)
  const mesh = useRef<Mesh>(null!)
  const label = useRef<HTMLSpanElement>(null)
  const clock = useRef(0)
  const nextSegment = useRef(0)
  /** The row the price has been published for, and the row the tag is showing. */
  const shownRow = useRef(Number.NaN)
  const painted = useRef(Number.NaN)
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
    () => (openPrice === null ? [] : walkOf(path.flips, openPrice, 'stock', market)),
    [path, openPrice, market],
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
        // Feed the ticker, which lives outside the Canvas.
        publishPrice(player.id, walk[seg.decisions] ?? openPrice)
      }
    }

    /*
     * The tag catches up to the row the marble is on, whenever it can.
     *
     * Painted here rather than at the crossing itself because the tag's element
     * may not exist yet on the frame a row is crossed — and a write skipped there
     * was a write lost until the *next* row, which left a tag reading a price a
     * whole row behind the tape overhead. Still written straight to the DOM: a
     * React update per marble per row would cost far more than the text.
     */
    if (openPrice !== null && label.current && painted.current !== shownRow.current) {
      const price = walk[shownRow.current] ?? openPrice
      painted.current = shownRow.current
      if (showPrice) label.current.textContent = `${tag} ${formatPrice(price)}`
      // Against the open, not the step count: a marble can be several steps right
      // of centre and still down, having gone left on the wild row.
      label.current.dataset.trend = trendOf(price - openPrice)
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
            /*
             * Sized against the closing frame on a desk, and not at all on a
             * phone.
             *
             * `distanceFactor` makes a tag 1:1 at one framing and wrong either
             * side of it, by whatever the camera has moved since. That is nothing
             * on a desk, where the drop's whole zoom range is at most 1.4× — but
             * an upright phone has to widen nearly fivefold to fit a deep board
             * across, and the tags opened five times too big. Without it drei
             * leaves the element alone, so a tag is its own pixel size at every
             * point of the drop, and the camera owes it nothing.
             */
            distanceFactor={compact ? undefined : labelScale}
            /*
             * Below every panel's stacking order; see .panel in styles.css.
             *
             * A single value where the tags are ordered by price, so that is what
             * decides which is in front rather than which marble happens to be
             * nearer the lens. See `tagStack`.
             */
            zIndexRange={tagRange}
            style={{ pointerEvents: 'none' }}
          >
            <span ref={label} className="marble-label" style={{ '--chip': color } as CSSProperties}>
              {showPrice && openPrice !== null ? `${tag} ${formatPrice(openPrice)}` : tag}
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
