import { describe, expect, it } from 'vitest'
import { byName } from './store'
import { STORAGE_KEY, loadGame } from './testing'
import type { Player } from './types'

const player = (name: string, slot = 0): Player => ({
  id: `p${slot}`,
  slot,
  name,
  active: true,
})

const filed = (...names: string[]) =>
  names
    .map((name, i) => player(name, i))
    .sort(byName)
    .map((p) => p.name)

describe('filing the roster by name', () => {
  it('sorts alphabetically', () => {
    expect(filed('Scott C', 'Braden', 'Mariela', 'Camillo')).toEqual([
      'Braden',
      'Camillo',
      'Mariela',
      'Scott C',
    ])
  })

  it('ignores case, so one lower-case name is not exiled to the end', () => {
    expect(filed('braden', 'Camillo', 'Anna')).toEqual(['Anna', 'braden', 'Camillo'])
  })

  it('reads numbers as numbers', () => {
    // Compared as text, "Player 10" files between 1 and 2.
    expect(filed('Player 1', 'Player 10', 'Player 2', 'Player 9')).toEqual([
      'Player 1',
      'Player 2',
      'Player 9',
      'Player 10',
    ])
  })

  it('keeps two people of the same name in a settled order', () => {
    const first = player('Sam', 3)
    const second = player('Sam', 7)
    expect([second, first].sort(byName)).toEqual([first, second])
    expect([first, second].sort(byName)).toEqual([first, second])
  })
})

describe('the roster in the store', () => {
  it('files everyone when a name is finished', async () => {
    const { useGame } = await loadGame()
    const [a, b, c] = useGame.getState().players
    useGame.getState().renamePlayer(a.id, 'Zoe')
    useGame.getState().renamePlayer(b.id, 'Adam')
    useGame.getState().renamePlayer(c.id, 'Mia')

    // Untouched until asked: a name half-typed is not the name being filed.
    expect(
      useGame
        .getState()
        .players.map((p) => p.name)
        .slice(0, 3),
    ).toEqual(['Zoe', 'Adam', 'Mia'])

    useGame.getState().sortRoster()
    expect(useGame.getState().players.map((p) => p.name)).toEqual([
      'Adam',
      'Mia',
      'Player 4',
      'Zoe',
    ])
  })

  it('keeps every colour with its player', async () => {
    const { useGame } = await loadGame()
    const before = useGame.getState().players
    useGame.getState().renamePlayer(before[0].id, 'Zoe')
    useGame.getState().sortRoster()

    const after = useGame.getState().players
    expect(after).toHaveLength(before.length)
    for (const player of before) {
      const moved = after.find((p) => p.id === player.id)
      // Colour follows the slot, and the slot follows the person.
      expect(moved?.slot).toBe(player.slot)
    }
  })

  it('files a restored roster on the way in', async () => {
    const session = await loadGame()
    const [a, b] = session.useGame.getState().players
    session.useGame.getState().renamePlayer(a.id, 'Zoe')
    session.useGame.getState().renamePlayer(b.id, 'Adam')

    const reloaded = await loadGame(session.storage.get(STORAGE_KEY))
    const names = reloaded.useGame.getState().players.map((p) => p.name)
    expect(names[0]).toBe('Adam')
    expect(names[names.length - 1]).toBe('Zoe')
  })
})
