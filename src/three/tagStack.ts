/**
 * Which name tag sits in front of which, while the marbles are falling.
 *
 * The tags are HTML over the scene, so when marbles bunch up their tags overlap,
 * and something has to decide the order. Left to itself that order is the camera's
 * — whichever marble happens to be nearer the lens — which changes for reasons a
 * player cannot see and puts a straggler's tag over the leader's.
 *
 * Ordering by price instead makes the pile-up readable: the tag on top is the one
 * winning. It is a Stock Market idea only; Black Swan's marbles have no running
 * figure to be ahead on.
 */

/**
 * The band the tags may use.
 *
 * Bounded above by the panels, which start at 20 — a tag over the results card
 * would be a tag over the thing it is being read against. Twenty players and
 * nineteen levels means the last two share the bottom one, which matters only if
 * the two worst-placed tags overlap each other.
 */
const TOP = 19
const BOTTOM = 1

/**
 * A z-index per id, highest price in front.
 *
 * The price lookup is a parameter rather than a channel read so this stays
 * arithmetic: the caller knows where prices come from.
 */
export function tagStack(
  ids: readonly string[],
  priceOf: (id: string) => number | undefined,
): Map<string, number> {
  const ranked = [...ids].sort((a, b) => (priceOf(b) ?? 0) - (priceOf(a) ?? 0))
  return new Map(ranked.map((id, rank) => [id, Math.max(BOTTOM, TOP - rank)]))
}
