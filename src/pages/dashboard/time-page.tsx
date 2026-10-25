import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Hourglass, MessageSquare } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { Chip } from '@/components/chip'
import { getProjectBySlug } from '@/lib/supabase/projects'
import { KNOWN_COMPARISON_PAIRS } from '@/lib/supabase/comparative-analysis'
import {
  addAssumption, loadAssumptionTopics, loadOrderSources, loadPlacements, loadTimeContent, loadTimeData, savePlanCopy, startAssumptionDiscussion, updateAssumption,
  type PlacementRow, type TimeAssumptionRow, type TimeData, type TimePlanRow,
} from '@/lib/supabase/time-plans'
import {
  checkOrder, computePlanMeasures, deriveOrderEdges, EMPTY_SOURCES, expandAxis, generateStarterPlacements, ORDER_RULES, placementMinutes, projectPlan, selectUnits, structuralProfile,
  type Axis, type OrderRule, type OrderSources, type OrderStatus, type StructuralProfile, type AxisDef, type ConceptRef, type Placement, type PlanMeasures, type Preset, type ProjectionRule, type StageRef, type StarterParams, type Unit,
} from '@/lib/time'

// The Time page. Time stays out of the LPM content: a plan places the content of this space onto an axis (a
// sequence of discrete units of any size) and every number rests on a listed assumption.
// Design note: lab_manager/docs/design-notes/bio-core-interdisciplinary-modelling-literature-human-examples-and-time-budget-2026-10-25.md
// (section 5). Derived values are computed here from the plan and the content and are never stored.

const EDIT_ROLES = ['owner', 'maintainer', 'editor', 'contributor']

function hrs(min: number): string {
  const h = min / 60
  return h >= 10 ? String(Math.round(h)) : h >= 1 ? h.toFixed(1) : h.toFixed(2)
}
function range(r: { low: number; high: number }): string {
  if (Math.abs(r.low - r.high) < 0.5) return `${hrs(r.low)} h`
  return `${hrs(r.low)} to ${hrs(r.high)} h`
}
function pct(r: { low: number; high: number }): string {
  const a = Math.round(r.low * 100)
  const b = Math.round(r.high * 100)
  return a === b ? `${a}%` : `${a} to ${b}%`
}

interface Segment { from: number; to: number; role: string }

/** Where a placement sits inside each year, for the year strip. */
function yearSegments(axis: Axis, placements: Placement[], unitsByYear: Map<number, Unit[]>): Map<number, Segment[]> {
  const yi = axis.levels.indexOf('year')
  const out = new Map<number, Segment[]>()
  if (yi < 0) return out
  for (const p of placements) {
    const role = p.role ?? 'dedicated'
    const hits = selectUnits(axis, p.selector)
    const byYear = new Map<number, number[]>()
    for (const h of hits) {
      const y = h.unit.absAt[yi]
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(h.unit.abs)
    }
    for (const [year, abss] of byYear) {
      const units = unitsByYear.get(year) ?? []
      const list = out.get(year) ?? []
      if (units.length <= 1) {
        const span = p.selector.span
        const cut = !!span && (p.selector.spanWithin === 'year' || byYear.size === 1)
        list.push({ from: cut ? span!.from : 0, to: cut ? span!.to : 1, role })
      } else {
        const idx = abss.map((a) => units.findIndex((u) => u.abs === a)).filter((i) => i >= 0).sort((a, b) => a - b)
        let start = idx[0]
        let prev = idx[0]
        for (let k = 1; k <= idx.length; k++) {
          if (k === idx.length || idx[k] !== prev + 1) {
            list.push({ from: start / units.length, to: (prev + 1) / units.length, role })
            start = idx[k]
          }
          prev = idx[k]
        }
      }
      out.set(year, list)
    }
  }
  return out
}

function YearStrip({ axis, placements }: { axis: Axis; placements: Placement[] }) {
  const yi = axis.levels.indexOf('year')
  const data = useMemo(() => {
    if (yi < 0) return null
    const unitsByYear = new Map<number, Unit[]>()
    for (const u of axis.units) {
      const y = u.absAt[yi]
      if (!unitsByYear.has(y)) unitsByYear.set(y, [])
      unitsByYear.get(y)!.push(u)
    }
    return { unitsByYear, segs: yearSegments(axis, placements, unitsByYear) }
  }, [axis, placements, yi])
  if (!data) return <p className="muted">This axis has no year level, so there is no year strip to draw.</p>
  const years = [...data.unitsByYear.keys()].sort((a, b) => a - b)
  const names = axis.def.levels[yi]?.names
  const rowH = 20
  const left = 78
  const width = 640
  return (
    <svg viewBox={`0 0 ${left + width + 8} ${years.length * rowH + 6}`} role="img" aria-label="Where evolution time sits inside each school year" style={{ width: '100%', maxWidth: 760, height: 'auto' }}>
      {years.map((y, i) => {
        const top = i * rowH + 3
        const segs = data.segs.get(y) ?? []
        return (
          <g key={y}>
            <text x={0} y={top + 12} fontSize={11} fill="var(--text-muted)">{names?.[y - 1] ?? `Year ${y}`}</text>
            <rect x={left} y={top + 2} width={width} height={rowH - 8} rx={3} fill="var(--border)" opacity={0.45} />
            {segs.filter((s) => s.role === 'threaded').map((s, k) => (
              <rect key={`t${k}`} x={left + s.from * width} y={top + 2} width={Math.max(1.5, (s.to - s.from) * width)} height={rowH - 8} rx={3} fill="var(--map-3)" opacity={0.35} />
            ))}
            {segs.filter((s) => s.role !== 'threaded').map((s, k) => (
              <rect key={`d${k}`} x={left + s.from * width} y={top + 2} width={Math.max(2, (s.to - s.from) * width)} height={rowH - 8} rx={3} fill="var(--map-1)" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

const ORDER_LABEL: Record<OrderStatus, string> = {
  'in-order': 'in order', 'leans-in-order': 'leans in order', 'unordered': 'order left open',
  'leans-out-of-order': 'leans out of order', 'out-of-order': 'out of order', 'not-placed': 'not in this plan',
}
const ORDER_CHIP: Record<OrderStatus, string> = {
  'in-order': 'accepted', 'leans-in-order': 'pending', 'unordered': 'draft', 'leans-out-of-order': 'pending', 'out-of-order': 'rejected', 'not-placed': 'merged',
}
const ORDER_SORT: OrderStatus[] = ['out-of-order', 'leans-out-of-order', 'unordered', 'leans-in-order', 'in-order', 'not-placed']

function structureRows(a: StructuralProfile, b: StructuralProfile | null, bo: { orderedShare: number | null; unorderedShare: number | null } | null, order: { orderedShare: number | null; unorderedShare: number | null } | null) {
  const n = (v: number, d = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(d))
  const p = (v: number) => `${Math.round(v * 100)}%`
  const share = (o: { orderedShare: number | null } | null) => (o && o.orderedShare !== null ? p(o.orderedShare) : 'none')
  const open = (o: { unorderedShare: number | null } | null) => (o && o.unorderedShare !== null ? p(o.unorderedShare) : 'none')
  const row = (label: string, hint: string, f: (x: StructuralProfile) => string, ra?: string, rb?: string) => ({ label, hint, a: ra ?? f(a), b: rb ?? (b ? f(b) : '') })
  return [
    row('Stages', 'Units of teaching in the space', (x) => String(x.stages)),
    row('Outcomes', 'Performance indicators across all stages', (x) => String(x.outcomes)),
    row('Strands', 'Learning paths running through the grade bands', (x) => String(x.strands)),
    row('Concepts used', 'Concepts that appear in at least one stage', (x) => String(x.conceptsUsed)),
    row('Main ideas per stage', 'Concepts a stage is mainly about', (x) => n(x.primaryPerStage)),
    row('Supporting concepts per stage', 'Concepts a stage reinforces', (x) => n(x.reinforcingPerStage)),
    row('Reach: stages per concept', 'Mean, median and maximum number of stages a concept appears in', (x) => `${n(x.reachStages.mean)}, ${n(x.reachStages.median)}, ${x.reachStages.max}`),
    row('Reach: strands per concept', 'Mean and maximum number of strands a concept crosses', (x) => `${n(x.reachStrands.mean)}, ${x.reachStrands.max}`),
    row('Concepts in three or more stages', 'The recurring vocabulary', (x) => p(x.reachStages.shareInThreePlus)),
    row('Concepts in one stage only', 'Vocabulary that never returns', (x) => String(x.reachStages.appearOnce)),
    row('Spread of use (entropy, bits)', 'Higher means use is spread evenly over concepts', (x) => n(x.reachStages.entropyBits, 2)),
    row('Concentration (Gini)', '0 is even use, 1 is all use on one concept', (x) => n(x.reachStages.gini, 2)),
    row('Share held by the top three concepts', 'How much of the vocabulary load three concepts carry', (x) => p(x.reachStages.topThreeShare)),
    row('Concepts that are never a main idea', 'Used only in support', (x) => String(x.neverMain)),
    row('Ordering claims', 'Prerequisite, thread and band links among stages', (x) => String(x.orderEdges)),
    row('Share ordered by this plan', 'Of the claims the plan can place', () => '', share(order), bo ? share(bo) : ''),
    row('Share left open by this plan', 'Claims whose stages share the same time', () => '', open(order), bo ? open(bo) : ''),
  ]
}

function bandNamesOf(axis: Axis | null): string[] {
  return axis && axis.levels[0] === 'band' ? axis.def.levels[0]?.names ?? [] : []
}

function safeExpand(def: AxisDef): { axis: Axis | null; error: string | null } {
  try {
    return { axis: expandAxis(def), error: null }
  } catch (e) {
    return { axis: null, error: e instanceof Error ? e.message : String(e) }
  }
}

function measuresFor(axis: Axis | null, placements: Placement[], stages: StageRef[], concepts: ConceptRef[], params: Record<string, unknown>): PlanMeasures | null {
  if (!axis || axis.levels[0] !== 'band') return null
  return computePlanMeasures(axis, placements, stages, concepts, { reinforcing_share: typeof params.reinforcing_share === 'number' ? params.reinforcing_share : undefined })
}

export default function TimePage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const canEdit = EDIT_ROLES.includes(role)
  const [data, setData] = useState<TimeData | null>(null)
  const [content, setContent] = useState<{ stages: StageRef[]; concepts: ConceptRef[] } | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [placementsFor, setPlacementsFor] = useState<string | null>(null)
  const [topics, setTopics] = useState<Map<string, string>>(new Map())
  const [segEdits, setSegEdits] = useState<Record<string, { low: number; high: number }>>({})
  const [paramEdits, setParamEdits] = useState<Partial<StarterParams>>({})
  const [axisJson, setAxisJson] = useState<string | null>(null)
  const [placementsJson, setPlacementsJson] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [copyName, setCopyName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [rule, setRule] = useState<ProjectionRule | null>(null)
  const [partner, setPartner] = useState<{ name: string; measures: PlanMeasures; structure: StructuralProfile; orderedShare: number | null; unorderedShare: number | null; edges: number } | null>(null)
  const [sources, setSources] = useState<OrderSources>(EMPTY_SOURCES)
  const [rules, setRules] = useState<OrderRule[]>(ORDER_RULES.map((r) => r.key))
  const [partnerMsg, setPartnerMsg] = useState<string | null>(null)

  const reload = useCallback(async (select?: string) => {
    const [d, c, t, src] = await Promise.all([loadTimeData(supabase, project.id), loadTimeContent(supabase, project.id), loadAssumptionTopics(supabase, project.id), loadOrderSources(supabase, project.id)])
    setSources(src)
    setData(d)
    setContent(c)
    setTopics(t)
    setPlanId((cur) => select ?? cur ?? d.plans[0]?.id ?? null)
  }, [supabase, project.id])

  useEffect(() => { void reload() }, [reload])

  const plan: TimePlanRow | null = data?.plans.find((p) => p.id === planId) ?? null
  const axisRow = data?.axes.find((a) => a.id === plan?.axis_id) ?? null

  useEffect(() => {
    setSegEdits({}); setParamEdits({}); setAxisJson(null); setPlacementsJson(null); setJsonError(null); setMessage(null); setRule(null)
    setCopyName(plan ? `${plan.name} (copy)` : '')
    setPlacementsFor(null)
    if (!plan) { setPlacements([]); return }
    void loadPlacements(supabase, plan.id).then((rows) => { setPlacements(rows); setPlacementsFor(plan.id) })
  }, [plan?.id, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const baseParams = (plan?.parameters ?? {}) as Partial<StarterParams>
  const hasPreset = !!baseParams.preset
  const effParams = { ...baseParams, ...paramEdits } as StarterParams & Record<string, unknown>

  const effAxisDef: AxisDef | null = useMemo(() => {
    if (!axisRow) return null
    if (axisJson !== null) {
      try { return JSON.parse(axisJson) as AxisDef } catch { return axisRow.definition }
    }
    const def = axisRow.definition
    if (Object.keys(segEdits).length === 0) return def
    return { ...def, segments: (def.segments ?? []).map((s) => (segEdits[s.key] ? { ...s, duration: { low: `PT${segEdits[s.key].low}H`, high: `PT${segEdits[s.key].high}H` } } : s)) }
  }, [axisRow, segEdits, axisJson])

  const { axis, error: axisError } = useMemo(() => (effAxisDef ? safeExpand(effAxisDef) : { axis: null, error: null }), [effAxisDef])

  // Every ordering claim, used to put stages in dependency order inside a band.
  const allEdges = useMemo(() => (content ? deriveOrderEdges(sources, content.stages, bandNamesOf(axis)) : []), [sources, content, axis])

  const effPlacements: Placement[] = useMemo(() => {
    if (placementsJson !== null) {
      try { return JSON.parse(placementsJson) as Placement[] } catch { return placements }
    }
    if (hasPreset && content && Object.keys(paramEdits).length > 0) return generateStarterPlacements(content.stages, effParams, bandNamesOf(axis), allEdges)
    return placements
  }, [placementsJson, placements, hasPreset, content, paramEdits, effParams, axis, allEdges])

  const measures = useMemo(() => (content ? measuresFor(axis, effPlacements, content.stages, content.concepts, effParams) : null), [axis, effPlacements, content, effParams])

  const checkedEdges = useMemo(() => (content ? deriveOrderEdges(sources, content.stages, bandNamesOf(axis), rules) : []), [sources, content, axis, rules])
  const order = useMemo(() => (axis && measures ? checkOrder(axis, effPlacements, checkedEdges) : null), [axis, measures, effPlacements, checkedEdges])
  const structure = useMemo(() => (content && axis && measures ? structuralProfile(content.stages, content.concepts, allEdges, bandNamesOf(axis)) : null), [content, axis, measures, allEdges])

  const dirty = Object.keys(segEdits).length > 0 || Object.keys(paramEdits).length > 0 || axisJson !== null || placementsJson !== null

  const planTotal = useMemo(() => {
    if (!axis) return { low: 0, high: 0 }
    return effPlacements.reduce((s, p) => {
      const m = placementMinutes(axis, p)
      return { low: s.low + m.reduce((a, b) => a + b.low, 0), high: s.high + m.reduce((a, b) => a + b.high, 0) }
    }, { low: 0, high: 0 })
  }, [axis, effPlacements])

  // Projection of a plan written on a generic axis onto a dated axis.
  const projection = data?.projections.find((p) => p.source_axis_id === axisRow?.id) ?? null
  const targetRow = data?.axes.find((a) => a.id === projection?.target_axis_id) ?? null
  const fit = useMemo(() => {
    if (!axis || !projection || !targetRow) return null
    const target = safeExpand(targetRow.definition).axis
    if (!target) return null
    const useRule = rule ?? (projection.rule as ProjectionRule)
    try { return projectPlan(axis, effPlacements, target, useRule) } catch { return null }
  }, [axis, projection, targetRow, effPlacements, rule])

  // The partner space (Bio-Core and Interdisciplinary): the same preset on the same axis shape.
  const partnerSlug = KNOWN_COMPARISON_PAIRS[project.slug]
  async function loadPartner() {
    setPartnerMsg(null)
    if (!partnerSlug || !plan || !axis) return
    const res = await getProjectBySlug(supabase, partnerSlug)
    const pr = res.project
    const pid = pr?.id
    if (!pid) { setPartnerMsg('The partner space is not visible to you.'); return }
    const [d, c, psrc] = await Promise.all([loadTimeData(supabase, pid), loadTimeContent(supabase, pid), loadOrderSources(supabase, pid)])
    const match = d.plans.find((p) => (p.parameters as Partial<StarterParams>)?.preset === effParams.preset && p.axis_id && d.axes.find((a) => a.id === p.axis_id)?.kind === axisRow?.kind)
    if (!match) { setPartnerMsg('The partner space has no plan with the same pattern yet.'); return }
    const defP = effAxisDef as AxisDef
    const ax = safeExpand(defP).axis
    if (!ax) return
    const bands = bandNamesOf(ax)
    const pedges = deriveOrderEdges(psrc, c.stages, bands)
    const pl = effParams.preset ? generateStarterPlacements(c.stages, { ...(match.parameters as unknown as StarterParams), ...paramEdits }, bands, pedges) : await loadPlacements(supabase, match.id)
    const m = measuresFor(ax, pl, c.stages, c.concepts, match.parameters)
    const ord = checkOrder(ax, pl, deriveOrderEdges(psrc, c.stages, bands, rules))
    if (m) setPartner({ name: pr?.name ?? partnerSlug, measures: m, structure: structuralProfile(c.stages, c.concepts, pedges, bands), orderedShare: ord.orderedShare, unorderedShare: ord.unorderedShare, edges: pedges.length })
  }

  async function saveCopy() {
    if (!plan || !axisRow || !axis || !content) return
    setMessage(null)
    const changedAxis = axisJson !== null || Object.keys(segEdits).length > 0
    const result = await savePlanCopy(supabase, {
      projectId: project.id,
      from: plan,
      name: copyName.trim() || `${plan.name} (copy)`,
      summary: plan.summary,
      parameters: { ...(plan.parameters ?? {}), ...paramEdits },
      placements: effPlacements,
      axis: changedAxis && effAxisDef
        ? { name: `${axisRow.name} (edited)`, description: axisRow.description, kind: axisRow.kind, definition: effAxisDef, source: axisRow.source }
        : { existingId: axisRow.id },
    })
    if ('error' in result) { setMessage(`Could not save: ${result.error}`); return }
    setMessage('Saved as a new plan. The original is unchanged.')
    await reload(result.planId)
  }

  function checkJson() {
    setJsonError(null)
    try {
      const def = JSON.parse(axisJson ?? JSON.stringify(axisRow?.definition)) as AxisDef
      const ax = expandAxis(def)
      const ps = JSON.parse(placementsJson ?? JSON.stringify(effPlacements)) as Placement[]
      for (const p of ps) { if (!p.selector || !p.amount || !p.target_type || !p.target_id) throw new Error('Every placement needs a target, a selector and an amount.'); placementMinutes(ax, p) }
      setMessage(`Valid: ${ax.units.length} units and ${ps.length} placements.`)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!data || !content) return <p className="muted">Loading…</p>

  const assumptions = data.assumptions.filter((a) => a.plan_id === plan?.id || a.axis_id === plan?.axis_id || (projection && a.projection_id === projection.id))
  const segments = effAxisDef?.segments ?? []

  return (
    <div>
      <h1 className="row"><Hourglass size={18} style={{ color: 'var(--text-muted)' }} />Time</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Time is kept apart from the content. A plan puts the content of this space onto a calendar of any length and says how much time each part gets.
        Every number below rests on an assumption listed at the bottom, with its source and a place to discuss it. The starter plans are AI-drafted
        and unreviewed, and every figure in them is a placeholder.
      </p>

      {data.plans.length === 0 ? (
        <div className="card empty"><Hourglass size={32} /><p>No time plans for this space yet.</p></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="field" style={{ maxWidth: 520 }}>
              <label>Plan</label>
              <select value={planId ?? ''} onChange={(e) => setPlanId(e.target.value)}>
                {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {plan && (
              <>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Chip status={plan.status}>{plan.status}</Chip>
                  <span className="muted">Kind: {plan.kind}</span>
                  <span className="muted">Axis: {axisRow?.name}</span>
                </div>
                {plan.summary && <p style={{ marginBottom: 0 }}>{plan.summary}</p>}
              </>
            )}
            {axisError && <div className="notice notice-bad" style={{ marginTop: 8 }}>{axisError}</div>}
          </div>

          {axis && plan && placementsFor !== plan.id && <p className="muted">Loading the plan…</p>}
          {axis && plan && placementsFor === plan.id && (
            <>
              {segments.length > 0 && <h2>Hours per school year</h2>}
              {segments.length > 0 && <div className="card" style={{ marginBottom: 16 }}>
                <p className="muted" style={{ marginTop: 0 }}>
                  Hours of teaching time per year in each tier. Change them to match local conditions. Changes preview at once and are saved as a copy.
                  Tiers sit beside the grade bands, so one grade can belong to a band and to a tier.
                </p>
                <div className="grid grid-3">
                  {segments.map((s) => {
                    const low = segEdits[s.key]?.low ?? Number(String(s.duration.low).replace(/[^0-9.]/g, '').replace(/^$/, '0'))
                    const high = segEdits[s.key]?.high ?? Number(String(s.duration.high ?? s.duration.low).replace(/[^0-9.]/g, '').replace(/^$/, '0'))
                    return (
                      <div key={s.key} className="field">
                        <label>{s.label ?? s.key}</label>
                        <div className="row" style={{ gap: 6 }}>
                          <input type="number" min={0} value={low} disabled={!canEdit || axisJson !== null} aria-label={`${s.label} low hours`} style={{ width: 80 }}
                            onChange={(e) => setSegEdits({ ...segEdits, [s.key]: { low: Number(e.target.value), high } })} />
                          <span>to</span>
                          <input type="number" min={0} value={high} disabled={!canEdit || axisJson !== null} aria-label={`${s.label} high hours`} style={{ width: 80 }}
                            onChange={(e) => setSegEdits({ ...segEdits, [s.key]: { low, high: Number(e.target.value) } })} />
                          <span className="muted">h a year</span>
                        </div>
                        {s.note && <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{s.note}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>}

              {hasPreset && (
                <>
                  <h2>Pattern and share</h2>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="grid grid-3">
                      <div className="field">
                        <label>Pattern</label>
                        <select value={effParams.preset} disabled={!canEdit} onChange={(e) => setParamEdits({ ...paramEdits, preset: e.target.value as Preset })}>
                          <option value="capstone">One unit at the end of each year</option>
                          <option value="threaded">A slice of every session</option>
                          <option value="spiral">Short blocks that return, plus a thread</option>
                          <option value="sequenced">Stages in sequence, in dependency order</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Evolution's share of biology time (percent, low to high)</label>
                        <div className="row" style={{ gap: 6 }}>
                          <input type="number" min={0} max={100} style={{ width: 70 }} disabled={!canEdit} value={Math.round((effParams.share?.low ?? 0) * 100)}
                            onChange={(e) => setParamEdits({ ...paramEdits, share: { low: Number(e.target.value) / 100, high: effParams.share?.high ?? 0 } })} />
                          <span>to</span>
                          <input type="number" min={0} max={100} style={{ width: 70 }} disabled={!canEdit} value={Math.round((effParams.share?.high ?? 0) * 100)}
                            onChange={(e) => setParamEdits({ ...paramEdits, share: { low: effParams.share?.low ?? 0, high: Number(e.target.value) / 100 } })} />
                        </div>
                      </div>
                      {effParams.preset === 'sequenced' && (
                        <div className="field">
                          <label>Order inside each band</label>
                          <select value={effParams.sequence_order ?? 'dependency'} disabled={!canEdit} onChange={(e) => setParamEdits({ ...paramEdits, sequence_order: e.target.value as 'dependency' | 'reverse' })}>
                            <option value="dependency">Dependency order</option>
                            <option value="reverse">Reverse order (a control for the order check)</option>
                          </select>
                        </div>
                      )}
                      {effParams.preset === 'spiral' && (
                        <>
                          <div className="field">
                            <label>Blocks per year</label>
                            <input type="number" min={1} max={6} style={{ width: 70 }} disabled={!canEdit} value={effParams.returns_per_year ?? 2}
                              onChange={(e) => setParamEdits({ ...paramEdits, returns_per_year: Number(e.target.value) })} />
                          </div>
                          <div className="field">
                            <label>Kept as a thread (percent)</label>
                            <input type="number" min={0} max={90} style={{ width: 70 }} disabled={!canEdit} value={Math.round((effParams.thread_fraction ?? 0.25) * 100)}
                              onChange={(e) => setParamEdits({ ...paramEdits, thread_fraction: Number(e.target.value) / 100 })} />
                          </div>
                        </>
                      )}
                      <div className="field">
                        <label>Reinforcing concepts get (percent of a topic's time)</label>
                        <input type="number" min={0} max={100} style={{ width: 70 }} disabled={!canEdit} value={Math.round((effParams.reinforcing_share ?? 0.15) * 100)}
                          onChange={(e) => setParamEdits({ ...paramEdits, reinforcing_share: Number(e.target.value) / 100 })} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {dirty && canEdit && (
                <div className="notice" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                  <span>Unsaved changes. The tables below show a preview.</span>
                  <input value={copyName} onChange={(e) => setCopyName(e.target.value)} aria-label="Name of the copy" style={{ minWidth: 220 }} />
                  <button className="btn btn-mini" onClick={saveCopy}>Save as a copy</button>
                  <button className="btn btn-mini" onClick={() => { setSegEdits({}); setParamEdits({}); setAxisJson(null); setPlacementsJson(null); setJsonError(null) }}>Reset</button>
                </div>
              )}
              {message && <div className="notice notice-ok" style={{ marginBottom: 16 }}>{message}</div>}

              <h2>Where the time sits</h2>
              <div className="card" style={{ marginBottom: 16 }}>
                <p className="muted" style={{ marginTop: 0 }}>
                  Each row is a school year. Green is a unit of teaching, blue is a slice that runs through the year. Total over the whole axis: <strong>{range(planTotal)}</strong>.
                </p>
                <YearStrip axis={axis} placements={effPlacements} />
              </div>

              {measures && (
                <>
                  <h2>By grade band</h2>
                  <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <p className="muted" style={{ marginTop: 0 }}>Grain: grade band. Ranges run from the low to the high end of every assumption.</p>
                    <table>
                      <thead>
                        <tr><th>Band</th><th>Years</th><th>Biology time</th><th>Evolution time</th><th>Share</th><th>Stages</th><th>Outcomes</th><th>Per outcome</th><th>New main concepts</th><th>Per 10 h</th><th>Shared across strands</th></tr>
                      </thead>
                      <tbody>
                        {measures.bands.map((b) => (
                          <tr key={b.band}>
                            <td>{b.band}</td><td>{b.years}</td><td>{range(b.biology)}</td><td>{range(b.evolution)}</td><td>{pct(b.evolutionShareOfBiology)}</td>
                            <td>{b.stages}</td><td>{b.outcomes}</td><td>{b.outcomes ? range(b.minutesPerOutcome) : 'none'}</td>
                            <td>{b.newMainConcepts}</td><td>{b.newMainConcepts ? `${b.newMainPer10h.low.toFixed(1)} to ${b.newMainPer10h.high.toFixed(1)}` : 'none'}</td><td>{b.conceptsSharedAcrossStrands} of {b.distinctConcepts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      Total evolution time: {range(measures.totalEvolution)}. Dedicated: {range(measures.dedicatedMinutes)}. Threaded: {range(measures.threadedMinutes)}.
                      {Object.keys(measures.byTag).length > 0 && ' By tier: ' + Object.entries(measures.byTag).map(([k, v]) => `${k} ${range(v)}`).join('; ') + '.'}
                      {' '}This measures crowding. It says nothing about which content matters or how well it is learned.
                    </p>
                  </div>

                  {partnerSlug && (
                    <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0 }}>Compare with the partner space</h3>
                        <button className="btn btn-mini" onClick={loadPartner}>{partner ? 'Refresh' : 'Compare'}</button>
                      </div>
                      <p className="muted">Same hours for both spaces: each gets the same biology time and the same pattern. The numbers show how crowded each design is under that budget.</p>
                      {partnerMsg && <p className="muted">{partnerMsg}</p>}
                      {partner && (
                        <table>
                          <thead>
                            <tr><th>Band</th><th>{project.name}: outcomes</th><th>per outcome</th><th>new main per 10 h</th><th>{partner.name}: outcomes</th><th>per outcome</th><th>new main per 10 h</th></tr>
                          </thead>
                          <tbody>
                            {measures.bands.map((b, i) => {
                              const o = partner.measures.bands[i]
                              if (!o) return null
                              return (
                                <tr key={b.band}>
                                  <td>{b.band}</td>
                                  <td>{b.outcomes}</td><td>{b.outcomes ? range(b.minutesPerOutcome) : 'none'}</td><td>{b.newMainConcepts ? `${b.newMainPer10h.low.toFixed(1)} to ${b.newMainPer10h.high.toFixed(1)}` : 'none'}</td>
                                  <td>{o.outcomes}</td><td>{o.outcomes ? range(o.minutesPerOutcome) : 'none'}</td><td>{o.newMainConcepts ? `${o.newMainPer10h.low.toFixed(1)} to ${o.newMainPer10h.high.toFixed(1)}` : 'none'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  <h2>By concept</h2>
                  <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Concept time is derived from topic time. A topic's primary concepts share its dedicated time equally, and its reinforcing concepts receive the share set above as threaded time.
                      Gaps are measured between grade bands (grain: band centres, in school years).
                    </p>
                    <table>
                      <thead>
                        <tr><th>Concept</th><th>Dedicated</th><th>Threaded</th><th>Total</th><th>Stages</th><th>Strands</th><th>Bands</th><th>First main idea</th><th>Returns</th><th>Longest gap</th></tr>
                      </thead>
                      <tbody>
                        {measures.concepts.filter((c) => c.occasions > 0).sort((a, b) => b.total.high - a.total.high).map((c) => (
                          <tr key={c.id}>
                            <td>{c.label}</td><td>{range(c.dedicated)}</td><td>{range(c.threaded)}</td><td>{range(c.total)}</td>
                            <td>{c.occasions}</td><td>{c.strands}</td><td>{c.bands.join(', ')}</td><td>{c.firstMainBand ?? 'never'}</td><td>{c.returns}</td>
                            <td>{c.returns ? `${c.longestGapYears.toFixed(1)} years` : 'none'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {order && content && axis && (
                <>
                  <h2>Order checks</h2>
                  <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Does this plan put the content in an order that the space's own sequencing claims allow? Each claim below is a rule you can switch off.
                      Where two stages share the same units of time, the plan leaves their order open. That describes the plan and makes no claim that it is wrong.
                      Grain: {axis.levels[axis.levels.length - 1]}.
                    </p>
                    <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                      {ORDER_RULES.map((r) => (
                        <label key={r.key} className="row" style={{ gap: 6 }}>
                          <input type="checkbox" checked={rules.includes(r.key)} onChange={(e) => setRules(e.target.checked ? [...rules, r.key] : rules.filter((x) => x !== r.key))} />
                          <span>{r.label} ({allEdges.filter((e) => e.rules.includes(r.key)).length})</span>
                        </label>
                      ))}
                    </div>
                    <p>
                      Claims checked: {order.items.length}. {(['in-order', 'leans-in-order', 'unordered', 'leans-out-of-order', 'out-of-order', 'not-placed'] as OrderStatus[]).map((k) => `${ORDER_LABEL[k]} ${order.summary[k]}`).join(', ')}.
                      {order.orderedShare !== null && ` Share ordered by the plan: ${Math.round(order.orderedShare * 100)}%. Share left open: ${Math.round((order.unorderedShare ?? 0) * 100)}%.`}
                    </p>
                    {order.items.length > 0 && (
                      <table>
                        <thead><tr><th>Comes first</th><th>Comes second</th><th>Rule</th><th>Result</th><th>First: time</th><th>Second: time</th></tr></thead>
                        <tbody>
                          {[...order.items].sort((a, b) => ORDER_SORT.indexOf(a.status) - ORDER_SORT.indexOf(b.status)).slice(0, 80).map((it) => {
                            const label = (id: string) => content.stages.find((s) => s.id === id)?.title ?? id
                            const span = (t: { first: number; last: number } | null) => {
                              if (!t) return 'none'
                              const a = axis.units[t.first - 1]?.label ?? String(t.first)
                              const b = axis.units[t.last - 1]?.label ?? String(t.last)
                              return a === b ? a : `${a} to ${b}`
                            }
                            return (
                              <tr key={`${it.edge.from}|${it.edge.to}`}>
                                <td>{label(it.edge.from)}</td><td>{label(it.edge.to)}</td>
                                <td>{it.edge.rules.map((r) => ORDER_RULES.find((x) => x.key === r)?.label.split(',')[0]).join('; ')}</td>
                                <td><Chip status={ORDER_CHIP[it.status]}>{ORDER_LABEL[it.status]}</Chip></td>
                                <td>{span(it.from)}</td><td>{span(it.to)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    {order.items.length > 80 && <p className="muted" style={{ marginBottom: 0 }}>Showing the first 80 of {order.items.length}, with the most serious results first.</p>}
                  </div>
                </>
              )}

              {structure && (
                <>
                  <h2>Structure of this space</h2>
                  <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Numbers read from the content alone, with no time in them. A time model takes these as inputs, and they let spaces with different aims be compared on the same measures.
                      {!partner && partnerSlug && ' Press Compare above to add the partner space.'}
                    </p>
                    <table>
                      <thead><tr><th>Measure</th><th>{project.name}</th>{partner && <th>{partner.name}</th>}</tr></thead>
                      <tbody>
                        {structureRows(structure, partner?.structure ?? null, partner ? { orderedShare: partner.orderedShare, unorderedShare: partner.unorderedShare } : null, order).map((r) => (
                          <tr key={r.label}><td>{r.label}<div className="muted" style={{ fontSize: 11.5 }}>{r.hint}</div></td><td>{r.a}</td>{partner && <td>{r.b}</td>}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {fit && projection && targetRow && (
                <>
                  <h2>Fit on a real calendar</h2>
                  <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <p className="muted" style={{ marginTop: 0 }}>
                      This plan is written on a generic year. It is laid over <strong>{targetRow.name}</strong>. {targetRow.source ? `Source: ${targetRow.source}` : ''}
                    </p>
                    <div className="field" style={{ maxWidth: 420 }}>
                      <label>How positions map onto the calendar</label>
                      <select value={rule ?? projection.rule} onChange={(e) => setRule(e.target.value as ProjectionRule)}>
                        <option value="teaching-time">Same share of the year's teaching minutes (holidays drop out)</option>
                        <option value="date-offset">Same number of days after the start (holidays stay in)</option>
                      </select>
                    </div>
                    <p>Fit: {fit.summary.fits} fit, {fit.summary.uncertain} uncertain, {fit.summary.short} short, {fit.summary.unplaced} not placed.</p>
                    <table>
                      <thead><tr><th>Placement</th><th>Asked for</th><th>Available</th><th>Status</th><th>Dates</th><th>Sessions</th><th>Closed days inside</th><th>Stretch</th></tr></thead>
                      <tbody>
                        {fit.items.map((it) => (
                          <tr key={it.index}>
                            <td>{it.note ?? it.target}</td><td>{range(it.requested)}</td><td>{range(it.available)}</td>
                            <td><Chip status={it.status === 'fits' ? 'accepted' : it.status === 'short' ? 'rejected' : 'draft'}>{it.status}</Chip></td>
                            <td>{it.windows.map((w) => `${w.firstDate} to ${w.lastDate}`).join('; ') || 'none'}</td>
                            <td>{it.sessions}</td><td>{it.closedDays}</td><td>{it.stretch ? `${it.stretch.toFixed(2)}x` : 'none'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {fit.spacing.length > 0 && (
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Spacing between returns of the same target: {fit.spacing.map((s) => s.gapsGenericDays.map((g, i) => `${g} generic days (${s.gapsElapsedDays[i]} elapsed days, ${hrs(s.gapsTeachingMinutes[i])} teaching hours)`).join('; ')).join('; ')}.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <h2>Assumptions</h2>
          <p className="muted" style={{ maxWidth: 720 }}>Every number and every rule on this page. Each can be edited, contested and discussed. Confidence is low unless there is a source.</p>
          {assumptions.length === 0 && <p className="muted">No assumptions are recorded for this plan yet.</p>}
          {assumptions.map((a) => (
            <AssumptionCard key={a.id} a={a} canEdit={canEdit} topicId={topics.get(a.id) ?? null}
              onSave={async (patch) => { await updateAssumption(supabase, a.id, patch); await reload() }}
              onDiscuss={async () => { await startAssumptionDiscussion(supabase, project.id, a); await reload() }} />
          ))}
          {canEdit && plan && <AddAssumption onAdd={async (row) => { await addAssumption(supabase, { project_id: project.id, plan_id: plan.id, axis_id: null, ...row }); await reload() }} />}

          {canEdit && plan && axisRow && (
            <details style={{ marginTop: 16 }}>
              <summary>Advanced: edit the axis and placements as JSON</summary>
              <div className="card" style={{ marginTop: 8 }}>
                <p className="muted" style={{ marginTop: 0 }}>For any axis shape: more levels, irregular sizes, dates, other resources. Check, preview, then save as a copy. Durations use ISO 8601 (for example PT45M).</p>
                <label>Axis definition</label>
                <textarea rows={10} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} value={axisJson ?? JSON.stringify(axisRow.definition, null, 2)} onChange={(e) => setAxisJson(e.target.value)} />
                <label>Placements</label>
                <textarea rows={10} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} value={placementsJson ?? JSON.stringify(effPlacements, null, 2)} onChange={(e) => setPlacementsJson(e.target.value)} />
                {jsonError && <div className="notice notice-bad">{jsonError}</div>}
                <button className="btn btn-mini" onClick={checkJson}>Check</button>
              </div>
            </details>
          )}
        </>
      )}
      <p className="muted" style={{ marginTop: 16 }}>
        Discussions about assumptions appear on the <Link to="../discussions">Discussions</Link> page.
      </p>
    </div>
  )
}

function AssumptionCard({ a, canEdit, topicId, onSave, onDiscuss }: {
  a: TimeAssumptionRow; canEdit: boolean; topicId: string | null
  onSave: (patch: Partial<Pick<TimeAssumptionRow, 'statement' | 'assumption_type' | 'confidence' | 'source' | 'rationale' | 'status'>>) => Promise<void>
  onDiscuss: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [statement, setStatement] = useState(a.statement)
  const [type, setType] = useState(a.assumption_type)
  const [conf, setConf] = useState(a.confidence)
  const [source, setSource] = useState(a.source ?? '')
  const [why, setWhy] = useState(a.rationale ?? '')
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      {!editing ? (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Chip status="pending">{a.assumption_type}</Chip>
            <Chip status={a.confidence === 'high' ? 'accepted' : a.confidence === 'medium' ? 'pending' : 'draft'}>{a.confidence} confidence</Chip>
            {a.status !== 'open' && <Chip status="pending">{a.status}</Chip>}
          </div>
          <p style={{ margin: '6px 0' }}><strong>{a.statement}</strong></p>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Source: {a.source ?? 'none recorded'}</p>
          {a.rationale && <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{a.rationale}</p>}
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            {topicId ? <Link className="btn btn-mini" to="../discussions"><MessageSquare size={12} /> Open discussion</Link> : <button className="btn btn-mini" onClick={() => void onDiscuss()}><MessageSquare size={12} /> Start a discussion</button>}
            {canEdit && <button className="btn btn-mini" onClick={() => setEditing(true)}>Edit</button>}
            {canEdit && a.status !== 'contested' && <button className="btn btn-mini" onClick={() => void onSave({ status: 'contested' })}>Mark contested</button>}
          </div>
        </>
      ) : (
        <>
          <div className="field"><label>Statement</label><textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} /></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field"><label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {['estimate', 'literature', 'derived', 'placeholder', 'calendar-constraint'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Confidence</label>
              <select value={conf} onChange={(e) => setConf(e.target.value as 'low' | 'medium' | 'high')}>
                {['low', 'medium', 'high'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
          </div>
          <div className="field"><label>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%' }} /></div>
          <div className="field"><label>Why this value</label><textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-mini" onClick={async () => { await onSave({ statement, assumption_type: type, confidence: conf, source: source || null, rationale: why || null }); setEditing(false) }}>Save</button>
            <button className="btn btn-mini" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

function AddAssumption({ onAdd }: { onAdd: (row: { statement: string; assumption_type: string; confidence: string; source: string | null; rationale: string | null }) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [statement, setStatement] = useState('')
  const [type, setType] = useState('estimate')
  const [conf, setConf] = useState('low')
  const [source, setSource] = useState('')
  if (!open) return <button className="btn btn-mini" onClick={() => setOpen(true)}>Add an assumption</button>
  return (
    <div className="card">
      <div className="field"><label>Statement</label><textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} /></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field"><label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>{['estimate', 'literature', 'derived', 'placeholder', 'calendar-constraint'].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field"><label>Confidence</label>
          <select value={conf} onChange={(e) => setConf(e.target.value)}>{['low', 'medium', 'high'].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field" style={{ flex: 1 }}><label>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%' }} /></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-mini" disabled={!statement.trim()} onClick={async () => { await onAdd({ statement: statement.trim(), assumption_type: type, confidence: conf, source: source || null, rationale: null }); setStatement(''); setSource(''); setOpen(false) }}>Add</button>
        <button className="btn btn-mini" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
