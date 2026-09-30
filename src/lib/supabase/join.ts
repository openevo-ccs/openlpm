import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ProjectMemberRole } from './projects'
import { logActivity } from './activity'

type Client = SupabaseClient<Database>

export interface JoinEligibility {
  eligible: boolean
  role: ProjectMemberRole | null
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

  const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: user.id, role })
  if (!error) {
    await logActivity(supabase, { projectId, actionType: 'member_self_joined', details: { role } })
  }
  return { error }
}
