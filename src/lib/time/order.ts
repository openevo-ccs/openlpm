import { axisFor } from './hosts'
import { placementMinutes } from './placements'
import type { StageRef } from './presets'
import type { Axis, Placement } from './types'

// Order checks: does a plan put the content in an order that the LPM's own sequencing claims allow?
//
// The LPMs state order in four ways. Each becomes a rule, and each rule can be switched off:
//   stage-prerequisite   an asserted prerequisiteOf link between two stages
//   strand-prerequisite  a prerequisiteOf or foundationalTo link between two strands. Derived assumption: inside a
//                        grade band, the prerequisite strand's stage comes before the dependent strand's stage.
//   thread-order         the stations of a thread, in sequence
//   band-order           inside one strand, an earlier grade band comes before a later one
// A plan gives each stage a position on the axis. Where two stages overlap in time the plan does not order them.

export type OrderRule = 'stage-prerequisite' | 'strand-prerequisite' | 'thread-order' | 'band-order'

export const ORDER_RULES: { key: OrderRule; label: string }[] = [
  { key: 'stage-prerequisite', label: 'Stage prerequisites' },
  { key: 'strand-prerequisite', label: 'Strand prerequisites, inside each grade band' },
  { key: 'thread-order', label: 'Order of stages along a thread' },
  { key: 'band-order', label: 'Earlier grade band before later, inside a strand' },
]

export interface OrderSources {
  /** Stage id to the id of the strand it belongs to. */
  stageStrand: Record<string, string>
  strandEdges: { from: string; to: string; relation: string }[]
  stageEdges: { from: string; to: string; relation: string }[]
  threads: { id: string; slug: string; title: string; stageIds: string[] }[]
}

export interface OrderEdge {
  from: string
  to: string
  rules: OrderRule[]
}

export const EMPTY_SOURCES: OrderSources = { stageStrand: {}, strandEdges: [], stageEdges: [], threads: [] }

/** Every ordering claim between the given stages, one edge per pair with the rules that assert it. */
export function deriveOrderEdges(sources: OrderSources, stages: StageRef[], bandNames: string[], rules: OrderRule[] = ORDER_RULES.map((r) => r.key)): OrderEdge[] {
  const ids = new Set(stages.map((s) => s.id))
  const bandOf = new Map(stages.map((s) => [s.id, bandNames.indexOf(s.band)]))
  const merged = new Map<string, OrderEdge>()
  const add = (from: string, to: string, rule: OrderRule) => {
    if (from === to || !ids.has(from) || !ids.has(to) || !rules.includes(rule)) return
    const key = `${from}|${to}`
    const cur = merged.get(key)
    if (cur) { if (!cur.rules.includes(rule)) cur.rules.push(rule) } else merged.set(key, { from, to, rules: [rule] })
  }
  for (const e of sources.stageEdges) add(e.from, e.to, 'stage-prerequisite')
  const byStrandBand = new Map<string, string[]>()
  for (const s of stages) {
    const strand = sources.stageStrand[s.id]
    if (!strand) continue
    const k = `${strand}|${bandOf.get(s.id)}`
    byStrandBand.set(k, [...(byStrandBand.get(k) ?? []), s.id])
  }
  for (const e of sources.strandEdges) {
    for (let b = 0; b < bandNames.length; b++) {
      for (const a of byStrandBand.get(`${e.from}|${b}`) ?? []) for (const c of byStrandBand.get(`${e.to}|${b}`) ?? []) add(a, c, 'strand-prerequisite')
    }
  }
  for (const t of sources.threads) {
    const inPlan = t.stageIds.filter((id) => ids.has(id))
    for (let i = 1; i < inPlan.length; i++) add(inPlan[i - 1], inPlan[i], 'thread-order')
  }
  const byStrand = new Map<string, StageRef[]>()
  for (const s of stages) {
    const strand = sources.stageStrand[s.id]
    if (strand) byStrand.set(strand, [...(byStrand.get(strand) ?? []), s])
  }
  for (const list of byStrand.values()) {
    const sorted = [...list].sort((a, b) => (bandOf.get(a.id) ?? 0) - (bandOf.get(b.id) ?? 0))
    for (let i = 1; i < sorted.length; i++) if ((bandOf.get(sorted[i - 1].id) ?? 0) < (bandOf.get(sorted[i].id) ?? 0)) add(sorted[i - 1].id, sorted[i].id, 'band-order')
  }
  return [...merged.values()]
}

/** Stages of one band in dependency order (Kahn's algorithm, ties by strand then id). 'reverse' flips the result, as a negative control. */
export function orderStagesWithinBand(inBand: StageRef[], edges: OrderEdge[], direction: 'dependency' | 'reverse' = 'dependency'): StageRef[] {
  const ids = new Set(inBand.map((s) => s.id))
  const indeg = new Map(inBand.map((s) => [s.id, 0]))
  const next = new Map<string, string[]>()
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
    next.set(e.from, [...(next.get(e.from) ?? []), e.to])
  }
  const key = (s: StageRef) => `${s.strand}|${s.id}`
  const byId = new Map(inBand.map((s) => [s.id, s]))
  const ready = inBand.filter((s) => (indeg.get(s.id) ?? 0) === 0).sort((a, b) => key(a).localeCompare(key(b)))
  const out: StageRef[] = []
  while (ready.length) {
    const s = ready.shift() as StageRef
    out.push(s)
    for (const t of next.get(s.id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1)
      if (indeg.get(t) === 0) { ready.push(byId.get(t) as StageRef); ready.sort((a, b) => key(a).localeCompare(key(b))) }
    }
  }
  for (const s of [...inBand].sort((a, b) => key(a).localeCompare(key(b)))) if (!out.includes(s)) out.push(s)
  return direction === 'reverse' ? out.reverse() : out
}

/** Each stage takes its own stretch of the band, in order. Evolution time per stage matches the other presets. */
export function generateSequencedPlacements(
  stages: StageRef[],
  params: { share: { low: number; high: number }; sequence_order?: 'dependency' | 'reverse' },
  edges: OrderEdge[],
  bandNames: string[],
): Placement[] {
  const out: Placement[] = []
  const direction = params.sequence_order ?? 'dependency'
  bandNames.forEach((band, bi) => {
    const ordered = orderStagesWithinBand(stages.filter((s) => s.band === band), edges, direction)
    const n = ordered.length
    ordered.forEach((s, k) => {
      out.push({
        target_type: 'topic', target_id: s.id, role: 'dedicated', resource: 'instructional_time',
        selector: { where: { band: { eq: bi + 1 } }, span: { from: k / n, to: (k + 1) / n } },
        amount: { kind: 'share', low: params.share.low, high: params.share.high },
        note: `Stage ${k + 1} of ${n} in the band, in ${direction === 'reverse' ? 'reverse dependency order (control)' : 'dependency order'}.`,
      })
    })
  })
  return out
}

export interface StageTime {
  first: number
  last: number
  /** Minutes-weighted centre along the axis (unit positions). */
  centre: number
  minutes: number
}

/** Where each stage sits on the axis under a plan. Stages with no time are left out. */
export function stageTimes(axis: Axis, placements: Placement[], extra?: Record<string, Axis>): Map<string, StageTime> {
  const acc = new Map<string, { first: number; last: number; wsum: number; w: number }>()
  for (const p of placements) {
    if (p.target_type !== 'topic') continue
    for (const m of placementMinutes(axisFor(p, axis, extra), p)) {
      const w = (m.low + m.high) / 2
      if (w <= 0) continue
      const cur = acc.get(p.target_id) ?? { first: Infinity, last: -Infinity, wsum: 0, w: 0 }
      cur.first = Math.min(cur.first, m.abs)
      cur.last = Math.max(cur.last, m.abs)
      cur.wsum += m.abs * w
      cur.w += w
      acc.set(p.target_id, cur)
    }
  }
  const out = new Map<string, StageTime>()
  for (const [id, a] of acc) out.set(id, { first: a.first, last: a.last, centre: a.wsum / a.w, minutes: a.w })
  return out
}

export type OrderStatus = 'in-order' | 'leans-in-order' | 'unordered' | 'leans-out-of-order' | 'out-of-order' | 'not-placed'

export interface OrderItem {
  edge: OrderEdge
  status: OrderStatus
  from: StageTime | null
  to: StageTime | null
}

export interface OrderReport {
  items: OrderItem[]
  /** Counts by status, overall and for each rule. */
  summary: Record<OrderStatus, number>
  byRule: Record<OrderRule, Record<OrderStatus, number>>
  /** Share of placed edges that are in order or lean in order. Null when nothing is placed. */
  orderedShare: number | null
  /** Share of placed edges the plan does not order at all. */
  unorderedShare: number | null
}

const STATUSES: OrderStatus[] = ['in-order', 'leans-in-order', 'unordered', 'leans-out-of-order', 'out-of-order', 'not-placed']
const blank = (): Record<OrderStatus, number> => Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>

/**
 * Checks each ordering claim against the plan. Stages whose time intervals do not touch are ordered by the plan.
 * Stages whose intervals overlap are not, though their time centres may still lean one way.
 */
export function checkOrder(axis: Axis, placements: Placement[], edges: OrderEdge[], extra?: Record<string, Axis>): OrderReport {
  const times = stageTimes(axis, placements, extra)
  const items: OrderItem[] = edges.map((edge) => {
    const a = times.get(edge.from) ?? null
    const b = times.get(edge.to) ?? null
    if (!a || !b) return { edge, status: 'not-placed' as OrderStatus, from: a, to: b }
    let status: OrderStatus
    if (a.last < b.first) status = 'in-order'
    else if (a.first > b.last) status = 'out-of-order'
    else if (Math.abs(a.centre - b.centre) < 1e-9) status = 'unordered'
    else status = a.centre < b.centre ? 'leans-in-order' : 'leans-out-of-order'
    return { edge, status, from: a, to: b }
  })
  const summary = blank()
  const byRule = Object.fromEntries(ORDER_RULES.map((r) => [r.key, blank()])) as Record<OrderRule, Record<OrderStatus, number>>
  for (const it of items) {
    summary[it.status] += 1
    for (const r of it.edge.rules) byRule[r][it.status] += 1
  }
  const placed = items.length - summary['not-placed']
  return {
    items, summary, byRule,
    orderedShare: placed > 0 ? (summary['in-order'] + summary['leans-in-order']) / placed : null,
    unorderedShare: placed > 0 ? summary['unordered'] / placed : null,
  }
}
