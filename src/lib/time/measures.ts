import { available } from './axis'
import { axisFor, bandMinutes, type HostContext } from './hosts'
import { placementMinutes, type RangeMinutes } from './placements'
import type { StageRef } from './presets'
import type { Axis, Placement, Unit } from './types'

// Measures derived from a plan plus the LPM content. Nothing here is stored. Every value names its grain:
// bands unless a measure says otherwise.

export interface ConceptRef {
  id: string
  label: string
}

export interface MeasureParams {
  /** Fraction of a topic's time given to its reinforcing concepts as threaded time (default 0.15). */
  reinforcing_share?: number
  bandNames?: string[]
  /** Host subjects, when the plan puts time on more than one timetable. */
  hosts?: HostContext
}

export interface ConceptMeasure {
  id: string
  label: string
  dedicated: RangeMinutes
  threaded: RangeMinutes
  total: RangeMinutes
  occasions: number
  strands: number
  bands: string[]
  firstMainBand: string | null
  returns: number
  /** Longest stretch between appearances, counted in grade bands. */
  longestGapBands: number
  /** The same gap in school years, between band centres. */
  longestGapYears: number
  /** Returns per school year spanned (grain: band centres). Null for a concept that appears once. */
  returnsPerYear: number | null
  /** Subjects whose time carries topics of this concept. Empty when the plan names no host subjects. */
  subjects: string[]
}

export interface HostBandMeasure {
  band: string
  available: RangeMinutes
  claimed: RangeMinutes
  /** Claimed time as a share of the subject's own time in the band. */
  share: { low: number; high: number }
}

/** What a plan takes from one subject's timetable. Grain: grade band. */
export interface HostMeasure {
  axisId: string
  subject: string
  label: string
  available: RangeMinutes
  claimed: RangeMinutes
  share: { low: number; high: number }
  bands: HostBandMeasure[]
  /** Topics that get time in this subject. */
  topics: number
}

export interface BandMeasure {
  band: string
  years: number
  biology: RangeMinutes
  evolution: RangeMinutes
  evolutionShareOfBiology: { low: number; high: number }
  stages: number
  outcomes: number
  distinctConcepts: number
  newMainConcepts: number
  conceptsSharedAcrossStrands: number
  /** Minutes of evolution time per outcome. */
  minutesPerOutcome: RangeMinutes
  /** New main concepts per 10 hours of evolution time. */
  newMainPer10h: { low: number; high: number }
}

export interface PlanMeasures {
  totalEvolution: RangeMinutes
  dedicatedMinutes: RangeMinutes
  threadedMinutes: RangeMinutes
  topics: { id: string; title: string; band: string; minutes: RangeMinutes }[]
  concepts: ConceptMeasure[]
  bands: BandMeasure[]
  byTag: Record<string, RangeMinutes>
  placementsWithoutTarget: number
  /** One entry per host subject, in the order of the host context. Empty when the plan names none. */
  hosts: HostMeasure[]
  /** Topics that draw time from more than one subject. */
  crossSubjectTopics: number
  /** Mean number of subjects per topic that has time. */
  meanSubjectsPerTopic: number
}

const ZERO: RangeMinutes = { low: 0, high: 0 }

function add(a: RangeMinutes, b: RangeMinutes): RangeMinutes {
  return { low: a.low + b.low, high: a.high + b.high }
}

function scale(a: RangeMinutes, k: number): RangeMinutes {
  return { low: a.low * k, high: a.high * k }
}

export function computePlanMeasures(axis: Axis, placements: Placement[], stages: StageRef[], concepts: ConceptRef[], params: MeasureParams = {}): PlanMeasures {
  const rho = params.reinforcing_share ?? 0.15
  const bandNames = params.bandNames ?? axis.def.levels[0]?.names ?? []
  const yearIdx = axis.levels.indexOf('year')
  const stageById = new Map(stages.map((s) => [s.id, s]))

  const topicMinutes = new Map<string, RangeMinutes>()
  const byBand = new Map<number, RangeMinutes>()
  const byTag: Record<string, RangeMinutes> = {}
  let dedicated = ZERO
  let threaded = ZERO
  let placementsWithoutTarget = 0

  const extra: Record<string, Axis> = {}
  const subjectOfAxis = new Map<string, string>()
  const hostCtx = params.hosts
  if (hostCtx) for (const h of hostCtx.hosts) { extra[h.axisId] = h.axis; subjectOfAxis.set(h.axisId, h.subject) }
  const subjectOf = (p: Placement) => (p.axis_id && subjectOfAxis.get(p.axis_id)) || hostCtx?.reference || ''
  const hostBand = new Map<string, RangeMinutes[]>()
  const hostTopics = new Map<string, Set<string>>()
  const topicSubjects = new Map<string, Map<string, number>>()
  const unitCache = new Map<Axis, Map<number, Unit>>()
  const unitsOf = (ax: Axis) => {
    let m = unitCache.get(ax)
    if (!m) { m = new Map(ax.units.map((u) => [u.abs, u])); unitCache.set(ax, m) }
    return m
  }

  for (const p of placements) {
    if (p.target_type === 'topic' && !stageById.has(p.target_id)) placementsWithoutTarget += 1
    const ax = axisFor(p, axis, extra)
    const per = placementMinutes(ax, p)
    const unitByAbs = unitsOf(ax)
    const subject = subjectOf(p)
    let sum = ZERO
    for (const m of per) {
      const u = unitByAbs.get(m.abs)
      if (!u) continue
      const v = { low: m.low, high: m.high }
      sum = add(sum, v)
      byBand.set(u.coords[0], add(byBand.get(u.coords[0]) ?? ZERO, v))
      for (const tag of u.tags) byTag[tag] = add(byTag[tag] ?? ZERO, v)
      if (subject) {
        const arr = hostBand.get(subject) ?? bandNames.map(() => ZERO)
        if (u.coords[0] >= 1 && u.coords[0] <= arr.length) arr[u.coords[0] - 1] = add(arr[u.coords[0] - 1], v)
        hostBand.set(subject, arr)
      }
    }
    if (p.target_type === 'topic') {
      topicMinutes.set(p.target_id, add(topicMinutes.get(p.target_id) ?? ZERO, sum))
      if (subject && sum.high > 0) {
        if (!hostTopics.has(subject)) hostTopics.set(subject, new Set())
        hostTopics.get(subject)!.add(p.target_id)
        const ts = topicSubjects.get(p.target_id) ?? new Map<string, number>()
        ts.set(subject, (ts.get(subject) ?? 0) + (sum.low + sum.high) / 2)
        topicSubjects.set(p.target_id, ts)
      }
    }
    if ((p.role ?? 'dedicated') === 'threaded') threaded = add(threaded, sum)
    else dedicated = add(dedicated, sum)
  }

  // Concept time is derived from topic time. Primary concepts share the topic's dedicated time equally.
  // Reinforcing concepts receive the plan's reinforcing share of the topic's time as threaded time.
  const dedByConcept = new Map<string, RangeMinutes>()
  const thrByConcept = new Map<string, RangeMinutes>()
  for (const s of stages) {
    const t = topicMinutes.get(s.id)
    if (!t) continue
    const primary = s.concepts.filter((c) => c.emphasis === 'primary')
    const reinforcing = s.concepts.filter((c) => c.emphasis !== 'primary')
    const r = reinforcing.length > 0 && primary.length > 0 ? rho : primary.length === 0 ? 1 : 0
    for (const c of primary) dedByConcept.set(c.id, add(dedByConcept.get(c.id) ?? ZERO, scale(t, (1 - r) / primary.length)))
    for (const c of reinforcing) thrByConcept.set(c.id, add(thrByConcept.get(c.id) ?? ZERO, scale(t, r / reinforcing.length)))
  }

  // Year position of each band centre, from the axis.
  const centre: number[] = []
  for (let b = 1; b <= bandNames.length; b++) {
    const years = new Set<number>()
    for (const u of axis.units) if (u.coords[0] === b) years.add(yearIdx >= 0 ? u.absAt[yearIdx] : b)
    const arr = [...years]
    centre[b - 1] = arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : b
  }
  const bandPos = (name: string) => bandNames.indexOf(name)

  const conceptMeasures: ConceptMeasure[] = concepts.map((c) => {
    const where = stages.filter((s) => s.concepts.some((x) => x.id === c.id))
    const bands = [...new Set(where.map((s) => s.band))].sort((a, b) => bandPos(a) - bandPos(b))
    const mainBands = [...new Set(where.filter((s) => s.concepts.find((x) => x.id === c.id)?.emphasis === 'primary').map((s) => s.band))].sort((a, b) => bandPos(a) - bandPos(b))
    const idxs = bands.map(bandPos)
    let gapBands = 0
    let gapYears = 0
    for (let i = 1; i < idxs.length; i++) {
      gapBands = Math.max(gapBands, idxs[i] - idxs[i - 1])
      gapYears = Math.max(gapYears, centre[idxs[i]] - centre[idxs[i - 1]])
    }
    const spanYears = idxs.length > 1 ? centre[idxs[idxs.length - 1]] - centre[idxs[0]] : 0
    const ded = dedByConcept.get(c.id) ?? ZERO
    const thr = thrByConcept.get(c.id) ?? ZERO
    return {
      id: c.id,
      label: c.label,
      dedicated: ded,
      threaded: thr,
      total: add(ded, thr),
      occasions: where.length,
      strands: new Set(where.map((s) => s.strand)).size,
      bands,
      firstMainBand: mainBands[0] ?? null,
      returns: Math.max(0, bands.length - 1),
      longestGapBands: gapBands,
      longestGapYears: gapYears,
      returnsPerYear: spanYears > 0 ? (bands.length - 1) / spanYears : null,
      subjects: [...new Set(where.flatMap((st) => [...(topicSubjects.get(st.id)?.keys() ?? [])]))],
    }
  })

  const seenMain = new Set<string>()
  const bandMeasures: BandMeasure[] = bandNames.map((band, i) => {
    const inBand = stages.filter((s) => s.band === band)
    const units = axis.units.filter((u) => u.coords[0] === i + 1)
    const biology = units.reduce((acc, u) => add(acc, available(u)), ZERO)
    const evo = byBand.get(i + 1) ?? ZERO
    const ids = new Set(inBand.flatMap((s) => s.concepts.map((c) => c.id)))
    const mainNow = new Set(inBand.flatMap((s) => s.concepts.filter((c) => c.emphasis === 'primary').map((c) => c.id)))
    const fresh = [...mainNow].filter((id) => !seenMain.has(id))
    mainNow.forEach((id) => seenMain.add(id))
    const strandsPerConcept = new Map<string, Set<string>>()
    for (const s of inBand) for (const c of s.concepts) {
      if (!strandsPerConcept.has(c.id)) strandsPerConcept.set(c.id, new Set())
      strandsPerConcept.get(c.id)!.add(s.strand)
    }
    const shared = [...strandsPerConcept.values()].filter((v) => v.size > 1).length
    const outcomes = inBand.reduce((a, s) => a + s.outcomes, 0)
    const yearsInBand = new Set(units.map((u) => (yearIdx >= 0 ? u.absAt[yearIdx] : u.abs))).size
    return {
      band,
      years: yearsInBand,
      biology,
      evolution: evo,
      evolutionShareOfBiology: { low: biology.low > 0 ? evo.low / biology.low : 0, high: biology.high > 0 ? evo.high / biology.high : 0 },
      stages: inBand.length,
      outcomes,
      distinctConcepts: ids.size,
      newMainConcepts: fresh.length,
      conceptsSharedAcrossStrands: shared,
      minutesPerOutcome: outcomes > 0 ? scale(evo, 1 / outcomes) : ZERO,
      newMainPer10h: {
        low: evo.high > 0 ? (fresh.length / (evo.high / 60)) * 10 : 0,
        high: evo.low > 0 ? (fresh.length / (evo.low / 60)) * 10 : 0,
      },
    }
  })

  const hostMeasures: HostMeasure[] = (hostCtx?.hosts ?? []).map((h) => {
    const avail = bandMinutes(h.axis, bandNames.length)
    const used = hostBand.get(h.subject) ?? bandNames.map(() => ZERO)
    const bands: HostBandMeasure[] = bandNames.map((band, i) => ({
      band,
      available: avail[i],
      claimed: used[i],
      share: { low: avail[i].low > 0 ? used[i].low / avail[i].low : 0, high: avail[i].high > 0 ? used[i].high / avail[i].high : 0 },
    }))
    const totalAvail = avail.reduce((a, b) => add(a, b), ZERO)
    const totalUsed = used.reduce((a, b) => add(a, b), ZERO)
    return {
      axisId: h.axisId, subject: h.subject, label: h.label,
      available: totalAvail, claimed: totalUsed,
      share: { low: totalAvail.low > 0 ? totalUsed.low / totalAvail.low : 0, high: totalAvail.high > 0 ? totalUsed.high / totalAvail.high : 0 },
      bands, topics: hostTopics.get(h.subject)?.size ?? 0,
    }
  })
  const withTime = [...topicSubjects.values()]
  const crossSubjectTopics = withTime.filter((m) => m.size > 1).length
  const meanSubjectsPerTopic = withTime.length > 0 ? withTime.reduce((a, m) => a + m.size, 0) / withTime.length : 0

  return {
    totalEvolution: add(dedicated, threaded),
    dedicatedMinutes: dedicated,
    threadedMinutes: threaded,
    topics: stages.map((s) => ({ id: s.id, title: s.title, band: s.band, minutes: topicMinutes.get(s.id) ?? ZERO })),
    concepts: conceptMeasures,
    bands: bandMeasures,
    byTag,
    placementsWithoutTarget,
    hosts: hostMeasures,
    crossSubjectTopics,
    meanSubjectsPerTopic,
  }
}
