import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type PeerReviewAssignmentRow = Database['public']['Tables']['peer_review_assignments']['Row']
export type GenericReviewableType = 'theory' | 'framework_tag' | 'portfolio_item' | 'portfolio_private_node' | 'base_repo_record'

export interface GenericReviewItem {
  assignment: PeerReviewAssignmentRow
  label: string
  detail: string | null
}

// Base Repo Explorer records live in per-repo snapshot tables keyed by the
// repo's own real TEXT id (e.g. "OE-METHOD-..."), not a UUID -- so they go
// through base_repo_review_targets (migration 156), a small indirection
// table whose own UUID id is what actually gets stored in reviewable_id.
// This map is how the resolver below turns that id back into real content.
const BASE_REPO_SNAPSHOT_TABLES: Record<string, { table: string; label: string }> = {
  theorybase: { table: 'theorybase_snapshot', label: 'label' },
  literaturebase: { table: 'literaturebase_snapshot', label: 'title' },
  methodsbase: { table: 'methodsbase_snapshot', label: 'label' },
  questionbase: { table: 'questionbase_snapshot', label: 'label' },
  quotebase: { table: 'quotebase_snapshot', label: 'label' },
  competencybase: { table: 'competencybase_snapshot', label: 'label' },
  projectbase: { table: 'projectbase_snapshot', label: 'label' },
}

const RESOLVERS: Record<GenericReviewableType, (supabase: Client, ids: string[]) => Promise<Map<string, { label: string; detail: string | null }>>> = {
  theory: async (supabase, ids) => {
    const { data } = await supabase.from('theories').select('id, label, description').in('id', ids)
    return new Map((data ?? []).map((r) => [r.id, { label: r.label, detail: r.description }]))
  },
  framework_tag: async (supabase, ids) => {
    const { data } = await supabase.from('framework_tags').select('id, label, definition').in('id', ids)
    return new Map((data ?? []).map((r) => [r.id, { label: r.label, detail: r.definition }]))
  },
  portfolio_item: async (supabase, ids) => {
    const { data } = await supabase.from('portfolio_items').select('id, custom_annotation, target_type, target_id').in('id', ids)
    return new Map((data ?? []).map((r) => [r.id, { label: `Notebook reference (${r.target_type})`, detail: r.custom_annotation }]))
  },
  portfolio_private_node: async (supabase, ids) => {
    const { data } = await supabase.from('portfolio_private_nodes').select('id, label, content, node_type').in('id', ids)
    return new Map((data ?? []).map((r) => [r.id, { label: `${r.label} (${r.node_type.replace('_', ' ')})`, detail: r.content }]))
  },
  // base_repo_review_targets (migration 156) isn't in database.types.ts yet
  // -- cast at the query boundary, same convention as every other
  // not-yet-regenerated-type table in this repo (grep `as any).from(` for
  // the pattern), rather than blocking this file on a type regen that
  // itself needs the migration live first.
  base_repo_record: async (supabase, ids) => {
    const { data: targets } = await (supabase as any).from('base_repo_review_targets').select('id, base_repo, record_id').in('id', ids)
    const result = new Map<string, { label: string; detail: string | null }>()
    const byRepo = new Map<string, { targetId: string; recordId: string }[]>()
    for (const t of targets ?? []) {
      const list = byRepo.get(t.base_repo) ?? []
      list.push({ targetId: t.id, recordId: t.record_id })
      byRepo.set(t.base_repo, list)
    }
    await Promise.all(
      Array.from(byRepo.entries()).map(async ([baseRepo, items]) => {
        const cfg = BASE_REPO_SNAPSHOT_TABLES[baseRepo]
        if (!cfg) return
        const { data: rows } = await supabase.from(cfg.table).select(`id, ${cfg.label}`).in('id', items.map((i) => i.recordId))
        const byRecordId = new Map((rows ?? []).map((r: any) => [r.id, r[cfg.label]]))
        for (const item of items) {
          result.set(item.targetId, { label: byRecordId.get(item.recordId) ?? `(${baseRepo} record)`, detail: `${baseRepo} · ${item.recordId}` })
        }
      })
    )
    return result
  },
}

/** Finds or creates the base_repo_review_targets row for one (base_repo, record_id) pair. */
export async function resolveBaseRepoReviewTarget(
  supabase: Client,
  params: { baseRepo: string; recordId: string }
): Promise<string> {
  const { data: existing } = await (supabase as any)
    .from('base_repo_review_targets')
    .select('id')
    .eq('base_repo', params.baseRepo)
    .eq('record_id', params.recordId)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created, error } = await (supabase as any)
    .from('base_repo_review_targets')
    .insert({ base_repo: params.baseRepo, record_id: params.recordId })
    .select('id')
    .single()
  if (error || !created) throw error ?? new Error('Could not create a review target.')
  return created.id
}

/** Site-wide counterpart of listGenericReviewQueue, for review assignments with no project (Base Repo Explorer). */
export async function listGlobalReviewQueue(supabase: Client): Promise<GenericReviewItem[]> {
  const { data: assignments } = await (supabase as any)
    .from('peer_review_assignments')
    .select('*')
    .is('project_id', null)
    .eq('status', 'pending')
    .eq('reviewable_type', 'base_repo_record')
    .order('created_at', { ascending: true })

  const rows = (assignments ?? []) as PeerReviewAssignmentRow[]
  const ids = rows.map((a) => a.reviewable_id)
  const resolved = ids.length ? await RESOLVERS.base_repo_record(supabase, ids) : new Map()

  return rows.map((a) => {
    const found = resolved.get(a.reviewable_id)
    return { assignment: a, label: found?.label ?? '(deleted item)', detail: found?.detail ?? null }
  })
}

/** Site-wide counterpart of submitForReview, for a Base Repo Explorer record. */
export async function submitBaseRepoRecordForReview(
  supabase: Client,
  params: { baseRepo: string; recordId: string }
) {
  const { data: { user } } = await supabase.auth.getUser()
  const targetId = await resolveBaseRepoReviewTarget(supabase, { baseRepo: params.baseRepo, recordId: params.recordId })
  return (supabase as any).from('peer_review_assignments').insert({
    project_id: null,
    reviewable_type: 'base_repo_record',
    reviewable_id: targetId,
    submitted_by: user?.id ?? null,
    status: 'pending',
  })
}

/**
 * Every open (pending, unassigned) review request across the content types
 * that don't have their own in-object status field the way lpm_connections/
 * lpm_threads do (those two track "proposed/under_review/accepted/rejected"
 * on the row itself -- see coherence.ts's reviewConnection, which creates
 * an already-completed assignment purely as an audit record). For these
 * four types, peer_review_assignments.status IS the real pending state.
 */
export async function listGenericReviewQueue(supabase: Client, projectId: string): Promise<GenericReviewItem[]> {
  const { data: assignments } = await supabase
    .from('peer_review_assignments')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .in('reviewable_type', ['theory', 'framework_tag', 'portfolio_item', 'portfolio_private_node'])
    .order('created_at', { ascending: true })

  const rows = (assignments ?? []) as PeerReviewAssignmentRow[]
  const byType = new Map<GenericReviewableType, string[]>()
  for (const a of rows) {
    const type = a.reviewable_type as GenericReviewableType
    const list = byType.get(type) ?? []
    list.push(a.reviewable_id)
    byType.set(type, list)
  }

  const resolved = new Map<string, { label: string; detail: string | null }>()
  await Promise.all(
    Array.from(byType.entries()).map(async ([type, ids]) => {
      const labels = await RESOLVERS[type](supabase, ids)
      for (const [id, v] of labels) resolved.set(`${type}:${id}`, v)
    })
  )

  return rows.map((a) => {
    const found = resolved.get(`${a.reviewable_type}:${a.reviewable_id}`)
    return { assignment: a, label: found?.label ?? '(deleted item)', detail: found?.detail ?? null }
  })
}

export async function submitForReview(
  supabase: Client,
  params: { projectId: string; reviewableType: GenericReviewableType; reviewableId: string }
) {
  const { data: { user } } = await supabase.auth.getUser()
  // Cast: GenericReviewableType now also includes 'base_repo_record'
  // (migration 156), which database.types.ts doesn't know about until its
  // next regen -- this function is never actually called with that value
  // (submitBaseRepoRecordForReview is its own dedicated path).
  return (supabase as any).from('peer_review_assignments').insert({
    project_id: params.projectId,
    reviewable_type: params.reviewableType,
    reviewable_id: params.reviewableId,
    submitted_by: user?.id ?? null,
    status: 'pending',
  })
}

export async function completeGenericReview(
  supabase: Client,
  params: { assignmentId: string; decision: 'accept' | 'reject'; reviewText: string }
) {
  const { data: { user } } = await supabase.auth.getUser()
  return supabase
    .from('peer_review_assignments')
    .update({
      reviewer_id: user?.id ?? null,
      status: 'completed',
      recommendation: params.decision,
      review_text: params.reviewText,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', params.assignmentId)
}
