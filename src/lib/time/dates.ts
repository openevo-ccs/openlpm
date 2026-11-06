// Small UTC date helpers (no dependency). Dates are YYYY-MM-DD strings.

const DAY = 86400000

export function parseDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${s}`)
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

export function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function addDays(s: string, n: number): string {
  return formatDate(parseDate(s) + n * DAY)
}

/** 1 = Monday ... 7 = Sunday. */
export function weekdayOf(s: string): number {
  return ((new Date(parseDate(s)).getUTCDay() + 6) % 7) + 1
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / DAY)
}

/** Same month and day, n years later (29 February moves to 28 February in a common year). */
export function addYears(s: string, n: number): string {
  const d = new Date(parseDate(s))
  const y = d.getUTCFullYear() + n
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return formatDate(Date.UTC(y, m, Math.min(day, last)))
}
