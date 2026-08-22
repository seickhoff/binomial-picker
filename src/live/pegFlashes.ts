/**
 * Peg impact flashes, as one shared buffer of 0…1 intensities.
 *
 * The marbles write into it and the board reads it once per frame to nudge
 * material uniforms. Keeping it out of React state means a busy board — up to
 * 136 pegs and eight marbles — never triggers a re-render.
 */
let bank = new Float32Array(0)

export function resizeFlashBank(size: number): Float32Array {
  if (bank.length !== size) bank = new Float32Array(size)
  return bank
}

export function flashBank(): Float32Array {
  return bank
}

export function flashPeg(index: number): void {
  if (index >= 0 && index < bank.length) bank[index] = 1
}
