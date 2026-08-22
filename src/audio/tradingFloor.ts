/**
 * The floor, synthesised.
 *
 * No audio file. A trading floor is a room full of overlapping voices, and a
 * room full of voices is what noise sounds like once it is band-passed around
 * the frequencies speech lives in and swelled by a slow, uneven envelope. Shouts
 * go on top as short louder bursts, pitched and panned differently every time so
 * no two are the same, because a repeating sound is the thing an ear picks out
 * of a background and then cannot stop hearing.
 *
 * Generating it costs a few hundred lines of arithmetic once. A recording would
 * cost a licence, a megabyte over the wire, and a fetch that can fail — for a
 * sound this app renders the same way it renders its backdrop.
 *
 * The whole floor hangs off one gain of its own, so opening and closing it is a
 * fade rather than a switch, and nothing ever clicks.
 */
import { audioDevice } from './context'

/** Peak master level. A background, not a feature. */
const FULL_VOLUME = 0.5
/** Fades, in seconds. Long enough that neither end is a click. */
const FADE_IN = 1.2
const FADE_OUT = 0.7
/** Seconds of noise to generate and loop. Prime-ish, so seams don't line up. */
const NOISE_SECONDS = 7

/** Vowels live around here; three bands is enough to read as voices. */
const FORMANTS = [
  { frequency: 420, q: 0.9, gain: 1 },
  { frequency: 900, q: 1.1, gain: 0.75 },
  { frequency: 1900, q: 1.4, gain: 0.4 },
]

/** How far apart shouts fall, in seconds. */
const SHOUT_GAP = { min: 0.55, max: 2.4 }

interface Floor {
  readonly context: AudioContext
  readonly master: GainNode
  readonly sources: readonly AudioScheduledSourceNode[]
  readonly noise: AudioBuffer
  /** Timer for the next scheduled shout. */
  shoutTimer: number | null
  closing: boolean
}

let floor: Floor | null = null

/**
 * Brown-ish noise: white noise through a one-pole lowpass, which rolls off the
 * hiss and leaves something that sounds like a room rather than a radio.
 *
 * Exported so its level and tilt can be asserted. Both failures here are silent
 * ones to a reader — a buffer that comes out empty, or one loud enough to clip —
 * and neither shows up anywhere except in a listener's ears.
 */
export function noiseBuffer(context: Pick<AudioContext, 'sampleRate' | 'createBuffer'>): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * NOISE_SECONDS), context.sampleRate)
  const samples = buffer.getChannelData(0)

  let last = 0
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.035 * white) / 1.035
    // Some of the white back in, or it is all rumble and no consonants.
    samples[i] = last * 3.2 + white * 0.12
    peak = Math.max(peak, Math.abs(samples[i]))
  }

  /*
   * Normalised rather than scaled by a constant.
   *
   * The lowpass above is a leaky integrator, so the signal is a random walk and
   * its largest excursion is a matter of luck: a fixed multiplier sometimes came
   * out over full scale, which clips, and sometimes well under, which makes the
   * ambience quieter on one page load than the next for no reason. Measuring the
   * peak fixes both — the level below is then the only thing that sets loudness.
   */
  const headroom = 0.9
  if (peak > 0) {
    for (let i = 0; i < samples.length; i++) samples[i] *= headroom / peak
  }
  return buffer
}

function looping(context: AudioContext, noise: AudioBuffer, rate = 1): AudioBufferSourceNode {
  const source = context.createBufferSource()
  source.buffer = noise
  source.loop = true
  source.playbackRate.value = rate
  // Start somewhere random, so two sources built together aren't in step.
  source.start(0, Math.random() * noise.duration)
  return source
}

/**
 * The murmur: the whole room at once.
 *
 * A constant band of noise reads as rain. What makes it a crowd is that it
 * breathes — so a second, heavily filtered noise source drives the gain, adding
 * a slow random wander to a steady floor level.
 */
function buildMurmur(
  context: AudioContext,
  noise: AudioBuffer,
  destination: AudioNode,
): AudioBufferSourceNode[] {
  const voices = looping(context, noise)
  const swell = context.createGain()
  swell.gain.value = 0.62

  for (const formant of FORMANTS) {
    const band = context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = formant.frequency
    band.Q.value = formant.q

    const level = context.createGain()
    level.gain.value = formant.gain

    voices.connect(band).connect(level).connect(swell)
  }

  // The wander. Sub-audio-rate noise, summed onto the gain above.
  const wander = looping(context, noise, 0.06)
  const slow = context.createBiquadFilter()
  slow.type = 'lowpass'
  slow.frequency.value = 1.6
  const depth = context.createGain()
  depth.gain.value = 0.38
  wander.connect(slow).connect(depth).connect(swell.gain)

  swell.connect(destination)
  return [voices, wander]
}

/** One shout, somewhere in the room, at time `at`. */
function scheduleShout(active: Floor, at: number): void {
  const { context, noise } = active
  const length = 0.18 + Math.random() * 0.34

  const source = context.createBufferSource()
  source.buffer = noise
  source.playbackRate.value = 0.7 + Math.random() * 0.7

  // A shout starts high and falls: that drop is most of what makes it read as a
  // voice raised rather than a burst of static.
  const band = context.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 2.6 + Math.random() * 2
  const top = 780 + Math.random() * 620
  band.frequency.setValueAtTime(top, at)
  band.frequency.exponentialRampToValueAtTime(top * 0.55, at + length)

  const level = context.createGain()
  const peak = 0.12 + Math.random() * 0.16
  level.gain.setValueAtTime(0.0001, at)
  level.gain.linearRampToValueAtTime(peak, at + 0.05)
  level.gain.exponentialRampToValueAtTime(0.0001, at + length)

  const place = context.createStereoPanner()
  place.pan.value = Math.random() * 1.7 - 0.85

  source.connect(band).connect(level).connect(place).connect(active.master)
  source.start(at, Math.random() * (noise.duration - length), length)
  source.onended = () => place.disconnect()
}

/** Keeps shouts coming at uneven intervals for as long as the floor is open. */
function keepShouting(active: Floor): void {
  const { min, max } = SHOUT_GAP
  const gap = min + Math.random() * (max - min)

  active.shoutTimer = window.setTimeout(() => {
    if (floor !== active || active.closing) return
    scheduleShout(active, active.context.currentTime + 0.02)
    keepShouting(active)
  }, gap * 1000)
}

/**
 * Opens the floor, building it on first use.
 *
 * Deliberately lazy: constructing an `AudioContext` before the page has been
 * clicked leaves it suspended and logs a warning, so nothing is built until a
 * round actually starts — which is always a click or a keypress away.
 */
export function openFloor(): void {
  if (floor && !floor.closing) return
  if (floor) closeFloorNow()

  const device = audioDevice()
  if (!device) return
  const { context } = device

  const master = context.createGain()
  master.gain.value = 0.0001
  master.connect(device.output)

  const noise = noiseBuffer(context)
  const sources = buildMurmur(context, noise, master)
  floor = { context, master, sources, noise, shoutTimer: null, closing: false }

  master.gain.setValueAtTime(0.0001, context.currentTime)
  master.gain.exponentialRampToValueAtTime(FULL_VOLUME, context.currentTime + FADE_IN)

  keepShouting(floor)
}

/** Fades the floor out and releases the audio device. */
export function closeFloor(): void {
  const active = floor
  if (!active || active.closing) return

  active.closing = true
  if (active.shoutTimer !== null) window.clearTimeout(active.shoutTimer)

  const { context, master } = active
  const now = context.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
  master.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT)

  window.setTimeout(
    () => {
      if (floor === active) closeFloorNow()
    },
    FADE_OUT * 1000 + 80,
  )
}

function closeFloorNow(): void {
  const active = floor
  if (!active) return
  floor = null

  if (active.shoutTimer !== null) window.clearTimeout(active.shoutTimer)
  for (const source of active.sources) {
    try {
      source.stop()
    } catch {
      // Already stopped; nothing to do.
    }
  }
  // The device is shared with the plinks and the bell, so only the floor's own
  // chain comes down here.
  active.master.disconnect()
}
