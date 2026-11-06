// Shared rules for every OpenLPM timeline drawn on a calendar axis (Dustin's
// timeline request, feedback 4c10c072; decisions in lab_manager/docs/design-
// notes/openlpm-timeline-standards-2026-10-29.md). Pure functions, no React,
// so the same rules can serve any dated view.
//
//   1. The whole range is always in view first, with no sideways page scroll.
//   2. A window (start and end) is what the person moves: zoom with the
//      buttons, Ctrl or Cmd plus the wheel, a pinch or a double click, pan by
//      dragging, and jump with the overview strip underneath.
//   3. The axis names itself: years when zoomed out, months and days when
//      zoomed in, with the larger unit shown above for context.
//   4. Items that overlap in a lane stack into rows, so nothing hides behind
//      something else.
//   5. Lanes are named on the left and keep their color meaning on every
//      timeline (one color per kind of source).

export const DAY_MS = 24 * 60 * 60 * 1000
export const YEAR_MS = 365.25 * DAY_MS
/** Smallest window the person can zoom into. */
export const MIN_WINDOW_MS = 14 * DAY_MS

export interface TimeWindow {
  start: number
  end: number
}

/** Keeps a window inside the full range and no smaller than the minimum. */
export function clampWindow(w: TimeWindow, full: TimeWindow): TimeWindow {
  const fullSpan = Math.max(1, full.end - full.start)
  const span = Math.min(fullSpan, Math.max(Math.min(MIN_WINDOW_MS, fullSpan), w.end - w.start))
  let start = w.start
  if (start < full.start) start = full.start
  if (start + span > full.end) start = full.end - span
  return { start, end: start + span }
}

/** Zooms by `factor` (above 1 zooms in) and keeps the time under `anchorFraction` (0 to 1) where it is. */
export function zoomWindow(w: TimeWindow, full: TimeWindow, factor: number, anchorFraction = 0.5): TimeWindow {
  const span = w.end - w.start
  const next = span / factor
  const anchor = w.start + span * anchorFraction
  return clampWindow({ start: anchor - next * anchorFraction, end: anchor + next * (1 - anchorFraction) }, full)
}

export function panWindow(w: TimeWindow, full: TimeWindow, deltaMs: number): TimeWindow {
  return clampWindow({ start: w.start + deltaMs, end: w.end + deltaMs }, full)
}

export function isFullWindow(w: TimeWindow, full: TimeWindow): boolean {
  return w.end - w.start >= (full.end - full.start) * 0.999
}

// ---- Rule 3: an axis that names itself -------------------------------------

export interface AxisTick {
  time: number
  label: string
  /** True for the ticks that start a larger unit (a new year, a new month). Drawn a little stronger. */
  major: boolean
}

type Unit = 'year' | 'month' | 'day'
interface Step { unit: Unit; n: number }

// Smallest step first. The axis picks the first step whose gap on screen is wide enough for its label.
const STEPS: Step[] = [
  { unit: 'day', n: 1 }, { unit: 'day', n: 7 },
  { unit: 'month', n: 1 }, { unit: 'month', n: 3 }, { unit: 'month', n: 6 },
  { unit: 'year', n: 1 }, { unit: 'year', n: 2 }, { unit: 'year', n: 5 }, { unit: 'year', n: 10 }, { unit: 'year', n: 20 }, { unit: 'year', n: 50 }, { unit: 'year', n: 100 },
]

const MIN_LABEL_GAP_PX = 58

function stepMs(s: Step): number {
  return s.unit === 'day' ? s.n * DAY_MS : s.unit === 'month' ? s.n * 30.44 * DAY_MS : s.n * YEAR_MS
}

function alignedStart(t: number, s: Step): Date {
  const d = new Date(t)
  if (s.unit === 'year') return new Date(Math.floor(d.getFullYear() / s.n) * s.n, 0, 1)
  if (s.unit === 'month') return new Date(d.getFullYear(), Math.floor(d.getMonth() / s.n) * s.n, 1)
  // A step of 7 days starts on a Monday, a step of 1 day on the day itself.
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (s.n === 7) { const back = (day.getDay() + 6) % 7; day.setDate(day.getDate() - back) }
  return day
}

function advance(d: Date, s: Step): Date {
  const next = new Date(d)
  if (s.unit === 'year') next.setFullYear(next.getFullYear() + s.n)
  else if (s.unit === 'month') next.setMonth(next.getMonth() + s.n)
  else next.setDate(next.getDate() + s.n)
  return next
}

export function chooseStep(windowMs: number, widthPx: number): Step {
  const pxPerMs = widthPx / Math.max(1, windowMs)
  return STEPS.find((s) => stepMs(s) * pxPerMs >= MIN_LABEL_GAP_PX) ?? STEPS[STEPS.length - 1]
}

/**
 * Ticks for the visible window. `minor` are the labelled steps. `context` are
 * the bigger units shown above them when the minor step is a month or a day,
 * so "Mar" always has its year next to it.
 */
export function buildAxis(w: TimeWindow, widthPx: number, locale?: string): { minor: AxisTick[]; context: AxisTick[]; step: Step } {
  const step = chooseStep(w.end - w.start, widthPx)
  const minor: AxisTick[] = []
  let cursor = alignedStart(w.start, step)
  let guard = 0
  while (cursor.getTime() <= w.end && guard++ < 400) {
    const t = cursor.getTime()
    if (t >= w.start - stepMs(step)) {
      let label: string
      let major = false
      if (step.unit === 'year') { label = String(cursor.getFullYear()); major = cursor.getFullYear() % (step.n >= 10 ? 100 : 10) === 0 }
      else if (step.unit === 'month') { label = cursor.toLocaleDateString(locale, { month: 'short' }); major = cursor.getMonth() === 0 }
      else { label = String(cursor.getDate()); major = cursor.getDate() <= 7 && (step.n === 7 || cursor.getDate() === 1) }
      minor.push({ time: t, label, major })
    }
    cursor = advance(cursor, step)
  }

  const context: AxisTick[] = []
  if (step.unit !== 'year') {
    const ctxStep: Step = step.unit === 'month' ? { unit: 'year', n: 1 } : { unit: 'month', n: 1 }
    let c = alignedStart(w.start, ctxStep)
    let g = 0
    while (c.getTime() <= w.end && g++ < 400) {
      const label = ctxStep.unit === 'year' ? String(c.getFullYear()) : c.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      context.push({ time: c.getTime(), label, major: true })
      c = advance(c, ctxStep)
    }
  }
  return { minor, context, step }
}

// ---- Rule 4: overlapping items stack into rows ------------------------------

export interface PackInput {
  id: string
  /** Left and right edge in px, already including any room the mark needs. */
  x0: number
  x1: number
}

/**
 * Assigns each item a row so that two items in the same row never touch.
 * Items are placed left to right. Returns the row of each id and the number
 * of rows used, capped at `maxRows` (extra items share the last row).
 */
export function packRows(items: PackInput[], gapPx = 3, maxRows = 6): { rowOf: Map<string, number>; rows: number } {
  const sorted = [...items].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1)
  const rowEnds: number[] = []
  const rowOf = new Map<string, number>()
  for (const it of sorted) {
    let row = rowEnds.findIndex((end) => end + gapPx <= it.x0)
    if (row === -1) row = rowEnds.length < maxRows ? rowEnds.length : maxRows - 1
    rowEnds[row] = Math.max(rowEnds[row] ?? -Infinity, it.x1)
    rowOf.set(it.id, row)
  }
  return { rowOf, rows: Math.max(1, rowEnds.length) }
}
