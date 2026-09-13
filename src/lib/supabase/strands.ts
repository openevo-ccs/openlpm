import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type StrandParentRow = Database['public']['Tables']['strand_parents']['Row']
export type ThreadRow = Database['public']['Tables']['lpm_threads']['Row']

/** The strands this one is nested directly under -- a strand can have more than one. */
export async function listParentStrands(supabase: Client, strandId: string): Promise<ThreadRow[]> {
  const { data } = await supabase
    .from('strand_parents')
    .select('parent:lpm_threads!strand_parents_parent_strand_id_fkey(*)')
    .eq('strand_id', strandId)
  return ((data ?? []) as unknown as { parent: ThreadRow }[]).map((r) => r.parent).filter(Boolean)
}

/** The strands directly nested under this one -- possibly also nested under others. */
export async function listChildStrands(supabase: Client, strandId: string): Promise<ThreadRow[]> {
  const { data } = await supabase
    .from('strand_parents')
    .select('child:lpm_threads!strand_parents_strand_id_fkey(*)')
    .eq('parent_strand_id', strandId)
  return ((data ?? []) as unknown as { child: ThreadRow }[]).map((r) => r.child).filter(Boolean)
}

export async function addParentStrand(supabase: Client, strandId: string, parentStrandId: string) {
  return supabase.from('strand_parents').insert({ strand_id: strandId, parent_strand_id: parentStrandId })
}

export async function removeParentStrand(supabase: Client, strandId: string, parentStrandId: string) {
  return supabase.from('strand_parents').delete().eq('strand_id', strandId).eq('parent_strand_id', parentStrandId)
}
