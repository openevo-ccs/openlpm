import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// method_basiskonzept_links (migration 079) isn't in the generated types
// yet -- cast at the query boundary, same as project_join_rules.

export interface MethodConceptLink {
  method_key: string
  basiskonzept_id: string
  is_konzeptanker: boolean
}

export async function listMethodConceptLinks(supabase: Client, projectId: string): Promise<MethodConceptLink[]> {
  const { data } = await (supabase as any)
    .from('method_basiskonzept_links')
    .select('method_key, basiskonzept_id, is_konzeptanker')
    .eq('project_id', projectId)
  return data ?? []
}

export async function setMethodConceptLink(
  supabase: Client,
  projectId: string,
  methodKey: string,
  basiskonzeptId: string,
  linked: boolean
) {
  if (linked) {
    return (supabase as any)
      .from('method_basiskonzept_links')
      .insert({ project_id: projectId, method_key: methodKey, basiskonzept_id: basiskonzeptId })
  }
  return (supabase as any)
    .from('method_basiskonzept_links')
    .delete()
    .eq('project_id', projectId)
    .eq('method_key', methodKey)
    .eq('basiskonzept_id', basiskonzeptId)
}

export async function setMethodConceptKonzeptanker(
  supabase: Client,
  projectId: string,
  methodKey: string,
  basiskonzeptId: string,
  isKonzeptanker: boolean
) {
  return (supabase as any)
    .from('method_basiskonzept_links')
    .update({ is_konzeptanker: isKonzeptanker })
    .eq('project_id', projectId)
    .eq('method_key', methodKey)
    .eq('basiskonzept_id', basiskonzeptId)
}
