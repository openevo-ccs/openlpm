import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type TheoryRow = Database['public']['Tables']['theories']['Row']
export type TheoryLiteratureLinkRow = Database['public']['Tables']['theory_literature_links']['Row']
export type TheoryRelationRow = Database['public']['Tables']['theory_relations']['Row']
export type LiteratureRow = Database['public']['Tables']['literature_references']['Row']

export async function listTheories(supabase: Client, projectId: string): Promise<TheoryRow[]> {
  const { data } = await supabase.from('theories').select('*').eq('project_id', projectId).order('label', { ascending: true })
  return data ?? []
}

export interface TheoryLiteratureLinkWithReference extends TheoryLiteratureLinkRow {
  reference: LiteratureRow
}

/** A theory's linked literature, the concepts/schema elements it relates to are resolved separately by target_type since it's polymorphic (no single FK to embed). */
export async function getTheoryLiteratureLinks(supabase: Client, theoryId: string): Promise<TheoryLiteratureLinkWithReference[]> {
  const { data } = await supabase
    .from('theory_literature_links')
    .select('*, reference:literature_references(*)')
    .eq('theory_id', theoryId)
  return (data ?? []) as unknown as TheoryLiteratureLinkWithReference[]
}

export async function getTheoryRelations(supabase: Client, theoryId: string): Promise<TheoryRelationRow[]> {
  const { data } = await supabase.from('theory_relations').select('*').eq('theory_id', theoryId)
  return data ?? []
}

/** Resolves each relation's target label locally, since target_type is polymorphic across three different tables. */
export async function resolveRelationLabels(
  supabase: Client,
  relations: TheoryRelationRow[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const byType = {
    framework_tag: relations.filter((r) => r.target_type === 'framework_tag').map((r) => r.target_id),
    schema_element: relations.filter((r) => r.target_type === 'schema_element').map((r) => r.target_id),
    data_object: relations.filter((r) => r.target_type === 'data_object').map((r) => r.target_id),
    thread: relations.filter((r) => r.target_type === 'thread').map((r) => r.target_id),
  }
  const [tags, elements, objects, threads] = await Promise.all([
    byType.framework_tag.length ? supabase.from('framework_tags').select('id, label').in('id', byType.framework_tag) : Promise.resolve({ data: [] }),
    byType.schema_element.length ? supabase.from('lpm_schema_elements').select('id, label').in('id', byType.schema_element) : Promise.resolve({ data: [] }),
    byType.data_object.length ? supabase.from('lpm_data_objects').select('id, title').in('id', byType.data_object) : Promise.resolve({ data: [] }),
    byType.thread.length ? supabase.from('lpm_threads').select('id, title').in('id', byType.thread) : Promise.resolve({ data: [] }),
  ])
  for (const t of tags.data ?? []) labels.set(t.id, t.label)
  for (const e of elements.data ?? []) labels.set(e.id, e.label)
  for (const o of objects.data ?? []) labels.set(o.id, o.title)
  for (const th of threads.data ?? []) labels.set(th.id, th.title)
  return labels
}
