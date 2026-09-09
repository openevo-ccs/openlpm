import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type BranchRow = Database['public']['Tables']['branches']['Row']

/**
 * Resolves a branch by its (project-scoped) slug. Branch slugs are only
 * unique within a project (UNIQUE (project_id, slug), see migration 004),
 * so this always needs the project id alongside the slug -- unlike
 * getProjectBySlug, there's no project-membership check here because the
 * caller (BranchLayout) already sits inside <ProjectLayout>, which has
 * already resolved that.
 */
export async function getBranchBySlug(
  supabase: Client,
  projectId: string,
  slug: string
): Promise<BranchRow | null> {
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .maybeSingle()

  return data
}
