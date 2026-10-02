import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// lpm_concept_relations (migration 087) isn't in the generated types yet --
// cast at the query boundary, same convention as method_basiskonzept_links.
//
// Real feedback e7333af2 (Susan Hanisch, 2026-10-02): a named, directed link
// between any two Basiskonzepte/Unterkonzepte, at any depth, that the
// schema's own single-parent tree can't represent on its own -- mirrors
// lpm_connections (Lernziel-to-Lernziel) for lpm_schema_elements instead.

export interface ConceptRelation {
  id: string
  from_element_id: string
  to_element_id: string
  relation_type: string
}

export async function listConceptRelations(supabase: Client, projectId: string): Promise<ConceptRelation[]> {
  const { data } = await (supabase as any)
    .from('lpm_concept_relations')
    .select('id, from_element_id, to_element_id, relation_type')
    .eq('project_id', projectId)
  return data ?? []
}

export async function createConceptRelation(
  supabase: Client,
  projectId: string,
  fromElementId: string,
  toElementId: string,
  relationType: string
) {
  return (supabase as any)
    .from('lpm_concept_relations')
    .insert({ project_id: projectId, from_element_id: fromElementId, to_element_id: toElementId, relation_type: relationType })
}

export async function deleteConceptRelation(supabase: Client, id: string) {
  return (supabase as any).from('lpm_concept_relations').delete().eq('id', id)
}
