// "When is it taught?" Calculations over curriculum-unit records: units of an official Lehrplan with a subject,
// grades, hours and topic tags. Pure functions, run under node:test.

import { jensenShannon, total } from './stats'
import type { CmpRecord } from './model'

export const BANDS: { id: string; from: number; to: number }[] = [
  { id: '5-6', from: 5, to: 6 },
  { id: '7-8', from: 7, to: 8 },
  { id: '9-10', from: 9, to: 10 },
  { id: '11-13', from: 11, to: 13 },
]

export interface PlacedUnit {
  /** The place (state or country) the unit's Lehrplan belongs to. */
  placeId: string
  record: CmpRecord
}

export function gradesOf(rec: CmpRecord): number[] {
  const u = rec.unit
  if (!u) return []
  const out: number[] = []
  for (let g = Math.min(u.gradeFrom, u.gradeTo); g <= Math.max(u.gradeFrom, u.gradeTo); g++) out.push(g)
  return out
}

/** The grades shown on the page: every grade any unit touches, at least 5 to 12. */
export function gradeRange(units: PlacedUnit[]): number[] {
  let lo = 5
  let hi = 12
  for (const u of units) for (const g of gradesOf(u.record)) { lo = Math.min(lo, g); hi = Math.max(hi, g) }
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

export const matchesTags = (rec: CmpRecord, tags: ReadonlySet<string> | null): boolean =>
  !tags || tags.size === 0 || (rec.unit?.tags ?? []).some((t) => tags.has(t))

export interface PlaceProfile {
  placeId: string
  /** Per grade, in `grades` order: hours the Lehrplan gives to matching units (a unit over several grades is shared equally). */
  hours: number[]
  /** Per grade: number of matching units touching that grade. */
  units: number[]
  /** Units that carry no hours at all, so the hours understate the content. */
  unitsWithoutHours: number
  unitCount: number
}

/** Hours and unit counts per grade for each place, over units matching `tags` and `subject`. */
export function placementProfiles(units: PlacedUnit[], subject: string, tags: ReadonlySet<string> | null, grades: number[], placeIds: string[]): PlaceProfile[] {
  const idx = new Map(grades.map((g, i) => [g, i]))
  return placeIds.map((placeId) => {
    const hours = new Array<number>(grades.length).fill(0)
    const counts = new Array<number>(grades.length).fill(0)
    let without = 0
    let n = 0
    for (const u of units) {
      if (u.placeId !== placeId || u.record.unit?.subject !== subject || !matchesTags(u.record, tags)) continue
      const gs = gradesOf(u.record)
      if (gs.length === 0) continue
      n++
      const h = u.record.unit!.hours
      if (h === null) without++
      for (const g of gs) {
        const i = idx.get(g)
        if (i === undefined) continue
        counts[i]++
        if (h !== null) hours[i] += h / gs.length
      }
    }
    return { placeId, hours, units: counts, unitsWithoutHours: without, unitCount: n }
  })
}

/** The first grade in which a topic tag appears in a place's units, or null. */
export function firstGrade(units: PlacedUnit[], placeId: string, subject: string, tag: string): number | null {
  let first: number | null = null
  for (const u of units) {
    if (u.placeId !== placeId || u.record.unit?.subject !== subject || !(u.record.unit.tags ?? []).includes(tag)) continue
    const g = Math.min(u.record.unit.gradeFrom, u.record.unit.gradeTo)
    if (first === null || g < first) first = g
  }
  return first
}

/** Share of a profile in each grade band (hours when the place states hours for its units, else unit counts). Rows sum to 1, or all 0 for an empty profile. */
export function bandShares(profile: PlaceProfile, grades: number[]): { shares: number[]; basis: 'hours' | 'units' } {
  const basis: 'hours' | 'units' = total(profile.hours) > 0 ? 'hours' : 'units'
  const values = basis === 'hours' ? profile.hours : profile.units
  const out = BANDS.map((b) => grades.reduce((acc, g, i) => (g >= b.from && g <= b.to ? acc + values[i] : acc), 0))
  const t = total(out)
  return { shares: t > 0 ? out.map((x) => x / t) : out.map(() => 0), basis }
}

/** Jensen-Shannon distance (0 to 1) between two places' grade profiles, null when either is empty. */
export function profileDistance(a: PlaceProfile, b: PlaceProfile): number | null {
  const useHours = total(a.hours) > 0 && total(b.hours) > 0
  const d = jensenShannon(useHours ? a.hours : a.units, useHours ? b.hours : b.units)
  return d === null ? null : Math.sqrt(d)
}
