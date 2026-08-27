/**
 * The lineup: the order a field is filed in, and the order it is let go in.
 *
 * Release order is not a fairness question — the flips are drawn per player
 * before anything moves, so nobody gains from going first or last. It is a
 * legibility question: with a dozen marbles at the funnel, the order they leave
 * in is the only cue a watcher gets about who is who before the tags separate.
 * It used to be shuffled, which told nobody anything.
 *
 * Black Swan releases by name, the same order the roster is filed in, so the
 * field goes straight down the list on screen. Stock Market opens the day the
 * way a board does — by price, highest first, with the ticker settling stocks
 * level on price. Day one has the whole field on $100, so that falls through to
 * plain alphabetical order by ticker.
 */
import { openPriceOf } from './scoring'
import type { Mode, Player, Round } from './types'

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

export interface ReleaseOrderRequest {
  readonly entrants: readonly Player[]
  /** The round about to be dropped; its opening prices are what ranks it. */
  readonly round: Round
  readonly mode: Mode
  /** Ticker per player id. Stock Market files by symbol, not by name. */
  readonly symbols: ReadonlyMap<string, string>
}

/**
 * The field in release order.
 *
 * Stock Market ranks on the price each stock *opens* at rather than the one it
 * closed at, which is the same figure — a further trading day carries every
 * close forward as the next day's open — and is the one the round about to be
 * dropped actually holds. Reaching back into the previous round would give the
 * same answer only for as long as nothing else can start a session.
 *
 * Prices compare exactly: they are summed in whole cents and converted once, so
 * two stocks that really are level are level to the bit, and the ticker decides
 * between them.
 */
export function releaseOrder({ entrants, round, mode, symbols }: ReleaseOrderRequest): Player[] {
  if (mode !== 'stock') return [...entrants].sort(byName)

  return [...entrants].sort(
    (a, b) =>
      openPriceOf(b.id, round) - openPriceOf(a.id, round) ||
      collator.compare(tickerOf(a, symbols), tickerOf(b, symbols)) ||
      a.slot - b.slot,
  )
}

/**
 * Symbols are handed out distinct, so the comparison above lands on the slot
 * only if a player is missing one — and a slot is unique by construction, so the
 * order is total either way.
 */
function tickerOf(player: Player, symbols: ReadonlyMap<string, string>): string {
  return symbols.get(player.id) ?? player.name.toUpperCase()
}
