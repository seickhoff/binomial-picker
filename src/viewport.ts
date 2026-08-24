import { useEffect, useState } from 'react'

/**
 * When the layout has to work as a phone's rather than a desk's.
 *
 * Width is the obvious half: under 700px there is no room for a card beside the
 * board, so the panels stop being cards. Height is the other half, and it is what
 * catches a phone held sideways — 844 × 390 passes a width test comfortably and
 * fails every other one, because there the setup card's problem is that it has
 * nowhere to be tall.
 *
 * At the top level rather than inside `ui/`, because the scene asks the same
 * question: on a phone the marbles' name tags carry a ticker symbol instead of a
 * name and a price, and `three/` cannot reach into the panels' own modules.
 */
export const COMPACT_MAX_WIDTH = 700
export const COMPACT_MAX_HEIGHT = 500

/**
 * The stylesheet's half of the same question — kept as one definition, since a
 * media query cannot be shared between a stylesheet and a module and the two
 * disagreeing by a pixel is a layout that half-applies.
 *
 * The "Compact layout" block in styles.css spells out the same numbers, and says
 * so.
 */
export const COMPACT_LAYOUT = `(max-width: ${COMPACT_MAX_WIDTH}px), (max-height: ${COMPACT_MAX_HEIGHT}px)`

/** The same test, for a caller that already knows its size — the canvas does. */
export function isCompact(width: number, height: number): boolean {
  return width <= COMPACT_MAX_WIDTH || height <= COMPACT_MAX_HEIGHT
}

/** True while the viewport is one the compact layout is meant for. */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_LAYOUT).matches)

  useEffect(() => {
    const query = window.matchMedia(COMPACT_LAYOUT)
    const onChange = () => setCompact(query.matches)

    // Read once on the way in as well: the answer can have changed between the
    // first render and this effect — a rotation, or a window still settling.
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return compact
}
