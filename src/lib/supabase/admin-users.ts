import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { JoinRule, JoinRuleType, ProjectMemberRole } from './members'
import type { ProjectRow } from './projects'

type Client = SupabaseClient<Database>

// Everything here is the cross-project counterpart of src/lib/supabase/members.ts
// -- built for the system-wide admin page (lab_manager/docs/design-notes/
// openlpm-system-wide-admin-page-scoping-2026-09-30.md, feedback 908d1311).
// Role-change/remove/add-rule/remove-rule actions deliberately reuse members.ts's
// own functions rather than duplicating them -- migration 049's admin RLS
// policies are what actually let those same functions now also succeed for an
// admin acting on a project they don't otherwise belong to.
//
// project_members/project_join_rules/users.blocked_at reads below aren't in the
// generated Supabase types until migration 049 is pushed -- cast at the query
// boundary, same convention as members.ts's own join-rule functions.

export interface AdminUserRow {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: string | null
  blocked_at: string | null
  created_at: string
}

export async function listAllUsers(supabase: Client): Promise<AdminUserRow[]> {
  const { data } = await (supabase as any)
    .from('users')
    .select('id, email, name, avatar_url, role, blocked_at, created_at')
    .order('created_at', { ascending: true })
  return (data ?? []) as AdminUserRow[]
}

/** The full project row -- kept as its own name since this module's callers already import it this way. */
export type AdminProjectRow = ProjectRow

/**
 * Every project that exists -- the join-rule project picker, the admin
 * Projects section, and (2026-10-01) the admin's own "Your project spaces"
 * page, which shows every real project platform-wide for the admin account
 * specifically, not just the ones it happens to belong to (real need: "I
 * need to always be able to see all projects on the platform"). Full row
 * (not a narrow column list) so the switcher page can render it with the
 * exact same card it already uses for a real membership. Needs migration
 * 049's admin SELECT policy on projects to include ones the admin isn't a
 * member of.
 */
export async function listAllProjects(supabase: Client): Promise<AdminProjectRow[]> {
  const { data } = await supabase.from('projects').select('*').order('name', { ascending: true })
  return (data ?? []) as AdminProjectRow[]
}


export interface AdminMembershipRow {
  id: string
  user_id: string
  role: ProjectMemberRole
  project: { id: string; name: string; slug: string }
}

/** Every membership row across every project -- needs migration 049's admin SELECT policy on project_members and projects to see rows outside the admin's own projects. */
export async function listAllMemberships(supabase: Client): Promise<AdminMembershipRow[]> {
  const { data } = await (supabase as any)
    .from('project_members')
    .select('id, user_id, role, project:projects(id, name, slug)')
    .order('created_at', { ascending: true })
  return (data ?? []) as AdminMembershipRow[]
}

export interface AdminJoinRule extends JoinRule {
  project: { id: string; name: string; slug: string }
}

export async function listAllJoinRules(supabase: Client): Promise<AdminJoinRule[]> {
  const { data } = await (supabase as any)
    .from('project_join_rules')
    .select('*, project:projects(id, name, slug)')
    .order('created_at', { ascending: false })
  return (data ?? []) as AdminJoinRule[]
}

export async function addAdminJoinRule(
  supabase: Client,
  projectId: string,
  ruleType: JoinRuleType,
  rawValue: string,
  role: ProjectMemberRole
) {
  const value = ruleType === 'domain' ? rawValue.trim().toLowerCase().replace(/^@+/, '') : rawValue.trim().toLowerCase()
  if (!value) return { error: new Error('Enter a value') }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (supabase as any)
    .from('project_join_rules')
    .insert({ project_id: projectId, rule_type: ruleType, value, role, created_by: user?.id ?? null })
}

export async function removeAdminJoinRule(supabase: Client, ruleId: string) {
  return (supabase as any).from('project_join_rules').delete().eq('id', ruleId)
}

/** Reversible sign-in lock (migration 049's users.blocked_at). Not a delete -- the account and everything it made stays exactly as-is. */
export async function setUserBlocked(supabase: Client, userId: string, blocked: boolean) {
  return (supabase as any)
    .from('users')
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq('id', userId)
}
