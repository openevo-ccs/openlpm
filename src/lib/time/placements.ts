import { available } from './axis'
import { parseDuration } from './duration'
import { selectUnits } from './selector'
import type { Axis, Placement, UnitMinutes } from './types'

/**
 * Minutes a placement puts on each unit it covers, as a low and a high value.
 *
 * duration: minutes per covered unit, weighted by how much of the unit is covered.
 * share:    a fraction of each covered unit's own teaching time (needs unit durations).
 * total:    a total spread over the covered units in proportion to coverage.
 */
export function placementMinutes(axis: Axis, p: Placement): UnitMinutes[] {
  const hits = selectUnits(axis, p.selector)
  const a = p.amount
  if (hits.length === 0) return []
  if (a.kind === 'duration') {
    const lo = parseDuration(a.low)
    const hi = a.high === undefined ? lo : parseDuration(a.high)
    return hits.map(({ unit, coverage }) => ({ abs: unit.abs, low: lo * coverage, high: hi * coverage, coverage }))
  }
  if (a.kind === 'share') {
    const lo = a.low
    const hi = a.high === undefined ? lo : a.high
    return hits.map(({ unit, coverage }) => {
      const d = available(unit)
      return { abs: unit.abs, low: lo * d.low * coverage, high: hi * d.high * coverage, coverage }
    })
  }
  const lo = parseDuration(a.low)
  const hi = a.high === undefined ? lo : parseDuration(a.high)
  const weight = hits.reduce((s, h) => s + h.coverage, 0)
  return hits.map(({ unit, coverage }) => ({ abs: unit.abs, low: (lo * coverage) / weight, high: (hi * coverage) / weight, coverage }))
}

export interface RangeMinutes {
  low: number
  high: number
}

export function sumMinutes(items: UnitMinutes[]): RangeMinutes {
  return items.reduce((s, i) => ({ low: s.low + i.low, high: s.high + i.high }), { low: 0, high: 0 })
}

/** Total minutes per target for a set of placements. Key is `${target_type}:${target_id}`. */
export function minutesByTarget(axis: Axis, placements: Placement[]): Map<string, RangeMinutes> {
  const out = new Map<string, RangeMinutes>()
  for (const p of placements) {
    const key = `${p.target_type}:${p.target_id}`
    const add = sumMinutes(placementMinutes(axis, p))
    const cur = out.get(key) ?? { low: 0, high: 0 }
    out.set(key, { low: cur.low + add.low, high: cur.high + add.high })
  }
  return out
}
