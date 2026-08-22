/**
 * The one audio device, and the one place anything can be silenced.
 *
 * Every sound in the app — the floor, the plinks, the bell — hangs off the same
 * master gain, so muting is a single ramp rather than a message to each voice,
 * and nothing can be left playing by a source that forgot to check.
 *
 * Built lazily: constructing an `AudioContext` before the page has been clicked
 * leaves it suspended and logs a warning, and every sound here follows a click
 * or a keypress.
 */

/** Master level, before each source's own gain. */
const FULL_VOLUME = 0.9
/** Long enough not to click, short enough that "mute" feels immediate. */
const MUTE_RAMP = 0.12

interface Device {
  readonly context: AudioContext
  readonly output: GainNode
}

let device: Device | null = null
let muted = false

/**
 * The shared context and the node to connect to, or null where Web Audio is
 * unavailable or refused — in which case the game simply runs silent.
 */
export function audioDevice(): Device | null {
  if (device) return device
  if (typeof AudioContext === 'undefined') return null

  try {
    const context = new AudioContext()
    const output = context.createGain()
    output.gain.value = muted ? 0.0001 : FULL_VOLUME
    output.connect(context.destination)
    device = { context, output }
  } catch {
    return null
  }

  void device.context.resume()
  return device
}

/** Silences everything at once, or brings it back. */
export function setMuted(next: boolean): void {
  muted = next
  // Remembered even with no device yet, so a mute set before the first sound
  // still applies to it.
  if (!device) return

  const { context, output } = device
  const now = context.currentTime
  output.gain.cancelScheduledValues(now)
  output.gain.setValueAtTime(Math.max(output.gain.value, 0.0001), now)
  output.gain.linearRampToValueAtTime(muted ? 0.0001 : FULL_VOLUME, now + MUTE_RAMP)
}

/** Suspends the device — for a backgrounded tab, which should be silent. */
export function holdAudio(hold: boolean): void {
  if (!device) return
  void (hold ? device.context.suspend() : device.context.resume())
}
