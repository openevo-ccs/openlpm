import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type TheoryRow = Database['public']['Tables']['theories']['Row']
export type TheoryLiteratureLinkRow = Database['public']['Tables']['theory_literature_links']['Row']
export type TheoryRelationRow = Database['public']['Tables']['theory_relations']['Row']
export type LiteratureRow = Database['public']['Tables']['literature_references']['Row']
export type TheoryPropositionRow = Database['public']['Tables']['theory_propositions']['Row']
export type TheoryContributionRow = Database['public']['Tables']['theory_contributions']['Row']
export type TheorybaseSnapshotRow = Database['public']['Tables']['theorybase_snapshot']['Row']
export type ProjectBaseLinkRow = Database['public']['Tables']['project_base_links']['Row']

export async function listTheories(supabase: Client, projectId: string): Promise<TheoryRow[]> {
  const { data } = await supabase.from('theories').select('*').eq('project_id', projectId).order('label', { ascending: true })
  return data ?? []
}

// ============================================================================
// Propositions/assumptions -- the real decomposition TheoryBase's own
// schema requires (Option 3, the "theory workbench").
// ============================================================================

export async function listTheoryPropositions(supabase: Client, theoryId: string): Promise<TheoryPropositionRow[]> {
  const { data } = await supabase.from('theory_propositions').select('*').eq('theory_id', theoryId).order('sort_order', { ascending: true })
  return data ?? []
}

export async function addTheoryProposition(
  supabase: Client,
  theoryId: string,
  kind: 'proposition' | 'assumption',
  label: string,
  statement: string,
  sortOrder: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('theory_propositions').insert({
    theory_id: theoryId, kind, label, statement, sort_order: sortOrder, created_by: user?.id ?? null,
  })
}

export async function removeTheoryProposition(supabase: Client, id: string): Promise<void> {
  await supabase.from('theory_propositions').delete().eq('id', id)
}

// ============================================================================
// TheoryBase snapshot -- a read-only, periodically-refreshed cache of real
// TheoryBase content, synced by scripts/sync_theorybase_snapshot.mjs
// (Option 1, findability). Private repo, so this is a cache, not a live
// fetch the way ConceptBase's import works.
// ============================================================================

export async function searchTheorybaseSnapshot(supabase: Client, query: string): Promise<TheorybaseSnapshotRow[]> {
  const q = query.trim()
  if (q.length < 2) {
    const { data } = await supabase.from('theorybase_snapshot').select('*').order('record_type', { ascending: true }).limit(40)
    return data ?? []
  }
  const { data } = await supabase
    .from('theorybase_snapshot')
    .select('*')
    .or(`label.ilike.%${q}%,summary.ilike.%${q}%`)
    .limit(40)
  return data ?? []
}

/** Creates a new local theory pre-filled from a real TheoryBase snapshot record, tagged base_repo/base_repo_ref -- the existing tracking mechanism (migration 020) this project already had, now actually usable for TheoryBase. */
export async function importTheoryFromSnapshot(supabase: Client, projectId: string, snapshot: TheorybaseSnapshotRow): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('theories')
    .insert({
      project_id: projectId,
      label: snapshot.label,
      description: snapshot.summary ?? `Imported from TheoryBase (${snapshot.id}). See the full record for details.`,
      base_repo: 'theorybase',
      base_repo_ref: snapshot.id,
      authorship_provenance: (snapshot.authorship_provenance as TheoryRow['authorship_provenance']) ?? null,
      characterization_status: (snapshot.characterization_status as TheoryRow['characterization_status']) ?? null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not import this record.')
  return data.id
}

// ============================================================================
// Proposing a local theory back to TheoryBase (Option 2, quality-improvement
// cycles). This records intent + a generated draft; the actual branch/
// commit in the real theorybase repo is scripts/draft_theorybase_contribution.mjs's
// job, run with a human's own hands, same boundary every other write to a
// shared governed resource hits in this lab.
// ============================================================================

export async function listTheoryContributions(supabase: Client, theoryId: string): Promise<TheoryContributionRow[]> {
  const { data } = await supabase.from('theory_contributions').select('*').eq('theory_id', theoryId).order('created_at', { ascending: false })
  return data ?? []
}

export async function createTheoryContribution(
  supabase: Client,
  theoryId: string,
  projectId: string,
  draftYaml: string
): Promise<TheoryContributionRow> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('theory_contributions')
    .insert({ theory_id: theoryId, project_id: projectId, draft_yaml: draftYaml, created_by: user?.id ?? null })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create this contribution.')
  return data
}

// ============================================================================
// project_base_links -- the existing platform-wide "which shared libraries
// can this project use" switch (migration 004), already wired up for
// ConceptBase on the Concepts page. Reused here for TheoryBase so Browse/
// Propose stay an explicit per-project opt-in, not a silent always-on.
// ============================================================================

export async function getTheorybaseLink(supabase: Client, projectId: string): Promise<ProjectBaseLinkRow | null> {
  const { data } = await supabase
    .from('project_base_links')
    .select('*')
    .eq('project_id', projectId)
    .eq('base_repo', 'theorybase')
    .maybeSingle()
  return data ?? null
}

export async function setTheorybaseLink(supabase: Client, projectId: string, enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (enabled) {
    await supabase.from('project_base_links').upsert(
      { project_id: projectId, base_repo: 'theorybase', can_import: true, can_propose_pr: true, added_by: user?.id ?? null },
      { onConflict: 'project_id,base_repo' }
    )
  } else {
    await supabase.from('project_base_links').delete().eq('project_id', projectId).eq('base_repo', 'theorybase')
  }
}

export interface TheoryLiteratureLinkWithReference extends TheoryLiteratureLinkRow {
  reference: LiteratureRow
}

/** A theory's linked literature, the concepts/schema elements it relates to are resolved separately by target_type since it's polymorphic (no single FK to embed). */
export async function getTheoryLiteratureLinks(supabase: Client, theoryId: string): Promise<TheoryLiteratureLinkWithReference[]> {
  const { data } = await supabase
    .from('theory_literature_links')
    .select('*, reference:literature_references(*)')
    .eq('theory_id', theoryId)
  return (data ?? []) as unknown as TheoryLiteratureLinkWithReference[]
}

export async function getTheoryRelations(supabase: Client, theoryId: string): Promise<TheoryRelationRow[]> {
  const { data } = await supabase.from('theory_relations').select('*').eq('theory_id', theoryId)
  return data ?? []
}

/** Every theory_relations row across every theory in a project, for the relations-graph view -- a project-wide read rather than per-theory, since the point of a picture is seeing all of a project's theories at once. */
export async function listProjectTheoryRelations(supabase: Client, theoryIds: string[]): Promise<TheoryRelationRow[]> {
  if (theoryIds.length === 0) return []
  const { data } = await supabase.from('theory_relations').select('*').in('theory_id', theoryIds)
  return data ?? []
}

/** Resolves each relation's target label locally, since target_type is polymorphic across three different tables. */
export async function resolveRelationLabels(
  supabase: Client,
  relations: TheoryRelationRow[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const byType = {
    framework_tag: relations.filter((r) => r.target_type === 'framework_tag').map((r) => r.target_id),
    schema_element: relations.filter((r) => r.target_type === 'schema_element').map((r) => r.target_id),
    data_object: relations.filter((r) => r.target_type === 'data_object').map((r) => r.target_id),
    thread: relations.filter((r) => r.target_type === 'thread').map((r) => r.target_id),
  }
  const [tags, elements, objects, threads] = await Promise.all([
    byType.framework_tag.length ? supabase.from('framework_tags').select('id, label').in('id', byType.framework_tag) : Promise.resolve({ data: [] }),
    byType.schema_element.length ? supabase.from('lpm_schema_elements').select('id, label').in('id', byType.schema_element) : Promise.resolve({ data: [] }),
    byType.data_object.length ? supabase.from('lpm_data_objects').select('id, title').in('id', byType.data_object) : Promise.resolve({ data: [] }),
    byType.thread.length ? supabase.from('lpm_threads').select('id, title').in('id', byType.thread) : Promise.resolve({ data: [] }),
  ])
  for (const t of tags.data ?? []) labels.set(t.id, t.label)
  for (const e of elements.data ?? []) labels.set(e.id, e.label)
  for (const o of objects.data ?? []) labels.set(o.id, o.title)
  for (const th of threads.data ?? []) labels.set(th.id, th.title)
  return labels
}
