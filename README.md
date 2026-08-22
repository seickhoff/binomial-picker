# Binomial Picker

A 3D Galton board that picks a person. One marble per player falls through a
lattice of pegs, and there are two ways to win.

**Black Swan** — the marble that strays **furthest from the expected middle**
wins. Landing dead centre is the likeliest thing that can happen, so it wins
nothing; you win by being improbable. A tie goes to **sudden death**, where the
whole field drops again.

**Stock Market** — every player is a stock that opens at **$100**. Neighbouring
finishing slots are **$1 apart**: the centre slot closes unchanged, one slot
right is +$1, two slots right is +$2, and so on. **Highest close wins.** A tie
goes to **after hours**, where the **whole field** trades again — every stock
resuming **from the price it reached**, not from $100. The market simply keeps
going, so a stock that was behind can rally past the leaders, and the winner is
whoever is highest when it closes.

Each session is a **dated day of trading**, announced on its own placard, and an
unsettled close rolls into the next day by itself. Days are dated forward one
trading day at a time, skipping weekends — a placard reading "Day 2 · Saturday"
would undo the illusion the placards exist to build.

### Volatility

Optional, and Stock Market only. With it on, every peg row is drawn worth **1¢, 5¢
or 10¢ on top of the base 50¢**, and every player crossing that row wears it —
added going right, subtracted going left.

The dollars still come from the lattice, so a slot is still a dollar and the
ladder under the bins still means what it says. What volatility decides is the
small change, which is where a real tape carries its noise: two marbles in the
same bin close a few cents apart, and whoever caught the wild row going the right
way is ahead. It makes exact price ties rare without changing who was winning.

It stays fair because a row is worth the same to everyone in it. Each player meets
the identical row and tosses their own coin against it, so every player has the
same distribution of closes — a market can be jumpy without being rigged. Prices
are summed in whole cents, since adding nickels in floating point leaves two
genuinely level players differing by a millionth of a cent, which is enough to
defeat a tie.

### Settling

How long a series runs is a setting:

- **One winner** — stop as soon as a single player is alone at the top.
- **Winner & loser** — keep going until **first and last are both decided**.
  Places in between may tie; only the two ends have to come apart.

Either way the re-drop puts the whole field back on the board, since separating
the ends is a statement about everyone. Black Swan calls it sudden death and
Stock Market calls it after hours, but the rule is the same.

Note that "last" means different things per mode: the lowest close in Stock
Market, and the _most likely_ landing in Black Swan — where the centre bin is
the wooden spoon.

A single peg is worth **50¢**, which follows from the slot spacing rather than
being a separate rule: stepping one slot further right means one more right
deflection _and_ one fewer left one, so a slot is always two pegs' worth of
movement. Prices therefore pass through half-dollars on the way down, and the
ticker shows them.

Same board, same fair coin flips, opposite incentives: Black Swan rewards the
tails, Stock Market rewards direction.

- **Vite + React 19 + TypeScript**
- **three.js / react-three-fiber** for the scene, with shadows, a light-formed
  environment for reflections, bloom, and a hand-written GLSL backdrop shader
- **zustand** for game state, persisted to `localStorage`

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # fairness + drop-model tests
npm run build      # typecheck + production bundle
```

## How a drop works

Every peg row is **one fair coin flip**, so the landing bin is exactly
`Binomial(rows, 1/2)`, and with `rows` rows there are `rows + 1` bins. The flips
are drawn in [`src/game/rounds.ts`](src/game/rounds.ts) before the marble moves
and stored on the round; [`src/game/drop.ts`](src/game/drop.ts) turns them into a
flight path, and the animation carries the marble along it using real projectile
motion — it accelerates under gravity, arcs half a space sideways per row, and
bounces off each peg it strikes.

This is deliberately **not** a rigid-body simulation. An earlier version used
one, and it could not be fair: bounce, friction and marble-on-marble contact
biased the walk badly (measured variance 13.3 against binomial's 2.5, with
marbles piling into the end bins), and marbles could wedge in the funnel and
never reach the floor. The tests assert what the current model guarantees:

- each decision is 50/50 (to 3 decimal places over 200k drops)
- mean, variance and a chi-square fit against `Binomial(rows, 1/2)`
- the marble always reaches the floor, resting exactly on its bin's centre

The first two live in `rounds.test.ts`, which tests the draw; the third is in
`drop.test.ts`, which tests the path a draw is turned into.

Scoring lives in [`src/game/modes.ts`](src/game/modes.ts) and is the only thing
the two modes disagree about. Black Swan ranks by probability ascending — the
rarest bin, which on a symmetric board is the one furthest from centre. Stock
Market ranks by closing price descending. Ties are real and common on small
boards, and either way the re-drop puts the whole field back on the board.

### Theme

Stock Market mode redresses the whole scene as a trading floor: a scrolling
ticker of every player's price, brass trim, a price grid and a drifting index
line drawn procedurally in the backdrop shader, and bins tinted red-to-green
from loss to gain. Gain/loss colours are the reserved status pair and always
ship with a ▲/▼ glyph, so the colour is never the only cue. No image assets —
it's all shader and CSS.

### Sound

No audio files either. The trading floor is a room full of overlapping voices,
which is what noise sounds like once it is band-passed around the frequencies
speech lives in and swelled by a slow, uneven envelope; shouts go on top as short
bursts, pitched and panned differently every time. The bell is inharmonic
partials at ratios like 2.76 and 5.40 with the high ones dying first — which is
why a bell starts as a clang and settles into a hum — rung as a flurry, because
the real thing is a hand bell rung hard and fast. Every peg strike rings a note,
pitched and panned by where the peg sits, on a pentatonic scale so that dozens
landing at once stay consonant.

One shared audio device carries all of it, so muting is a single ramp, and it
suspends itself five seconds after the last sound rather than waking its thread
every three milliseconds for silence.

### The roster

2 to 20 players. Names and the row count are remembered in `localStorage`, so
the same group can keep dropping across sessions. Each player has an **in/out**
checkbox: untick to sit a round out without losing their name or colour. A round
needs at least two players in.

### Release modes

- **All at once** — everyone drops together, staggered by a beat. Marbles are
  spread slightly in depth so they never overlap on screen. Release slots across
  the funnel mouth are reshuffled every round.
- **One at a time** — each marble runs the board alone from the same point. The
  fairest-feeling option when you're using this to pick a person.

Either way the odds are identical, because the flips are.

## Layout

Dependencies point inward only: `game` knows nothing about the renderer or the
UI, and the renderer and UI never reference each other.

```
src/
  game/          pure rules. No three.js, no React, no DOM.
    binomial.ts  Pascal's triangle, pmf, odds formatting
    rounds.ts    drawing a round: one fair coin flip per row per player
    drop.ts      flips to flight path, and planning a whole field at once
    geometry.ts  peg/bin/wall layout, all derived from the row count
    modes.ts     the two modes: their rules, copy and price arithmetic
    scoring.ts   who won — ranking, ties, closing prices
    series.ts    a run of sessions read as one price history, and one long drop
    calendar.ts  dating sessions, a trading day at a time
    store.ts     zustand state and transitions (mechanism, not policy)
    palette.ts   the player colours
  live/          per-frame channels between the scene and everything else.
    priceFeed.ts    marbles publish prices, the ticker reads them
    cameraFocus.ts  marbles publish height, the camera follows
    pegFlashes.ts   marbles announce strikes; the pegs light and the speakers click
  audio/         every sound, synthesised — no audio files anywhere.
    tradingFloor.ts  the room: filtered noise, and shouts across it
    bell.ts          the opening and closing bell, from inharmonic partials
    plinks.ts        a note per peg, pitched and panned by where it is
    ambience.ts      when the floor is open, as a pure rule
  three/         the scene. Board (board/), Marbles, CameraRig, Stage, Backdrop.
    framing.ts   what the camera frames, as pure arithmetic — and tested
  ui/            panels and charts. presenters.ts holds the wording.
    curve.ts     monotone cubic smoothing that cannot overshoot its data
    keys.ts      which keystrokes belong to the app, and which to the control
```

Two boundaries are worth calling out:

**Policy vs. mechanism.** `scoring.ts` decides who won and knows nothing about
zustand; `store.ts` holds state and knows nothing about how a round is scored.
Swapping the state container wouldn't touch the rules, and the rules are tested
without one.

**Per-frame data.** Marbles update sixty times a second, and routing that
through React state would re-render the app every frame. The `live/` modules are
plain mutable channels read once per frame by whoever needs them — the reason
`ui/` never has to import from `three/`.

Board geometry is derived entirely from the row count (4–24), so the device, the
camera framing and the chart all rescale from one slider.

### Colour

Twenty categorical colours, one per roster slot, so a full field never repeats a
hue. They are generated in OKLCH as six hues across four lightness tiers, then
ordered by a hill climb that maximises the separation of neighbouring slots —
scored under simulated protanopia, deuteranopia and tritanopia as well as normal
vision, since the pairs that collide are not the same ones in each.

The result was checked against this app's panel surface for lightness band,
chroma floor, colour-vision separation and contrast. Three of the twenty land
just under 3:1 against the surface, so colour never carries identity alone:
every player is named directly in the HUD, on the marble, on their line in the
chart and in the results table, and each one also trades under a distinct ticker
symbol.

## Deploying to Vercel

`vercel.json` is set up for a static Vite build (`npm run build` → `dist`).
Point Vercel at the repo and it needs no further configuration.
