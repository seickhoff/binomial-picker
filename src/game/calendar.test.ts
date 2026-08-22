import { describe, expect, it } from 'vitest'
import { tradingDayAfter } from './calendar'

/** Local midnight, so nothing here depends on the machine's timezone offset. */
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day)
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

describe('dating a run of sessions', () => {
  it('leaves the first session on the day it is played', () => {
    const saturday = on(2026, 8, 22)
    expect(iso(tradingDayAfter(saturday, 0))).toBe('2026-08-22')
  })

  it('steps a day at a time through a week', () => {
    // Monday 24 August 2026.
    const monday = on(2026, 8, 24)
    expect([1, 2, 3, 4].map((n) => iso(tradingDayAfter(monday, n)))).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
    ])
  })

  it('jumps the weekend after a Friday', () => {
    const friday = on(2026, 8, 28)
    expect(iso(tradingDayAfter(friday, 1))).toBe('2026-08-31')
    expect(iso(tradingDayAfter(friday, 2))).toBe('2026-09-01')
  })

  it('never lands on a weekend, however long the series runs', () => {
    const start = on(2026, 8, 24)
    for (let session = 1; session <= 60; session++) {
      const date = tradingDayAfter(start, session)
      expect(date.getDay(), `session ${session + 1}`).not.toBe(0)
      expect(date.getDay(), `session ${session + 1}`).not.toBe(6)
    }
  })

  it('crosses months and years', () => {
    // Thursday 31 December 2026 into the new year.
    expect(iso(tradingDayAfter(on(2026, 12, 31), 1))).toBe('2027-01-01')
    expect(iso(tradingDayAfter(on(2026, 12, 31), 2))).toBe('2027-01-04')
  })

  it('leaves the date it was given alone', () => {
    const start = on(2026, 8, 24)
    tradingDayAfter(start, 10)
    expect(iso(start)).toBe('2026-08-24')
  })
})
