import { describe, expect, it } from 'vitest'
import { noiseBuffer } from './tradingFloor'

const SAMPLE_RATE = 48_000

/**
 * Enough of an `AudioContext` to generate a buffer into. The synthesiser proper
 * needs a real audio device; the noise it is built out of is plain arithmetic.
 */
function stubContext() {
  return {
    sampleRate: SAMPLE_RATE,
    createBuffer(_channels: number, length: number, rate: number) {
      const data = new Float32Array(length)
      return {
        length,
        duration: length / rate,
        getChannelData: () => data,
      } as unknown as AudioBuffer
    },
  }
}

describe('the noise the floor is built from', () => {
  const samples = noiseBuffer(stubContext()).getChannelData(0)

  it('fills the whole buffer with finite samples', () => {
    expect(samples.length).toBeGreaterThan(SAMPLE_RATE)
    expect([...samples].every(Number.isFinite)).toBe(true)
  })

  it('is audible without clipping', () => {
    let peak = 0
    let sumOfSquares = 0
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample))
      sumOfSquares += sample * sample
    }
    const rms = Math.sqrt(sumOfSquares / samples.length)

    // Silence and a wall of clipping are the two ways this goes wrong, and
    // neither is visible in the code that generates it.
    expect(peak).toBeLessThanOrEqual(1)
    expect(rms).toBeGreaterThan(0.05)
    expect(rms).toBeLessThan(0.6)
  })

  it('leans low, the way a room does rather than a hiss', () => {
    // No FFT needed: differencing a signal emphasises its high frequencies, so a
    // spectrum tilted downward is one whose differences are the smaller of the
    // two. White noise would put this ratio near 1.4.
    let signal = 0
    let difference = 0
    for (let i = 1; i < samples.length; i++) {
      signal += Math.abs(samples[i])
      difference += Math.abs(samples[i] - samples[i - 1])
    }
    expect(difference / signal).toBeLessThan(0.9)
  })
})
