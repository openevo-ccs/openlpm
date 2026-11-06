import { available, matchWhere } from './axis'
import { mid } from './duration'
import type { Axis, Hit, Selector, Unit } from './types'

/**
 * Units of the axis that a selector covers, with the share of each unit covered.
 *
 * `where` keeps units that satisfy every per-level constraint. `span` then cuts a stretch out of the matched
 * region along cumulative teaching time (or along unit count when the axis gives no durations), so "the last
 * fifth of every year" is { span: { from: 0.8, to: 1 }, spanWithin: 'year' }. A unit that straddles the cut
 * is covered in part.
 */
export function selectUnits(axis: Axis, sel: Selector): Hit[] {
  const matched = axis.units.filter((u) => matchWhere(u, axis.levels, sel.where))
  if (!sel.span) return matched.map((unit) => ({ unit, coverage: 1 }))
  const { from, to } = sel.span
  const groups = new Map<string, Unit[]>()
  const within = sel.spanWithin ? axis.levels.indexOf(sel.spanWithin) : -1
  if (sel.spanWithin && within < 0) return []
  for (const u of matched) {
    const key = within >= 0 ? u.coords.slice(0, within + 1).join('.') : 'all'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(u)
  }
  const hits: Hit[] = []
  for (const group of groups.values()) {
    const weights = group.map((u) => (u.teaching ? mid(available(u)) : 0))
    let total = weights.reduce((a, b) => a + b, 0)
    let w = weights
    if (total <= 0) {
      w = group.map((u) => (u.teaching ? 1 : 0))
      total = w.reduce((a, b) => a + b, 0)
    }
    if (total <= 0) continue
    let cum = 0
    group.forEach((unit, i) => {
      const a = cum / total
      const b = (cum + w[i]) / total
      cum += w[i]
      if (w[i] <= 0) return
      const overlap = Math.max(0, Math.min(b, to) - Math.max(a, from))
      const coverage = overlap / (b - a)
      if (coverage > 1e-9) hits.push({ unit, coverage: Math.min(1, coverage) })
    })
  }
  return hits
}
