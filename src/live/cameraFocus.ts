/**
 * Where the marbles are, for the camera to follow.
 *
 * Marbles publish their height here each frame and the camera rig reads it —
 * a plain module singleton rather than React state, because this changes every
 * frame and must never cause a re-render.
 */
const heights = new Map<string, number>()

export function reportMarbleY(id: string, y: number): void {
  heights.set(id, y)
}

export function dropMarbleFocus(id: string): void {
  heights.delete(id)
}

export function clearMarbleFocus(): void {
  heights.clear()
}

export interface MarbleFocus {
  /** The lowest marble — the one leading the way down. */
  readonly leadY: number
  readonly meanY: number
  readonly count: number
}

export function marbleFocus(): MarbleFocus | null {
  if (heights.size === 0) return null
  let leadY = Number.POSITIVE_INFINITY
  let sum = 0
  for (const y of heights.values()) {
    if (y < leadY) leadY = y
    sum += y
  }
  return { leadY, meanY: sum / heights.size, count: heights.size }
}
