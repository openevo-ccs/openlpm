import type { SupabaseClient } from '@supabase/supabase-js'
import type { AxisDef, ConceptRef, Placement, StageRef } from '@/lib/time'

// Data layer for the time layer (migration 176). None of these tables is in the generated types yet, so the
// client is cast at the boundary, the same convention as dashboard-views.ts and comparative-analysis.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface TimeAxisRow {
  id: string
  project_id: string
  name: string
  description: string | null
  kind: string
  definition: AxisDef
  jurisdiction: string | null
  source: string | null
  status: string
}

export interface TimePlanRow {
  id: string
  project_id: string
  axis_id: string
  name: string
  summary: string | null
  kind: string
  parameters: Record<string, unknown>
  forked_from: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  created_at: string
}

export interface TimeProjectionRow {
  id: string
  project_id: string
  name: string
  source_axis_id: string
  target_axis_id: string
  rule: string
  parameters: Record<string, unknown>
  source: string | null
  status: string
}

export interface TimeAssumptionRow {
  id: string
  project_id: string
  plan_id: string | null
  axis_id: string | null
  projection_id: string | null
  statement: string
  assumption_type: string
  confidence: 'low' | 'medium' | 'high'
  source: string | null
  rationale: string | null
  value: unknown
  status: string
}

export interface PlacementRow extends Placement {
  id: string
  plan_id: string
  sort_order: number
}

export interface TimeData {
  axes: TimeAxisRow[]
  plans: TimePlanRow[]
  projections: TimeProjectionRow[]
  assumptions: TimeAssumptionRow[]
}

export async function loadTimeData(supabase: Client, projectId: string): Promise<TimeData> {
  const [axes, plans, projections, assumptions] = await Promise.all([
    supabase.from('lpm_time_axes').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('lpm_time_plans').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('lpm_time_projections').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('lpm_time_assumptions').select('*').eq('project_id', projectId).order('created_at'),
  ])
  return {
    axes: (axes.data ?? []) as TimeAxisRow[],
    plans: (plans.data ?? []) as TimePlanRow[],
    projections: (projections.data ?? []) as TimeProjectionRow[],
    assumptions: (assumptions.data ?? []) as TimeAssumptionRow[],
  }
}

export async function loadPlacements(supabase: Client, planId: string): Promise<PlacementRow[]> {
  const { data } = await supabase.from('lpm_time_placements').select('*').eq('plan_id', planId).order('sort_order')
  return (data ?? []) as PlacementRow[]
}

/** Accepted stages and the concept labels of a project, in the shapes the measures expect. */
export async function loadTimeContent(supabase: Client, projectId: string): Promise<{ stages: StageRef[]; concepts: ConceptRef[] }> {
  const [objs, els] = await Promise.all([
    supabase.from('lpm_data_objects').select('id, title, grade_band, content').eq('project_id', projectId).eq('object_type', 'substrand').eq('status', 'accepted'),
    supabase.from('lpm_schema_elements').select('id, label, metadata').eq('project_id', projectId).eq('element_type', 'concept'),
  ])
  const stages: StageRef[] = ((objs.data ?? []) as { id: string; title: string; grade_band: string | null; content: Record<string, unknown> | null }[])
    .map((r) => {
      const c = (r.content ?? {}) as { concepts?: { id: string; emphasis?: string }[]; performanceIndicators?: unknown[]; required?: boolean; _source?: { path?: string } }
      return {
        id: r.id,
        title: r.title,
        band: r.grade_band ?? '',
        strand: c._source?.path ?? 'strand',
        concepts: (c.concepts ?? []).map((x) => ({ id: x.id, emphasis: x.emphasis ?? 'reinforcing' })),
        outcomes: Array.isArray(c.performanceIndicators) ? c.performanceIndicators.length : 0,
        required: c.required !== false,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
  const concepts: ConceptRef[] = ((els.data ?? []) as { id: string; label: string; metadata: { conceptbase_id?: string } | null }[]).map((e) => ({
    id: e.metadata?.conceptbase_id ?? e.id,
    label: e.label,
  }))
  return { stages, concepts }
}

/** Save a new axis and plan with its placements. Always a copy, so earlier plans are never overwritten. */
export async function savePlanCopy(
  supabase: Client,
  params: {
    projectId: string
    from: TimePlanRow
    name: string
    summary: string | null
    parameters: Record<string, unknown>
    placements: Placement[]
    axis: { existingId: string } | { name: string; description: string | null; kind: string; definition: AxisDef; source: string | null }
  },
): Promise<{ planId: string } | { error: string }> {
  let axisId: string
  if ('existingId' in params.axis) axisId = params.axis.existingId
  else {
    const a = params.axis
    const { data, error } = await supabase
      .from('lpm_time_axes')
      .insert({ project_id: params.projectId, name: a.name, description: a.description, kind: a.kind, definition: a.definition, source: a.source, status: 'proposed' })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Could not save the axis' }
    axisId = (data as { id: string }).id
  }
  const { data: plan, error: pErr } = await supabase
    .from('lpm_time_plans')
    .insert({ project_id: params.projectId, axis_id: axisId, name: params.name, summary: params.summary, kind: params.from.kind, parameters: params.parameters, forked_from: params.from.id, status: 'proposed' })
    .select('id')
    .single()
  if (pErr || !plan) return { error: pErr?.message ?? 'Could not save the plan' }
  const planId = (plan as { id: string }).id
  if (params.placements.length > 0) {
    const rows = params.placements.map((p, i) => ({
      plan_id: planId,
      target_type: p.target_type,
      target_id: p.target_id,
      role: p.role ?? null,
      resource: p.resource ?? 'instructional_time',
      selector: p.selector,
      amount: p.amount,
      note: p.note ?? null,
      sort_order: i,
    }))
    const { error } = await supabase.from('lpm_time_placements').insert(rows)
    if (error) return { error: error.message }
  }
  return { planId }
}

export async function updateAssumption(supabase: Client, id: string, patch: Partial<Pick<TimeAssumptionRow, 'statement' | 'assumption_type' | 'confidence' | 'source' | 'rationale' | 'status'>>) {
  return supabase.from('lpm_time_assumptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function addAssumption(supabase: Client, row: { project_id: string; plan_id: string | null; axis_id: string | null; statement: string; assumption_type: string; confidence: string; source: string | null; rationale: string | null }) {
  return supabase.from('lpm_time_assumptions').insert(row)
}

/** Discussion topics tied to time assumptions, by assumption id. */
export async function loadAssumptionTopics(supabase: Client, projectId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from('discussion_topics').select('id, linked_id').eq('project_id', projectId).eq('linked_type', 'time_assumption')
  const out = new Map<string, string>()
  for (const r of (data ?? []) as { id: string; linked_id: string }[]) if (!out.has(r.linked_id)) out.set(r.linked_id, r.id)
  return out
}

export async function startAssumptionDiscussion(supabase: Client, projectId: string, a: TimeAssumptionRow) {
  return supabase
    .from('discussion_topics')
    .insert({
      project_id: projectId,
      title: `Time assumption: ${a.statement.slice(0, 110)}`,
      description: `${a.statement}\n\nType: ${a.assumption_type}. Confidence: ${a.confidence}. Source: ${a.source ?? 'none recorded'}.${a.rationale ? `\n\n${a.rationale}` : ''}`,
      category: 'time-assumption',
      linked_type: 'time_assumption',
      linked_id: a.id,
    })
    .select('id')
    .single()
}
