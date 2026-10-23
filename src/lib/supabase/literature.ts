import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type LiteratureRow = Database['public']['Tables']['literature_references']['Row']
export type LiteraturebaseSnapshotRow = Database['public']['Tables']['literaturebase_snapshot']['Row']
export type LiteratureContributionRow = Database['public']['Tables']['literature_contributions']['Row']
export type ProjectBaseLinkRow = Database['public']['Tables']['project_base_links']['Row']

// ============================================================================
// project_base_links -- the existing platform-wide "which shared libraries
// can this project use" switch (migration 004), already wired up for
// ConceptBase/TheoryBase. Reused here so checking against and proposing to
// LiteratureBase stay an explicit per-project opt-in, not a silent always-on.
// ============================================================================

export async function getLiteraturebaseLink(supabase: Client, projectId: string): Promise<ProjectBaseLinkRow | null> {
  const { data } = await supabase
    .from('project_base_links')
    .select('*')
    .eq('project_id', projectId)
    .eq('base_repo', 'literaturebase')
    .maybeSingle()
  return data ?? null
}

export async function setLiteraturebaseLink(supabase: Client, projectId: string, enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (enabled) {
    await supabase.from('project_base_links').upsert(
      { project_id: projectId, base_repo: 'literaturebase', can_import: true, can_propose_pr: true, added_by: user?.id ?? null },
      { onConflict: 'project_id,base_repo' }
    )
  } else {
    await supabase.from('project_base_links').delete().eq('project_id', projectId).eq('base_repo', 'literaturebase')
  }
}

// ============================================================================
// LiteratureBase snapshot -- a read-only, periodically-refreshed cache of
// real LiteratureBase content, synced by scripts/sync_literaturebase_snapshot.mjs.
// Used two ways: (1) cross-checking a search result's DOI against the real
// corpus regardless of which external engine found it (feedback 36f3fe54),
// and (2) letting someone search the corpus directly as its own engine.
// ============================================================================

/** Looks up real LiteratureBase matches for a set of DOIs in one round trip -- the "is this already a trusted source" check run against every search result, not just ones found by searching LiteratureBase directly. */
export async function findLiteraturebaseMatchesByDoi(supabase: Client, dois: string[]): Promise<Map<string, LiteraturebaseSnapshotRow>> {
  const clean = [...new Set(dois.filter(Boolean))]
  const byDoi = new Map<string, LiteraturebaseSnapshotRow>()
  if (clean.length === 0) return byDoi
  const { data } = await supabase.from('literaturebase_snapshot').select('*').in('doi', clean)
  for (const row of data ?? []) if (row.doi) byDoi.set(row.doi, row)
  return byDoi
}

/** Resolves a set of already-linked literaturebase_id values (literature_references.literaturebase_id) to their real snapshot rows, for showing a "already in LiteratureBase" badge on saved items. */
export async function getLiteraturebaseSnapshotByIds(supabase: Client, ids: string[]): Promise<Map<string, LiteraturebaseSnapshotRow>> {
  const clean = [...new Set(ids.filter(Boolean))]
  const byId = new Map<string, LiteraturebaseSnapshotRow>()
  if (clean.length === 0) return byId
  const { data } = await supabase.from('literaturebase_snapshot').select('*').in('id', clean)
  for (const row of data ?? []) byId.set(row.id, row)
  return byId
}

// Matches on title AND each record's own plain-language summary text, not
// title alone -- a real improvement over a title-only search, but an
// honest one: this is full-text keyword matching, not semantic search.
// GWDG's live model roster has zero embedding-capable models right now
// (checked directly, 2026-10-23), so true semantic search over this
// corpus needs an embedding model this lab's infrastructure doesn't have
// yet -- not something to fake with a relabeled keyword search.
export async function searchLiteraturebaseSnapshot(supabase: Client, query: string): Promise<LiteraturebaseSnapshotRow[]> {
  const q = query.trim()
  if (q.length < 2) {
    const { data } = await supabase.from('literaturebase_snapshot').select('*').order('title', { ascending: true }).limit(40)
    return data ?? []
  }
  // PostgREST's `.or()` filter string has its own comma/parenthesis syntax
  // -- strip those out of free-typed search text rather than risk a typed
  // "," or "(" breaking the filter expression.
  const safe = q.replace(/[,()]/g, ' ').trim()
  const { data } = await supabase
    .from('literaturebase_snapshot')
    .select('*')
    .or(`title.ilike.%${safe}%,data->plain_language_summary->>text.ilike.%${safe}%`)
    .limit(40)
  return data ?? []
}

// ============================================================================
// Proposing a project's own literature reference back to LiteratureBase.
// This records intent + a generated draft; the actual branch/commit in the
// real literaturebase repo is scripts/draft_literaturebase_contribution.mjs's
// job, run with a human's own hands, same boundary every other write to a
// shared governed resource hits in this lab.
// ============================================================================

export async function listLiteratureContributions(supabase: Client, referenceId: string): Promise<LiteratureContributionRow[]> {
  const { data } = await supabase
    .from('literature_contributions')
    .select('*')
    .eq('literature_reference_id', referenceId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createLiteratureContribution(
  supabase: Client,
  referenceId: string,
  projectId: string,
  draftYaml: string
): Promise<LiteratureContributionRow> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('literature_contributions')
    .insert({ literature_reference_id: referenceId, project_id: projectId, draft_yaml: draftYaml, created_by: user?.id ?? null })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not record this proposal.')
  return data
}
