import {
  BOARD_DEPTH,
  FLOOR_THICKNESS,
  WALL_THICKNESS,
  type BoardGeometry,
  type WallSegment,
} from '../../game/geometry'
import { BACK_PANEL_COLOR, FLOOR_COLOR, FRAME_COLOR } from './materials'

/** The cabinet: funnel, side walls, floor and bin dividers. */
export function Cabinet({ geo }: { geo: BoardGeometry }) {
  return (
    <group>
      {/* Both side walls, mirrored: the funnel cheek and the vertical run. */}
      {geo.wall.map((segment, i) =>
        [1, -1].map((side) => (
          <WallBar key={`${i}:${side}`} segment={segment} side={side as Side} />
        )),
      )}

      <Floor geo={geo} />

      {geo.dividerX.map((x) => (
        <BinDivider key={x} x={x} geo={geo} />
      ))}
    </group>
  )
}

type Side = 1 | -1

/**
 * One wall segment as a rotated bar, offset outward by half its thickness so
 * the segment line is the wall's *inner* face — the playfield keeps exactly the
 * clearance the geometry promises. `side` mirrors it to the left wall.
 */
function WallBar({ segment, side }: { segment: WallSegment; side: Side }) {
  const [[x1, y1], [x2, y2]] = [segment.from, segment.to]
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  // (-dy, dx) is the outward normal for every right-hand segment.
  const outwardX = -dy / length
  const outwardY = dx / length

  return (
    <mesh
      position={[
        ((x1 + x2) / 2 + (outwardX * WALL_THICKNESS) / 2) * side,
        (y1 + y2) / 2 + (outwardY * WALL_THICKNESS) / 2,
        0,
      ]}
      rotation={[0, 0, Math.atan2(dy, dx) * side]}
      castShadow
      receiveShadow
    >
      {/* Overlong, so neighbouring segments meet without a seam to catch on. */}
      <boxGeometry args={[length + WALL_THICKNESS, WALL_THICKNESS, BOARD_DEPTH]} />
      <meshStandardMaterial color={FRAME_COLOR} metalness={0.5} roughness={0.45} />
    </mesh>
  )
}

function Floor({ geo }: { geo: BoardGeometry }) {
  return (
    <mesh position={[0, geo.floorY - FLOOR_THICKNESS / 2, 0]} receiveShadow>
      <boxGeometry args={[geo.width + WALL_THICKNESS * 2, FLOOR_THICKNESS, BOARD_DEPTH * 1.3]} />
      <meshStandardMaterial color={FLOOR_COLOR} metalness={0.35} roughness={0.6} />
    </mesh>
  )
}

function BinDivider({ x, geo }: { x: number; geo: BoardGeometry }) {
  return (
    <mesh position={[x, geo.floorY + geo.binWallHeight / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[WALL_THICKNESS * 0.5, geo.binWallHeight, BOARD_DEPTH]} />
      <meshStandardMaterial color={FRAME_COLOR} metalness={0.5} roughness={0.4} />
    </mesh>
  )
}

/** Shadow-catching panel behind the playfield. */
export function BackPanel({ geo }: { geo: BoardGeometry }) {
  return (
    <mesh position={[0, geo.centerY, -BOARD_DEPTH / 2 - 0.05]} receiveShadow>
      <planeGeometry args={[geo.width + WALL_THICKNESS * 2, geo.height]} />
      <meshStandardMaterial color={BACK_PANEL_COLOR} metalness={0.1} roughness={0.85} />
    </mesh>
  )
}

/**
 * Bounce light in the bins, so landed marbles aren't silhouettes. A point light
 * rather than a rect-area one — area lights need three's extra uniforms lib and
 * can't cast shadows.
 */
export function BinBounceLight({ geo }: { geo: BoardGeometry }) {
  return (
    <pointLight
      position={[0, geo.floorY + geo.binWallHeight * 0.6, BOARD_DEPTH * 2.2]}
      intensity={geo.width * 1.6}
      distance={geo.width * 1.6}
      decay={1.7}
      color="#7d9bff"
    />
  )
}
