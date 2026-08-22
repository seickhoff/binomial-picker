import type { Mode, Phase } from '../game/types'

/**
 * Whether the trading floor should be audible.
 *
 * Policy, kept apart from the synthesiser that carries it out, and pure so the
 * rule can be read and tested without an audio device.
 *
 * The floor is open while a Stock Market drop is live. It shuts at the results,
 * because the market has closed and there is a table to read, and it never opens
 * in Black Swan, which has no trading floor to stand on.
 */
export function isFloorOpen(mode: Mode, phase: Phase, enabled: boolean): boolean {
  return enabled && mode === 'stock' && phase === 'running'
}

/**
 * Whether the session has just closed, which is what the closing bell marks.
 *
 * The results phase is exactly that moment: the last marble has landed and the
 * prices are final.
 */
export function isMarketClosed(mode: Mode, phase: Phase, enabled: boolean): boolean {
  return enabled && mode === 'stock' && phase === 'results'
}
