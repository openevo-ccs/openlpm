import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { logActivity } from './activity'

type Client = SupabaseClient<Database>

// project_federations (migration 083) isn't in the generated Supabase types
// yet -- cast at the query boundary here, same convention as members.ts's
// join-rules functions, rather than block the whole file on a type regen
// that needs the real push to happen first anyway.

export type FederationStatus = 'proposed' | 'accepted' | 'revoked'
export type ProjectMemberRole = Database['public']['Tables']['project_members']['Row']['role']

export interface Federation {
  id: string
  source_project_id: string
  target_project_id: string
  granted_role: ProjectMemberRole
  status: FederationStatus
  proposed_by: string | null
  created_at: string
  accepted_by: string | null
  accepted_at: string | null
  revoked_by: string | null
  revoked_at: string | null
}

export interface ResolvedProject {
  id: string
  name: string
  slug: string
  project_kind?: string
}

/** Outgoing: federations where `projectId` is the source (offering its own members elsewhere). */
export async function listOutgoingFederations(supabase: Client, projectId: string): Promise<Federation[]> {
  const { data } = await (supabase as any)
    .from('project_federations')
    .select('*')
    .eq('source_project_id', projectId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Federation[]
}

/** Incoming: federations where `projectId` is the target (another project's members reaching in). */
export async function listIncomingFederations(supabase: Client, projectId: string): Promise<Federation[]> {
  const { data } = await (supabase as any)
    .from('project_federations')
    .select('*')
    .eq('target_project_id', projectId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Federation[]
}

/** Resolves a target project by its exact slug -- see migration 083's own comment on why this is a slug lookup, not a browsable search. */
export async function findProjectForFederation(supabase: Client, slug: string): Promise<ResolvedProject | null> {
  const { data } = await (supabase as any).rpc('find_project_for_federation', { p_slug: slug.trim().toLowerCase() })
  return (data && data[0]) ?? null
}

/** Resolves the OTHER side's name/slug for a federation row the caller can already see. */
export async function federationCounterparty(supabase: Client, projectId: string): Promise<ResolvedProject | null> {
  const { data } = await (supabase as any).rpc('federation_counterparty', { p_project_id: projectId })
  return (data && data[0]) ?? null
}

export interface FederationPreviewMember {
  user_id: string
  name: string
  email: string
  role: ProjectMemberRole
}

/** The real accept-time preview: exactly who is about to be added and at what role. */
export async function federationPreviewMembers(supabase: Client, federationId: string): Promise<FederationPreviewMember[]> {
  const { data } = await (supabase as any).rpc('federation_preview_members', { p_federation_id: federationId })
  return (data ?? []) as FederationPreviewMember[]
}

/** Labels a federation-sourced roster row -- "via federation with <name>". */
export async function federationSourceName(supabase: Client, federationId: string): Promise<string | null> {
  const { data } = await (supabase as any).rpc('federation_source_name', { p_federation_id: federationId })
  return data ?? null
}

export async function proposeFederation(
  supabase: Client,
  sourceProjectId: string,
  targetProjectId: string,
  grantedRole: ProjectMemberRole
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await (supabase as any)
    .from('project_federations')
    .insert({
      source_project_id: sourceProjectId,
      target_project_id: targetProjectId,
      granted_role: grantedRole,
      status: 'proposed',
      proposed_by: user?.id ?? null,
    })

  if (!error) {
    await logActivity(supabase, {
      projectId: sourceProjectId,
      actionType: 'federation_proposed',
      targetType: 'project',
      targetId: targetProjectId,
      details: { granted_role: grantedRole },
    })
  }
  return { error }
}

/** Target owner/maintainer accepting -- the UI must show federationPreviewMembers's real list first. */
export async function acceptFederation(supabase: Client, federation: Federation) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await (supabase as any)
    .from('project_federations')
    .update({ status: 'accepted', accepted_by: user?.id ?? null, accepted_at: new Date().toISOString() })
    .eq('id', federation.id)

  if (!error) {
    await logActivity(supabase, {
      projectId: federation.target_project_id,
      actionType: 'federation_accepted',
      targetType: 'project',
      targetId: federation.source_project_id,
      details: { granted_role: federation.granted_role },
    })
  }
  return { error }
}

/** Ends a federation -- declining a still-proposed one, or revoking an active one. Either side may call this. */
export async function revokeFederation(supabase: Client, federation: Federation) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await (supabase as any)
    .from('project_federations')
    .update({ status: 'revoked', revoked_by: user?.id ?? null, revoked_at: new Date().toISOString() })
    .eq('id', federation.id)

  if (!error) {
    await logActivity(supabase, {
      projectId: federation.source_project_id,
      actionType: 'federation_revoked',
      targetType: 'project',
      targetId: federation.target_project_id,
      details: { previous_status: federation.status },
    })
  }
  return { error }
}
