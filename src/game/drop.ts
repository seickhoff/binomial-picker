/**
 * A marble's trip down the board.
 *
 * The outcome is decided by mathematics, not by a solver: each of the `rows`
 * peg rows is one fair coin flip, so the landing bin is exactly
 * Binomial(rows, 1/2) and every decision is exactly 50/50. A rigid-body
 * simulation cannot promise either — bounce, friction and marble-on-marble
 * jostling bias it, and marbles can wedge and never arrive.
 *
 * The motion is still real physics: between two pegs the marble follows plain
 * projectile motion under `DROP_GRAVITY`, so it accelerates, arcs and bounces
 * the way it should. Only *which* way it leaves each peg is drawn up front.
 */
import { binOf } from './rounds'
import {
  MARBLE_RADIUS,
  PEG_RADIUS,
  ROW_GAP,
  SPACING,
  releasePoints,
  type BoardGeometry,
} from './geometry'

/** Downward acceleration, in world units per second². */
const DROP_GRAVITY = 18
/** Upward kick off each peg. */
const PEG_BOUNCE = 0.9
/** Rebound off the bin floor. */
const FLOOR_BOUNCE = 1.45

export interface DropSegment {
  readonly t0: number
  readonly duration: number
  readonly x0: number
  readonly x1: number
  readonly y0: number
  /** Upward velocity at t0; the arc is projectile motion from there. */
  readonly vy0: number
  /** Peg to light up when this segment ends, or null for the floor. */
  readonly pegIndex: number | null
  /** How many coin flips have been resolved once this segment ends. */
  readonly decisions: number
}

export interface DropPath {
  /** One ±1 per row: the actual coin flips. */
  readonly flips: readonly number[]
  /**
   * Running sum of the flips, indexed by decisions resolved — so `netAfter[k]`
   * is the net step count after `k` rows, and in Stock Market mode the dollar
   * move so far. Length `rows + 1`.
   */
  readonly netAfter: readonly number[]
  readonly bin: number
  readonly segments: readonly DropSegment[]
  /** When the marble first touches down, and is scored. */
  readonly landingTime: number
  readonly duration: number
  readonly restX: number
  readonly restY: number
}

/** Time to fall `drop` units when thrown upward at `vy0`. */
function fallTime(drop: number, vy0: number): number {
  /*
   * The discriminant cannot go negative while the geometry holds, and this clamp
   * is here because when it did, the consequence was silent and total: a negative
   * fall gave a NaN duration, which made every sampled position NaN, which made
   * the marble simply not appear. A marble landing at the wrong moment is a bug
   * you can see and fix; one that vanishes looks like it was never dealt in.
   */
  const reach = Math.max(0, vy0 * vy0 + 2 * DROP_GRAVITY * drop)
  return (vy0 + Math.sqrt(reach)) / DROP_GRAVITY
}

/**
 * How many marbles a bin can stack before the pile reaches the last peg row.
 *
 * A bin is not bottomless. Twenty marbles is eight units of marble, and a bin is
 * about three deep — so on a shallow board with a full roster, a popular bin
 * genuinely runs out of room. Which bin is popular is not a rare case either:
 * four rows put a quarter of the field in the center slot.
 */
export function binCapacity(geo: BoardGeometry): number {
  const ceiling = contactY(geo.rows - 1, geo) - MARBLE_RADIUS
  const floor = geo.floorY + MARBLE_RADIUS
  return Math.max(1, Math.floor((ceiling - floor) / (MARBLE_RADIUS * 2)) + 1)
}

/** Where a marble sits when resting on a peg in `row`. */
function contactY(row: number, geo: BoardGeometry): number {
  return geo.apexY - row * ROW_GAP + PEG_RADIUS + MARBLE_RADIUS
}

/** Index into `geo.pegs` of the peg at `x` in `row`. */
function pegIndexAt(row: number, x: number): number {
  const withinRow = Math.round(x / SPACING + row / 2)
  return (row * (row + 1)) / 2 + withinRow
}

export interface BuildDropOptions {
  /** Where the marble is released across the funnel mouth. */
  readonly releaseX: number
  /**
   * The decisions this marble takes, one ±1 per row. Drawn in `rounds.ts`, since
   * the row count can depend on the draw; this turns them into a flight path.
   */
  readonly flips: readonly number[]
  /**
   * Claims a resting slot in the bin the flips chose, and returns how many
   * marbles are already stacked there.
   */
  readonly reserveSlot?: (bin: number) => number
}

export function buildDropPath(geo: BoardGeometry, options: BuildDropOptions): DropPath {
  const { releaseX, reserveSlot } = options
  // The flips and the board must describe the same number of rows. They do by
  // construction — both come from the round — but trimming here means a
  // mismatch degrades to a shorter drop rather than indexing off the end of the
  // bins and putting a marble at NaN.
  const flips = options.flips.slice(0, geo.rows)
  const bin = binOf(flips)

  // Running total, so a marble can show its dollar move mid-flight.
  const netAfter = [0]
  for (const flip of flips) netAfter.push(netAfter[netAfter.length - 1] + flip)

  /*
   * Held to what the bin can hold: past that the pile shares its top slot and the
   * marbles visibly heap, which is what an overfull bin does. The alternative was
   * a marble resting above the pegs it fell through, and the arithmetic for that
   * is a fall of negative height.
   */
  const claimed = reserveSlot ? reserveSlot(bin) : 0
  const stackIndex = Math.min(claimed, binCapacity(geo) - 1)
  const restX = geo.binCenters[bin]
  const restY = geo.floorY + MARBLE_RADIUS + stackIndex * MARBLE_RADIUS * 2

  const segments: DropSegment[] = []
  let t = 0

  function push(seg: Omit<DropSegment, 't0' | 'duration'>, drop: number) {
    const duration = fallTime(drop, seg.vy0)
    segments.push({ ...seg, t0: t, duration })
    t += duration
  }

  // Down the funnel to the apex peg, drifting to center as the walls gather it.
  push(
    {
      x0: releaseX,
      x1: 0,
      y0: geo.dropY,
      vy0: 0,
      pegIndex: pegIndexAt(0, 0),
      decisions: 0,
    },
    geo.dropY - contactY(0, geo),
  )

  // Peg to peg. `x` is where the marble sits on the row it has reached.
  let x = 0
  for (let row = 0; row < geo.rows - 1; row++) {
    const next = x + (flips[row] * SPACING) / 2
    push(
      {
        x0: x,
        x1: next,
        y0: contactY(row, geo),
        vy0: PEG_BOUNCE,
        pegIndex: pegIndexAt(row + 1, next),
        decisions: row + 1,
      },
      ROW_GAP,
    )
    x = next
  }

  // Off the last row and down into the bin.
  const lastRow = geo.rows - 1
  push(
    {
      x0: x,
      x1: restX,
      y0: contactY(lastRow, geo),
      vy0: PEG_BOUNCE,
      pegIndex: null,
      decisions: geo.rows,
    },
    contactY(lastRow, geo) - restY,
  )
  const landingTime = t

  // One settling bounce in place.
  push(
    {
      x0: restX,
      x1: restX,
      y0: restY,
      vy0: FLOOR_BOUNCE,
      pegIndex: null,
      decisions: geo.rows,
    },
    0,
  )

  return { flips, netAfter, bin, segments, landingTime, duration: t, restX, restY }
}

/**
 * Every path for one round, planned together.
 *
 * Resting slots have to be handed out with knowledge of the whole field, or two
 * marbles claim the same slot — or, worse, the count drifts and marbles come to
 * rest stacked in mid-air. Planning the round in a single pure pass makes the
 * slots correct by construction, and keeps the whole thing testable.
 */
export function planDrops(
  geo: BoardGeometry,
  flipsPerMarble: readonly (readonly number[])[],
  random: () => number = Math.random,
): DropPath[] {
  // Shuffled, so no player owns the middle of the funnel two rounds running.
  const offsets = shuffle(releasePoints(flipsPerMarble.length, geo), random)
  const claimed = new Map<number, number>()

  return flipsPerMarble.map((flips, i) =>
    buildDropPath(geo, {
      releaseX: offsets[i] ?? 0,
      flips,
      reserveSlot: (bin) => {
        const taken = claimed.get(bin) ?? 0
        claimed.set(bin, taken + 1)
        return taken
      },
    }),
  )
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface DropSample {
  readonly x: number
  readonly y: number
}

/** Position along the path at time `t`, held at rest once it's over. */
export function samplePath(path: DropPath, t: number): DropSample {
  if (t >= path.duration) return { x: path.restX, y: path.restY }

  for (const seg of path.segments) {
    const local = t - seg.t0
    if (local < 0) break
    if (local > seg.duration) continue
    const progress = seg.duration > 0 ? local / seg.duration : 1
    return {
      // Horizontal velocity is constant in flight, so this is linear.
      x: seg.x0 + (seg.x1 - seg.x0) * progress,
      y: seg.y0 + seg.vy0 * local - 0.5 * DROP_GRAVITY * local * local,
    }
  }

  const first = path.segments[0]
  return { x: first.x0, y: first.y0 }
}
