import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { Color } from 'three'
import { binomialPmf } from '../../game/binomial'
import { BOARD_DEPTH, FLOOR_THICKNESS, type BoardGeometry } from '../../game/geometry'
import { closingPrice, formatMove, formatPrice, netMove, trendOf } from '../../game/modes'
import { colorForSlot } from '../../game/palette'
import type { Landing, Mode, Player } from '../../game/types'
import {
  EMPTY_BIN_COLOR,
  GAIN_COLOR,
  LOSS_COLOR,
  PROFILE_COLOR,
  PROFILE_WINNER_COLOR,
} from './materials'

/** Above this many slots the labels shrink so a single row still fits. */
const CROWDED_ABOVE = 11

/**
 * The ladder across the front of the floor: what each slot pays. Prices in
 * Stock Market mode, bin numbers in Black Swan.
 *
 * One row, sitting on the plinth. Every slot keeps its label, so with a lot of
 * slots the type shrinks rather than the row splitting in two.
 */
export function SlotLabels({
  geo,
  mode,
  openPrice,
  winnerBins,
}: {
  geo: BoardGeometry
  mode: Mode
  /** Null when entrants opened at different prices; slots then show the move. */
  openPrice: number | null
  winnerBins: readonly number[]
}) {
  const fontSize = geo.binCount > CROWDED_ABOVE ? 10 : 12

  return (
    <group>
      {geo.binCenters.map((x, bin) => {
        const move = netMove(bin, geo.rows)
        const label =
          openPrice === null ? formatMove(move) : formatPrice(closingPrice(bin, geo.rows, openPrice))
        return (
          <Html
            key={bin}
            center
            // Centred on the plinth's front face, just clear of it.
            position={[x, geo.floorY - FLOOR_THICKNESS / 2, BOARD_DEPTH * 0.72]}
            distanceFactor={geo.height * 0.62}
            // Below every panel's stacking order; see .panel in styles.css.
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="slot-label"
              style={{ fontSize: `${fontSize}px` }}
              data-trend={mode === 'stock' ? trendOf(move) : undefined}
              data-winner={winnerBins.includes(bin) ? '' : undefined}
            >
              {mode === 'stock' ? label : bin}
            </span>
          </Html>
        )
      })}
    </group>
  )
}

/**
 * The expected distribution, drawn as bars behind the bins: the shape a marble
 * is "supposed" to land in. Landing far from this profile is what wins.
 */
export function ExpectedProfile({
  geo,
  winnerBins,
  mode,
}: {
  geo: BoardGeometry
  winnerBins: readonly number[]
  mode: Mode
}) {
  const pmf = useMemo(() => binomialPmf(geo.rows), [geo.rows])
  const peak = Math.max(...pmf)

  return (
    <group position={[0, 0, -BOARD_DEPTH / 2 + 0.02]}>
      {geo.binCenters.map((x, bin) => {
        const height = Math.max(0.06, (pmf[bin] / peak) * geo.binWallHeight * 0.92)
        const isWinner = winnerBins.includes(bin)
        return (
          <mesh key={bin} position={[x, geo.floorY + height / 2, 0]}>
            <planeGeometry args={[geo.binWidth * 0.62, height]} />
            <meshBasicMaterial
              color={profileColor(bin, geo.rows, mode, isWinner)}
              transparent
              opacity={isWinner ? 0.9 : 0.55}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Stock Market reads left-to-right as loss-to-gain, so the profile is tinted
 * red through to green; Black Swan stays neutral blue. Dimmed unless it's the
 * winning bin.
 */
function profileColor(bin: number, rows: number, mode: Mode, isWinner: boolean): Color {
  if (mode !== 'stock') {
    return new Color(isWinner ? PROFILE_WINNER_COLOR : PROFILE_COLOR)
  }
  const towardGain = rows > 0 ? bin / rows : 0.5
  const color = new Color(LOSS_COLOR).lerp(new Color(GAIN_COLOR), towardGain)
  return isWinner ? color : color.multiplyScalar(0.42)
}

/** A bin lights up in the colour of whoever landed in it. */
export function BinLights({
  geo,
  landings,
  players,
  winnerBins,
}: {
  geo: BoardGeometry
  landings: readonly Landing[]
  players: readonly Player[]
  winnerBins: readonly number[]
}) {
  const colorByBin = useMemo(
    () => landedColorByBin(landings, players, winnerBins),
    [landings, players, winnerBins],
  )

  return (
    <group>
      {geo.binCenters.map((x, bin) => {
        const color = colorByBin.get(bin)
        return (
          <mesh
            key={bin}
            position={[x, geo.floorY + 0.012, BOARD_DEPTH * 0.1]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[geo.binWidth * 0.88, BOARD_DEPTH * 0.8]} />
            <meshBasicMaterial
              color={color ?? EMPTY_BIN_COLOR}
              transparent
              opacity={color ? 0.95 : 0.5}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function landedColorByBin(
  landings: readonly Landing[],
  players: readonly Player[],
  winnerBins: readonly number[],
): Map<number, string> {
  const slotById = new Map(players.map((p) => [p.id, p.slot]))
  const colors = new Map<number, string>()

  for (const landing of landings) {
    const slot = slotById.get(landing.playerId)
    if (slot === undefined) continue
    // A winner's colour outranks an also-ran sharing the bin.
    if (!colors.has(landing.bin) || winnerBins.includes(landing.bin)) {
      colors.set(landing.bin, colorForSlot(slot).hex)
    }
  }

  return colors
}
