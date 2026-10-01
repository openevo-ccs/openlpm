import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProjectMemberRole = Database['public']['Tables']['project_members']['Row']['role']

export interface ProjectWithRole {
  project: ProjectRow
  role: ProjectMemberRole
}

/**
 * Every project the current user is a member of, with their role in each.
 *
 * Real bug, fixed 2026-09-13: this query had no `user_id` filter, relying
 * entirely on RLS to scope the rows -- but the `project_members` SELECT
 * policy correctly lets any member of a project see the *whole* team's
 * membership rows (that's what the Members page needs), not just the
 * caller's own. On any project with more than one person, every other
 * member's row leaked in here too, so a shared project showed once per
 * person on it, each with that person's own role misattributed to the
 * viewer -- reported independently by both Dustin and Susan Hanisch on
 * EvoMentor Thuringia. Filtering by user_id explicitly fixes it at the
 * source, for every caller of this function (project switcher and profile
 * page both use it), rather than patching each caller's display logic.
 */
export async function getUserProjects(supabase: Client): Promise<ProjectWithRole[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('project_members')
    .select('role, projects(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data
    .filter((row): row is typeof row & { projects: ProjectRow } => row.projects !== null)
    .map((row) => ({ project: row.projects, role: row.role }))
}

/**
 * Resolves a project by slug and the current user's role in it (null if the
 * project doesn't exist, or exists but they aren't a member -- RLS lets any
 * authenticated user see a *public* project's row, per "projects are a
 * browsable directory," but never its content; a *private* project's row
 * (migration 025) is invisible to non-members entirely, so those two cases
 * are distinguished by whether `project` comes back at all vs. `role` being
 * null).
 */
export async function getProjectBySlug(
  supabase: Client,
  slug: string
): Promise<{ project: ProjectRow | null; role: ProjectMemberRole | null; joinedVia: string | null }> {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!project) return { project: null, role: null, joinedVia: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { project, role: null, joinedVia: null }

  // joined_via (migration 039) isn't in the generated types yet.
  const { data: membership } = await (supabase as any)
    .from('project_members')
    .select('role, joined_via')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { project, role: membership?.role ?? null, joinedVia: membership?.joined_via ?? null }
}

/** How many sub-projects sit inside this project -- deletion must be blocked while any exist (see deleteProject's own comment). */
export async function countSubProjects(supabase: Client, projectId: string): Promise<number> {
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('parent_project_id', projectId)
  return count ?? 0
}

/**
 * Permanently deletes a project. Every project-scoped table cascades on
 * projects.id (migrations 004/010/011/013/018/019/020/027/030/035, etc.)
 * EXCEPT sub-projects (parent_project_id is ON DELETE SET NULL, migration
 * 015) -- they'd silently become orphaned, top-level projects instead of
 * being deleted. Callers must call countSubProjects() first and refuse to
 * proceed while any exist, rather than relying on that DB behavior. No undo
 * once this succeeds. Needs migration 052's owner/admin DELETE policies on
 * `projects` to be live.
 */
export async function deleteProject(supabase: Client, projectId: string) {
  return supabase.from('projects').delete().eq('id', projectId)
}
