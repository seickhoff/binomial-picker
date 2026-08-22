/**
 * Binomial maths for the board.
 *
 * A marble that clears `rows` peg rows makes `rows` independent left/right
 * choices, so the bin it lands in is Binomial(rows, 1/2). Bin counts are exact
 * integers from Pascal's triangle — no factorials, no float drift.
 */

/** Row `n` of Pascal's triangle: the C(n, k) weights for k = 0…n. */
export function pascalRow(n: number): number[] {
  let row = [1]
  for (let i = 0; i < n; i++) {
    const next: number[] = [1]
    for (let j = 0; j < row.length - 1; j++) next.push(row[j] + row[j + 1])
    next.push(1)
    row = next
  }
  return row
}

/** Probability of each bin, index 0…rows. Sums to 1. */
export function binomialPmf(rows: number): number[] {
  const weights = pascalRow(rows)
  const total = weights.reduce((sum, w) => sum + w, 0)
  return weights.map((w) => w / total)
}

/** How many bins a board with `rows` peg rows has. */
export function binCount(rows: number): number {
  return rows + 1
}

/** Distance from the expected (centre) bin, in bins. */
export function deviation(bin: number, rows: number): number {
  return Math.abs(bin - rows / 2)
}

/** "1 in N" odds for a probability. */
export function oneInN(probability: number): number {
  return probability > 0 ? 1 / probability : Infinity
}

/**
 * Rarity in bits: -log2(p). Higher is rarer. Used for display only — ranking
 * compares probabilities directly.
 */
export function rarityBits(probability: number): number {
  return probability > 0 ? -Math.log2(probability) : Infinity
}

export function formatOdds(probability: number): string {
  const n = oneInN(probability)
  if (!Number.isFinite(n)) return '—'
  return n < 10 ? `1 in ${n.toFixed(1)}` : `1 in ${Math.round(n).toLocaleString()}`
}

export function formatPercent(probability: number): string {
  const pct = probability * 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}
