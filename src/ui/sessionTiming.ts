/**
 * How long a self-running series holds each screen.
 *
 * Its own module because two of these belong to two different components and to
 * the same decision. `useSessionFlow` runs the waits; the results card runs the
 * fade at the end of one of them. Read from one place, they are a rhythm; read
 * from two, the second is a magic number that drifts away from the first — and
 * the failure is invisible, a card that fades a beat after it has already been
 * replaced.
 *
 * Nothing is imported here, deliberately. This is the most stable thing in the
 * flow and everything else may depend on it freely.
 */

/** Placard time. A beat to read the day, and for the bell to get going. */
export const PLACARD_MS = 2400

/**
 * Summary time, before the next session opens itself.
 *
 * Long enough to read the card rather than to notice it: the verdict, the two
 * ends of the field, and a table of however many players were in it. Five
 * seconds was time to look at one of those.
 */
export const SUMMARY_MS = 8600

/**
 * The card's last moment, spent fading.
 *
 * Comes out of the summary rather than adding to it, so it ends exactly as the
 * next session opens — the card is gone by the time the placard is up, instead of
 * being cut off mid-sentence by it.
 */
export const SUMMARY_FADE_MS = 900
