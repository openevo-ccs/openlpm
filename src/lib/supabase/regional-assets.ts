import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// Regional assets (migration 242): places in a region that support learning outside the classroom. The table is new, so the
// queries go through an untyped client until the generated types are refreshed.
const db = (supabase: Client) => supabase as any

export interface RegionalAssetRow {
  id: string
  project_id: string
  asset_type: string
  name: string
  town: string | null
  place_code: string | null
  url: string | null
  description: string | null
  topics: string | null
  review_status: string
}

export interface RegionalAssetInput {
  projectId: string
  assetType: string
  name: string
  town: string | null
  placeCode: string | null
  url: string | null
  description: string | null
  topics: string | null
}

// Open list, as in the database. A new kind of place never needs a change to the database.
export const ASSET_TYPE_LABEL: Record<string, string> = {
  'research-institute': 'Research institute',
  zoo: 'Zoo',
  museum: 'Museum',
  'botanical-garden': 'Botanical garden',
  'informal-learning-place': 'Informal learning place',
  other: 'Other',
}

/** The repositories a page covers: the page's own repository plus the state repositories nested under it. */
export async function listCoveredRepositories(supabase: Client, projectId: string): Promise<{ id: string; name: string }[]> {
  const { data: self } = await supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle()
  const { data: kids } = await db(supabase)
    .from('projects')
    .select('id, name')
    .eq('parent_project_id', projectId)
    .eq('project_kind', 'curriculum-repository')
    .order('name')
  return [...(self ? [self] : []), ...((kids ?? []) as { id: string; name: string }[])]
}

export async function listRegionalAssets(supabase: Client, projectIds: string[]): Promise<{ rows: RegionalAssetRow[]; error: string | null }> {
  if (projectIds.length === 0) return { rows: [], error: null }
  const { data, error } = await db(supabase).from('regional_assets').select('*').in('project_id', projectIds).order('name')
  return { rows: (data ?? []) as RegionalAssetRow[], error: error?.message ?? null }
}

export async function createRegionalAsset(supabase: Client, input: RegionalAssetInput): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await db(supabase).from('regional_assets').insert({
    project_id: input.projectId,
    asset_type: input.assetType,
    name: input.name,
    town: input.town,
    place_code: input.placeCode,
    url: input.url,
    description: input.description,
    topics: input.topics,
    review_status: 'original',
    created_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}

/** Changing the text leaves the draft tag alone. Only "Mark as checked" takes it off, because an edit does not mean an expert read the whole entry. */
export async function updateRegionalAsset(supabase: Client, id: string, input: Omit<RegionalAssetInput, 'projectId'>): Promise<{ error: string | null }> {
  const { error } = await db(supabase)
    .from('regional_assets')
    .update({
      asset_type: input.assetType,
      name: input.name,
      town: input.town,
      place_code: input.placeCode,
      url: input.url,
      description: input.description,
      topics: input.topics,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function markRegionalAssetChecked(supabase: Client, id: string): Promise<{ error: string | null }> {
  const { error } = await db(supabase).from('regional_assets').update({ review_status: 'reviewed', updated_at: new Date().toISOString() }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteRegionalAsset(supabase: Client, id: string): Promise<{ error: string | null }> {
  const { error } = await db(supabase).from('regional_assets').delete().eq('id', id)
  return { error: error?.message ?? null }
}
