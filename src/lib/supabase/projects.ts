import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { ADMIN_EMAIL } from '@/lib/admin'

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

  if (membership) {
    return { project, role: membership.role, joinedVia: membership.joined_via ?? null }
  }

  // Real ask 2026-10-01: an admin needs to open ANY project, not just ones
  // they happen to belong to -- migration 058 already made every content
  // table's RLS admit an admin the same way it admits a real owner. This is
  // the matching frontend half: without it, a non-member admin would still
  // hit the "you don't have access" screen below (ProjectLayout's `if
  // (!role)` branch) despite the database now actually allowing the reads.
  // 'owner' gives the same UI capability (canManage, Danger zone, etc.) a
  // real owner gets -- joinedVia stays null, so this never gets mistaken
  // for a self-joined student view.
  if (user.email === ADMIN_EMAIL) {
    return { project, role: 'owner', joinedVia: null }
  }

  return { project, role: null, joinedVia: null }
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
 *
 * Returns an explicit error when RLS allowed the request but matched no row
 * -- a DELETE a policy doesn't cover isn't a Postgres-level error, it's a
 * silent 0-row delete (confirmed live, 2026-10-01: before migration 052 was
 * pushed, this returned no `error` at all, so a caller checking only `error`
 * would wrongly treat "nothing happened" as success and navigate away as if
 * the project were actually gone). Checking the real row count here means
 * every caller gets a trustworthy result without having to know this.
 */
export async function deleteProject(supabase: Client, projectId: string) {
  const { data, error } = await supabase.from('projects').delete().eq('id', projectId).select('id')
  if (error) return { error }
  if (!data || data.length === 0) {
    return { error: new Error("Nothing was deleted -- you may not have permission, or it's already gone.") }
  }
  return { error: null }
}

export interface ProjectMetadataPatch {
  // All fields optional: the single-project edit form (ProjectEditForm)
  // always supplies name/description/working_languages since it starts from
  // a full pre-filled form, but bulk edit (admin-users-page.tsx's
  // BulkEditPanel) only ever touches the handful of fields it's actually
  // changing across a selection -- an omitted field here is left alone, not
  // cleared. Never send `undefined` to mean "clear it"; use `null` for
  // description.
  name?: string
  description?: string | null
  working_languages?: string[]
  // Undefined (not just omitted) on a nested sub-project -- inherited from
  // its parent at creation time (new-project-wizard.tsx), never independently
  // editable, same rule the wizard itself already enforces.
  epistemic_status?: ProjectRow['epistemic_status']
  is_private?: boolean
}

/**
 * Edits a project's own identity fields. Only the fields present in `patch`
 * are written -- epistemic_status/is_private only make sense for a top-level
 * project space (a nested sub-project inherits both from its parent, same as
 * at creation time); callers decide whether to include them. RLS (migration
 * 004's "Owners and maintainers can update their project", plus migration
 * 058's admin bypass) is the real boundary; this is a plain partial update.
 */
export async function updateProjectMetadata(supabase: Client, projectId: string, patch: ProjectMetadataPatch) {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.description !== undefined) row.description = patch.description
  if (patch.working_languages !== undefined) row.working_languages = patch.working_languages
  if (patch.epistemic_status !== undefined) row.epistemic_status = patch.epistemic_status
  if (patch.is_private !== undefined) row.is_private = patch.is_private
  if (Object.keys(row).length === 0) return { error: null }

  const { data, error } = await (supabase as any).from('projects').update(row).eq('id', projectId).select('id')
  if (error) return { error }
  if (!data || data.length === 0) {
    return { error: new Error("Nothing was updated -- you may not have permission, or it's already gone.") }
  }
  return { error: null }
}
