import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { flattenProfile, profileRowFields, type TosModel, type TosProfile } from '../tos-profile'

type Client = SupabaseClient<Database>

// Theories of Schooling (migration 256). The tables tos_profiles and tos_elements are not in database.types.ts until someone regenerates the
// types after the migration is applied, so the queries are cast at the boundary, as in literature-collections.ts.
//
// Row level security decides who can do what: members of the space read, editors write, viewers cannot write. The profiles hold text that
// people wrote, so the AI opt-out rule applies (CLAUDE.md): see listProfileIdsOpenToAi.
const db = (supabase: Client) => supabase as any

export interface TosProfileRow {
  id: string
  project_id: string
  profile_id: string
  title: string
  holder_kind: string
  visibility: 'public' | 'lab-only' | 'local'
  theory_ref: string | null
  version: string
  license: string
  review_status: string
  data: TosProfile
  created_by: string
  created_at: string
  updated_at: string
}

export interface TosElementSearchRow {
  id: string
  profile_row_id: string
  element_id: string
  type: string
  label: string | null
  statement: string
  supers: string[]
  subs: string[]
  visibility: 'public' | 'lab-only'
}

/** True when an error says the table or function is not there, which is what happens before migration 256 is applied. */
export function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  const msg = err.message ?? ''
  return err.code === '42P01' || err.code === '42883' || err.code === 'PGRST205' || err.code === 'PGRST202' || /schema cache|does not exist/i.test(msg)
}

export const NOT_READY_MESSAGE = 'This space is not ready yet. The database update that adds Theories of Schooling has not been applied. Ask an admin.'

export interface LoadResult<T> {
  data: T
  /** A plain sentence for the person, or null. */
  problem: string | null
}

export async function listTosProfiles(supabase: Client, projectId: string): Promise<LoadResult<TosProfileRow[]>> {
  const { data, error } = await db(supabase)
    .from('tos_profiles')
    .select('id, project_id, profile_id, title, holder_kind, visibility, theory_ref, version, license, review_status, data, created_by, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) return { data: [], problem: isMissingTableError(error) ? NOT_READY_MESSAGE : 'The profiles could not be loaded. Try again in a moment.' }
  return { data: (data ?? []) as TosProfileRow[], problem: null }
}

/**
 * Saves a profile in a space. A profile with the same code in the same space is replaced (a new version); otherwise a new one is added.
 * The statements are written after the profile and can always be rebuilt from the profile's own data.
 */
export async function saveTosProfile(
  supabase: Client,
  projectId: string,
  userId: string,
  profile: TosProfile,
): Promise<{ id: string | null; replaced: boolean; error: string | null }> {
  const fields = profileRowFields(profile)
  const found = await db(supabase).from('tos_profiles').select('id').eq('project_id', projectId).eq('profile_id', profile.id).maybeSingle()
  if (found.error) return { id: null, replaced: false, error: isMissingTableError(found.error) ? NOT_READY_MESSAGE : 'The profile could not be saved. Try again in a moment.' }
  let rowId: string
  const replaced = !!found.data
  if (found.data) {
    rowId = found.data.id as string
    // A change that row level security refuses comes back as zero rows and no error, so the rows are counted.
    const { data: changed, error } = await db(supabase).from('tos_profiles').update(fields).eq('id', rowId).select('id')
    if (error || !changed?.length) return { id: null, replaced, error: 'The profile could not be saved. You may need the editor role in this space.' }
  } else {
    const { data, error } = await db(supabase)
      .from('tos_profiles')
      .insert({ ...fields, project_id: projectId, created_by: userId })
      .select('id')
      .single()
    if (error || !data) return { id: null, replaced, error: 'The profile could not be saved. You may need the editor role in this space.' }
    rowId = data.id as string
  }
  // review_status is a column of migration 257. A row that has none is written without it, so saving also works before that migration is applied.
  const rows = flattenProfile(profile).map(({ review_status, ...r }) => ({ ...r, ...(review_status ? { review_status } : {}), project_id: projectId, profile_row_id: rowId }))
  const cleared = await db(supabase).from('tos_elements').delete().eq('profile_row_id', rowId)
  if (cleared.error) return { id: rowId, replaced, error: 'The profile is saved, but its statement list could not be refreshed. Save it again.' }
  // Statements go in chunks so one request never gets very large.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db(supabase).from('tos_elements').insert(rows.slice(i, i + 500))
    if (error) return { id: rowId, replaced, error: 'The profile is saved, but its statement list is incomplete. Save it again.' }
  }
  // People's decisions about placements and marks (migration 257) are kept in a log of their own. Put the latest of each back on top of the saved profile.
  // Quiet when migration 257 is not applied yet.
  const back = await db(supabase).rpc('tos_reapply_edits', { p_project_id: projectId, p_profile_code: profile.id })
  if (back.error && !isMissingTableError(back.error)) return { id: rowId, replaced, error: 'The profile is saved, but the earlier checks could not be put back on it. Save it again.' }
  return { id: rowId, replaced, error: null }
}

export async function deleteTosProfile(supabase: Client, rowId: string): Promise<string | null> {
  const { data, error } = await db(supabase).from('tos_profiles').delete().eq('id', rowId).select('id')
  return error || !data?.length ? 'The profile could not be deleted. You may need the editor role in this space.' : null
}

/**
 * The ids of the profiles of a space that may be given to an AI assistant: those whose creator has not opted out (CLAUDE.md, "People who
 * opted out of AI processing"). Returns null when the question cannot be answered. The caller then leaves everything out.
 */
export async function listProfileIdsOpenToAi(supabase: Client, projectId: string): Promise<Set<string> | null> {
  const { data, error } = await db(supabase).rpc('tos_profile_ids_open_to_ai', { p_project_id: projectId })
  if (error || !Array.isArray(data)) return null
  return new Set(data.map((x: unknown) => (typeof x === 'string' ? x : String((x as Record<string, unknown>)?.tos_profile_ids_open_to_ai ?? ''))).filter(Boolean))
}

/** Statements of a space whose wording contains the text. Wildcard characters in the text are taken literally. */
export async function searchTosStatements(supabase: Client, projectId: string, query: string, limit = 50): Promise<LoadResult<TosElementSearchRow[]>> {
  const q = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
  if (q.length < 2) return { data: [], problem: null }
  const { data, error } = await db(supabase)
    .from('tos_elements')
    .select('id, profile_row_id, element_id, type, label, statement, supers, subs, visibility')
    .eq('project_id', projectId)
    .ilike('statement', `%${q}%`)
    .limit(limit)
  if (error) return { data: [], problem: isMissingTableError(error) ? NOT_READY_MESSAGE : 'The search could not run. Try again in a moment.' }
  return { data: (data ?? []) as TosElementSearchRow[], problem: null }
}

// ---- The domain model (a file next to the Atlas widget) ----

let modelPromise: Promise<TosModel> | null = null

/** The domain model that the Atlas widget and the checks use. One file, loaded once. */
export function loadTosModel(): Promise<TosModel> {
  if (!modelPromise) {
    const url = `${import.meta.env.BASE_URL}vendor/openevo-atlas/atlas/model-schooling-domains-v1.json`
    modelPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`model ${r.status}`)
        return r.json() as Promise<TosModel>
      })
      .catch((e) => {
        modelPromise = null
        throw e
      })
  }
  return modelPromise
}
