import { describe, expect, it } from 'vitest'
import { pickAfterTap, popupLeft } from './chartPick'

describe('tapping a mark', () => {
  it('opens the popup on the mark that was tapped', () => {
    expect(pickAfterTap(null, 7)).toBe(7)
  })

  it('closes it when the same mark is tapped again', () => {
    expect(pickAfterTap(7, 7)).toBe(null)
  })

  it('switches across when another mark is tapped', () => {
    expect(pickAfterTap(7, 8)).toBe(8)
  })

  it('works the same for the charts keyed by player', () => {
    expect(pickAfterTap<string>(null, 'p3')).toBe('p3')
    expect(pickAfterTap('p3', 'p3')).toBe(null)
    expect(pickAfterTap('p3', 'p4')).toBe('p4')
  })
})

describe('placing the popup', () => {
  // A 100px popup in a 560px plot: the desk case, where there is room to spare.
  it('centers on the mark when it fits', () => {
    expect(popupLeft(280, 100, 560)).toBe(230)
  })

  it('stops at the left edge rather than hanging off it', () => {
    expect(popupLeft(10, 100, 560)).toBe(0)
  })

  it('stops at the right edge rather than hanging off it', () => {
    expect(popupLeft(550, 100, 560)).toBe(460)
  })

  it('touches an edge exactly when the mark is half a popup in', () => {
    expect(popupLeft(50, 100, 560)).toBe(0)
    expect(popupLeft(510, 100, 560)).toBe(460)
  })

  // A phone: 340px of plot, and a popup carrying three names.
  it('keeps a wide popup inside a narrow plot', () => {
    expect(popupLeft(320, 220, 340)).toBe(120)
    expect(popupLeft(20, 220, 340)).toBe(0)
  })

  it('gives up at the left edge when nothing would fit', () => {
    expect(popupLeft(200, 400, 340)).toBe(0)
  })
})
