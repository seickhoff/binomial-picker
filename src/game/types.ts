export type Phase =
  | 'setup'
  /**
   * The session's placard is up and the marbles are held at the funnel. Long
   * enough to read what day it is, and to let the bell ring before the drop.
   */
  | 'opening'
  | 'running'
  | 'results'

/** Which chart the results panel shows. */
export type ChartView =
  /** Where the outcome could have landed, as a distribution. */
  | 'distribution'
  /** How each player's price actually moved, row by row. */
  | 'moves'
  /** One candle per player: where each opened, closed, and reached either way. */
  | 'candles'
  /**
   * Not a chart at all: the next morning's paper, reporting the two ends of the
   * field. It shares the switch because it is another way of looking at the
   * session that just closed, and Stock Market is the only mode that has one.
   */
  | 'frontPage'

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
  /**
   * One drop and done: whatever the board says is the result, ties included.
   *
   * Not a settling rule so much as the absence of one — there is no second
   * session to reach, so a level top is simply how that round ended.
   */
  | 'oneShot'

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
  /** Bins away from the expected center. */
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
  /**
   * What each row of pegs is worth, in dollars, one per row.
   *
   * Drawn with the flips and recorded here, so a session's own market conditions
   * stay with it: a series charted across days keeps each day at the volatility
   * it was actually played at.
   */
  readonly rowMoves: readonly number[]
  /** The flips each entrant will take, drawn before the round is rendered. */
  readonly plan: Readonly<Record<string, readonly number[]>>
  /**
   * Each entrant's own penny per peg, in dollars — empty when the market is flat.
   *
   * Per player rather than per row, unlike `rowMoves`: this is the part of a
   * price that is nobody else's. Drawn with the flips and kept with the round for
   * the same reason — a chart of a finished session has to price it the way it
   * was actually played.
   */
  readonly jitter: Readonly<Record<string, readonly number[]>>
  /**
   * Price each entrant opened this round at, for Stock Market mode.
   *
   * Equal across the field on day one, where everyone opens at $100, and only
   * then: a further trading day puts the whole field back on the board carrying
   * the price it reached, so the opens are as spread out as the last close was.
   * That is also the order the field is released in — see `lineup.ts`.
   * (Black Swan keeps prices too; it simply never reads them.)
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
