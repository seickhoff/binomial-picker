/**
 * The field: which marbles exist, when each is let go, and which board they are
 * flying over.
 *
 * One marble's own flight is `Marble`, next door. The two were one file and split
 * at 500 lines, along the line they were always going to: this one answers to the
 * round — its draw, its release order, its stagger — and changes when the rules of
 * a session do. That one answers to a single ball falling, and changes when the
 * look of the board does.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { planDrops, type DropPath } from '../game/drop'
import type { BoardGeometry } from '../game/geometry'
import { marketFor, openPriceOf } from '../game/scoring'
import { useGame } from '../game/store'
import type { Market } from '../game/modes'
import { tickerSymbols } from '../game/symbols'
import type { DropMode, Player } from '../game/types'
import { clearMarbleFocus } from '../live/cameraFocus'
import { clearQuotes, quoteOf, subscribeQuotes } from '../live/priceFeed'
import { isCompact } from '../viewport'
import { Marble } from './Marble'
import { overlayScale } from './framing'
import { tagStack } from './tagStack'

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
const SEQUENTIAL_GAP_MS = 1000
/** Marbles are spread slightly in depth so they don't sit inside one another. */
const DEPTH_SPREAD = 0.5

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

/** Where a finished round's landings go. Module-level, so the prop is stable. */
const ignoreLanding = () => {}

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
   * On a phone a tag carries the ticker symbol alone, not the name and the running
   * price.
   *
   * "Jonathan $102.39" is around 150px of tag. Eleven of those, on marbles that
   * start life within a marble's width of each other, is a wall of overlapping
   * names with the board somewhere behind it. "JONA" is a third of the width, and
   * the price it drops is on the tape overhead and in the table afterwards.
   *
   * Taken from the canvas's own size rather than a media query, because that is
   * what the scene already re-renders on.
   */
  const compact = isCompact(size.width, size.height)
  const symbols = useMemo(() => tickerSymbols(players), [players])

  /*
   * Each player's market, held against the round's draw rather than the round.
   *
   * `marketFor` builds an object, and the marble that reads it prices its whole
   * walk against that object — memoised on it. Built fresh per render, that meant
   * re-pricing every marble's every row on every landing. What a market is made of
   * is the draw, and the draw does not change once the round is under way.
   */
  const markets = useMemo(
    () => new Map(round.entrantIds.map((id): [string, Market] => [id, marketFor(round, id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draw, not the round
    [round.entrantIds, round.rowMoves, round.jitter],
  )

  /*
   * Which tag is in front of which, by the price each marble is currently showing.
   *
   * One array per marble, handed to its tag once and then written through rather
   * than replaced. Going via React state instead left the order visibly behind the
   * prices: eleven marbles cross a peg row every few frames, so there is a quote
   * to answer almost every frame, and a re-render queued from outside an event is
   * scheduled work — with the scene already busy it landed frames late, and a tag
   * reading $98.29 sat over one reading $99.49. Written straight through, the
   * order is what the prices say on the frame they say it.
   */
  const ordered = mode === 'stock'
  const tagRanges = useMemo(
    // Camera-distance order until the prices have their say, which is also what
    // Black Swan keeps: its marbles have no running figure to be ahead on.
    () => new Map(round.entrantIds.map((id) => [id, [9, 0] as [number, number]])),
    [round.entrantIds],
  )

  useEffect(() => {
    if (!ordered) return

    const restack = () => {
      // Falling back to the opening price, not to nothing: a marble that has yet
      // to cross its first row has published no quote, and ranking it below
      // everybody put a tag showing $100.00 underneath one showing $97.36.
      const stack = tagStack(round.entrantIds, (id) => quoteOf(id)?.price ?? openPriceOf(id, round))
      for (const [id, z] of stack) {
        const range = tagRanges.get(id)
        if (range) {
          range[0] = z
          range[1] = z
        }
      }
    }

    restack()
    return subscribeQuotes(restack)
  }, [ordered, round.entrantIds, tagRanges])

  /*
   * Planned when the drop starts, not when the session opens.
   *
   * Held in a ref keyed by runToken, so a repeat render reuses the same plan —
   * re-planning mid-round would change outcomes already recorded. And built no
   * earlier than the release, so the last round's marbles stay in their slots
   * while the next session's placard is up: they give way to the new field when
   * it is actually dropped, not a placard beforehand.
   */
  const plan = useRef<{ token: number; geo: BoardGeometry; round: RoundPlan } | null>(null)
  if (phase === 'running' && plan.current?.token !== runToken) {
    plan.current = { token: runToken, geo, round: planRound(entrants, geo, round.plan) }
  }

  /*
   * Whatever was on the board, going back to setup takes it off for good.
   *
   * Without this the field came back: setup draws nothing, but it does not throw
   * the plan away, so the next session's placard — which deliberately shows the
   * last field still in its slots — found a plan waiting and drew a round that had
   * been abandoned. Then the real drop began and swept it away, which reads as the
   * game starting twice.
   */
  if (phase === 'setup') plan.current = null

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

  /*
   * Nothing to draw before the first drop — and nothing to draw for a field that
   * was planned against a different board.
   *
   * The second half is the peg-count case. A finished field stays in its slots
   * while the next session opens, which is right when the board underneath it is
   * the same board. Change the row count in between and it is not: the marbles
   * were given resting places on a ten-row board, and hold them in mid-air over a
   * twenty-four-row one until the real drop clears them away.
   */
  if (!plan.current || plan.current.geo !== geo) return null

  const { token: planToken, round: planned } = plan.current
  const { paths, order } = planned
  const timedReleases = released.token === planToken ? released.count : 0

  /*
   * Whether what is on the board is the field now being scored.
   *
   * It is not, in one window: a session that opens while the last one's marbles
   * are still sitting in their slots. They are on show, but their round is over,
   * and nothing they do counts towards the round that has just been drawn.
   */
  const scoring = planToken === runToken
  const spread = entrants.length > 1 ? DEPTH_SPREAD : 0

  return (
    <group>
      {order.slice(0, timedReleases).map((player, i) => {
        const path = paths.get(player.id)
        const market = markets.get(player.id)
        if (!path || !market) return null
        return (
          <Marble
            /*
             * Keyed by the plan it is flying, not by the store's current run.
             *
             * These are the same number except in the window above — and there,
             * keying by the run remounted every marble the moment the next session
             * opened. A remounted marble starts its flight again from the funnel,
             * so the previous field re-flew its paths under the placard, landed,
             * and reported those landings into the round that had just been drawn.
             * The new round therefore opened already scored, with the last round's
             * result, and a tie re-dropped to the same standings for ever.
             */
            key={`${planToken}:${player.id}`}
            player={player}
            geo={geo}
            path={path}
            z={(i / Math.max(1, entrants.length - 1) - 0.5) * spread}
            fancy={fancy}
            showLabel={showLabels}
            labelScale={labelScale}
            // A symbol on a phone, a name on a desk; see `compact` above.
            label={(compact && ordered ? symbols.get(player.id) : player.name) ?? player.name}
            // The price belongs to a tag with room for it. On a phone the symbol
            // stands alone and the price is read off the tape.
            showPrice={!compact}
            compact={compact}
            tagRange={tagRanges.get(player.id)}
            // Stock Market: the tag ticks the running price as it falls.
            openPrice={mode === 'stock' ? openPriceOf(player.id, round) : null}
            market={market}
            // Belt as well as braces: a marble whose round is over cannot score,
            // whatever else changes about how these are mounted.
            onLand={scoring ? recordLanding : ignoreLanding}
          />
        )
      })}
    </group>
  )
}
