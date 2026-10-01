import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ProjectMemberRole, ProjectRow } from './projects'
import { logActivity } from './activity'

type Client = SupabaseClient<Database>

export interface JoinEligibility {
  eligible: boolean
  role: ProjectMemberRole | null
}

export interface JoinableProject {
  project: ProjectRow
  role: ProjectMemberRole
}

/**
 * Every project the signed-in user is eligible to self-join right now --
 * the same real data `checkJoinEligibility` checks one project at a time,
 * surfaced as a real list instead of requiring someone to already know a
 * slug or link (real feedback 2026-10-01: "should provide a drop down list
 * ... not complicated codes"). RLS (migration 035) already restricts
 * `project_join_rules` to just the rows matching the caller's own email, so
 * this can't be used to browse any other project's allowlist. A project can
 * carry more than one matching rule (e.g. a domain rule plus a narrower
 * email rule) -- deduped by project id, first match wins.
 */
export async function listMyJoinableProjects(supabase: Client): Promise<JoinableProject[]> {
  const { data } = await (supabase as any)
    .from('project_join_rules')
    .select('role, project:projects(*)')
  const seen = new Set<string>()
  const result: JoinableProject[] = []
  for (const row of (data ?? []) as { role: ProjectMemberRole; project: ProjectRow | null }[]) {
    if (!row.project || seen.has(row.project.id)) continue
    seen.add(row.project.id)
    result.push({ project: row.project, role: row.role })
  }
  return result
}

/**
 * Whether the current signed-in user is allowed to self-join this project,
 * and which role they'd get. Relies entirely on project_join_rules' own RLS
 * (migration 035): a non-admin can only ever see the one rule row that
 * actually matches their own sign-in email, so this can't be used to probe
 * the rest of a project's allowlist -- an empty result here just means "no
 * rule matches me," never "here's the full list to try."
 */
export async function checkJoinEligibility(supabase: Client, projectId: string): Promise<JoinEligibility> {
  const { data } = await (supabase as any).from('project_join_rules').select('role').eq('project_id', projectId).limit(1)
  const row = (data ?? [])[0] as { role: ProjectMemberRole } | undefined
  return { eligible: !!row, role: row?.role ?? null }
}

/**
 * The actual join: a plain insert the RLS policy only allows through when
 * `role` exactly matches a rule that matches the caller's own email --
 * never trust the caller to have picked the right role themselves, always
 * pass back exactly what checkJoinEligibility just confirmed.
 */
export async function selfJoinProject(supabase: Client, projectId: string, role: ProjectMemberRole) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }

  // joined_via (migration 039) isn't in the generated types yet -- same
  // not-regenerated-until-real-deploy situation as project_join_rules itself.
  const { error } = await (supabase as any)
    .from('project_members')
    .insert({ project_id: projectId, user_id: user.id, role, joined_via: 'self_join_rule' })
  if (!error) {
    await logActivity(supabase, { projectId, actionType: 'member_self_joined', details: { role } })
  }
  return { error }
}
