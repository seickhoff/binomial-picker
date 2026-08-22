/**
 * A marble striking a peg.
 *
 * The peg's index is the only thing a strike reports, and it turns out to carry
 * everything a voice needs. Pegs are numbered along a triangle — row 0 has one,
 * row 1 has two — so the row and the position across that row both fall straight
 * out of the arithmetic, with no need to hand the board's geometry to a
 * synthesiser.
 *
 * Position across the row sets both pitch and stereo placement, so a marble
 * drifting right rings higher and further right. In Stock Market mode that means
 * the sound follows the price: a stock climbing plays up the scale.
 *
 * The notes are a major pentatonic, which has no semitone in it. On a busy board
 * dozens of these land within a second of each other, and any scale with a
 * semitone turns that into a cluster; a pentatonic stays consonant however many
 * marbles are falling.
 */
import { audioDevice } from './context'

/** Semitones above the root, per octave of the scale. */
const PENTATONIC = [0, 2, 4, 7, 9]
/** The middle of the board rings here, in Hz. Exported so tests needn't guess. */
export const CENTRE_PITCH = 1760
/** Notes either side of centre. Eleven covers the widest board. */
const HALF_RANGE = 5

/**
 * The modes of a small struck piece of metal, as ratios of the strike note, with
 * each one's share of the level and how long it lasts relative to the whole.
 *
 * This is what makes it sound like metal. A stack of whole-number harmonics —
 * which is what it was — is a tuned pitch, the sound of a string or a pipe. Metal
 * bars and plates ring *inharmonically*, at ratios like 2.76 and 5.40, and those
 * upper modes die away much faster than the fundamental: that combination is the
 * chink at the front and the short ring after it.
 *
 * The next mode up sits at 8.93, which at this pitch is 15.7kHz — above where it
 * would be heard, so it is left out rather than synthesised for nobody.
 */
const MODES = [
  { ratio: 1, share: 1, decay: 1 },
  { ratio: 2.76, share: 0.5, decay: 0.4 },
  { ratio: 5.4, share: 0.26, decay: 0.16 },
]

/** How long a plink rings, in seconds. */
const DECAY = { min: 0.12, max: 0.22 }
/** Level of one voice, before the master gain. */
const VOICE_GAIN = 0.15
/**
 * The most voices allowed to overlap, and the closest two may start.
 *
 * Twenty marbles crossing twenty-four rows is a few hundred strikes inside ten
 * seconds, arriving in clumps as the field crosses a row together. Without a cap
 * that is a wall of noise that also clips; with one it stays a shower of taps.
 * Two strikes 20ms apart are one sound to an ear anyway.
 */
const MAX_VOICES = 14
const MIN_GAP = 0.02

let voices = 0
let lastStrike = -1

/** Which row a peg is in, from its index alone: the triangular numbers. */
export function rowOfPeg(index: number): number {
  return Math.floor((Math.sqrt(8 * index + 1) - 1) / 2)
}

/**
 * The note and the placement for a peg.
 *
 * `offset` is how far the peg sits from its row's centre, in peg spaces, so it is
 * negative on the left and positive on the right, and ±row/2 at the edges.
 */
export function voiceForPeg(index: number): { frequency: number; pan: number } {
  const row = rowOfPeg(index)
  const offset = index - (row * (row + 1)) / 2 - row / 2

  const step = Math.max(-HALF_RANGE, Math.min(HALF_RANGE, Math.round(offset)))
  // Steps below the root wrap to the top of the scale an octave down, which is
  // what makes the pattern continue rather than stop at the root.
  const octave = Math.floor(step / PENTATONIC.length)
  const degree = ((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
  const semitones = PENTATONIC[degree] + octave * 12

  return {
    frequency: CENTRE_PITCH * 2 ** (semitones / 12),
    // Divided by the row's own width, and never by less than four, so the top
    // rows — which are two or three pegs wide — don't slam hard to one side.
    pan: Math.max(-0.85, Math.min(0.85, offset / Math.max(4, row))),
  }
}

/**
 * Rings the peg at `index`, if there is room in the mix for it.
 *
 * Called for every strike, which is far more often than a sound should be made,
 * so this is the throttle as much as it is the synthesiser.
 */
export function plinkPeg(index: number): void {
  if (index < 0) return
  const device = audioDevice()
  if (!device) return

  const { context, output } = device
  const now = context.currentTime
  // A suspended tab can leave voices that never report finishing, so a quiet
  // second is taken as proof the mix is empty.
  if (now - lastStrike > 1) voices = 0
  if (voices >= MAX_VOICES || now - lastStrike < MIN_GAP) return
  lastStrike = now

  const { frequency, pan } = voiceForPeg(index)
  const length = DECAY.min + Math.random() * (DECAY.max - DECAY.min)

  // Detuned a touch per strike, so the same peg twice running isn't the
  // identical sound.
  const detune = 1 + (Math.random() - 0.5) * 0.012
  const body = context.createGain()
  body.gain.value = VOICE_GAIN

  const place = context.createStereoPanner()
  place.pan.value = pan
  body.connect(place).connect(output)

  const partials: OscillatorNode[] = []
  for (const { ratio, share, decay } of MODES) {
    const tone = context.createOscillator()
    tone.type = 'sine'
    tone.frequency.value = frequency * ratio * detune

    const level = context.createGain()
    level.gain.setValueAtTime(share, now)
    level.gain.exponentialRampToValueAtTime(0.0001, now + length * decay)

    tone.connect(level).connect(body)
    tone.start(now)
    tone.stop(now + length)
    partials.push(tone)
  }

  addTick(context, body, now)

  voices += 1
  partials[0].onended = () => {
    voices -= 1
    place.disconnect()
  }
}

/**
 * The contact itself: marble meeting metal, before any of the metal rings.
 *
 * A few milliseconds of noise up where the ear hears brightness. Without it the
 * modes above are three sine waves fading — recognisably a bell, and never quite
 * the sound of something being *hit*.
 */
function addTick(context: AudioContext, destination: AudioNode, at: number): void {
  const source = context.createBufferSource()
  source.buffer = tickBuffer(context)
  // Varies which few milliseconds of noise get used, so the attack isn't a
  // recording of itself on every strike.
  source.playbackRate.value = 0.85 + Math.random() * 0.5

  const bright = context.createBiquadFilter()
  bright.type = 'bandpass'
  bright.frequency.value = 5200
  bright.Q.value = 0.7

  const level = context.createGain()
  level.gain.value = 0.5

  source.connect(bright).connect(level).connect(destination)
  source.start(at)
}

/**
 * The tick's noise, built once per device rather than per strike.
 *
 * Fifty of these a second, each allocating its own buffer, is garbage for the
 * collector to chase during the busiest moment on screen.
 */
let tick: { context: AudioContext; buffer: AudioBuffer } | null = null

function tickBuffer(context: AudioContext): AudioBuffer {
  if (tick?.context === context) return tick.buffer

  const length = 0.012
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) {
    // Squared fade, so the burst is over almost before it starts.
    const fade = 1 - i / samples.length
    samples[i] = (Math.random() * 2 - 1) * fade * fade
  }

  tick = { context, buffer }
  return buffer
}
