import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// One row per person in user_privacy_settings (migration 238). No row means the
// person has not opted out. The table is not in the generated types until the
// migration is pushed, so the queries are cast at the boundary, the same way
// join.ts handles project_join_rules.

/** True when the signed-in person has opted out of processing by outside AI services. */
export async function getMyAiOptOut(supabase: Client): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await (supabase as any)
    .from('user_privacy_settings')
    .select('ai_processing_opt_out')
    .eq('user_id', user.id)
    .maybeSingle()
  return !!data?.ai_processing_opt_out
}

export async function setMyAiOptOut(supabase: Client, optOut: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }
  const { error } = await (supabase as any)
    .from('user_privacy_settings')
    .upsert({ user_id: user.id, ai_processing_opt_out: optOut }, { onConflict: 'user_id' })
  return { error }
}

/** Admin view: ids of everyone who has opted out. Returns an empty set for anyone who cannot read other people's rows. */
export async function listAiOptOutUserIds(supabase: Client): Promise<Set<string>> {
  const { data } = await (supabase as any)
    .from('user_privacy_settings')
    .select('user_id')
    .eq('ai_processing_opt_out', true)
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))
}

// ---- Requests to delete an account and its data (migration 238, data_deletion_requests) ----

export interface DeletionRequest {
  id: string
  requested_at: string
  due_at: string
  status: 'open' | 'done' | 'declined' | 'withdrawn'
  reason: string | null
}

/** The signed-in person's most recent request, or null if they never filed one. */
export async function getMyLatestDeletionRequest(supabase: Client): Promise<DeletionRequest | null> {
  const { data } = await (supabase as any)
    .from('data_deletion_requests')
    .select('id, requested_at, due_at, status, reason')
    .order('requested_at', { ascending: false })
    .limit(1)
  return ((data ?? [])[0] as DeletionRequest | undefined) ?? null
}

export async function requestMyDeletion(supabase: Client, reason: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }
  const { error } = await (supabase as any)
    .from('data_deletion_requests')
    .insert({ user_id: user.id, reason: reason.trim() || null })
  return { error }
}

export async function withdrawMyDeletionRequest(supabase: Client, requestId: string) {
  const { error } = await (supabase as any)
    .from('data_deletion_requests')
    .update({ status: 'withdrawn', reason: null })
    .eq('id', requestId)
  return { error }
}

export interface AdminDeletionRequest extends DeletionRequest {
  user_id: string | null
  user: { name: string | null; email: string | null } | null
}

/** Admin view: requests still waiting, earliest due date first. */
export async function listOpenDeletionRequests(supabase: Client): Promise<AdminDeletionRequest[]> {
  const { data } = await (supabase as any)
    .from('data_deletion_requests')
    .select('id, user_id, requested_at, due_at, status, reason, user:user_id(name, email)')
    .eq('status', 'open')
    .order('due_at', { ascending: true })
  return (data ?? []) as AdminDeletionRequest[]
}
