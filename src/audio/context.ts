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
/**
 * How long the device stays awake after the last sound.
 *
 * A running `AudioContext` wakes its thread every 128 samples — under three
 * milliseconds — whether or not anything is playing, which on a quiet results
 * screen is work for nothing and keeps a laptop out of its idle state. Suspending
 * hands the device back; the next sound resumes it, and resuming costs a few
 * milliseconds nobody can hear at the front of a plink.
 *
 * Longer than the longest tail here, so a bell is never cut off mid-ring.
 */
const IDLE_SLEEP_MS = 5000

interface Device {
  readonly context: AudioContext
  readonly output: GainNode
}

let device: Device | null = null
let muted = false
/** Continuous sources that must not be suspended under them. */
let sustained = 0
let sleepTimer: number | null = null

function armSleep(): void {
  if (sleepTimer !== null) window.clearTimeout(sleepTimer)
  sleepTimer = window.setTimeout(() => {
    sleepTimer = null
    // A held device has something playing that would simply stop.
    if (sustained > 0) return
    if (device?.context.state === 'running') void device.context.suspend()
  }, IDLE_SLEEP_MS)
}

/**
 * Keeps the device awake until the returned release is called.
 *
 * One-shot sounds — a plink, a bell — are covered by the idle timer, since they
 * are over long before it fires. A sound that runs indefinitely, like the floor,
 * has to say so, or it would be suspended halfway through.
 */
export function holdAwake(): () => void {
  sustained += 1
  let released = false

  return () => {
    if (released) return
    released = true
    sustained = Math.max(0, sustained - 1)
    armSleep()
  }
}

/**
 * The shared context and the node to connect to, or null where Web Audio is
 * unavailable or refused — in which case the game simply runs silent.
 */
export function audioDevice(): Device | null {
  if (device) {
    // Woken on demand: the device suspends itself when nothing has played for a
    // while, and every sound comes through here.
    if (device.context.state === 'suspended') void device.context.resume()
    armSleep()
    return device
  }
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
  armSleep()
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
