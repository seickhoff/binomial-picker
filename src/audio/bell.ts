/**
 * The bell that opens and closes the session.
 *
 * Synthesised, not sampled: there is no audio file in this repo, and a recording
 * of the real thing belongs to whoever recorded it. A bell is one of the few
 * sounds easier to build than to license, because what makes it a bell is
 * entirely in the numbers — its partials are *inharmonic*, sitting at ratios like
 * 2.76 and 5.40 rather than 2 and 3, and the high ones die away first. That is
 * why a bell starts as a clang and settles into a hum, where a plain stack of
 * harmonics just sounds like an organ.
 *
 * The other half of the impression is the rhythm. The bell on a trading floor is
 * a brass hand bell rung hard and fast, so what you hear is a dozen strikes
 * piling onto each other's ringing, not one clean stroke. Striking it repeatedly
 * with a little jitter in the timing does more for the likeness than any amount
 * of work on a single strike.
 *
 * To use a real recording instead: decode it into an `AudioBuffer` and play it
 * through the shared output in `ringBell`. Everything else here can go.
 */
import { audioDevice } from './context'

/**
 * Partial ratios of a struck bell, with each one's share of the level and how
 * long it lasts relative to the whole. Measured ratios for tuned bells cluster
 * around these; the hum an octave below the strike note is what gives the tail
 * its weight.
 */
const PARTIALS = [
  { ratio: 0.5, share: 0.5, decay: 1 },
  { ratio: 1, share: 1, decay: 0.85 },
  { ratio: 2.02, share: 0.55, decay: 0.5 },
  { ratio: 2.76, share: 0.45, decay: 0.33 },
  { ratio: 4.06, share: 0.3, decay: 0.22 },
  { ratio: 5.4, share: 0.22, decay: 0.15 },
  { ratio: 6.8, share: 0.14, decay: 0.1 },
]

/**
 * Strike note: F♯, because that is what the real bell rings.
 *
 * F♯5 — 739.99Hz in equal temperament — which keeps the register a hand bell has
 * over a crowd rather than a cathedral's. Every partial below is a ratio of this
 * one number, so the whole bell transposes together if the octave is ever wrong.
 */
const PITCH = 739.99
/** How long one strike rings on, in seconds. */
const RING = 1.5
/**
 * Level of a single strike.
 *
 * Low, because a dozen of them overlap: the ring of the last is still sounding
 * when the next lands, and that build-up is the sound. Set per-strike as if it
 * were alone and the sum clips.
 */
const STRIKE_LEVEL = 0.15

interface Ring {
  /** Strikes in the flurry. */
  readonly strikes: number
  /** Seconds between them, before jitter. */
  readonly gap: number
}

/** Rung to open the session: a long, insistent flurry. */
const OPENING: Ring = { strikes: 11, gap: 0.23 }
/**
 * Rung to close it: the same bell, a little shorter and slower.
 *
 * It is the same bell in real life too — only the moment differs — so the sound
 * is not disguised into a second instrument. The shorter flurry is enough to
 * tell them apart when both are heard in one round.
 */
const CLOSING: Ring = { strikes: 7, gap: 0.28 }

export function ringOpeningBell(): void {
  ringBell(OPENING)
}

export function ringClosingBell(): void {
  ringBell(CLOSING)
}

function ringBell({ strikes, gap }: Ring): void {
  const device = audioDevice()
  if (!device) return

  const { context, output } = device
  const start = context.currentTime + 0.02

  const body = context.createGain()
  body.gain.value = 1
  body.connect(output)

  let at = start
  for (let i = 0; i < strikes; i++) {
    // Hand-rung, so the spacing wanders and no two strikes are the same weight.
    strike(context, body, at, 0.75 + Math.random() * 0.45)
    at += gap * (0.82 + Math.random() * 0.36)
  }

  const done = at + RING + 0.2
  window.setTimeout(() => body.disconnect(), (done - start) * 1000)
}

/** One stroke of the clapper, at `at`, at `weight` of full level. */
function strike(context: AudioContext, destination: AudioNode, at: number, weight: number): void {
  const level = context.createGain()
  level.gain.value = STRIKE_LEVEL * weight
  level.connect(destination)

  // The clapper catches the bell slightly differently every stroke, which moves
  // the pitch a few cents. Without this the flurry rings like a machine.
  const pitch = PITCH * (1 + (Math.random() - 0.5) * 0.012)

  for (const { ratio, share, decay } of PARTIALS) {
    const tone = context.createOscillator()
    tone.type = 'sine'
    tone.frequency.value = pitch * ratio

    const envelope = context.createGain()
    const length = RING * decay
    envelope.gain.setValueAtTime(0.0001, at)
    // Not a step: a bell takes a few milliseconds to speak, and jumping the gain
    // puts a click on the front of every partial.
    envelope.gain.linearRampToValueAtTime(share, at + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length)

    tone.connect(envelope).connect(level)
    tone.start(at)
    tone.stop(at + length)
  }

  addClapper(context, level, at)
}

/** The clapper itself: metal hit, gone in a twentieth of a second. */
function addClapper(context: AudioContext, destination: AudioNode, at: number): void {
  const length = 0.05
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) {
    // Fades across the burst, so it reads as a strike rather than a hiss.
    samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length)
  }

  const source = context.createBufferSource()
  source.buffer = buffer

  const edge = context.createBiquadFilter()
  edge.type = 'bandpass'
  edge.frequency.value = PITCH * 3.4
  edge.Q.value = 0.8

  const level = context.createGain()
  level.gain.value = 0.45

  source.connect(edge).connect(level).connect(destination)
  source.start(at)
}
