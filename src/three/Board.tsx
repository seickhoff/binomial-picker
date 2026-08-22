import type { BoardGeometry } from '../game/geometry'
import type { Landing, Mode, Player } from '../game/types'
import { BackPanel, BinBounceLight, Cabinet } from './board/Cabinet'
import { BinLights, ExpectedProfile, SlotLabels } from './board/Bins'
import { Pegs } from './board/Pegs'

export interface BoardProps {
  geo: BoardGeometry
  landings: readonly Landing[]
  players: readonly Player[]
  winnerBins: readonly number[]
  /** Bloom, shadows and the bin bounce light. */
  fancy: boolean
  mode: Mode
  /** Shared opening price for the slot ladder, or null if entrants differ. */
  openPrice: number | null
}

/** The whole device, back to front. */
export function Board({ geo, landings, players, winnerBins, fancy, mode, openPrice }: BoardProps) {
  return (
    <group>
      <BackPanel geo={geo} />
      <ExpectedProfile geo={geo} winnerBins={winnerBins} mode={mode} />
      <Cabinet geo={geo} />
      <Pegs geo={geo} />
      <BinLights geo={geo} landings={landings} players={players} winnerBins={winnerBins} />
      <SlotLabels geo={geo} mode={mode} openPrice={openPrice} winnerBins={winnerBins} />
      {fancy && <BinBounceLight geo={geo} />}
    </group>
  )
}
