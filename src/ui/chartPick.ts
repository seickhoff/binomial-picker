import { useState } from 'react'

/**
 * How a chart's popup is opened, and where it is allowed to sit.
 *
 * A mouse hovers and a finger taps, and the difference is not a detail: touch
 * fires the hover events too — `pointerenter` on the way down, `pointerleave` the
 * instant the finger lifts — so a popup driven by hover alone lived exactly as
 * long as the press. On a phone that is a popup you can never read.
 *
 * So hover belongs to the mouse alone, and a tap gets a pick of its own that
 * outlives the touch: tapping a mark opens it, tapping the same mark again closes
 * it, and tapping another switches across. Nothing here reads `:hover`, and
 * nothing depends on a `click` being synthesized from a tap — `pointerup` is the
 * event, which WebKit sends where the touch began however far the finger drifted,
 * and withholds in favor of `pointercancel` when the gesture turns into a scroll.
 */
type PointerLike = { readonly pointerType: string }

function isMouse(event: PointerLike): boolean {
  return event.pointerType === 'mouse'
}

/** What is showing after `key` is tapped, given what was showing before. */
export function pickAfterTap<K>(showing: K | null, key: K): K | null {
  return showing === key ? null : key
}

export interface PickHandlers {
  onPointerEnter: (event: PointerLike) => void
  onPointerLeave: (event: PointerLike) => void
  onPointerUp: (event: PointerLike) => void
}

/**
 * The mark a chart is currently showing a popup for, and the handlers to hang on
 * every mark that can be picked. `marks` is called with whatever identifies one —
 * a bin number here, a player id there — and compares them by identity.
 */
export function useChartPick<K>(): {
  picked: K | null
  marks: (key: K) => PickHandlers
} {
  const [picked, setPicked] = useState<K | null>(null)

  return {
    picked,
    marks: (key) => ({
      onPointerEnter: (event) => {
        if (isMouse(event)) setPicked(key)
      },
      onPointerLeave: (event) => {
        // Only the mouse takes the popup away with it. A finger has lifted by
        // now, and the whole point of the tap is that what it opened stays open.
        if (isMouse(event)) setPicked((current) => (current === key ? null : current))
      },
      onPointerUp: (event) => {
        if (!isMouse(event)) setPicked((current) => pickAfterTap(current, key))
      },
    }),
  }
}

/**
 * Where a popup of `width` sits inside a box `room` wide when it would rather be
 * centered on `anchor`. Both ends clamp, so a popup on the first bar or the last
 * is complete instead of half cut off by the edge of the card.
 *
 * A popup with no room to fit gives up and starts at the left edge: hanging off
 * one side is at least readable from the beginning, where hanging off both sides
 * loses the price at the start and the names at the end.
 */
export function popupLeft(anchor: number, width: number, room: number): number {
  if (width >= room) return 0
  return Math.min(Math.max(anchor - width / 2, 0), room - width)
}
