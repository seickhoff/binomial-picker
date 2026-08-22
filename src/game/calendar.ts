/**
 * Trading days.
 *
 * Sessions are dated, and the day after a Friday session is Monday: a market is
 * shut at the weekend, and a placard reading "Day 2 — Saturday" would undo the
 * illusion the placards exist to build.
 *
 * Day 1 is today, whatever day today is, because that is the day you are
 * actually playing on. Only the days after it are moved.
 *
 * Holidays are deliberately not handled. Doing it properly means a table per
 * exchange per year, maintained forever, to move a label by one day a few times
 * a year — and a wrong holiday table is more conspicuous than no holiday table.
 */
const SUNDAY = 0
const SATURDAY = 6

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === SATURDAY || day === SUNDAY
}

/**
 * The date `sessions` trading days after `from`; zero gives `from` back.
 *
 * Copies rather than mutating: a `Date` handed in from the store is shared, and
 * `setDate` would move it under everyone else holding it.
 */
export function tradingDayAfter(from: Date, sessions: number): Date {
  const date = new Date(from.getTime())

  for (let session = 0; session < sessions; session++) {
    do {
      date.setDate(date.getDate() + 1)
    } while (isWeekend(date))
  }
  return date
}
