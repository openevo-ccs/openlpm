import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type PeerReviewAssignmentRow = Database['public']['Tables']['peer_review_assignments']['Row']
export type GenericReviewableType = 'theory' | 'framework_tag' | 'portfolio_item' | 'portfolio_private_node'

export interface GenericReviewItem {
  assignment: PeerReviewAssignmentRow
  label: string
  detail: string | null
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
  return supabase.from('peer_review_assignments').insert({
    project_id: params.projectId,
    reviewable_type: params.reviewableType,
    reviewable_id: params.reviewableId,
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
