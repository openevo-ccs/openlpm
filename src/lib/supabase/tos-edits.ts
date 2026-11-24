import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { editRows, type AtlasEditDetail, type ReviewProgress } from '../tos-edits'
import { isMissingTableError } from './tos-profiles'

type Client = SupabaseClient<Database>

// Checking and correcting a theory of schooling (migration 257). tos_element_edits is not in database.types.ts until the types are regenerated after the
// migration is applied, so the queries are cast at the boundary, as in tos-profiles.ts. A trigger in the database puts each saved change onto the profile.
const db = (supabase: Client) => supabase as any

/** Saves one change the Atlas announced. Returns a plain sentence when it did not work, otherwise null. */
export async function saveTosEdit(supabase: Client, projectId: string, userId: string, detail: AtlasEditDetail): Promise<string | null> {
  const { error } = await db(supabase).from('tos_element_edits').insert(editRows(detail, projectId, userId))
  if (!error) return null
  if (isMissingTableError(error)) return 'Checking statements is not switched on yet. The database update has not been applied. Ask an admin.'
  return 'The change could not be saved. You may need the editor role in this space.'
}

/** How far the statements of a space have been checked. Null when the question cannot be answered (for example before migration 257 is applied). */
export async function loadReviewProgress(supabase: Client, projectId: string): Promise<ReviewProgress | null> {
  const { data, error } = await db(supabase).rpc('tos_review_progress', { p_project_id: projectId })
  if (error || !Array.isArray(data) || !data.length) return null
  const r = data[0] as Record<string, unknown>
  return { total: Number(r.total ?? 0), checked: Number(r.checked ?? 0), unsure: Number(r.unsure ?? 0), excluded: Number(r.excluded ?? 0) }
}

/** The name written on a mark. Falls back to an empty string. */
export async function loadUserName(supabase: Client, userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('name').eq('id', userId).maybeSingle()
  return ((data as { name?: string } | null)?.name ?? '').trim()
}
