/**
 * Categorical player palette: one distinct color per slot, never repeated.
 *
 * Generated as six hues across four lightness tiers in OKLCH, then ordered by
 * hill-climbing so the *worst* neighboring pair is as far apart as possible —
 * slot order is the color-vision safety mechanism, not decoration. Verified
 * with the palette validator against this app's panel surface (#141826):
 *
 *   lightness band       all 20 inside L 0.48–0.67
 *   chroma floor         all 20 >= 0.1 (none read as gray)
 *   CVD separation       worst adjacent ΔE 14.9 (deutan), 13.1 (tritan) — target 8
 *   normal-vision floor  worst adjacent ΔE 27.9 — target 15
 *   contrast vs surface  three slots sit just under 3:1
 *
 * Lightness is what carries the separation past eight colors: color-blind
 * vision collapses hue onto roughly one axis, so hue alone cannot separate
 * twenty. That is also why the tiers matter more than the hues here.
 *
 * The sub-3:1 contrast warning is relieved the way the palette documents it —
 * every player is direct-labeled with a number and name in the HUD, on the
 * marble, in the chart rug and in the results table, so nothing rests on color.
 */
export interface PlayerColor {
  /** Human-readable name — the non-visual identity channel. */
  readonly label: string
  readonly hex: string
}

export const PLAYER_COLORS: readonly PlayerColor[] = [
  { label: 'Gold', hex: '#9c7d18' },
  { label: 'Navy', hex: '#3e54c0' },
  { label: 'Coral', hex: '#e7614f' },
  { label: 'Blue', hex: '#5b77e5' },
  { label: 'Brick', hex: '#ad291c' },
  { label: 'Emerald', hex: '#23ad55' },
  { label: 'Magenta', hex: '#b754b0' },
  { label: 'Pine', hex: '#127437' },
  { label: 'Orchid', hex: '#c966c2' },
  { label: 'Forest', hex: '#178741' },
  { label: 'Mulberry', hex: '#93328e' },
  { label: 'Green', hex: '#1c9a4b' },
  { label: 'Plum', hex: '#a5439f' },
  { label: 'Amber', hex: '#b08d1c' },
  { label: 'Indigo', hex: '#4c65d2' },
  { label: 'Orange', hex: '#d34f3e' },
  { label: 'Teal', hex: '#209fb2' },
  { label: 'Rust', hex: '#c03d2e' },
  { label: 'Periwinkle', hex: '#6a88f8' },
  { label: 'Bronze', hex: '#896d13' },
]

/** The roster can't outgrow the palette: every player gets their own color. */
export const MAX_PLAYERS = PLAYER_COLORS.length
export const MIN_PLAYERS = 2

export function colorForSlot(slot: number): PlayerColor {
  return PLAYER_COLORS[slot % PLAYER_COLORS.length]
}
