/**
 * Peg impact flashes, as one shared buffer of 0…1 intensities.
 *
 * The marbles write into it and the board reads it once per frame to nudge
 * material uniforms. Keeping it out of React state means a busy board — up to
 * 300 pegs and twenty marbles — never triggers a re-render.
 *
 * A strike is also announced to anyone who has asked, which is how it reaches the
 * speakers. The alternative was for the marbles to call the synthesiser directly,
 * and a marble has no business knowing that sound exists: it hits a peg and says
 * so, and the board lighting up and the plink are both just consequences.
 */
let bank = new Float32Array(0)

type StrikeListener = (index: number) => void
const listeners = new Set<StrikeListener>()

/** Listens for peg strikes. Returns the unsubscribe. */
export function onPegStrike(listener: StrikeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resizeFlashBank(size: number): Float32Array {
  if (bank.length !== size) bank = new Float32Array(size)
  return bank
}

export function flashBank(): Float32Array {
  return bank
}

export function flashPeg(index: number): void {
  if (index < 0) return
  // The bank is sized by the board, which may not have mounted yet; a strike is
  // still worth announcing when there is nowhere to record it.
  if (index < bank.length) bank[index] = 1
  for (const listener of listeners) listener(index)
}
