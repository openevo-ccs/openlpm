import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { logActivity } from './activity'

type Client = SupabaseClient<Database>

export type SchemaElementRow = Database['public']['Tables']['lpm_schema_elements']['Row']
export type CoherenceReviewRow = Database['public']['Tables']['lpm_coherence_reviews']['Row']

// The pair-matrix method (measure every pair systematically, cite a real
// bridge or explicitly record "no real connection found," never force a
// link to make the matrix look complete, validate the end state with a live
// count) generalizes eva-graph-66's mpi-eva-graph coherence review
// (docs/mpi-eva-graph-coherence-review-2026-09-09.md there) to OpenLPM's own
// object model. "grade_band" is the one axis with real data today; the
// scope/axis shape below is deliberately generic so subject_area or
// cross-project axes reuse the same mechanism once a second real dataset
// exists to check.

export interface GradeBandCell {
  gradeA: string
  gradeB: string
  assertedCount: number
  suggestedThreads: { id: string; title: string }[]
  // Connections between these two grades that exist but haven't cleared
  // review yet -- not visible to teachers, but real work-in-progress a
  // curriculum designer should see distinctly from a genuinely untouched gap.
  pendingCount: number
  reviewedNoConnection: CoherenceReviewRow | null
}

export interface GradeBandMatrix {
  grades: string[]
  cells: GradeBandCell[]
  totalObjects: number
  orphanObjectIds: string[]
}

function sortPair(a: string, b: string): [string, string] {
  return Number(a) <= Number(b) ? [a, b] : [b, a]
}

/**
 * Computes the live grade-band pair-matrix for one branch: every real
 * asserted connection and every thread's cross-grade-band reach, plus which
 * zero-count pairs have already been reviewed and explicitly found to have
 * no real connection (so they don't read as an untouched gap). Aggregated
 * client-side -- the real data volume here (a few hundred objects, a few
 * hundred edges) is small enough that a live SQL view/function would be
 * premature machinery, not a correctness requirement.
 */
export async function getGradeBandMatrix(supabase: Client, projectId: string, branchId: string): Promise<GradeBandMatrix> {
  const [{ data: objects }, { data: connections }, { data: threads }, { data: reviews }] = await Promise.all([
    supabase.from('lpm_data_objects').select('id, grade_band').eq('project_id', projectId).eq('branch_id', branchId),
    supabase.from('lpm_connections').select('from_object_id, to_object_id, status').eq('project_id', projectId).eq('branch_id', branchId),
    // Only 'accepted' threads count toward the matrix -- a proposed thread
    // isn't real coherence yet from a teacher's point of view, same as a
    // proposed connection.
    supabase.from('lpm_threads').select('id, title').eq('project_id', projectId).eq('branch_id', branchId).eq('status', 'accepted'),
    supabase.from('lpm_coherence_reviews').select('*').eq('project_id', projectId).eq('branch_id', branchId).eq('axis', 'grade_band'),
  ])

  const objs = objects ?? []
  const gradeOf = new Map(objs.map((o) => [o.id, o.grade_band]))
  const grades = Array.from(new Set(objs.map((o) => o.grade_band).filter((g): g is string => !!g))).sort((a, b) => Number(a) - Number(b))

  const threadIds = (threads ?? []).map((t) => t.id)
  const { data: stations } = threadIds.length
    ? await supabase.from('lpm_thread_stations').select('thread_id, data_object_id').in('thread_id', threadIds)
    : { data: [] as { thread_id: string; data_object_id: string }[] }

  const threadById = new Map((threads ?? []).map((t) => [t.id, t]))
  const stationsByThread = new Map<string, string[]>()
  for (const s of stations ?? []) {
    const list = stationsByThread.get(s.thread_id) ?? []
    list.push(s.data_object_id)
    stationsByThread.set(s.thread_id, list)
  }

  const pairKey = (a: string, b: string) => sortPair(a, b).join('|')
  const assertedCounts = new Map<string, number>()
  const pendingCounts = new Map<string, number>()
  const suggestedThreadsByPair = new Map<string, Set<string>>()
  const touched = new Set<string>() // object ids with at least one connection or thread membership, any status

  for (const c of connections ?? []) {
    const ga = gradeOf.get(c.from_object_id)
    const gb = gradeOf.get(c.to_object_id)
    touched.add(c.from_object_id)
    touched.add(c.to_object_id)
    if (!ga || !gb || ga === gb) continue
    const key = pairKey(ga, gb)
    if (c.status === 'accepted') {
      assertedCounts.set(key, (assertedCounts.get(key) ?? 0) + 1)
    } else if (c.status === 'proposed' || c.status === 'under_review') {
      pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1)
    }
  }

  for (const [threadId, objectIds] of stationsByThread) {
    const gradesInThread = new Set(objectIds.map((id) => gradeOf.get(id)).filter((g): g is string => !!g))
    for (const id of objectIds) touched.add(id)
    const list = Array.from(gradesInThread)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = pairKey(list[i], list[j])
        const set = suggestedThreadsByPair.get(key) ?? new Set()
        set.add(threadId)
        suggestedThreadsByPair.set(key, set)
      }
    }
  }

  const reviewByKey = new Map<string, CoherenceReviewRow>()
  for (const r of reviews ?? []) {
    const a = (r.scope_a as Record<string, string>).grade_band
    const b = (r.scope_b as Record<string, string>).grade_band
    if (a && b) reviewByKey.set(pairKey(a, b), r)
  }

  const cells: GradeBandCell[] = []
  for (let i = 0; i < grades.length; i++) {
    for (let j = i + 1; j < grades.length; j++) {
      const [gradeA, gradeB] = [grades[i], grades[j]]
      const key = pairKey(gradeA, gradeB)
      cells.push({
        gradeA,
        gradeB,
        assertedCount: assertedCounts.get(key) ?? 0,
        suggestedThreads: Array.from(suggestedThreadsByPair.get(key) ?? []).map((id) => threadById.get(id)!).filter(Boolean),
        pendingCount: pendingCounts.get(key) ?? 0,
        reviewedNoConnection: reviewByKey.get(key) ?? null,
      })
    }
  }

  const orphanObjectIds = objs.filter((o) => !touched.has(o.id)).map((o) => o.id)

  return { grades, cells, totalObjects: objs.length, orphanObjectIds }
}

export interface ConceptCandidate {
  schemaElementId: string
  label: string
  countA: number
  countB: number
}

/**
 * Real candidate-mining for one open pair: which schema concepts do objects
 * in *both* grade bands already share (via the normalized lpm_object_tags
 * table, never by parsing a project's own content JSONB) -- generalizes
 * EvoMentor_DE's own proven co-occurrence method
 * (docs/basiskonzepte-kohaerenz-strategie.md section 4) into a
 * project-agnostic query. Candidates only -- never auto-published as a real
 * connection.
 */
export async function getCoOccurringConcepts(
  supabase: Client,
  projectId: string,
  branchId: string,
  gradeA: string,
  gradeB: string
): Promise<ConceptCandidate[]> {
  const { data: objects } = await supabase
    .from('lpm_data_objects')
    .select('id, grade_band')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .in('grade_band', [gradeA, gradeB])

  const idsA = (objects ?? []).filter((o) => o.grade_band === gradeA).map((o) => o.id)
  const idsB = (objects ?? []).filter((o) => o.grade_band === gradeB).map((o) => o.id)
  if (idsA.length === 0 || idsB.length === 0) return []

  const { data: tags } = await supabase
    .from('lpm_object_tags')
    .select('data_object_id, schema_element_id, element:lpm_schema_elements(id, label)')
    .in('data_object_id', [...idsA, ...idsB])

  const setA = new Set(idsA)
  const countsA = new Map<string, number>()
  const countsB = new Map<string, number>()
  const labelById = new Map<string, string>()

  for (const t of (tags ?? []) as unknown as { data_object_id: string; schema_element_id: string; element: SchemaElementRow | null }[]) {
    if (t.element) labelById.set(t.schema_element_id, t.element.label)
    const counts = setA.has(t.data_object_id) ? countsA : countsB
    counts.set(t.schema_element_id, (counts.get(t.schema_element_id) ?? 0) + 1)
  }

  const candidates: ConceptCandidate[] = []
  for (const [elementId, countA] of countsA) {
    const countB = countsB.get(elementId) ?? 0
    if (countB > 0) {
      candidates.push({ schemaElementId: elementId, label: labelById.get(elementId) ?? elementId, countA, countB })
    }
  }
  return candidates.sort((a, b) => b.countA + b.countB - (a.countA + a.countB))
}

export async function markReviewedNoConnection(
  supabase: Client,
  params: { projectId: string; branchId: string; axis: string; gradeA: string; gradeB: string; note: string }
) {
  const [scope_a, scope_b] = sortPair(params.gradeA, params.gradeB).map((g) => ({ grade_band: g }))
  return supabase.from('lpm_coherence_reviews').insert({
    project_id: params.projectId,
    branch_id: params.branchId,
    axis: params.axis,
    scope_a,
    scope_b,
    note: params.note,
  })
}

export interface GradeBandObject {
  id: string
  title: string
}

export async function listObjectsInGrade(supabase: Client, projectId: string, branchId: string, grade: string): Promise<GradeBandObject[]> {
  const { data } = await supabase
    .from('lpm_data_objects')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .eq('grade_band', grade)
    .order('title', { ascending: true })
  return data ?? []
}

/**
 * Creates a new connection -- always landing at 'proposed' (the column's own
 * DB default; never overridden here) so it needs a review before it's ever
 * visible on the teacher-facing Explore view. Optionally cites a real,
 * already-in-the-project literature reference as evidence -- a citable
 * reason, not just the proposer's own written rationale, mirroring
 * eva-graph-66's "named person/paper, not a plausible-sounding gloss"
 * discipline. The evidence link is polymorphic (`target_type: 'connection'`)
 * so the same mechanism will work for citing a thread once threads have a
 * creation UI of their own.
 */
export async function createConnection(
  supabase: Client,
  params: {
    projectId: string
    branchId: string
    fromObjectId: string
    toObjectId: string
    kind: 'asserted' | 'suggested'
    relationType: string
    rationale: string
    evidenceReferenceId?: string
  }
) {
  // created_by has to be set explicitly here (no DB-side default derives it
  // from the session) -- the review queue's self-review guard compares this
  // against the reviewer's own id, so leaving it null would silently let
  // anyone review their own proposal.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('lpm_connections')
    .insert({
      project_id: params.projectId,
      branch_id: params.branchId,
      from_object_id: params.fromObjectId,
      to_object_id: params.toObjectId,
      kind: params.kind,
      relation_type: params.relationType,
      rationale: params.rationale,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { data, error }

  if (params.evidenceReferenceId) {
    const { error: evidenceError } = await supabase.from('evidence_links').insert({
      project_id: params.projectId,
      target_type: 'connection',
      target_id: data.id,
      reference_id: params.evidenceReferenceId,
      evidence_type: 'supports',
    })
    if (evidenceError) return { data, error: evidenceError }
  }

  await logActivity(supabase, {
    projectId: params.projectId,
    actionType: 'connection_proposed',
    targetType: 'connection',
    targetId: data.id,
    details: { kind: params.kind },
  })

  return { data, error: null }
}

export type LiteratureReferenceRow = Database['public']['Tables']['literature_references']['Row']

export async function listLiteratureReferences(supabase: Client, projectId: string): Promise<LiteratureReferenceRow[]> {
  const { data } = await supabase.from('literature_references').select('*').eq('project_id', projectId).order('title')
  return data ?? []
}

export interface PendingConnection {
  connection: Database['public']['Tables']['lpm_connections']['Row']
  fromObject: { id: string; title: string; grade_band: string | null }
  toObject: { id: string; title: string; grade_band: string | null }
  evidence: (Database['public']['Tables']['evidence_links']['Row'] & { reference: LiteratureReferenceRow | null })[]
}

/** Everything awaiting review for one branch -- the review queue's data source. */
export async function listPendingConnections(supabase: Client, projectId: string, branchId: string): Promise<PendingConnection[]> {
  const { data: connections } = await supabase
    .from('lpm_connections')
    .select('*, from_object:lpm_data_objects!lpm_connections_from_object_id_fkey(id,title,grade_band), to_object:lpm_data_objects!lpm_connections_to_object_id_fkey(id,title,grade_band)')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .in('status', ['proposed', 'under_review'])
    .order('created_at', { ascending: true })

  const rows = (connections ?? []) as unknown as (Database['public']['Tables']['lpm_connections']['Row'] & {
    from_object: { id: string; title: string; grade_band: string | null }
    to_object: { id: string; title: string; grade_band: string | null }
  })[]

  if (rows.length === 0) return []

  const { data: evidence } = await supabase
    .from('evidence_links')
    .select('*, reference:literature_references(*)')
    .eq('project_id', projectId)
    .eq('target_type', 'connection')
    .in('target_id', rows.map((r) => r.id))

  type EvidenceRow = PendingConnection['evidence'][number] & { target_id: string }
  const evidenceByTarget = new Map<string, PendingConnection['evidence']>()
  for (const e of (evidence ?? []) as unknown as EvidenceRow[]) {
    const list = evidenceByTarget.get(e.target_id) ?? []
    list.push(e)
    evidenceByTarget.set(e.target_id, list)
  }

  return rows.map((r) => ({
    connection: r,
    fromObject: r.from_object,
    toObject: r.to_object,
    evidence: evidenceByTarget.get(r.id) ?? [],
  }))
}

/**
 * Records a review decision: a peer_review_assignments row (the audit trail
 * -- who reviewed what, when, with what recommendation) plus updating the
 * connection's own status, which is what actually gates Explore visibility.
 * Self-review isn't blocked at the database level (same soft-gate pattern
 * as every other role check in this app -- see schema-page.tsx's canManage)
 * -- the UI keeps a proposer from reviewing their own submission.
 */
export async function reviewConnection(
  supabase: Client,
  params: { projectId: string; connectionId: string; decision: 'accepted' | 'rejected'; reviewText: string }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error: assignmentError } = await supabase.from('peer_review_assignments').insert({
    project_id: params.projectId,
    reviewable_type: 'lpm_connection',
    reviewable_id: params.connectionId,
    reviewer_id: user?.id ?? null,
    status: 'completed',
    recommendation: params.decision === 'accepted' ? 'accept' : 'reject',
    review_text: params.reviewText,
    submitted_at: new Date().toISOString(),
  })
  if (assignmentError) return { error: assignmentError }

  const { error: statusError } = await supabase.from('lpm_connections').update({ status: params.decision }).eq('id', params.connectionId)
  if (statusError) return { error: statusError }

  await logActivity(supabase, {
    projectId: params.projectId,
    actionType: 'connection_reviewed',
    targetType: 'connection',
    targetId: params.connectionId,
    details: { decision: params.decision },
  })

  return { error: null }
}
