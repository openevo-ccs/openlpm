import { available } from './axis'
import type { RangeMinutes } from './placements'
import type { StageRef } from './presets'
import type { Axis, Placement } from './types'

// Host subjects. An LPM never owns teaching time. In a school its content is taught inside subjects that already
// have a timetable. Each subject is an axis of its own with the same band and year structure as the plan's axis,
// and a placement says which axis it lands on. A topic can draw on several subjects, and the split is a plan
// setting that can be argued about like any other assumption.

export interface HostInfo {
  /** Id of the axis that holds this subject's timetable. */
  axisId: string
  /** Stable name that works across projects, for example 'biology'. The split is keyed by it. */
  subject: string
  label: string
  axis: Axis
}

export interface HostContext {
  /** Subject of the plan's own axis. Hours of the plan are counted against it. */
  reference: string
  /** All subjects, including the reference. */
  hosts: HostInfo[]
}

/**
 * 'matched-hours': the space takes the same number of hours as the one-subject plan and the split says which
 * subjects give them. 'home-share': every subject the space draws on gives the same share of its own time.
 * For a space that uses one subject the two coincide.
 */
export type HostBasis = 'matched-hours' | 'home-share'

export interface HostParams {
  basis: HostBasis
  /** Topic id to subject to weight. A topic with no entry is taught entirely in the reference subject. */
  split: Record<string, Record<string, number>>
}

export const HOST_BASES: { key: HostBasis; label: string; hint: string }[] = [
  { key: 'matched-hours', label: 'Same total hours', hint: 'The space takes as many hours as in a plan that uses one subject. The split says which subjects give them.' },
  { key: 'home-share', label: 'Same share of each subject', hint: 'Every subject the space draws on gives the same share of its own hours.' },
]

/** Available teaching minutes of an axis in each band, by band position (index 0 is the first band). */
export function bandMinutes(axis: Axis, bandCount: number): RangeMinutes[] {
  const out: RangeMinutes[] = Array.from({ length: bandCount }, () => ({ low: 0, high: 0 }))
  for (const u of axis.units) {
    const b = u.coords[0] - 1
    if (b < 0 || b >= bandCount) continue
    const a = available(u)
    out[b] = { low: out[b].low + a.low, high: out[b].high + a.high }
  }
  return out
}

/** Whether another axis lines up with the reference axis unit for unit, which a host timetable needs. */
export function axesAligned(reference: Axis, other: Axis): boolean {
  if (reference.levels.length !== other.levels.length) return false
  if (reference.levels.some((k, i) => k !== other.levels[i])) return false
  return reference.units.length === other.units.length
}

/** Scale weights so they add up to one. All zero or negative weights give an empty result. */
export function normalizeWeights(w: Record<string, number>): Record<string, number> {
  const entries = Object.entries(w).filter(([, v]) => Number.isFinite(v) && v > 0)
  const sum = entries.reduce((s, [, v]) => s + v, 0)
  if (sum <= 0) return {}
  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum]))
}

export interface HostSplitResult {
  placements: Placement[]
  /** Plain-language notes about weights that had to be moved, for example a subject with no hours in a band. */
  notes: string[]
}

function scaleAmount(p: Placement, low: number, high: number): Placement['amount'] {
  const a = p.amount
  if (a.kind !== 'share') return a
  return { kind: 'share', low: a.low * low, high: (a.high ?? a.low) * high }
}

/**
 * Spreads the placements of a one-subject plan over the subjects in the split. `base` is written against the
 * reference axis. Every placement of a topic with a split becomes one placement per subject that gets weight,
 * with the same selector and an amount rescaled for that subject's own hours.
 *
 * Only share amounts are rescaled, because the presets write nothing else. A subject with no hours in a band
 * gives its weight to the other subjects of that topic, and the notes say so.
 */
export function splitAcrossHosts(base: Placement[], stages: StageRef[], hp: HostParams, ctx: HostContext, bandNames: string[]): HostSplitResult {
  const notes: string[] = []
  const bySubject = new Map(ctx.hosts.map((h) => [h.subject, h]))
  const ref = bySubject.get(ctx.reference)
  if (!ref) return { placements: base, notes: ['The reference subject has no timetable, so the plan is unchanged.'] }
  const minutes = new Map<string, RangeMinutes[]>()
  for (const h of ctx.hosts) if (axesAligned(ref.axis, h.axis)) minutes.set(h.subject, bandMinutes(h.axis, bandNames.length))
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const bandOf = (id: string) => bandNames.indexOf(stageById.get(id)?.band ?? '')

  // Weights after removing subjects that have no hours in the topic's band. A topic with no split stays in the reference subject.
  const eff = new Map<string, Record<string, number>>()
  const moved = new Set<string>()
  for (const s of stages) {
    const raw = hp.split[s.id]
    if (!raw) { eff.set(s.id, { [ctx.reference]: 1 }); continue }
    const b = bandOf(s.id)
    const norm = normalizeWeights(raw)
    const usable: Record<string, number> = {}
    for (const [subject, w] of Object.entries(norm)) {
      const m = minutes.get(subject)?.[b]
      if (m && m.high > 0) usable[subject] = w
      else if (!minutes.has(subject)) moved.add(`${subject} is not aligned with the plan's axis`)
      else moved.add(`${bySubject.get(subject)?.label ?? subject} has no hours in ${bandNames[b] ?? 'this band'}`)
    }
    const fixed = normalizeWeights(usable)
    eff.set(s.id, Object.keys(fixed).length > 0 ? fixed : { [ctx.reference]: 1 })
  }
  for (const m of moved) notes.push(`${m}, so its share moved to the other subjects of the topic.`)

  // Sum of weights per subject and band, for the home-share basis.
  const wSum = new Map<string, number>()
  for (const s of stages) {
    const w = eff.get(s.id) as Record<string, number>
    for (const [subject, v] of Object.entries(w)) wSum.set(`${subject}|${bandOf(s.id)}`, (wSum.get(`${subject}|${bandOf(s.id)}`) ?? 0) + v)
  }
  const stagesInBand = (b: number) => stages.filter((s) => bandOf(s.id) === b).length

  const out: Placement[] = []
  for (const p of base) {
    const w = p.target_type === 'topic' ? eff.get(p.target_id) : undefined
    if (!w) { out.push(p); continue }
    const b = bandOf(p.target_id)
    const refMin = minutes.get(ctx.reference)?.[b]
    const entries = Object.entries(w).sort(([a], [c]) => ctx.hosts.findIndex((h) => h.subject === a) - ctx.hosts.findIndex((h) => h.subject === c))
    for (const [subject, weight] of entries) {
      const host = bySubject.get(subject)
      const hostMin = minutes.get(subject)?.[b]
      if (!host || !hostMin || !refMin) continue
      let lo: number
      let hi: number
      if (hp.basis === 'home-share') {
        const f = (stagesInBand(b) * weight) / (wSum.get(`${subject}|${b}`) || 1)
        lo = f; hi = f
      } else {
        lo = hostMin.low > 0 ? (weight * refMin.low) / hostMin.low : 0
        hi = hostMin.high > 0 ? (weight * refMin.high) / hostMin.high : 0
      }
      const alone = entries.length === 1 && subject === ctx.reference
      const note = alone ? p.note : `${p.note ?? ''}${p.note ? ' ' : ''}Taught in ${host.label} (${Math.round(weight * 100)}% of this topic).`
      out.push({ ...p, axis_id: subject === ctx.reference ? p.axis_id ?? null : host.axisId, amount: scaleAmount(p, lo, hi), note })
    }
  }
  return { placements: out, notes }
}

/** The axis a placement lands on, given the plan's own axis and the host axes by id. */
export function axisFor(p: Placement, axis: Axis, extra?: Record<string, Axis>): Axis {
  if (p.axis_id && extra && extra[p.axis_id]) return extra[p.axis_id]
  return axis
}

/** Split a topic's weights back out of a plan's placements, by subject. Used to show what a stored plan does. */
export function splitFromPlacements(placements: Placement[], ctx: HostContext, minutesOf: (p: Placement) => number): Record<string, Record<string, number>> {
  const bySubjectAxis = new Map(ctx.hosts.map((h) => [h.axisId, h.subject]))
  const acc: Record<string, Record<string, number>> = {}
  for (const p of placements) {
    if (p.target_type !== 'topic') continue
    const subject = p.axis_id ? bySubjectAxis.get(p.axis_id) ?? ctx.reference : ctx.reference
    const m = minutesOf(p)
    acc[p.target_id] = acc[p.target_id] ?? {}
    acc[p.target_id][subject] = (acc[p.target_id][subject] ?? 0) + m
  }
  const out: Record<string, Record<string, number>> = {}
  for (const [id, w] of Object.entries(acc)) out[id] = normalizeWeights(w)
  return out
}
