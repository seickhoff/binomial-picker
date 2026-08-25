/**
 * The financial press, such as it is.
 *
 * A session's winner and loser each get a front-page story, so the market needs
 * something to have written about them. Two catalogs of a hundred, one per
 * direction, in the cadence a wire service actually files in: a subject, a verb
 * in the present tense, and a reason.
 *
 * In the game layer beside `symbols`, and for the same reason — a headline is a
 * fact about a finished session, not a phrasing decision the panel is free to
 * make differently. It is chosen from the session's own figures, so the same
 * session always reads the same way: dragging the card, opening the chart or
 * re-rendering for any other reason must not reshuffle the news.
 *
 * Two tokens, because a real page uses both forms of a company's name. `{SYM}`
 * is the ticker — the four-letter identity from `symbols` — and `{CO}` is the
 * player, standing in for the company. Every line carries at least one.
 *
 * A story can be about more than one player, because an end of the field can be
 * tied, and then the tokens become a list: "NOVA, ACME and ZENO". English will
 * not let that pass with the rest of the sentence unchanged, so every line that
 * needs it carries its own plural in `[singular|plural]` brackets:
 *
 *   {SYM} Raise[s|] Full-Year Revenue Outlook[|s]
 *     one   → NOVA Raises Full-Year Revenue Outlook
 *     three → NOVA, ACME and ZENO Raise Full-Year Revenue Outlooks
 *
 * Written out per line rather than conjugated by rule. A rule can turn "Raises"
 * into "Raise", but the subject is not always the word before the verb — "{SYM}
 * Gross Margin Expands" needs "Gross Margins Expand", and "Slips From Its Highs"
 * needs "Their" — and a headline generator that gets the grammar wrong is worse
 * than no headline. Lines with nothing to inflect carry no brackets at all: the
 * verb is already plural ("{SYM} Shares Jump"), or the sentence never agreed with
 * the subject in the first place ("Analysts Lift {SYM} Price Targets").
 */

/** Which way the day went for whoever the story is about. */
export type NewsTone = 'good' | 'bad'

/** One player as the page refers to them: on the tape, and in full. */
export interface NewsSubject {
  readonly symbol: string
  readonly name: string
}

const GOOD: readonly string[] = [
  '{SYM} Raise[s|] Full-Year Revenue Outlook[|s] on Strong Quarterly Demand',
  '{CO} Win[s|] $480M Multi-Year Government Contract',
  '{SYM} Shares Jump After Earnings Beat Wall Street Expectations',
  'Analysts Lift {SYM} Price Targets Following Strong Guidance',
  '{CO} Expand[s|] Manufacturing Capacity as Orders Accelerate',
  '{SYM} Announce[s|] New AI Platform, Expect[s|] Material Revenue Contribution',
  'Institutional Buying Increases as {SYM} Reach[es|] 52-Week High[|s]',
  '{CO} Report[s|] Record Free Cash Flow, Plan[s|] Accelerated Debt Paydown',
  '{SYM} Top[s|] Estimates on Every Line as Margins Widen',
  '{CO} Sign[s|] Ten-Year Supply Agreement With Top-Three Customer',
  '{SYM} Guide[s|] Above Consensus for the First Time in Two Years',
  '{CO} Book[s|] the Largest Order in Company History',
  '{SYM} Upgraded to Buy on [an Improving Order Book|Improving Order Books]',
  '{CO} Lift[s|] Dividend[|s] 18%, Announce[s|] $2B Buyback[|s]',
  '{SYM} Clear[s|] Regulatory Review Ahead of Schedule',
  '{CO} Open[s|] Second Plant[|s] as Backlog[|s] Reach[es|] a Record',
  '{SYM} Rall[ies|y] as Short Interest Falls to a Two-Year Low',
  '{CO} Land[s|] Anchor Customer for [Its|Their] Next-Generation Line[|s]',
  '{SYM} Added to Major Index; Passive Inflows Expected',
  '{CO} Beat[s|] on Revenue, Raise[s|] Margin Target[|s] Through 2028',
  '{SYM} Gross Margin[|s] Expand[s|] 340 Basis Points',
  '{CO} Renew[s|] Flagship Contract at a Higher Rate',
  '{SYM} Announce[s|] Accretive Acquisition, Shares Climb',
  '{CO} Name[s|] [a Veteran Operator|Veteran Operators] as Chief Executive[|s]',
  '{SYM} Say[s|] Backlog[|s] Now Cover[s|] Two Full Years of Production',
  '{CO} Settle[s|] Long-Running Dispute on Favorable Terms',
  '{SYM} Cash Balance[|s] Swell[s|]; Board[|s] Weigh[s|] Special Dividend[|s]',
  '{CO} Report[s|] Fastest Customer Growth Since Founding',
  '{SYM} Break[s|] Out to [an All-Time High|All-Time Highs] on Heavy Volume',
  '{CO} Win[s|] Exclusive Rights in a Fast-Growing Segment',
  '{SYM} Trim[s|] Costs Without Touching Headcount, Filing[|s] Show[s|]',
  '{CO} Insiders Buy Shares in the Open Market',
  '{SYM} Raise[s|] Guidance Twice in a Single Quarter',
  '{CO} Reach[es|] Profitability a Year Ahead of Plan',
  '{SYM} Win[s|] Patent Ruling, Clearing the Path for Rollout',
  '{CO} Add[s|] a Marquee Name to [Its|Their] Customer List[|s]',
  '{SYM} Named Top Performer[|s] in Annual Sector Survey',
  '{CO} Secure[s|] Financing at a Lower Cost Than Expected',
  '{SYM} Report[s|] Zero Churn Among Enterprise Accounts',
  '{CO} Double[s|] Capacity After a Record Quarter of Bookings',
  '{SYM} Shares Surge on Report of Takeover Interest',
  '{CO} Deliver[s|] Flagship Project[|s] Early and Under Budget',
  '{SYM} Analyst Day[|s] Impress[es|]; Targets Move Higher',
  '{CO} Post[s|] [Its|Their] Best Quarter on Record for New Bookings',
  '{SYM} Raise[s|] Prices Without Losing a Single Customer',
  '{CO} Announce[s|] Process[|es] That Cut[s|] Production Costs in Half',
  '{SYM} Beat[s|] and Raise[s|]; Stock[|s] Gap[s|] Higher at the Open',
  '{CO} Reinstate[s|] Dividend[|s] After Two-Year Turnaround',
  '{SYM} Win[s|] Certification in a Key Overseas Market',
  '{CO} Report[s|] Blowout Quarter as Demand Outstrips Supply',
  '{SYM} Announce[s|] Partnership With an Industry Leader',
  '{CO} Recover[s|] the Market Share [It|They] Lost Last Year',
  '{SYM} Boost[s|] Buyback[|s] as Board[|s] Call[s|] Shares Undervalued',
  '{CO} Report[s|] [Its|Their] First Billion-Dollar Quarter',
  '{SYM} Order Backlog[|s] Climb[s|] for a Ninth Straight Quarter',
  '{CO} Named Preferred Supplier[|s] in Multi-Year Framework',
  '{SYM} Debt Upgraded to Investment Grade',
  '{CO} Turn[s|] Cash-Flow Positive Ahead of Guidance',
  '{SYM} Draw[s|] Fresh Buyers as Momentum Builds',
  '{CO} Expand[s|] Into an Adjacent Market With Early Wins',
  '{SYM} Raise[s|] Long-Term Margin Target[|s] at Investor Day',
  '{CO} Sign[s|] Distribution Deal[|s] Covering Three Continents',
  '{SYM} Beat[s|] Expectations Despite a Sector-Wide Slowdown',
  '{CO} Report[s|] Record Retention and Rising Order Sizes',
  '{SYM} Shrug[s|] Off Broad Market Selloff, Close[s|] Higher',
  '{CO} Complete[s|] Integration Ahead of Schedule',
  '{SYM} Hit[s|] 52-Week High[|s] as Volume Doubles',
  '{CO} Win[s|] Landmark Contract After a Two-Year Bid',
  '{SYM} Guidance Raise[|s] Prompt[s|] a Wave of Upgrades',
  '{CO} Report[s|] the Strongest Pipeline in Company History',
  '{SYM} Announce[s|] Stock Split[|s] as Shares Extend Their Run',
  '{CO} Cut[s|] Lead Times as [a New Line Comes|New Lines Come] Online',
  '{SYM} Pick[s|] Up Business After a Competitor Stumbles',
  '{CO} Report[s|] Margin Gains for a Fourth Straight Quarter',
  '{SYM} Rated Buy at Three Firms in a Single Morning',
  '{CO} Lock[s|] In Input Costs Through 2029',
  '{SYM} Quarterly Loss[|es] Narrow[s|] Far More Than Expected',
  '{CO} Win[s|] Approval for [Its|Their] Flagship Facilit[y|ies]',
  '{SYM} Report[s|] Record Quarter, Raise[s|] Outlook, Add[s|] Buyback',
  '{CO} Hire[s|] Star Executive[|s] Away From a Larger Rival',
  '{SYM} Shares Climb on Upbeat Channel Checks',
  '{CO} Sell[s|] Non-Core Unit[|s] at a Premium',
  '{SYM} Announce[s|] Capital Return Framework Through 2030',
  '{CO} Report[s|] Demand "Well Ahead of Plan"',
  '{SYM} Volume[|s] Spike[s|] as Funds Build Positions',
  '{CO} Sign[s|] the Largest Renewal in [Its|Their] History',
  '{SYM} Earnings Quality Praised by Skeptical Analysts',
  '{CO} Report[s|] the Highest Utilization Rates on Record',
  '{SYM} Win[s|] Bidding War for a Prized Asset',
  '{CO} End[s|] the Quarter With No Net Debt',
  '{SYM} Beat[s|] by a Wide Margin, Guide[s|] Higher Still',
  '{CO} Report[s|] Record Uptime and Falling Costs to Serve',
  '{SYM} See[s|] a Multi-Year Runway After Contract Win',
  '{CO} Expand[s|] [Its|Their] Order[|s] With [Its|Their] Largest Customer[|s]',
  '{SYM} Rebound[s|] Sharply as Buyers Step In',
  '{CO} Ship[s|] Breakthrough Product Ahead of Rivals',
  '{SYM} Raise[s|] Outlook, Citing "Broad-Based Strength"',
  '{CO} Draw[s|] Record Attendance at Product Launch[|es]',
  '{SYM} Close[s|] at [a Record High|Record Highs] for a Fifth Session Running',
  '{CO} End[s|] the Day as the Market’s Best Performer[|s]',
]

const BAD: readonly string[] = [
  '{SYM} Cut[s|] Revenue Forecast[|s], Citing Slower Customer Spending',
  '{CO} Shares Slide After Quarterly Profit[|s] Fall[s|] Short',
  '{SYM} Delay[s|] Major Product Launch Until Next Year',
  'Analysts Lower {SYM} Targets Following Weak Guidance',
  '{CO} Warn[s|] of Margin Pressure as Input Costs Continue to Rise',
  '{SYM} Lose[s|] Key Customer[|s] in Setback for Growth Strateg[y|ies]',
  'Insiders Sell Shares as {SYM} Slip[s|] From [Its|Their] Highs',
  '{CO} Announce[s|] Workforce Reduction Amid Cost-Cutting Push',
  '{SYM} Miss[es|] on Both Lines; Shares Fall Hard',
  '{CO} Pull[s|] Full-Year Guidance, Citing Limited Visibility',
  '{SYM} Downgraded to Sell on [a Deteriorating Order Book|Deteriorating Order Books]',
  '{CO} Suspend[s|] Dividend[|s] to Preserve Cash',
  '{SYM} Backlog[|s] Shrink[s|] for a Third Consecutive Quarter',
  '{CO} Lose[s|] Flagship Contract to a Lower Bidder',
  '{SYM} Slide[s|] to [a 52-Week Low|52-Week Lows] on Heavy Volume',
  '{CO} Delay[s|] Plant Opening as Costs Overrun Budget',
  // Short interest is uncountable, so the subject has to be the players rather
  // than the figure — "NOVA and ACME Short Interest Doubles" agrees with nothing.
  '{SYM} See[s|] Short Interest Double in a Month',
  '{CO} Chief Financial Officer[|s] Depart[s|] Without Explanation',
  '{SYM} Removed From Major Index; Outflows Expected',
  '{CO} Cut[s|] Prices as Rivals Undercut [Its|Their] Flagship Line[|s]',
  '{SYM} Gross Margin[|s] Contract[s|] 420 Basis Points',
  '{CO} Renew[s|] Key Contract at a Sharply Lower Rate',
  '{SYM} Acquisition[|s] Questioned; Shares Fall on the News',
  '{CO} Name[s|] [Its|Their] Third Chief Executive[|s] in Four Years',
  '{SYM} Say[s|] Demand Softened "Sharply" in the Final Weeks',
  '{CO} Settle[s|] Dispute at a Cost Well Above Estimates',
  '{SYM} Burn[s|] Through Cash Faster Than Expected',
  '{CO} Report[s|] Slowest Customer Growth Since Listing',
  '{SYM} Break[s|] Below Long-Term Support on Heavy Selling',
  '{CO} Lose[s|] Exclusive Rights in a Key Segment',
  '{SYM} Restate[s|] Prior Results After Accounting Review',
  '{CO} Insiders Unload Stock Ahead of the Quiet Period',
  '{SYM} Cut[s|] Guidance Twice in a Single Quarter',
  '{CO} Push[es|] Profitability Target[|s] Out Another Year',
  '{SYM} Lose[s|] Patent Ruling; Rollout Now in Doubt',
  '{CO} Drop[s|] Off Customer’s Preferred-Supplier List',
  '{SYM} Ranked Last in Annual Sector Survey',
  '{CO} Refinance[s|] at a Sharply Higher Cost',
  '{SYM} See[s|] Enterprise Churn Climb to a Record',
  '{CO} Idle[s|] Second Line[|s] as Orders Dry Up',
  '{SYM} Takeover Talks Collapse; Shares Give Back Gains',
  '{CO} Flagship Project[|s] Run[s|] Late and Over Budget',
  '{SYM} Investor Day[|s] Disappoint[s|]; Targets Move Lower',
  '{CO} Post[s|] [Its|Their] Worst Quarter for Bookings in Five Years',
  '{SYM} Raise[s|] Prices and Promptly Lose[s|] Customers',
  '{CO} Halt[s|] Rollout After Quality Issues Surface',
  '{SYM} Miss[es|] and Guide[s|] Lower; Stock[|s] Gap[s|] Down at the Open',
  '{CO} Skip[s|] Dividend[|s] for the First Time in a Decade',
  '{SYM} Fail[s|] Certification in a Key Overseas Market',
  '{CO} Report[s|] Weak Quarter as Supply Outstrips Demand',
  '{SYM} Partnership[|s] Dissolve[s|] After Eighteen Months',
  '{CO} Cede[s|] Market Share to Faster-Moving Rivals',
  '{SYM} Halt[s|] Buyback[|s] to Conserve Cash',
  '{CO} Post[s|] [Its|Their] First Annual Loss[|es] Since Founding',
  '{SYM} Order Backlog[|s] Fall[s|] to [Its|Their] Lowest Level[|s] in Years',
  '{CO} Placed Under Review by a Major Customer',
  '{SYM} Debt Downgraded Below Investment Grade',
  '{CO} Turn[s|] Cash-Flow Negative, Cite[s|] One-Time Items',
  '{SYM} Traders Head for the Exits as Momentum Fades',
  '{CO} Retreat[s|] From Adjacent Market After a Costly Push',
  '{SYM} Cut[s|] Long-Term Margin Target[|s] at Investor Day',
  '{CO} Distribution Deal[|s] End[s|] Three Years Early',
  '{SYM} Underperform[s|] Despite a Sector-Wide Upswing',
  '{CO} Report[s|] Falling Retention and Smaller Order Sizes',
  '{SYM} Slide[s|] Even as the Broad Market Rallies',
  '{CO} Integration[|s] Stall[s|]; Synergy Targets Withdrawn',
  '{SYM} Hit[s|] [a 52-Week Low|52-Week Lows] as Volume Doubles',
  '{CO} Lose[s|] Landmark Contract After a Two-Year Bid',
  '{SYM} Guidance Cut[|s] Prompt[s|] a Wave of Downgrades',
  '{CO} Report[s|] the Thinnest Pipeline in Years',
  '{SYM} Weigh[s|] Reverse Split[|s] as Shares Slide',
  '{CO} Lead Times Stretch as Production Falters',
  '{SYM} Lose[s|] Business to a Sharper Competitor',
  '{CO} Report[s|] Margin Declines for a Fourth Straight Quarter',
  '{SYM} Cut to Sell at Three Firms in a Single Morning',
  '{CO} Exposed to Input Costs as Hedges Roll Off',
  '{SYM} Quarterly Loss[|es] Widen[s|] Far More Than Expected',
  '{CO} Denied Approval for [Its|Their] Flagship Facilit[y|ies]',
  '{SYM} Miss[es|] Badly, Cut[s|] Outlook, Pause[s|] Buyback',
  '{CO} Lose[s|] Star Executive[|s] to a Smaller Rival',
  '{SYM} Shares Fall on Downbeat Channel Checks',
  '{CO} Sell[s|] Core Unit[|s] at a Discount to Raise Cash',
  '{SYM} Shelve[s|] Capital Return Plans',
  '{CO} Say[s|] Demand Is Running "Well Below Plan"',
  '{SYM} Funds Trim Positions; Volume Spikes on the Way Down',
  '{CO} Lose[s|] [Its|Their] Largest Renewal[|s]',
  '{SYM} Earnings Quality Questioned by Longtime Bulls',
  '{CO} Report[s|] the Lowest Utilization Rates on Record',
  '{SYM} Walk[s|] Away From Bidding War, Shares Fall Anyway',
  '{CO} End[s|] the Quarter With Debt at a Record High',
  '{SYM} Miss[es|] by a Wide Margin, Guide[s|] Lower Still',
  '{CO} Report[s|] Rising Costs to Serve and Falling Uptime',
  '{SYM} Growth Runway[|s] Narrow[s|] After Contract Loss',
  // Possessive, unlike the attributive names elsewhere ("{CO} Flagship Project"):
  // a superlative cannot modify a company the way a plain noun can.
  '{CO}’s Largest Customer[|s] Cut[s|] [Its|Their] Order[|s] in Half',
  '{SYM} Extend[s|] [Its|Their] Losing Streak[|s] to a Fifth Session',
  '{CO} Fall[s|] Behind Rivals on Next-Generation Product',
  '{SYM} Cut[s|] Outlook, Citing "Broad-Based Weakness"',
  '{CO} Product Launch[|es] Draw[s|] Sparse Crowds',
  '{SYM} Close[s|] at [a Record Low|Record Lows] for a Fifth Session Running',
  '{CO} End[s|] the Day as the Market’s Worst Performer[|s]',
]

export const HEADLINES: Readonly<Record<NewsTone, readonly string[]>> = { good: GOOD, bad: BAD }

/**
 * FNV-1a, 32-bit: a seed string in, a spread-out number out.
 *
 * Any hash would do — what matters is that it is a pure function of the seed, so
 * the page is written once by the facts of the session and never changes under a
 * re-render. `Math.imul` keeps the multiply in 32-bit integer space, which is the
 * whole reason to name the algorithm rather than multiply by a large prime and
 * hope.
 */
function hash(seed: string): number {
  let value = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return avalanche(value) >>> 0
}

/**
 * The finishing shuffle, and not optional: FNV-1a's low bits barely move.
 *
 * The catalogs are chosen with a remainder, which reads the bottom of the number —
 * and the bottom byte of an FNV hash depends only on the bottom byte of what went
 * in. Seeds here are near-identical strings differing in their last few digits,
 * so straight out of the loop a hundred sessions reached about a quarter of the
 * catalog, the same lines over and over. Murmur3's finalizer mixes the high bits
 * down into the low ones, which is exactly the missing step.
 */
function avalanche(value: number): number {
  let mixed = value ^ (value >>> 16)
  mixed = Math.imul(mixed, 0x85ebca6b)
  mixed ^= mixed >>> 13
  mixed = Math.imul(mixed, 0xc2b2ae35)
  return mixed ^ (mixed >>> 16)
}

/** A seed spread over `count` values: 0 to `count` − 1, and always the same one. */
export function spreadBySeed(seed: string, count: number): number {
  return hash(seed) % Math.max(1, count)
}

/** One of `items`, chosen by `seed` and always the same one for it. */
export function pickBySeed<T>(items: readonly T[], seed: string): T {
  return items[spreadBySeed(seed, items.length)]
}

/** Past this many, a headline stops naming names and starts counting them. */
const MOST_NAMED = 4

/**
 * A list of names as a headline sets it: "A", "A and B", "A, B and C".
 *
 * No serial comma, which is the house style of every paper this is imitating. A
 * long tie is summarised rather than listed — five names across a column is not a
 * headline any more, and "and 3 others" is what a real page prints.
 */
export function listOf(items: readonly string[], others = 'others'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]

  const namesThemAll = items.length <= MOST_NAMED
  // Everyone but the last, who is joined on with "and" — or, past the limit, as
  // many as are being named, with the count of those who aren't standing last.
  const listed = namesThemAll ? items.slice(0, -1) : items.slice(0, MOST_NAMED - 1)
  const last = namesThemAll ? items[items.length - 1] : `${items.length - listed.length} ${others}`

  return `${listed.join(', ')} and ${last}`
}

/**
 * The day's story about one end of the field: a line from the catalog for the way
 * the session went, with the market's names filled in and the grammar agreeing
 * with however many of them there are.
 */
export function headlineFor({
  tone,
  seed,
  subjects,
}: {
  tone: NewsTone
  /** Anything that identifies this session and this end of it. Same seed, same news. */
  seed: string
  /** Everyone the story is about — more than one when the end is tied. */
  subjects: readonly NewsSubject[]
}): string {
  const plural = subjects.length > 1

  return inflect(pickBySeed(HEADLINES[tone], seed), plural)
    .replaceAll(
      '{SYM}',
      listOf(
        subjects.map((subject) => subject.symbol),
        'Others',
      ),
    )
    .replaceAll(
      '{CO}',
      listOf(
        subjects.map((subject) => companyName(subject.name)),
        'Others',
      ),
    )
}

/** Resolves every `[singular|plural]` in a line to the form the subject needs. */
function inflect(line: string, plural: boolean): string {
  return line.replace(/\[([^[\]|]*)\|([^[\]|]*)\]/g, (_, one, many) => (plural ? many : one))
}

/**
 * A player's name as a paper would set it: trimmed, and never empty.
 *
 * A blank name is allowed on the roster — the field is left for the player to
 * fill in — and "Wins $480M Contract" with nothing in front of it is a headline
 * about nobody.
 */
function companyName(name: string): string {
  return name.trim() || 'An Unnamed Issuer'
}
