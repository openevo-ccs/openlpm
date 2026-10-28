import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { PartTags } from '@/lib/comparison/structure'

/** The parts of a space (rows of type "substrand" on its trunk branch) with the concepts tagged to each, main or supporting. */
export async function getPartTags(supabase: SupabaseClient<Database>, projectId: string): Promise<PartTags[]> {
  const { data: trunk } = await supabase.from('branches').select('id').eq('project_id', projectId).eq('is_trunk', true).maybeSingle()
  if (!trunk) return []
  const { data } = await supabase
    .from('lpm_data_objects')
    .select('id, content')
    .eq('project_id', projectId)
    .eq('branch_id', trunk.id)
    .eq('object_type', 'substrand')
    // Draft example and bridge parts belong to no strand yet, so they stay out of the structure.
    .neq('status', 'draft')
  return (data ?? []).map((row) => {
    const raw = (row.content as { concepts?: unknown } | null)?.concepts
    const concepts = Array.isArray(raw)
      ? (raw as { id?: unknown; emphasis?: unknown }[]).filter((c) => c?.id).map((c) => ({ id: String(c.id), primary: c.emphasis === 'primary' }))
      : []
    return { id: row.id, concepts }
  })
}
