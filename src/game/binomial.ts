/**
 * Binomial maths for the board.
 *
 * A marble that clears `rows` peg rows makes `rows` independent left/right
 * choices, so the bin it lands in is Binomial(rows, 1/2). Bin counts are exact
 * integers from Pascal's triangle — no factorials, no float drift.
 */

/** Row `n` of Pascal's triangle: the C(n, k) weights for k = 0…n. */
function pascalRow(n: number): number[] {
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

/** Distance from the expected (center) bin, in bins. */
export function deviation(bin: number, rows: number): number {
  return Math.abs(bin - rows / 2)
}

/** "1 in N" odds for a probability. */
function oneInN(probability: number): number {
  return probability > 0 ? 1 / probability : Infinity
}

/**
 * Above this, whole numbers. Below it, a decimal place — because that is where
 * the bins are packed too closely for whole numbers to tell them apart. Both
 * forms of the odds share the rule.
 *
 * A long series is the case that broke it. Odds are ranked on, so two rows that
 * print the same figure but sit in different places read as a bug, and on a
 * 96-row series they did: one slot off center is 1 in 12.57, two slots off is
 * 1 in 13.37, and both round to "1 in 13" while the table correctly places one
 * above the other. Out in the tail the gaps are tens wide and a decimal there
 * would be noise, which is what the threshold is for.
 */
const ODDS_DECIMAL_BELOW = 100

export function formatOdds(probability: number): string {
  return formatOneIn(oneInN(probability), (n) => Math.round(n).toLocaleString())
}

/**
 * "1 in N" in as little room as the ladder under the bins can spare.
 *
 * Every slot on the board keeps a label and a board can have twenty-five of
 * them, so "1 in 16,777,216" is out of the question — at that width the labels
 * would be sitting on top of one another. Abbreviated, the same figure is
 * "1 in 17M", which is what a person reads off it anyway.
 *
 * Only the thousands are abbreviated. Below that the two forms are the same
 * string, because the ladder and the results table are read together and a slot
 * that says "1 in 13" under a player the table calls 1 in 12.8 is one figure
 * disagreeing with itself.
 */
export function formatOddsCompact(probability: number): string {
  return formatOneIn(oneInN(probability), abbreviated)
}

/**
 * "1 in N", with the caller saying how a large N is written.
 *
 * The small end is not the caller's to choose: near the peak the bins are packed
 * closer than a whole number can separate, and that is true of any surface
 * showing them.
 */
function formatOneIn(n: number, large: (n: number) => string): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= ODDS_DECIMAL_BELOW) return `1 in ${large(n)}`
  // A trailing zero carries nothing and costs the hero figure its edge: "1 in
  // 66.0" as the headline of a results card is worse than "1 in 66".
  return `1 in ${trimmed(n.toFixed(1))}`
}

const THOUSAND = 1000
/** One per thousand, so the last of them is the largest figure this can write. */
const THOUSAND_SUFFIXES = ['k', 'M', 'B', 'T'] as const

/** Three significant figures at most, and a suffix for each thousand. */
function abbreviated(n: number): string {
  let scaled = n
  let suffix = ''
  for (const next of THOUSAND_SUFFIXES) {
    if (scaled < THOUSAND) break
    scaled /= THOUSAND
    suffix = next
  }
  return `${trimmed(scaled < 10 ? scaled.toFixed(1) : String(Math.round(scaled)))}${suffix}`
}

const trimmed = (value: string) => value.replace(/\.0$/, '')

export function formatPercent(probability: number): string {
  const pct = probability * 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}
