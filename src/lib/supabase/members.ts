import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { logActivity } from './activity'

type Client = SupabaseClient<Database>

export type ProjectMemberRole = Database['public']['Tables']['project_members']['Row']['role']
export type InviteRow = Database['public']['Tables']['project_invites']['Row']

export interface MemberWithUser {
  id: string
  role: ProjectMemberRole
  user: { id: string; email: string; name: string; avatar_url: string | null }
}

export async function listMembers(supabase: Client, projectId: string): Promise<MemberWithUser[]> {
  // Explicit FK hint required -- project_members has two FKs into users
  // (user_id and invited_by), so a bare `users(...)` embed is ambiguous.
  const { data } = await supabase
    .from('project_members')
    .select('id, role, user:users!project_members_user_id_fkey(id, email, name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as MemberWithUser[]
}

export async function listPendingInvites(supabase: Client, projectId: string): Promise<InviteRow[]> {
  const { data } = await supabase
    .from('project_invites')
    .select('*')
    .eq('project_id', projectId)
    .is('redeemed_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export interface InviteResult {
  email: string
  outcome: 'added' | 'invited' | 'already_member' | 'error'
  detail?: string
}

/**
 * Invites a batch of emails at once, one project owner/maintainer action
 * covering a whole class roster rather than one-at-a-time SQL by hand (the
 * only way this worked before). Each email resolves independently: if
 * someone with that email already has an account, they're added to
 * project_members immediately; otherwise a project_invites row waits for
 * them, auto-redeemed the moment they sign up (see migration 013's
 * extended handle_new_auth_user trigger) -- so an owner never needs to know
 * or care which of their invitees have signed up yet.
 */
export async function inviteMembers(
  supabase: Client,
  projectId: string,
  emails: string[],
  role: ProjectMemberRole
): Promise<InviteResult[]> {
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  const results: InviteResult[] = []
  for (const raw of emails) {
    const email = raw.trim().toLowerCase()
    if (!email) continue

    const { data: existingUser } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()

    if (existingUser) {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: existingUser.id, role, invited_by: currentUser?.id ?? null })
      if (error) {
        results.push(
          error.code === '23505'
            ? { email, outcome: 'already_member' }
            : { email, outcome: 'error', detail: error.message }
        )
      } else {
        results.push({ email, outcome: 'added' })
        await logActivity(supabase, { projectId, actionType: 'member_added', details: { email, role } })
      }
    } else {
      const { error } = await supabase
        .from('project_invites')
        .insert({ project_id: projectId, email, role, invited_by: currentUser?.id ?? null })
      if (error) {
        results.push(
          error.code === '23505'
            ? { email, outcome: 'invited', detail: 'already invited' }
            : { email, outcome: 'error', detail: error.message }
        )
      } else {
        results.push({ email, outcome: 'invited' })
        await logActivity(supabase, { projectId, actionType: 'member_invited', details: { email, role } })
      }
    }
  }
  return results
}

export async function revokeInvite(supabase: Client, inviteId: string) {
  return supabase.from('project_invites').delete().eq('id', inviteId)
}

export async function removeMember(supabase: Client, memberId: string) {
  return supabase.from('project_members').delete().eq('id', memberId)
}

export async function updateMemberRole(supabase: Client, memberId: string, role: ProjectMemberRole) {
  return supabase.from('project_members').update({ role }).eq('id', memberId)
}
