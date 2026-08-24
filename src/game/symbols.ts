/**
 * Ticker symbols: a player's four-letter identity on the tape.
 *
 * In the game layer rather than among the panels' wording, because a symbol is
 * not a phrasing decision — it is a fact about a player that four different
 * surfaces now have to agree on: the tape, the results table, the setup list, and
 * the name tags on the board. The last of those is inside the 3D scene, which
 * cannot reach into the panels' own modules and should not have to.
 */
import type { Player } from './types'

/**
 * Ticker symbols for a field of players, guaranteed distinct.
 *
 * Taking the first four letters is not enough: "Scott C" and "Scott E" both give
 * "SCOT", and two identical symbols on the tape means neither identifies anyone.
 * Each name proposes candidates in order of how well they read, and the first
 * one nobody has taken wins — the same trick real tickers use for BRK.A/BRK.B.
 */
export function tickerSymbols(players: readonly Player[]): Map<string, string> {
  const taken = new Set<string>()
  const symbols = new Map<string, string>()

  for (const player of players) {
    const pick =
      symbolCandidates(player.name, player.slot).find((candidate) => !taken.has(candidate)) ??
      firstFreeFallback(taken, player.slot)
    taken.add(pick)
    symbols.set(player.id, pick)
  }

  return symbols
}

/** Best-reading forms first, each at most four characters. */
function symbolCandidates(name: string, slot: number): string[] {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, '').toUpperCase())
    .filter(Boolean)

  if (words.length === 0) return []

  const squashed = words.join('')
  const candidates: string[] = []

  // "Scott C" → SCOC, "Scott E" → SCOE: a shared stem plus the distinguishing
  // initial, which is how a real tape separates share classes.
  if (words.length > 1) {
    const stem = words[0].slice(0, 3)
    for (const word of words.slice(1)) candidates.push(`${stem}${word[0]}`)
    candidates.push(
      words
        .map((word) => word[0])
        .join('')
        .slice(0, 4),
    )
  }

  candidates.push(squashed.slice(0, 4))

  // Walk deeper into the name for a distinguishing final character.
  const stem = squashed.slice(0, 3)
  for (const character of squashed.slice(3)) candidates.push(`${stem}${character}`)

  candidates.push(`${stem}${slot + 1}`)
  candidates.push(`${squashed.slice(0, 2)}${slot + 1}`)

  return candidates.filter((candidate) => candidate.length >= 2)
}

/** Last resort, and always available: no two players share a slot. */
function firstFreeFallback(taken: ReadonlySet<string>, slot: number): string {
  let attempt = slot + 1
  while (taken.has(`P${attempt}`)) attempt += 1
  return `P${attempt}`
}
