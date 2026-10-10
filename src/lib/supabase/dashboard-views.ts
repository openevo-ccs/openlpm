import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ProjectMemberRole } from './projects'

type Client = SupabaseClient<Database>

// None of this (project_dashboard_views, project_dashboard_view_assignments)
// is in the generated types yet -- cast at the query boundary, same
// convention as groups.ts/student-view-templates.ts.

export type DashboardViewKind = 'standard' | 'template'
export type ViewAssignmentTargetType = 'user' | 'group' | 'role' | 'join_method'
// Mirrors project_members.joined_via's own real values (migration 039):
// 'self_join_rule' is the only one ever written; anything else (added
// directly, invited by name) reads as 'direct' here.
export type JoinMethodValue = 'self_join_rule' | 'direct'

export interface DashboardView {
  id: string
  project_id: string
  name: string
  kind: DashboardViewKind
  page_keys: string[]
  template_id: string | null
  is_default: boolean
  is_forced: boolean
  created_at: string
}

export interface DashboardViewAssignment {
  id: string
  view_id: string
  target_type: ViewAssignmentTargetType
  target_value: string
}

export async function listDashboardViews(supabase: Client, projectId: string): Promise<DashboardView[]> {
  const { data } = await (supabase as any)
    .from('project_dashboard_views')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function listDashboardViewAssignments(supabase: Client, viewIds: string[]): Promise<DashboardViewAssignment[]> {
  if (viewIds.length === 0) return []
  const { data } = await (supabase as any)
    .from('project_dashboard_view_assignments')
    .select('*')
    .in('view_id', viewIds)
  return data ?? []
}

export interface CreateDashboardViewInput {
  name: string
  kind: DashboardViewKind
  pageKeys?: string[]
  templateId?: string | null
}

export async function createDashboardView(supabase: Client, projectId: string, input: CreateDashboardViewInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return (supabase as any)
    .from('project_dashboard_views')
    .insert({
      project_id: projectId,
      name: input.name,
      kind: input.kind,
      page_keys: input.kind === 'standard' ? input.pageKeys ?? [] : [],
      template_id: input.kind === 'template' ? input.templateId ?? null : null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .maybeSingle()
}

export async function updateDashboardViewPages(supabase: Client, viewId: string, pageKeys: string[]) {
  return (supabase as any).from('project_dashboard_views').update({ page_keys: pageKeys }).eq('id', viewId)
}

export async function setDashboardViewForced(supabase: Client, viewId: string, isForced: boolean) {
  return (supabase as any).from('project_dashboard_views').update({ is_forced: isForced }).eq('id', viewId)
}

/**
 * Makes `viewId` the project's one default view, unsetting any previous
 * default first -- the partial unique index (migration 109) only allows
 * one is_default=true row per project, so the old default has to clear
 * before the new one can be set. Two statements is fine for an
 * owner/maintainer-only, low-frequency action. `viewId: null` clears the
 * project's default entirely (nobody falls back to any view by default).
 */
export async function setDefaultDashboardView(supabase: Client, projectId: string, viewId: string | null) {
  const { error: clearError } = await (supabase as any)
    .from('project_dashboard_views')
    .update({ is_default: false })
    .eq('project_id', projectId)
    .eq('is_default', true)
  if (clearError) return { error: clearError }
  if (!viewId) return { error: null }
  return (supabase as any).from('project_dashboard_views').update({ is_default: true }).eq('id', viewId)
}

export async function deleteDashboardView(supabase: Client, viewId: string) {
  return (supabase as any).from('project_dashboard_views').delete().eq('id', viewId)
}

export async function addDashboardViewAssignment(
  supabase: Client,
  viewId: string,
  targetType: ViewAssignmentTargetType,
  targetValue: string
) {
  return (supabase as any)
    .from('project_dashboard_view_assignments')
    .insert({ view_id: viewId, target_type: targetType, target_value: targetValue })
}

export async function removeDashboardViewAssignment(supabase: Client, assignmentId: string) {
  return (supabase as any).from('project_dashboard_view_assignments').delete().eq('id', assignmentId)
}

// ============================================================================
// Resolution: given everything real about the viewer (their role, how they
// joined, which Groups they're in), which view -- if any -- applies to
// them, and whether they're locked into it or free to switch away.
//
// Specificity when more than one assignment matches the same viewer: a
// person named directly > a Group they're in > their project role > how
// they joined -- same "most specific wins" precedent as every other
// additive-policy feature in this schema (e.g. project_join_rules'
// email-vs-domain rules).
//
// Never resolves to a FORCED view for an owner/maintainer, regardless of
// what they're assigned to -- this is the one invariant carried over
// unchanged from the original "Preview as student" design (project-layout
// .tsx's own long-standing comment: "never true for an owner/maintainer's
// own real session, so an instructor can never be accidentally locked into
// the simplified view"). An owner/maintainer can still freely preview any
// defined view; they just always have a way back.
// ============================================================================

export interface ViewerContext {
  userId: string
  role: ProjectMemberRole
  joinedVia: string | null
  groupIds: string[]
}

export interface ViewResolution {
  // Non-null means: render exactly this view, no switcher offered.
  forcedView: DashboardView | null
  // Which view id (if any) to render before the viewer makes an explicit
  // choice of their own. Null means the full researcher/standard view.
  defaultViewId: string | null
  // Views the viewer may freely switch into (besides the full view, which
  // is always an option unless forcedView is set). Owners/maintainers get
  // every defined view here, matching their existing "preview anything"
  // capability.
  eligibleViews: DashboardView[]
}

const TARGET_SPECIFICITY: Record<ViewAssignmentTargetType, number> = {
  user: 0,
  group: 1,
  role: 2,
  join_method: 3,
}

export function resolveViewerViews(
  views: DashboardView[],
  assignments: DashboardViewAssignment[],
  viewer: ViewerContext
): ViewResolution {
  if (viewer.role === 'owner' || viewer.role === 'maintainer') {
    return { forcedView: null, defaultViewId: null, eligibleViews: views }
  }

  const joinMethodValue: JoinMethodValue = viewer.joinedVia === 'self_join_rule' ? 'self_join_rule' : 'direct'
  const viewById = new Map(views.map((v) => [v.id, v]))

  const matched = assignments
    .filter((a) => {
      if (a.target_type === 'user') return a.target_value === viewer.userId
      if (a.target_type === 'group') return viewer.groupIds.includes(a.target_value)
      if (a.target_type === 'role') return a.target_value === viewer.role
      return a.target_value === joinMethodValue
    })
    .map((a) => ({ specificity: TARGET_SPECIFICITY[a.target_type], view: viewById.get(a.view_id) }))
    .filter((m): m is { specificity: number; view: DashboardView } => !!m.view)
    .sort((a, b) => a.specificity - b.specificity)

  if (matched.length > 0) {
    const best = matched[0].view
    if (best.is_forced) return { forcedView: best, defaultViewId: best.id, eligibleViews: [] }
    const eligibleViews = Array.from(new Map(matched.map((m) => [m.view.id, m.view])).values())
    return { forcedView: null, defaultViewId: best.id, eligibleViews }
  }

  const fallbackDefault = views.find((v) => v.is_default)
  if (fallbackDefault) {
    if (fallbackDefault.is_forced) {
      return { forcedView: fallbackDefault, defaultViewId: fallbackDefault.id, eligibleViews: [] }
    }
    return { forcedView: null, defaultViewId: fallbackDefault.id, eligibleViews: [fallbackDefault] }
  }

  return { forcedView: null, defaultViewId: null, eligibleViews: [] }
}
