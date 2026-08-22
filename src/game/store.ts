import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { MAX_ROWS, MIN_ROWS } from './geometry'
import { START_PRICE } from './modes'
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
export function activePlayers(players: readonly Player[]): Player[] {
  return players.filter((p) => p.active)
}

function lowestFreeSlot(players: readonly Player[]): number {
  const taken = new Set(players.map((p) => p.slot))
  for (let slot = 0; slot < MAX_PLAYERS; slot++) if (!taken.has(slot)) return slot
  return players.length
}

function emptyRound(
  index: number,
  rows: number,
  entrantIds: string[],
  tieBreak: boolean,
  openPrices: Record<string, number>,
  plan: Record<string, readonly number[]> = {},
): Round {
  return { index, rows, entrantIds, landings: [], tieBreak, openPrices, plan }
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
  /** Trading floor ambience while a Stock Market drop is live. */
  floorSound: boolean
  round: Round
  history: Round[]
  /** Bumped for every release so the physics marbles remount cleanly. */
  runToken: number

  setRows: (rows: number) => void
  setMode: (mode: Mode) => void
  setSettleRule: (rule: SettleRule) => void
  setChartView: (view: ChartView) => void
  setChartOpen: (open: boolean) => void
  setDropMode: (mode: DropMode) => void
  setShowLabels: (show: boolean) => void
  setFancyGraphics: (fancy: boolean) => void
  setFloorSound: (on: boolean) => void
  addPlayer: () => void
  removePlayer: (id: string) => void
  renamePlayer: (id: string, name: string) => void
  /** Sit a player out, or bring them back in. */
  setPlayerActive: (id: string, active: boolean) => void
  /** True when enough players are in to hold a round. */
  canStart: () => boolean
  start: () => void
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
      chartView: 'distribution',
      chartOpen: false,
      rows: DEFAULT_ROWS,
      dropMode: 'together',
      players: initialPlayers,
      showLabels: true,
      fancyGraphics: true,
      floorSound: true,
      round: emptyRound(
        0,
        DEFAULT_ROWS,
        initialPlayers.map((p) => p.id),
        false,
        openingPrices(initialPlayers.map((p) => p.id)),
      ),
      history: [],
      runToken: 0,

      setRows: (rows) =>
        set({ rows: Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(rows))) }),
      setMode: (mode) => set({ mode }),
      setSettleRule: (settleRule) => set({ settleRule }),
      setChartView: (chartView) => set({ chartView }),
      setChartOpen: (chartOpen) => set({ chartOpen }),
      setDropMode: (dropMode) => set({ dropMode }),
      setShowLabels: (showLabels) => set({ showLabels }),
      setFancyGraphics: (fancyGraphics) => set({ fancyGraphics }),
      setFloorSound: (floorSound) => set({ floorSound }),

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

      canStart: () => activePlayers(get().players).length >= MIN_PLAYERS,

      start: () => {
        const { players, rows, runToken } = get()
        const entrants = activePlayers(players)
        if (entrants.length < MIN_PLAYERS) return

        const entrantIds = entrants.map((p) => p.id)
        const openPrices = openingPrices(entrantIds)
        const plan = drawRound({ entrantIds, rows })

        set({
          phase: 'running',
          history: [],
          round: emptyRound(0, rows, entrantIds, false, openPrices, plan),
          runToken: runToken + 1,
        })
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
        const openPrices = Object.fromEntries(
          field.map((id) => [id, priceAfter(id, round)]),
        )
        const plan = drawRound({ entrantIds: field, rows })

        set({
          phase: 'running',
          history: [...history, round],
          round: emptyRound(round.index + 1, rows, field, true, openPrices, plan),
          runToken: runToken + 1,
        })
      },

      recordLanding: (playerId, bin, flips = []) => {
        const { round } = get()
        if (!round.entrantIds.includes(playerId)) return
        if (round.landings.some((l) => l.playerId === playerId)) return

        const landing = landingFor(playerId, bin, round, round.landings.length, flips)
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
        chartView: state.chartView,
        chartOpen: state.chartOpen,
        rows: state.rows,
        dropMode: state.dropMode,
        players: state.players,
        showLabels: state.showLabels,
        fancyGraphics: state.fancyGraphics,
        floorSound: state.floorSound,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Restored players carry ids from a previous session; keep the id
        // generator ahead of them so new players can't collide.
        for (const p of state.players) {
          const n = Number.parseInt(p.id.slice(1), 10)
          if (Number.isFinite(n)) idCounter = Math.max(idCounter, n)
        }

        // Rosters saved before sit-out existed have no `active` field.
        state.players = state.players.map((p) => ({ ...p, active: p.active !== false }))

        // A persisted round would reference a stale field; always start fresh.
        const entrantIds = activePlayers(state.players).map((p) => p.id)
        state.round = emptyRound(0, state.rows, entrantIds, false, openingPrices(entrantIds))
        state.phase = 'setup'
        state.history = []
      },
    },
  ),
)
