# Binomial Picker

A 3D Galton board that picks a person. One marble per player, two ways to win.

**Black Swan** — furthest from the expected middle wins; dead center is the
likeliest landing and wins nothing. A tie goes to **sudden death**, and the odds
**multiply**: on a 24-row board, three slots right on Monday is 1 in 12.8, three
slots left on Tuesday is 1 in 12.8 again, and together they are **1 in 165**.
Straying is straying, whichever way it went.

**Stock Market** — every player is a stock opening at **$100**, neighboring slots
**$1 apart**. Highest close wins. A tie goes to **another trading day** where the
whole field trades again, each stock resuming from the price it reached. Sessions
are dated days on their own placards, weekends skipped.

The **ladder under the bins** says what a slot is worth in the mode's own
currency: a price in Stock Market (`$103`), the odds of landing there in Black
Swan (`1 in 17M` at the edge of a 24-row board, `1 in 6.2` in the middle). Never
a bin index — that points at a slot without saying what it is worth.

### Volatility

Stock Market only. Every peg row is drawn a **mood** — calm, mid or wild, one in
three — and then a whole number of cents from inside it: **0–5¢, 6–10¢ or 11–25¢
on top of the base 50¢** by default, with all three bands adjustable up to 50¢.
Every player crossing that row wears the same figure, added going right and
subtracted going left, so the dollars still come from the lattice and a slot is
still a dollar. Volatility decides only the small change.

Each player also draws a **private penny** at every peg — −1¢, 0 or +1¢, added
whichever way their marble went. That is what separates two players who took
mirror-image paths through the same market and would otherwise close at exactly
the same price.

Fair either way: the row is worth the same to everyone in it, and every player
draws their penny from the same symmetric set, so all of them have the identical
distribution of closes. Prices sum in whole cents, since adding nickels in
floating point leaves two level players a millionth of a cent apart — enough to
defeat a tie.

### Settling

- **One winner** — stop as soon as one player is alone at the top.
- **Both ends** — until first and last are both decided; places between may tie.
- **One shot** — no settling at all. One drop, and a level top stays level.

A re-drop puts the **whole field** back on the board.

**Both modes carry forward, but not the same thing.** Stock Market carries the
**price** — give back what you made and you are where you started. Black Swan
carries **improbability**, which is never given back: its sessions stay separate
drops and their odds multiply.

Multiplying is what lets Black Swan settle at all. Bin _k_ and bin _rows−k_ are
exactly as likely, so a single drop ties mirror-image players as a matter of
arithmetic — and a drop scored on its own is no more likely to separate them than
the one before it. Multiplied, a series converges: four players on ten rows are
decided by the first drop 57% of the time and need more than three sessions 3% of
the time. The hard case is a small board with a big field — twenty players over
five slots and three distinct rarities — and even that averages 2.6 sessions.
Players who really are level still tie, as they should, and odds multiply
**smallest first** so identical runs come out level to the bit.

"Last" differs by mode: the lowest close in Stock Market, the _most likely_
landing in Black Swan. And a peg is worth **50¢** from the slot spacing rather
than as a rule of its own — one slot right is one more right deflection _and_ one
fewer left, so a slot is two pegs.

- Vite + React 19 + TypeScript
- three.js / react-three-fiber — shadows, bloom, hand-written GLSL backdrop
- zustand for game state, persisted to `localStorage`

## Running it locally

Needs **Node 20.19+** (22+ recommended).

```bash
git clone https://github.com/seickhoff/binomial-picker.git
cd binomial-picker
npm install
npm run dev        # http://localhost:5173

npm test           # fairness and drop-model tests
npm run build      # typecheck, then a production bundle into dist/
npm run preview    # serve that bundle
npm run format     # apply the formatting rules
```

## How a drop works

Every peg row is **one fair coin flip**, so the landing bin is exactly
`Binomial(rows, 1/2)`. Flips are drawn in [`rounds.ts`](src/game/rounds.ts)
before the marble moves; [`drop.ts`](src/game/drop.ts) turns them into a flight
path the animation follows with real projectile motion — gravity, half a space of
arc per row, a bounce off every peg.

Deliberately **not** a rigid-body simulation. An earlier version was, and could
not be fair: variance 13.3 against binomial's 2.5, marbles piling into the end
bins, some wedging in the funnel and never landing. The tests assert what the
current model guarantees:

- every decision 50/50, to 3 decimal places over 200k drops
- mean, variance and a chi-square fit against `Binomial(rows, 1/2)`
- the marble always reaches the floor, resting exactly on its bin's center

Scoring is the only thing the modes disagree about — Black Swan ranks by
probability ascending, Stock Market by closing price descending — and either way
the result is read off the series rather than the day, through `scoredRound` in
[`series.ts`](src/game/series.ts), so nothing downstream knows how many days it
is looking at.

### Theme, sound, roster

Stock Market redresses the scene as a trading floor: scrolling ticker, brass
trim, a price grid and drifting index line in the backdrop shader, bins tinted
red-to-green. Gain and loss always ship with a ▲/▼ glyph, so color is never the
only cue. **No image assets** — shader and CSS.

**No audio files either.** The floor is noise band-passed around speech
frequencies under a slow, uneven envelope, with shouts on top; the bell is
inharmonic partials at ratios like 2.76 and 5.40, the high ones dying first, rung
as a flurry. Every peg strike is a note, pitched and panned by the peg's
position, pentatonic so dozens at once stay consonant. One shared audio device,
suspended five seconds after the last sound.

**2 to 20 players**, remembered in `localStorage`, each with an in/out checkbox.
A round needs two in. **Release** is all-at-once (staggered, spread in depth) or
one at a time; the odds are identical either way. Who goes first is a rule, not a
draw: Stock Market by price, highest first — which on day one, at $100 each, reads
as alphabetical by ticker — and Black Swan by name, the roster's own order.

## Layout

```
src/
  game/          pure rules. No three.js, no React, no DOM.
    binomial.ts  Pascal's triangle, pmf, odds formatting
    rounds.ts    drawing a round: one fair coin flip per row per player
    drop.ts      flips to flight path, and planning a whole field at once
    lineup.ts    filing a field: roster order, and release order per mode
    geometry.ts  peg/bin/wall layout, all derived from the row count
    modes.ts     the two modes: their rules, copy and price arithmetic
    scoring.ts   who won — ranking, ties, closing prices
    series.ts    a run of sessions, and the round a result is read off
    calendar.ts  dating sessions, a trading day at a time
    store.ts     zustand state and transitions (mechanism, not policy)
    palette.ts   the player colors
  live/          per-frame channels between the scene and everything else.
    priceFeed.ts    marbles publish prices, the ticker reads them
    cameraFocus.ts  marbles publish height, the camera follows
    pegFlashes.ts   marbles announce strikes; pegs light, speakers click
  audio/         every sound, synthesized — no audio files anywhere.
    tradingFloor.ts  the room: filtered noise, and shouts across it
    bell.ts          the opening and closing bell, from inharmonic partials
    plinks.ts        a note per peg, pitched and panned by where it is
    ambience.ts      when the floor is open, as a pure rule
  three/         the scene. Board (board/), Marbles, CameraRig, Stage, Backdrop.
    framing.ts   what the camera frames, as pure arithmetic — and tested
  ui/            panels and charts. presenters.ts holds the wording.
    curve.ts     monotone cubic smoothing that cannot overshoot its data
    keys.ts      which keystrokes belong to the app, and which to the control
  result.ts      the round a result is read off, as a hook
  viewport.ts    whether the layout is a phone's or a desk's
```

Dependencies point inward only: `game` knows nothing about the renderer or the
UI, and those two never reference each other. The top-level pair are React hooks
the scene and the panels both ask, so they can live in neither.

**Policy vs. mechanism.** `scoring.ts` decides who won and knows nothing about
zustand; `store.ts` holds state and implements none of the rules it calls. Swap
the state container and the rules don't move — they are tested without one.

**Per-frame data.** Marbles update sixty times a second, and routing that through
React state would re-render every frame. The `live/` modules are plain mutable
channels read once per frame — the reason `ui/` never imports `three/`.

Board geometry derives entirely from the row count (4–24), so the device, camera
framing and chart all rescale from one slider.

### Color

Twenty categorical colors, one per roster slot, so a full field never repeats a
hue — generated in OKLCH as six hues across four lightness tiers, then ordered by
a hill climb maximizing neighbor separation, scored under simulated protanopia,
deuteranopia and tritanopia as well as normal vision. Three land just under 3:1
against the panel surface, so color never carries identity alone: every player is
named in the HUD, on the marble, in the chart and in the table, and trades under
a distinct ticker.

## Deploying to Vercel

`vercel.json` is set up for a static Vite build (`npm run build` → `dist`). Point
Vercel at the repo; it needs no further configuration.
