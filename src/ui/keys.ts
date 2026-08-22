/**
 * Which keystrokes belong to the app and which belong to the focused control.
 *
 * Pure, and its own module rather than a helper inside `App`, so the rules can be
 * checked without loading a 3D scene to do it.
 */

/** Fields where a keystroke is text being typed, not a shortcut. */
export function typing(target: HTMLElement | null): boolean {
  if (!target) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

/**
 * Whether the focused control has a better claim on the space bar than the
 * camera does.
 *
 * Almost nothing has. A text field needs a literal space. A checkbox or radio is
 * *toggled* by one and, unlike a button, has no second key that does the same
 * job — taking space from those would strand them for anyone working by keyboard.
 * A select opens its list with it.
 *
 * Everything else — a slider, a button, the page itself — either ignores space or
 * answers to Enter as well, so the camera can have it. The row slider is the case
 * that prompted this: it is an `input`, and a blanket rule about inputs meant
 * holding space just after setting the row count did nothing at all.
 */
export function ownsSpace(target: HTMLElement | null): boolean {
  if (!target) return false
  if (target.isContentEditable) return true
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true
  if (target.tagName !== 'INPUT') return false
  return (target as HTMLInputElement).type !== 'range'
}
