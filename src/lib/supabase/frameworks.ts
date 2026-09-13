import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type FrameworkRow = Database['public']['Tables']['frameworks']['Row']
export type FrameworkTagRow = Database['public']['Tables']['framework_tags']['Row']

/**
 * Every framework of one type a project could pick from: the ecosystem-
 * shared ones (project_id null -- the seeded ISCED grade-band reference and
 * starter subject-area taxonomy) plus any of the user's own projects' real
 * local schemes (RLS already limits this to frameworks the user can
 * actually see -- shared, or belonging to a project they're a member of).
 */
export async function listAvailableFrameworks(supabase: Client, type: FrameworkRow['framework_type']): Promise<FrameworkRow[]> {
  const { data } = await supabase.from('frameworks').select('*').eq('framework_type', type).order('project_id', { ascending: true, nullsFirst: true })
  return data ?? []
}

export async function listFrameworkTags(supabase: Client, frameworkId: string): Promise<FrameworkTagRow[]> {
  const { data } = await supabase.from('framework_tags').select('*').eq('framework_id', frameworkId).order('sort_order', { ascending: true, nullsFirst: true })
  return data ?? []
}
