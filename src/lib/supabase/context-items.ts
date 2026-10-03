import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type ContextItemRow = Database['public']['Tables']['context_items']['Row']
export type GeoPlaceRow = Database['public']['Tables']['geo_places']['Row']

// Open vocabulary (schema foundation migration 094, same pattern as
// curriculum_repository_links.relation_type) -- no CHECK constraint, so a
// fourth kind never needs a migration. These three are just today's seed
// values, listed here for the dropdown.
export const ITEM_TYPE_LABEL: Record<string, string> = {
  'news-article': 'News article',
  'public-debate': 'Public debate',
  'key-issue': 'Key issue',
}

export async function listContextItems(supabase: Client, projectId: string): Promise<ContextItemRow[]> {
  const { data } = await supabase
    .from('context_items')
    .select('*')
    .eq('project_id', projectId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

/** The small, fill-as-needed place lookup (migration 094) -- a handful of rows today, safe to fetch in full for a dropdown. */
export async function listGeoPlaces(supabase: Client): Promise<GeoPlaceRow[]> {
  const { data } = await supabase.from('geo_places').select('*').order('display_name')
  return data ?? []
}

export interface ContextItemInput {
  itemType: string
  title: string
  url: string | null
  summary: string | null
  sourceOutlet: string | null
  publishedAt: string | null
  placeCode: string | null
  repositoryRecordId: string | null
}

export async function createContextItem(supabase: Client, projectId: string, input: ContextItemInput): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('context_items').insert({
    project_id: projectId,
    item_type: input.itemType,
    title: input.title,
    url: input.url,
    summary: input.summary,
    source_outlet: input.sourceOutlet,
    published_at: input.publishedAt,
    place_code: input.placeCode,
    repository_record_id: input.repositoryRecordId,
    created_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}

export async function updateContextItem(supabase: Client, id: string, input: ContextItemInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('context_items')
    .update({
      item_type: input.itemType,
      title: input.title,
      url: input.url,
      summary: input.summary,
      source_outlet: input.sourceOutlet,
      published_at: input.publishedAt,
      place_code: input.placeCode,
      repository_record_id: input.repositoryRecordId,
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteContextItem(supabase: Client, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('context_items').delete().eq('id', id)
  return { error: error?.message ?? null }
}
