import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { MAX_ROWS, MIN_ROWS } from './geometry'
import { BASE_PER_PEG, START_PRICE } from './modes'
import { MAX_PLAYERS, MIN_PLAYERS } from './palette'
import { drawRound } from './rounds'
import { isRoundComplete, landingFor, priceAfter, settlementOf } from './scoring'
import type { ChartView, DropMode, Mode, Phase, Player, Round, SettleRule } from './types'

const DEFAULT_ROWS = 10
const DEFAULT_PLAYER_COUNT = 4

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `p${idCounter}`
}

function makePlayer(slot: number): Player {
  return { id: nextId(), slot, name: `Player ${slot + 1}`, active: true }
}

/** Players taking part in the next round. */
function activePlayers(players: readonly Player[]): Player[] {
  return players.filter((p) => p.active)
}

/**
 * Roster order: by name, as a person would file them.
 *
 * Collated rather than compared as strings, for two reasons. `numeric` puts
 * "Player 9" before "Player 10", where a plain comparison reads the "1" and files
 * it second. And `sensitivity: 'base'` ignores case and accents, so "de Vries"
 * lands next to "De Vries" instead of in a separate block after every capital.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function byName(a: Player, b: Player): number {
  return collator.compare(a.name, b.name) || a.slot - b.slot
}

function sortedByName(players: readonly Player[]): Player[] {
  return [...players].sort(byName)
}

function lowestFreeSlot(players: readonly Player[]): number {
  const taken = new Set(players.map((p) => p.slot))
  for (let slot = 0; slot < MAX_PLAYERS; slot++) if (!taken.has(slot)) return slot
  return players.length
}

/**
 * A round before anyone has landed.
 *
 * Named arguments rather than positional: there were already six, three of them
 * numbers, and adding the price scale to that queue is how a row count ends up
 * being read as a dollar figure.
 */
function emptyRound({
  plan = {},
  ...round
}: Omit<Round, 'landings' | 'plan'> & {
  plan?: Record<string, readonly number[]>
}): Round {
  return { ...round, plan, landings: [] }
}

/**
 * Where a session starts.
 *
 * Stock Market sessions are dated days of trading, so each one opens on its
 * placard. Black Swan has no calendar to hang that on — its tie-break is sudden
 * death, not tomorrow — so it drops straight away, as it always has.
 */
function openingPhase(mode: Mode): Phase {
  return mode === 'stock' ? 'opening' : 'running'
}

/** Some path that reaches `bin`: the rights taken first. */
function pathTo(bin: number, rows: number): number[] {
  return Array.from({ length: rows }, (_, row) => (row < bin ? 1 : -1))
}

/** Everyone opens a fresh series at the same price. */
function openingPrices(entrantIds: readonly string[]): Record<string, number> {
  return Object.fromEntries(entrantIds.map((id) => [id, START_PRICE]))
}

export interface GameState {
  phase: Phase
  mode: Mode
  /** How far a series runs before it counts as decided. */
  settleRule: SettleRule
  /**
   * Draw each row's worth separately in Stock Market mode, instead of pricing
   * every row the same.
   *
   * Fair either way: the row values are shared by the field, so every player
   * meets the same rows. The dollars still come from the lattice — a slot is a
   * dollar regardless — so all this decides is the cents, and whether two marbles
   * in one bin close a few of them apart.
   */
  volatileRows: boolean
  /** Which chart the results panel shows. */
  chartView: ChartView
  /** Whether the chart is expanded. Closed by default: it is the tallest thing
   *  in the results card, and the verdict and table are what's read first. */
  chartOpen: boolean
  rows: number
  dropMode: DropMode
  players: Player[]
  /** Show a name badge floating on each marble. */
  showLabels: boolean
  /** Bloom, shadows and reflections. Off is a big win on weak GPUs. */
  fancyGraphics: boolean
  /** Trading floor ambience, and its opening bell, in Stock Market mode. */
  floorSound: boolean
  /** A note for every peg a marble strikes. */
  plinkSound: boolean
  /** Silences everything, without forgetting which sounds were wanted. */
  muted: boolean
  /**
   * Run a Stock Market series by itself: each session opens on its own placard
   * and, while ties are outstanding, the next one follows the summary.
   */
  autoSessions: boolean
  /**
   * When the series' first session was held, as epoch milliseconds. Later
   * sessions are dated forward from it, one trading day each.
   */
  seriesStart: number
  /**
   * Pull the camera back to take in the whole device. Held, not toggled — it is
   * a look at the board, not a mode.
   */
  overview: boolean
  round: Round
  history: Round[]
  /** Bumped for every release so the physics marbles remount cleanly. */
  runToken: number

  setRows: (rows: number) => void
  setMode: (mode: Mode) => void
  setSettleRule: (rule: SettleRule) => void
  setVolatileRows: (on: boolean) => void
  setChartView: (view: ChartView) => void
  setChartOpen: (open: boolean) => void
  setDropMode: (mode: DropMode) => void
  setShowLabels: (show: boolean) => void
  setFancyGraphics: (fancy: boolean) => void
  setFloorSound: (on: boolean) => void
  setPlinkSound: (on: boolean) => void
  setMuted: (muted: boolean) => void
  setAutoSessions: (on: boolean) => void
  setOverview: (on: boolean) => void
  addPlayer: () => void
  removePlayer: (id: string) => void
  renamePlayer: (id: string, name: string) => void
  /** Sit a player out, or bring them back in. */
  setPlayerActive: (id: string, active: boolean) => void
  /**
   * Files the roster by name.
   *
   * Called when a name is finished rather than as it is typed: re-sorting on
   * every keystroke would slide the row out from under the cursor, and a name
   * half-typed is not the name being filed.
   */
  sortRoster: () => void
  /** True when enough players are in to hold a round. */
  canStart: () => boolean
  start: () => void
  /** Lets the held marbles go, once the session's placard has been seen. */
  release: () => void
  /** Re-drop only the tied leaders. */
  startTieBreak: () => void
  /** Same field, same players, fresh drop. */
  rematch: () => void
  recordLanding: (playerId: string, bin: number, flips?: readonly number[]) => void
  backToSetup: () => void
}

const initialPlayers = Array.from({ length: DEFAULT_PLAYER_COUNT }, (_, i) => makePlayer(i))

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'setup',
      mode: 'blackSwan',
      settleRule: 'winner',
      volatileRows: true,
      chartView: 'distribution',
      chartOpen: false,
      rows: DEFAULT_ROWS,
      dropMode: 'together',
      players: initialPlayers,
      showLabels: true,
      fancyGraphics: true,
      floorSound: true,
      plinkSound: true,
      muted: false,
      autoSessions: true,
      seriesStart: 0,
      overview: false,
      round: emptyRound({
        index: 0,
        rows: DEFAULT_ROWS,
        entrantIds: initialPlayers.map((p) => p.id),
        tieBreak: false,
        openPrices: openingPrices(initialPlayers.map((p) => p.id)),
        rowMoves: Array.from({ length: DEFAULT_ROWS }, () => BASE_PER_PEG),
      }),
      history: [],
      runToken: 0,

      setRows: (rows) => set({ rows: Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(rows))) }),
      setMode: (mode) => set({ mode }),
      setSettleRule: (settleRule) => set({ settleRule }),
      setVolatileRows: (volatileRows) => set({ volatileRows }),
      setChartView: (chartView) => set({ chartView }),
      setChartOpen: (chartOpen) => set({ chartOpen }),
      setDropMode: (dropMode) => set({ dropMode }),
      setShowLabels: (showLabels) => set({ showLabels }),
      setFancyGraphics: (fancyGraphics) => set({ fancyGraphics }),
      setFloorSound: (floorSound) => set({ floorSound }),
      setPlinkSound: (plinkSound) => set({ plinkSound }),
      setMuted: (muted) => set({ muted }),
      setAutoSessions: (autoSessions) => set({ autoSessions }),
      setOverview: (overview) => set({ overview }),

      addPlayer: () =>
        set((state) =>
          state.players.length >= MAX_PLAYERS
            ? state
            : { players: [...state.players, makePlayer(lowestFreeSlot(state.players))] },
        ),

      removePlayer: (id) =>
        set((state) =>
          state.players.length <= MIN_PLAYERS
            ? state
            : { players: state.players.filter((p) => p.id !== id) },
        ),

      renamePlayer: (id, name) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      setPlayerActive: (id, active) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === id ? { ...p, active } : p)),
        })),

      sortRoster: () => set((state) => ({ players: sortedByName(state.players) })),

      canStart: () => activePlayers(get().players).length >= MIN_PLAYERS,

      start: () => {
        const { players, rows, runToken, mode, volatileRows } = get()
        const entrants = activePlayers(players)
        if (entrants.length < MIN_PLAYERS) return

        const entrantIds = entrants.map((p) => p.id)
        const openPrices = openingPrices(entrantIds)
        const draw = drawRound({ entrantIds, rows, volatileRows })

        set({
          phase: openingPhase(mode),
          history: [],
          // Day one of a new series is today; the sessions after it are dated
          // forward from here.
          seriesStart: Date.now(),
          round: emptyRound({
            index: 0,
            rows,
            entrantIds,
            tieBreak: false,
            openPrices,
            rowMoves: draw.rowMoves,
            plan: draw.plan,
          }),
          runToken: runToken + 1,
        })
      },

      release: () => {
        if (get().phase !== 'opening') return
        set({ phase: 'running' })
      },

      rematch: () => get().start(),

      startTieBreak: () => {
        const { round, history, rows, runToken, mode, settleRule } = get()
        // Nothing left to settle once the rule is satisfied.
        if (settlementOf(round, mode, settleRule).settled) return

        // The whole field goes again: separating the top from the bottom is a
        // statement about everyone, not just whoever happens to be level.
        const field = [...round.entrantIds]
        // In Stock Market everyone resumes from the price they reached; in Black
        // Swan the prices are unused and this is simply a fresh drop.
        const openPrices = Object.fromEntries(field.map((id) => [id, priceAfter(id, round)]))
        const draw = drawRound({ entrantIds: field, rows, volatileRows: get().volatileRows })

        set({
          phase: openingPhase(mode),
          history: [...history, round],
          round: emptyRound({
            index: round.index + 1,
            rows,
            entrantIds: field,
            tieBreak: true,
            openPrices,
            // Its own conditions: a new day is a new market, and prices already
            // on the tape are not disturbed by what tomorrow turns out to be.
            rowMoves: draw.rowMoves,
            plan: draw.plan,
          }),
          runToken: runToken + 1,
        })
      },

      recordLanding: (playerId, bin, flips) => {
        const { round } = get()
        if (!round.entrantIds.includes(playerId)) return
        if (round.landings.some((l) => l.playerId === playerId)) return

        /*
         * A landing needs the path it took, not just where it stopped, because
         * rows can be worth different amounts and a price is the sum of the rows
         * a marble actually crossed. The scene always has the path — it flew it —
         * so this fills in only for a caller that has a bin and nothing else.
         *
         * The stand-in takes its rights first. With every row worth the same that
         * is exact, since every path to a bin is then worth the same; with rows
         * differing it is one of the prices that bin could have closed at.
         */
        const path = flips?.length ? flips : pathTo(bin, round.rows)
        const landing = landingFor(playerId, bin, round, round.landings.length, path)
        const scored = { ...round, landings: [...round.landings, landing] }
        set({
          round: scored,
          phase: isRoundComplete(scored) ? 'results' : 'running',
        })
      },

      backToSetup: () => set({ phase: 'setup', history: [] }),
    }),
    {
      name: 'binomial-picker/v1',
      // Explicit, rather than zustand's default of `window.localStorage`: the
      // bare global works anywhere a global exists, and createJSONStorage's own
      // try/catch means a browser with storage disabled quietly runs without
      // persistence instead of throwing.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mode: state.mode,
        settleRule: state.settleRule,
        volatileRows: state.volatileRows,
        chartView: state.chartView,
        chartOpen: state.chartOpen,
        rows: state.rows,
        dropMode: state.dropMode,
        players: state.players,
        showLabels: state.showLabels,
        fancyGraphics: state.fancyGraphics,
        floorSound: state.floorSound,
        plinkSound: state.plinkSound,
        muted: state.muted,
        autoSessions: state.autoSessions,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Restored players carry ids from a previous session; keep the id
        // generator ahead of them so new players can't collide.
        for (const p of state.players) {
          const n = Number.parseInt(p.id.slice(1), 10)
          if (Number.isFinite(n)) idCounter = Math.max(idCounter, n)
        }

        // Rosters saved before sit-out existed have no `active` field. Filed on
        // the way in, so a roster saved out of order comes back tidy.
        state.players = sortedByName(
          state.players.map((p) => ({ ...p, active: p.active !== false })),
        )

        // A persisted round would reference a stale field; always start fresh.
        const entrantIds = activePlayers(state.players).map((p) => p.id)
        state.round = emptyRound({
          index: 0,
          rows: state.rows,
          entrantIds,
          tieBreak: false,
          openPrices: openingPrices(entrantIds),
          rowMoves: Array.from({ length: state.rows }, () => BASE_PER_PEG),
        })
        state.phase = 'setup'
        state.history = []
      },
    },
  ),
)
