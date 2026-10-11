import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ProjectMemberRole } from './projects'
import type { PortfolioEdge, PortfolioNode } from './portfolios'

type Client = SupabaseClient<Database>

// None of this (groups_enabled/group_creator_roles on projects,
// project_groups, group_members, portfolios.group_id) is in the generated
// types yet -- cast at the query boundary, same convention as
// student_view_template/project_kind/color.

export interface ProjectGroup {
  id: string
  project_id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  share_favorites: boolean
  created_at: string
  user: { id: string; name: string; email: string }
}

export function groupsSettings(project: { groups_enabled?: boolean; group_creator_roles?: ProjectMemberRole[]; group_sharing_roles?: ProjectMemberRole[] | null } | Record<string, unknown>) {
  return {
    enabled: Boolean((project as any).groups_enabled),
    creatorRoles: ((project as any).group_creator_roles ?? []) as ProjectMemberRole[],
    // null (the default) = unrestricted, every member may share -- today's
    // real behavior, preserved. A real (possibly empty) array means an
    // owner has restricted sharing to just those roles (owner/maintainer
    // can always share regardless, same as canManageGroups).
    sharingRoles: ((project as any).group_sharing_roles ?? null) as ProjectMemberRole[] | null,
  }
}

/** Whether `role` may create/delete groups in this project -- mirrors can_manage_groups() server-side; owner/maintainer always can. */
export function canManageGroups(role: ProjectMemberRole, project: Record<string, unknown>): boolean {
  if (role === 'owner' || role === 'maintainer') return true
  return groupsSettings(project).creatorRoles.includes(role)
}

/** Whether `role` may share a Notebook or Favorites into a group -- mirrors can_share_in_group() server-side (migration 117); owner/maintainer always can. */
export function canShareInGroup(role: ProjectMemberRole, project: Record<string, unknown>): boolean {
  if (role === 'owner' || role === 'maintainer') return true
  const { sharingRoles } = groupsSettings(project)
  return sharingRoles === null || sharingRoles.includes(role)
}

export async function setGroupsEnabled(supabase: Client, projectId: string, enabled: boolean) {
  return (supabase as any).from('projects').update({ groups_enabled: enabled }).eq('id', projectId)
}

export async function setGroupSharingRoles(supabase: Client, projectId: string, roles: ProjectMemberRole[] | null) {
  return (supabase as any).from('projects').update({ group_sharing_roles: roles }).eq('id', projectId)
}

export async function setGroupCreatorRoles(supabase: Client, projectId: string, roles: ProjectMemberRole[]) {
  return (supabase as any).from('projects').update({ group_creator_roles: roles }).eq('id', projectId)
}

export async function getGroup(supabase: Client, groupId: string): Promise<ProjectGroup | null> {
  const { data } = await (supabase as any).from('project_groups').select('*').eq('id', groupId).maybeSingle()
  return data ?? null
}

export async function listGroups(supabase: Client, projectId: string): Promise<ProjectGroup[]> {
  const { data } = await (supabase as any)
    .from('project_groups')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function createGroup(supabase: Client, projectId: string, name: string) {
  const { data: { user } } = await supabase.auth.getUser()
  return (supabase as any).from('project_groups').insert({ project_id: projectId, name, created_by: user?.id ?? null })
}

export async function deleteGroup(supabase: Client, groupId: string) {
  return (supabase as any).from('project_groups').delete().eq('id', groupId)
}

export async function listGroupMembers(supabase: Client, groupId: string): Promise<GroupMember[]> {
  const { data } = await (supabase as any)
    .from('group_members')
    .select('id, group_id, user_id, share_favorites, created_at, user:users(id, name, email)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
  return data ?? []
}

/** Every group in the project, plus the current user's own membership row (if any) in each -- one round trip for the whole "pick a group" list. */
export async function listGroupsWithMyMembership(supabase: Client, projectId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const groups = await listGroups(supabase, projectId)
  if (!user || groups.length === 0) return groups.map((g) => ({ group: g, membership: null as GroupMember | null }))
  const { data: mine } = await (supabase as any)
    .from('group_members')
    .select('id, group_id, user_id, share_favorites, created_at, user:users(id, name, email)')
    .eq('user_id', user.id)
    .in('group_id', groups.map((g) => g.id))
  const byGroup = new Map<string, GroupMember>((mine ?? []).map((m: GroupMember) => [m.group_id, m]))
  return groups.map((g) => ({ group: g, membership: byGroup.get(g.id) ?? null }))
}

export async function joinGroup(supabase: Client, groupId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }
  return (supabase as any).from('group_members').insert({ group_id: groupId, user_id: user.id })
}

export async function leaveGroup(supabase: Client, groupMembershipId: string) {
  return (supabase as any).from('group_members').delete().eq('id', groupMembershipId)
}

export async function setShareFavorites(supabase: Client, groupMembershipId: string, share: boolean) {
  return (supabase as any).from('group_members').update({ share_favorites: share }).eq('id', groupMembershipId)
}

// ============================================================================
// Student synthesis: which Lernziele this group's opted-in members
// favorited, and how many of them picked each one. RLS (migration 077)
// already restricts the read to rows this viewer is actually allowed to
// see (a fellow member of a group the row's owner shares with, or someone
// who manages groups for the project) -- scoping the query to this
// specific group's own roster below is what keeps counts from a DIFFERENT
// group the same owner might also share with out of this tally.
// ============================================================================

export async function getGroupFavoritesSynthesis(supabase: Client, groupId: string) {
  const { data: sharingMembers } = await (supabase as any)
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('share_favorites', true)
  const userIds: string[] = (sharingMembers ?? []).map((m: { user_id: string }) => m.user_id)
  if (userIds.length === 0) return { sharingMemberCount: 0, counts: new Map<string, number>() }

  const { data: favRows } = await (supabase as any)
    .from('user_favorite_learning_goals')
    .select('user_id, data_object_id')
    .in('user_id', userIds)

  const counts = new Map<string, number>()
  for (const row of favRows ?? []) {
    counts.set(row.data_object_id, (counts.get(row.data_object_id) ?? 0) + 1)
  }
  return { sharingMemberCount: userIds.length, counts }
}

// ============================================================================
// Researcher synthesis: every Notebook shared with this group, merged into
// one graph -- same node/edge shape portfolios.ts's getPortfolioGraph
// already uses (so it drops straight into the existing read-only graph
// renderer), with each node tagged with which notebook/owner it came from.
// ============================================================================

export interface GroupGraphNode extends PortfolioNode {
  portfolioId: string
  portfolioName: string
  ownerName: string
}

export async function getGroupNotebookSynthesis(
  supabase: Client,
  projectId: string,
  groupId: string
): Promise<{ nodes: GroupGraphNode[]; edges: PortfolioEdge[]; portfolioCount: number }> {
  const { data: portfolios } = await (supabase as any)
    .from('portfolios')
    .select('id, name, owner_id, owner:users(name)')
    .eq('project_id', projectId)
    .eq('visibility', 'group')
    .eq('group_id', groupId)

  const list: { id: string; name: string; owner_id: string; owner: { name: string } | null }[] = portfolios ?? []
  if (list.length === 0) return { nodes: [], edges: [], portfolioCount: 0 }

  const portfolioIds = list.map((p) => p.id)
  const [{ data: items }, { data: privateNodes }, { data: links }] = await Promise.all([
    supabase.from('portfolio_items').select('*').in('portfolio_id', portfolioIds),
    supabase.from('portfolio_private_nodes').select('*').in('portfolio_id', portfolioIds),
    supabase.from('portfolio_links').select('*').in('portfolio_id', portfolioIds),
  ])

  const schemaElementIds = (items ?? []).filter((i) => i.target_type === 'schema_element').map((i) => i.target_id)
  const dataObjectIds = (items ?? []).filter((i) => i.target_type === 'data_object').map((i) => i.target_id)
  const [{ data: schemaElements }, { data: dataObjects }] = await Promise.all([
    schemaElementIds.length
      ? supabase.from('lpm_schema_elements').select('id, label, element_type').in('id', schemaElementIds)
      : Promise.resolve({ data: [] as { id: string; label: string; element_type: string }[] }),
    dataObjectIds.length
      ? supabase.from('lpm_data_objects').select('id, title, object_type').in('id', dataObjectIds)
      : Promise.resolve({ data: [] as { id: string; title: string; object_type: string }[] }),
  ])
  const schemaById = new Map((schemaElements ?? []).map((s) => [s.id, s]))
  const objectById = new Map((dataObjects ?? []).map((o) => [o.id, o]))
  const portfolioById = new Map(list.map((p) => [p.id, p]))

  const nodes: GroupGraphNode[] = []
  for (const item of items ?? []) {
    const resolved = item.target_type === 'schema_element' ? schemaById.get(item.target_id) : objectById.get(item.target_id)
    const p = portfolioById.get(item.portfolio_id)
    nodes.push({
      id: `item-${item.id}`,
      label: resolved ? ('label' in resolved ? resolved.label : resolved.title) : '(deleted canonical item)',
      kind: 'canonical',
      subtype: resolved ? ('element_type' in resolved ? resolved.element_type : resolved.object_type) : 'unknown',
      annotation: item.custom_annotation,
      posX: item.pos_x,
      posY: item.pos_y,
      portfolioId: item.portfolio_id,
      portfolioName: p?.name ?? '',
      ownerName: p?.owner?.name ?? 'Unknown',
    })
  }
  for (const node of privateNodes ?? []) {
    const p = portfolioById.get(node.portfolio_id)
    nodes.push({
      id: `priv-${node.id}`,
      label: node.label,
      kind: 'private',
      subtype: node.node_type,
      annotation: node.content,
      posX: node.pos_x,
      posY: node.pos_y,
      portfolioId: node.portfolio_id,
      portfolioName: p?.name ?? '',
      ownerName: p?.owner?.name ?? 'Unknown',
    })
  }
  const edges: PortfolioEdge[] = (links ?? []).map((link) => ({
    id: link.id,
    source: link.from_item_id ? `item-${link.from_item_id}` : `priv-${link.from_private_id}`,
    target: link.to_item_id ? `item-${link.to_item_id}` : `priv-${link.to_private_id}`,
    label: link.label,
    rationale: link.rationale,
  }))

  return { nodes, edges, portfolioCount: list.length }
}
