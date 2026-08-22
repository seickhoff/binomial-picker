import { describe, expect, it } from 'vitest'
import { ownsSpace, typing } from './keys'

/** A stand-in for a focused element, with only the fields the rules read. */
function focused(tagName: string, type?: string, contentEditable = false) {
  return {
    tagName,
    type,
    isContentEditable: contentEditable,
  } as unknown as HTMLElement
}

describe('who gets the space bar', () => {
  it('gives it to the camera when nothing is focused', () => {
    expect(ownsSpace(null)).toBe(false)
    expect(ownsSpace(focused('BODY'))).toBe(false)
  })

  it('gives it to the camera from a slider', () => {
    // The case this rule exists for: setting the rows, then looking at the board.
    expect(ownsSpace(focused('INPUT', 'range'))).toBe(false)
  })

  it('gives it to the camera from a button, which answers to Enter as well', () => {
    expect(ownsSpace(focused('BUTTON'))).toBe(false)
  })

  it('leaves it to a text field, which needs a literal space', () => {
    for (const type of ['text', 'search', 'email', 'password']) {
      expect(ownsSpace(focused('INPUT', type)), type).toBe(true)
    }
    expect(ownsSpace(focused('TEXTAREA'))).toBe(true)
    expect(ownsSpace(focused('DIV', undefined, true))).toBe(true)
  })

  it('leaves it to a checkbox, which has no other key to toggle it', () => {
    expect(ownsSpace(focused('INPUT', 'checkbox'))).toBe(true)
    expect(ownsSpace(focused('INPUT', 'radio'))).toBe(true)
  })

  it('leaves it to a select, which opens its list with it', () => {
    expect(ownsSpace(focused('SELECT'))).toBe(true)
  })
})

describe('where a keystroke is text', () => {
  it('counts every kind of field a name could be typed into', () => {
    expect(typing(focused('INPUT', 'text'))).toBe(true)
    expect(typing(focused('TEXTAREA'))).toBe(true)
    expect(typing(focused('DIV', undefined, true))).toBe(true)
  })

  it('does not count the page, or a button on it', () => {
    expect(typing(null)).toBe(false)
    expect(typing(focused('BODY'))).toBe(false)
    expect(typing(focused('BUTTON'))).toBe(false)
  })
})
