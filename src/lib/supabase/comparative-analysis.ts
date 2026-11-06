import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// Real as of 2026-10-20 for exactly one real pair (Bio-Core LPM /
// Interdisciplinary LPM, the deliberate DCR-vs-ICR comparison pair) --
// shared between coherence-page.tsx's "Across curricula" tab and the
// German/US custom views' own "Vergleich"/"Comparison" tab, so both read
// the same one source of truth rather than two copies drifting apart.
// Not yet a general "pick any project to compare against" picker -- widen
// this map when a second real comparison pair exists.
export const KNOWN_COMPARISON_PAIRS: Record<string, string> = {
  'bio-core-lpm-synth': 'interdisciplinary-lpm-synth',
  'interdisciplinary-lpm-synth': 'bio-core-lpm-synth',
}

// The four synthetic spaces of the comparison, in reading order. The Time page compares any one of them with any other.
// KNOWN_COMPARISON_PAIRS stays as it is, because the comparative analysis tables hold links for that one pair only.
export const COMPARISON_SET = ['bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth']

export const COMPARISON_SET_LABELS: Record<string, string> = {
  'bio-core-lpm-synth': 'Bio-Core',
  'social-core-lpm-synth': 'Social-Core',
  'computational-core-lpm-synth': 'Computational-Core',
  'interdisciplinary-lpm-synth': 'Interdisciplinary',
}

/** The other spaces of the set that a space can be compared with. Empty for a project outside the set. */
export function comparisonPartners(slug: string): string[] {
  return COMPARISON_SET.includes(slug) ? COMPARISON_SET.filter((x) => x !== slug) : []
}

// None of this (lpm_comparative_links, lpm_divergence_reviews, and the two
// views built on top of them, migration 143/144) is in the generated types
// yet -- cast at the query boundary, same convention as dashboard-views.ts.

export interface ProjectComparisonProfile {
  project_id: string
  slug: string
  name: string
  strand_count: number
  substrand_count: number
  grade_bands_covered: number
  subject_domain_count: number
  avg_description_length: number | null
  avg_performance_indicators: number | null
  avg_real_world_links: number | null
  theory_count: number
  literature_count: number
  curriculum_repository_link_count: number
  comparative_link_count: number
  divergences_reviewed: number
  divergences_stale: number
}

export async function getProjectComparisonProfile(supabase: Client, projectId: string): Promise<ProjectComparisonProfile | null> {
  const { data } = await (supabase as any).from('lpm_project_comparison_profile').select('*').eq('project_id', projectId).maybeSingle()
  return data ?? null
}

export interface ComparativeLinkRow {
  id: string
  from_data_object_id: string
  to_data_object_id: string
  relation_type: string
  divergence_ref: string | null
  commentary: string
  created_at: string
}

export interface ComparativeLinkWithTitles extends ComparativeLinkRow {
  from_title: string
  from_project_id: string
  to_title: string
  to_project_id: string
  divergence_label: string | null
}

/** Every real comparative link whose two ends sit in these two specific projects (either direction) -- the "how does A compare to B" workspace's own main list. */
export async function listComparativeLinksBetweenProjects(
  supabase: Client,
  projectIdA: string,
  projectIdB: string
): Promise<ComparativeLinkWithTitles[]> {
  const { data } = await (supabase as any)
    .from('lpm_comparative_links')
    .select('*, from_object:lpm_data_objects!lpm_comparative_links_from_data_object_id_fkey(id,title,project_id), to_object:lpm_data_objects!lpm_comparative_links_to_data_object_id_fkey(id,title,project_id)')
  const rows = (data ?? []) as any[]
  const relevant = rows.filter((r) => {
    const a = r.from_object?.project_id
    const b = r.to_object?.project_id
    return (a === projectIdA && b === projectIdB) || (a === projectIdB && b === projectIdA)
  })
  if (relevant.length === 0) return []

  const divergenceRefs = Array.from(new Set(relevant.map((r) => r.divergence_ref).filter(Boolean)))
  let labels = new Map<string, string>()
  if (divergenceRefs.length > 0) {
    const { data: divergences } = await (supabase as any).from('theorybase_snapshot').select('id,label').in('id', divergenceRefs)
    labels = new Map((divergences ?? []).map((d: any) => [d.id, d.label]))
  }

  return relevant.map((r) => ({
    id: r.id,
    from_data_object_id: r.from_data_object_id,
    to_data_object_id: r.to_data_object_id,
    relation_type: r.relation_type,
    divergence_ref: r.divergence_ref,
    commentary: r.commentary,
    created_at: r.created_at,
    from_title: r.from_object?.title ?? '(unknown)',
    from_project_id: r.from_object?.project_id,
    to_title: r.to_object?.title ?? '(unknown)',
    to_project_id: r.to_object?.project_id,
    divergence_label: r.divergence_ref ? labels.get(r.divergence_ref) ?? null : null,
  }))
}

export async function createComparativeLink(
  supabase: Client,
  params: { fromDataObjectId: string; toDataObjectId: string; relationType: string; divergenceRef?: string | null; commentary: string }
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await (supabase as any).from('lpm_comparative_links').insert({
    from_data_object_id: params.fromDataObjectId,
    to_data_object_id: params.toDataObjectId,
    relation_type: params.relationType,
    divergence_ref: params.divergenceRef || null,
    commentary: params.commentary,
    created_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}

export interface DivergenceCoverageRow {
  project_id: string
  divergence_ref: string
  divergence_label: string | null
  outcome: string
  reviewed_version: string | null
  current_version: string | null
  is_stale: boolean
  reviewed_at: string
}

export async function listDivergenceCoverage(supabase: Client, projectId: string): Promise<DivergenceCoverageRow[]> {
  const { data } = await (supabase as any).from('lpm_divergence_coverage').select('*').eq('project_id', projectId)
  return data ?? []
}

/** Real TheoryBase divergence records whose relatedTheories overlap with this project's own linked theories -- "which real disagreements are even relevant here," independent of whether they've been reviewed yet. */
export async function listApplicableDivergences(supabase: Client, projectId: string): Promise<{ id: string; label: string; data: any }[]> {
  const { data: theories } = await supabase.from('theories').select('base_repo_ref').eq('project_id', projectId).not('base_repo_ref', 'is', null)
  const refs = (theories ?? []).map((t) => t.base_repo_ref).filter(Boolean) as string[]
  if (refs.length === 0) return []
  const { data: divergences } = await (supabase as any).from('theorybase_snapshot').select('id,label,data').eq('record_type', 'divergence')
  return (divergences ?? []).filter((d: any) => {
    const related = d.data?.relatedTheories
    return Array.isArray(related) && related.some((r: string) => refs.includes(r))
  })
}
