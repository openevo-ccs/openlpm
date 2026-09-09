import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProjectMemberRole = Database['public']['Tables']['project_members']['Row']['role']

export interface ProjectWithRole {
  project: ProjectRow
  role: ProjectMemberRole
}

/** Every project the current user is a member of, with their role in each. */
export async function getUserProjects(supabase: Client): Promise<ProjectWithRole[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('role, projects(*)')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data
    .filter((row): row is typeof row & { projects: ProjectRow } => row.projects !== null)
    .map((row) => ({ project: row.projects, role: row.role }))
}

/**
 * Resolves a project by slug and the current user's role in it (null if the
 * project doesn't exist, or exists but they aren't a member -- RLS lets any
 * authenticated user see the project row itself, per "projects are a
 * browsable directory," but not its content, so those two cases are
 * distinguished by whether `project` comes back at all vs. `role` being null).
 */
export async function getProjectBySlug(
  supabase: Client,
  slug: string
): Promise<{ project: ProjectRow | null; role: ProjectMemberRole | null }> {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!project) return { project: null, role: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { project, role: null }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { project, role: membership?.role ?? null }
}
