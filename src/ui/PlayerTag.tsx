import { colorForSlot } from '../game/palette'
import type { Player } from '../game/types'

/**
 * A player's colour, on its own.
 *
 * This used to carry a slot number as a second identity channel, from when the
 * palette repeated after eight players. The palette now holds twenty distinct,
 * colour-vision-checked colours, so the number was an arbitrary index that meant
 * nothing to anyone reading it. Where a mark genuinely needs a text label, the
 * ticker symbol is the one that means something.
 */
export function PlayerDot({ player }: { player: Player }) {
  return (
    <span
      className="chip"
      style={{ background: colorForSlot(player.slot).hex }}
      aria-hidden="true"
    />
  )
}

/** Dot plus name, the usual inline reference to a player. */
export function PlayerName({ player }: { player: Player }) {
  return (
    <>
      <PlayerDot player={player} />
      {player.name}
    </>
  )
}
