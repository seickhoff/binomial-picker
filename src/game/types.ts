export type Phase = 'setup' | 'running' | 'results'

/** Which chart the results panel shows. */
export type ChartView =
  /** Where the outcome could have landed, as a distribution. */
  | 'distribution'
  /** How each player's price actually moved, row by row. */
  | 'moves'

/** How a round is scored. The board itself is identical either way. */
export type Mode =
  /** Rarest landing wins — the improbable outlier. */
  | 'blackSwan'
  /** Each player is a stock; right is +$1, left is −$1. Highest close wins. */
  | 'stock'

/** How the marbles are released. */
export type DropMode =
  /** All marbles at once, staggered by a beat. They collide — that's the show. */
  | 'together'
  /** One marble at a time from the same throat. The fairest way to pick a person. */
  | 'sequential'

/** How long a series keeps going before it is considered decided. */
export type SettleRule =
  /** Stop as soon as one player is alone at the top. */
  | 'winner'
  /** Keep going until first and last are both decided; middles may tie. */
  | 'winnerAndLoser'

export interface Player {
  readonly id: string
  /** Index into the categorical palette. Sticks to the player for life. */
  readonly slot: number
  readonly name: string
  /** False sits this player out: they keep their slot but get no marble. */
  readonly active: boolean
}

export interface Landing {
  readonly playerId: string
  readonly bin: number
  /**
   * The decisions that produced it: one ±1 per row, in order. Kept so a round
   * can be replayed as a price line, not just a final position.
   */
  readonly flips: readonly number[]
  /** Probability of landing in that bin under Binomial(rows, 1/2). */
  readonly probability: number
  /** Bins away from the expected centre. */
  readonly deviation: number
  /** Finish order, 0-based. */
  readonly order: number
}

export interface Round {
  readonly index: number
  readonly rows: number
  readonly entrantIds: readonly string[]
  readonly landings: readonly Landing[]
  /** True for a re-drop run to break a tie. */
  readonly tieBreak: boolean
  /** The flips each entrant will take, drawn before the round is rendered. */
  readonly plan: Readonly<Record<string, readonly number[]>>
  /**
   * Price each entrant opened this round at, for Stock Market mode.
   *
   * In Stock Market mode these are always equal within a round: the first round
   * opens everyone at $100, and a tie-break there only includes players level on
   * price. (In Black Swan mode a tie-break groups players by how improbable
   * their landing was, so prices can differ — they just aren't used.)
   */
  readonly openPrices: Readonly<Record<string, number>>
}

export interface RankedEntry {
  readonly player: Player
  readonly landing: Landing
  /** 0 = best. Tied entries share a rank. */
  readonly rank: number
  readonly isWinner: boolean
  /** Bottom of the field. Both ends must be a single player to settle. */
  readonly isLoser: boolean
  /** Stock Market mode: where this player's price opened and closed. */
  readonly openPrice: number
  readonly closePrice: number
  readonly change: number
}
