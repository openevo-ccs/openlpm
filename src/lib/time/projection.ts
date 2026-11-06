import { addDays, addYears, daysBetween } from './dates'
import { placementMinutes, sumMinutes, type RangeMinutes } from './placements'
import { selectUnits } from './selector'
import type { Axis, Placement, Unit } from './types'

// Projection: lay a plan written on a generic year axis over a dated calendar. The plan names positions in a
// generic year (day 240, "the last fifth"). The dated axis lists the host subject's real sessions, with holidays
// and closures. The fit report says where each placement lands and whether the time it asks for is there.

export type ProjectionRule = 'date-offset' | 'teaching-time'

export interface Window {
  year: number
  firstDate: string
  lastDate: string
  genericStart: number
  genericEnd: number
  sessions: number
  available: RangeMinutes
  elapsedDays: number
  /** Calendar days inside the window that are closed. Under date-offset they are lost teaching time. Under teaching-time they only stretch the window. */
  closedDays: number
}

export interface FitItem {
  index: number
  target: string
  note?: string
  requested: RangeMinutes
  windows: Window[]
  available: RangeMinutes
  sessions: number
  closedDays: number
  genericDays: number
  elapsedDays: number
  /** Elapsed real days per generic day spanned. 1 means no stretch. */
  stretch: number | null
  missingYears: number
  status: 'fits' | 'uncertain' | 'short' | 'unplaced'
  shortfall: RangeMinutes
}

export interface SpacingReport {
  target: string
  returns: number
  gapsGenericDays: number[]
  gapsElapsedDays: number[]
  gapsTeachingMinutes: number[]
}

export interface FitReport {
  rule: ProjectionRule
  items: FitItem[]
  spacing: SpacingReport[]
  summary: { fits: number; uncertain: number; short: number; unplaced: number }
}

function teachingUnits(target: Axis, year: number): Unit[] {
  return target.units.filter((u) => u.coords[0] === year && u.teaching && u.date)
}

function closedDaysIn(target: Axis, first: string, last: string): number {
  const rules = target.def.dated?.non_teaching ?? []
  let n = 0
  const total = daysBetween(first, last)
  for (let d = 0; d <= total; d++) {
    const day = addDays(first, d)
    if (rules.some((r) => r.from <= day && day <= r.to)) n += 1
  }
  return n
}

function windowFor(rule: ProjectionRule, generic: Axis, target: Axis, year: number, dMin: number, dMax: number): Window | null {
  const cfg = target.def.dated
  const yearLength = generic.def.year_length ?? 365
  const units = teachingUnits(target, year)
  if (!cfg) return null
  if (rule === 'date-offset') {
    const yearStart = addYears(cfg.start, year - 1)
    const firstDate = addDays(yearStart, dMin - 1)
    const lastDate = addDays(yearStart, dMax - 1)
    const inside = units.filter((u) => (u.date as string) >= firstDate && (u.date as string) <= lastDate)
    const available = sumMinutes(inside.map((u) => ({ abs: u.abs, low: u.duration.low, high: u.duration.high, coverage: 1 })))
    return {
      year, firstDate, lastDate, genericStart: (year - 1) * yearLength + dMin, genericEnd: (year - 1) * yearLength + dMax,
      sessions: inside.length, available, elapsedDays: dMax - dMin + 1, closedDays: closedDaysIn(target, firstDate, lastDate),
    }
  }
  // teaching-time: the same fraction of the year's teaching minutes, so holidays drop out of the sequence.
  const total = units.reduce((s, u) => s + (u.duration.low + u.duration.high) / 2, 0)
  if (units.length === 0 || total <= 0) return null
  const a = (dMin - 1) / yearLength
  const b = dMax / yearLength
  let cum = 0
  let first: Unit | null = null
  let last: Unit | null = null
  let count = 0
  let low = 0
  let high = 0
  for (const u of units) {
    const w = (u.duration.low + u.duration.high) / 2
    const s = cum / total
    const e = (cum + w) / total
    cum += w
    const overlap = Math.max(0, Math.min(e, b) - Math.max(s, a))
    if (overlap > 1e-12) {
      const cov = Math.min(1, overlap / (e - s))
      if (!first) first = u
      last = u
      count += 1
      low += u.duration.low * cov
      high += u.duration.high * cov
    }
  }
  if (!first || !last) return null
  const firstDate = first.date as string
  const lastDate = last.date as string
  return {
    year, firstDate, lastDate, genericStart: (year - 1) * yearLength + dMin, genericEnd: (year - 1) * yearLength + dMax,
    sessions: count, available: { low, high }, elapsedDays: daysBetween(firstDate, lastDate) + 1, closedDays: closedDaysIn(target, firstDate, lastDate),
  }
}

/** Project placements written on a generic year axis onto a dated axis and report how they fit. */
export function projectPlan(generic: Axis, placements: Placement[], target: Axis, rule: ProjectionRule): FitReport {
  const items: FitItem[] = []
  const byTarget = new Map<string, Window[]>()
  placements.forEach((p, index) => {
    const key = `${p.target_type}:${p.target_id}`
    const requested = sumMinutes(placementMinutes(generic, p))
    const hits = selectUnits(generic, p.selector)
    const perYear = new Map<number, number[]>()
    for (const h of hits) {
      const y = h.unit.coords[0]
      if (!perYear.has(y)) perYear.set(y, [])
      perYear.get(y)!.push(h.unit.coords[1])
    }
    const windows: Window[] = []
    let missingYears = 0
    for (const [year, days] of [...perYear.entries()].sort((a, b) => a[0] - b[0])) {
      const w = windowFor(rule, generic, target, year, Math.min(...days), Math.max(...days))
      if (w) windows.push(w)
      else missingYears += 1
    }
    const available = windows.reduce((s, w) => ({ low: s.low + w.available.low, high: s.high + w.available.high }), { low: 0, high: 0 })
    const genericDays = [...perYear.values()].reduce((s, d) => s + (Math.max(...d) - Math.min(...d) + 1), 0)
    const elapsed = windows.reduce((s, w) => s + w.elapsedDays, 0)
    let status: FitItem['status'] = 'fits'
    if (windows.length === 0) status = 'unplaced'
    else if (available.high < requested.low) status = 'short'
    else if (available.low < requested.high) status = 'uncertain'
    items.push({
      index, target: key, note: p.note, requested, windows, available,
      sessions: windows.reduce((s, w) => s + w.sessions, 0),
      closedDays: windows.reduce((s, w) => s + w.closedDays, 0),
      genericDays, elapsedDays: elapsed, stretch: genericDays > 0 && windows.length > 0 ? elapsed / genericDays : null, missingYears, status,
      shortfall: { low: Math.max(0, requested.low - available.high), high: Math.max(0, requested.high - available.low) },
    })
    // Returns are counted between dedicated blocks. A thread runs through the whole span and has no gap.
    if (windows.length && (p.role ?? 'dedicated') !== 'threaded') byTarget.set(key, [...(byTarget.get(key) ?? []), ...windows])
  })

  const spacing: SpacingReport[] = []
  for (const [targetKey, ws] of byTarget) {
    const sorted = [...ws].sort((a, b) => a.genericStart - b.genericStart)
    if (sorted.length < 2) continue
    const gGen: number[] = []
    const gEl: number[] = []
    const gMin: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const next = sorted[i]
      gGen.push(Math.max(0, next.genericStart - prev.genericEnd))
      gEl.push(Math.max(0, daysBetween(prev.lastDate, next.firstDate)))
      gMin.push(
        target.units
          .filter((u) => u.teaching && u.date && (u.date as string) > prev.lastDate && (u.date as string) < next.firstDate)
          .reduce((sum, u) => sum + (u.duration.low + u.duration.high) / 2, 0),
      )
    }
    spacing.push({ target: targetKey, returns: sorted.length - 1, gapsGenericDays: gGen, gapsElapsedDays: gEl, gapsTeachingMinutes: gMin })
  }
  const summary = { fits: 0, uncertain: 0, short: 0, unplaced: 0 }
  for (const it of items) summary[it.status] += 1
  return { rule, items, spacing, summary }
}
