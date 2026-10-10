import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// methodsbase_snapshot, method_vocabulary_links, method_lernziel_links
// (migrations 121-123) aren't in the generated types yet -- cast at the
// query boundary, same convention as method-concept-links.ts.

export interface MethodsBaseRecord {
  id: string
  slug: string
  label: string
  method_class: string | null
  description: string | null
  when_to_use: string | null
  discipline: string | null
  status: string | null
  review_status: string | null
  data: Record<string, unknown>
}

export interface MethodLernzielLink {
  id: string
  method_key: string
  lernziel_id: string
  status: 'confirmed' | 'suggested' | 'rejected'
  source: 'existing_content' | 'llm_suggested' | 'manual'
  rationale: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

/** One row per method in the project's vocabulary that has a real MethodsBase match. */
export async function listMethodsBaseByVocabulary(supabase: Client): Promise<Map<string, MethodsBaseRecord>> {
  const { data } = await (supabase as any)
    .from('method_vocabulary_links')
    .select('method_key, methodsbase_snapshot(id, slug, label, method_class, description, when_to_use, discipline, status, review_status, data)')
  const map = new Map<string, MethodsBaseRecord>()
  for (const row of data ?? []) {
    if (row.methodsbase_snapshot) map.set(row.method_key, row.methodsbase_snapshot as MethodsBaseRecord)
  }
  return map
}

export async function listMethodLernzielLinks(supabase: Client, projectId: string): Promise<MethodLernzielLink[]> {
  const { data } = await (supabase as any)
    .from('method_lernziel_links')
    .select('id, method_key, lernziel_id, status, source, rationale, reviewed_by, reviewed_at, created_at')
    .eq('project_id', projectId)
  return data ?? []
}

export async function reviewMethodLernzielLink(
  supabase: Client,
  linkId: string,
  decision: 'confirmed' | 'rejected',
  reviewerId: string
) {
  return (supabase as any)
    .from('method_lernziel_links')
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', linkId)
}

export async function addManualMethodLernzielLink(
  supabase: Client,
  projectId: string,
  methodKey: string,
  lernzielId: string,
  reviewerId: string
) {
  return (supabase as any)
    .from('method_lernziel_links')
    .upsert(
      {
        project_id: projectId,
        method_key: methodKey,
        lernziel_id: lernzielId,
        status: 'confirmed',
        source: 'manual',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,method_key,lernziel_id' }
    )
}
