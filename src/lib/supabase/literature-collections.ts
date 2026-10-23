import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { LiteraturebaseSnapshotRow } from './literature'

type Client = SupabaseClient<Database>

// migration 167 hasn't been pushed to production yet, so these tables
// aren't in database.types.ts's generated types -- cast at the query
// boundary (`as any).from(...)`) rather than block on a regen that needs
// the real push to happen first anyway. Matches every existing example of
// this in the codebase (grep `as any).from(` for the pattern).
const db = (supabase: Client) => supabase as any

export interface LiteratureCollectionRow {
  id: string
  slug: string
  name: string
  kind: 'subject_area' | 'cross_cutting'
  domain_tag: string
  description: string | null
  maturity: 'provisional' | 'verified'
  owner_project_id: string | null
  forked_from_collection_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LiteratureCollectionItemRow {
  id: string
  collection_id: string
  literaturebase_id: string
  note: string | null
  added_by: string | null
  created_at: string
}

export interface ProjectLiteratureCollectionLinkRow {
  id: string
  project_id: string
  collection_id: string
  link_type: 'live' | 'branch'
  lpm_thread_id: string | null
  curriculum_repository_record_id: string | null
  created_by: string | null
  created_at: string
}

export type LinkScope = { lpmThreadId?: string; curriculumRepositoryRecordId?: string }

// ============================================================================
// Browsing the shared library
// ============================================================================

export async function listCanonicalCollections(supabase: Client): Promise<LiteratureCollectionRow[]> {
  const { data } = await db(supabase)
    .from('literature_collections')
    .select('*')
    .is('owner_project_id', null)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })
  return data ?? []
}

export async function getCollection(supabase: Client, collectionId: string): Promise<LiteratureCollectionRow | null> {
  const { data } = await db(supabase).from('literature_collections').select('*').eq('id', collectionId).maybeSingle()
  return data ?? null
}

/** A canonical collection's papers are computed live from the real LiteratureBase snapshot -- see migration 167's header note for why. A branch's papers are whatever is in literature_collection_items. */
export async function getCollectionPapers(supabase: Client, collection: LiteratureCollectionRow): Promise<LiteraturebaseSnapshotRow[]> {
  if (collection.owner_project_id === null) {
    const { data } = await supabase
      .from('literaturebase_snapshot')
      .select('*')
      .contains('domains', [collection.domain_tag])
      .order('year', { ascending: false })
    return data ?? []
  }
  const { data: items } = await db(supabase)
    .from('literature_collection_items')
    .select('literaturebase_id')
    .eq('collection_id', collection.id)
  const ids = (items ?? []).map((i: LiteratureCollectionItemRow) => i.literaturebase_id)
  if (ids.length === 0) return []
  const { data } = await supabase.from('literaturebase_snapshot').select('*').in('id', ids).order('year', { ascending: false })
  return data ?? []
}

export async function countCollectionPapers(supabase: Client, collection: LiteratureCollectionRow): Promise<number> {
  if (collection.owner_project_id === null) {
    const { count } = await supabase
      .from('literaturebase_snapshot')
      .select('id', { count: 'exact', head: true })
      .contains('domains', [collection.domain_tag])
    return count ?? 0
  }
  const { count } = await db(supabase)
    .from('literature_collection_items')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', collection.id)
  return count ?? 0
}

// ============================================================================
// Branching -- "shared, but each project can branch off it" (decision 5)
// ============================================================================

export async function forkCollectionForProject(
  supabase: Client,
  source: LiteratureCollectionRow,
  projectId: string,
  name?: string
): Promise<LiteratureCollectionRow> {
  const { data: { user } } = await supabase.auth.getUser()
  const papers = await getCollectionPapers(supabase, source)
  const slug = `${source.slug}-branch-${projectId.slice(0, 8)}-${Date.now().toString(36)}`
  const { data: branch, error } = await db(supabase)
    .from('literature_collections')
    .insert({
      slug,
      name: name?.trim() || `${source.name} (my copy)`,
      kind: source.kind,
      domain_tag: source.domain_tag,
      description: source.description,
      maturity: source.maturity,
      owner_project_id: projectId,
      forked_from_collection_id: source.id,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single()
  if (error || !branch) throw new Error(error?.message ?? 'Could not create a branch of this collection.')

  if (papers.length > 0) {
    const rows = papers.map((p) => ({ collection_id: branch.id, literaturebase_id: p.id, added_by: user?.id ?? null }))
    const { error: itemsError } = await db(supabase).from('literature_collection_items').insert(rows)
    if (itemsError) throw new Error(itemsError.message)
  }
  return branch
}

export async function addPaperToBranch(supabase: Client, collectionId: string, literaturebaseId: string, note?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await db(supabase)
    .from('literature_collection_items')
    .insert({ collection_id: collectionId, literaturebase_id: literaturebaseId, note: note ?? null, added_by: user?.id ?? null })
  if (error) throw new Error(error.message)
}

export async function removePaperFromBranch(supabase: Client, collectionId: string, literaturebaseId: string): Promise<void> {
  await db(supabase).from('literature_collection_items').delete().eq('collection_id', collectionId).eq('literaturebase_id', literaturebaseId)
}

// ============================================================================
// Attaching a collection to a project, a strand, or a Curriculum
// Repository record
// ============================================================================

export async function listLinksForProject(supabase: Client, projectId: string): Promise<(ProjectLiteratureCollectionLinkRow & { collection: LiteratureCollectionRow })[]> {
  const { data } = await db(supabase)
    .from('project_literature_collection_links')
    .select('*, collection:literature_collections(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function listLinksForScope(supabase: Client, scope: LinkScope): Promise<(ProjectLiteratureCollectionLinkRow & { collection: LiteratureCollectionRow })[]> {
  let query = db(supabase).from('project_literature_collection_links').select('*, collection:literature_collections(*)')
  query = scope.lpmThreadId ? query.eq('lpm_thread_id', scope.lpmThreadId) : query.eq('curriculum_repository_record_id', scope.curriculumRepositoryRecordId)
  const { data } = await query.order('created_at', { ascending: false })
  return data ?? []
}

export async function attachCollection(
  supabase: Client,
  projectId: string,
  collectionId: string,
  linkType: 'live' | 'branch',
  scope?: LinkScope
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await db(supabase).from('project_literature_collection_links').insert({
    project_id: projectId,
    collection_id: collectionId,
    link_type: linkType,
    lpm_thread_id: scope?.lpmThreadId ?? null,
    curriculum_repository_record_id: scope?.curriculumRepositoryRecordId ?? null,
    created_by: user?.id ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function removeLink(supabase: Client, linkId: string): Promise<void> {
  await db(supabase).from('project_literature_collection_links').delete().eq('id', linkId)
}
