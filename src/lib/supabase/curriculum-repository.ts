import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type RepositoryRecordRow = Database['public']['Tables']['curriculum_repository_records']['Row']
export type ProjectRepositoryLinkRow = Database['public']['Tables']['project_repository_links']['Row']
export type RepositoryContentLinkRow = Database['public']['Tables']['curriculum_repository_links']['Row']

export const RECORD_TYPE_LABEL: Record<RepositoryRecordRow['record_type'], string> = {
  'institutional-actor-record': 'Institution or office',
  'institutional-mandate-record': 'Mandate',
  'policy-timeline-event': 'Timeline event',
  'coherence-finding-record': 'Coherence finding',
  'latent-connection-record': 'Possible connection',
  'curriculum-crosswalk-record': 'Cross-jurisdiction comparison',
  'synthetic-curriculum-redesign-record': 'Proposed redesign',
  'policy-principle-record': 'Policy principle',
  'policy-brief-manifest': 'Policy brief',
}

export const ACCESS_TIER_LABEL: Record<RepositoryRecordRow['access_tier'], string> = {
  'full-text-stored': 'Full text available',
  'excerpt-only': 'Short excerpts only',
  'summary-only': 'Summary only, no original wording',
  'citation-only': 'Source citation only',
}

/** Fields shown even at the most restrictive (citation-only) tier -- facts about the record, not quoted/paraphrased source text. */
const SAFE_ALWAYS_KEYS = new Set([
  'actorType', 'eventType', 'mandateType', 'findingType', 'domain', 'status',
  'coverageStatus', 'temporalStatus', 'verificationStatus', 'dateStart', 'dateEnd',
  'dateGranularity', 'url', 'sourceUrl', 'labelDe', 'audience', 'contentStatus',
  'jurisdictionScope', 'sourceSystem',
])

/** Fields that carry (or may carry) quoted/paraphrased source text -- hidden below excerpt-only. */
const NARRATIVE_KEYS = new Set([
  'description', 'statementText', 'summary', 'connectionNarrative', 'proposedRedesign',
  'role', 'evidenceMethod', 'tradeoffAssessment', 'theoreticalGrounding', 'strengthAssessment',
  'objects', 'baselineCurriculumObject',
])

const ALWAYS_HIDDEN_KEYS = new Set(['id', 'slug', 'label', '$schema', 'provenance', 'accessTier', 'licenseOrRightsNote'])

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

export interface RenderableField {
  key: string
  label: string
  value: unknown
}

/** Splits a record's raw content into what's safe to show at its own access_tier vs. what's gated behind a higher one -- same recursive-conservative logic the import script used to compute access_tier in the first place, applied here to decide what to render rather than what to store. */
export function splitContentFields(record: RepositoryRecordRow): { visible: RenderableField[]; gated: RenderableField[] } {
  const content = (record.content ?? {}) as Record<string, unknown>
  const showNarrative = record.access_tier !== 'citation-only'
  const visible: RenderableField[] = []
  const gated: RenderableField[] = []
  for (const [key, value] of Object.entries(content)) {
    if (ALWAYS_HIDDEN_KEYS.has(key)) continue
    if (value === null || value === undefined || value === '') continue
    const field: RenderableField = { key, label: humanizeKey(key), value }
    if (NARRATIVE_KEYS.has(key) && !showNarrative) gated.push(field)
    else if (NARRATIVE_KEYS.has(key) || SAFE_ALWAYS_KEYS.has(key)) visible.push(field)
    else visible.push(field) // unrecognized key: default to showing it, not hiding it silently
  }
  return { visible, gated }
}

export async function listRepositoryRecords(
  supabase: Client,
  projectId: string,
  filters?: { recordType?: string; jurisdiction?: string; search?: string }
): Promise<RepositoryRecordRow[]> {
  let query = supabase.from('curriculum_repository_records').select('*').eq('project_id', projectId)
  if (filters?.recordType) query = query.eq('record_type', filters.recordType as RepositoryRecordRow['record_type'])
  if (filters?.jurisdiction) query = query.eq('jurisdiction', filters.jurisdiction)
  if (filters?.search) query = query.ilike('title', `%${filters.search}%`)
  const { data } = await query.order('record_type', { ascending: true }).order('title', { ascending: true })
  return data ?? []
}

export async function getRepositoryRecord(supabase: Client, recordId: string): Promise<RepositoryRecordRow | null> {
  const { data } = await supabase.from('curriculum_repository_records').select('*').eq('id', recordId).maybeSingle()
  return data ?? null
}

export async function listJurisdictions(supabase: Client, projectId: string): Promise<string[]> {
  const { data } = await supabase.from('curriculum_repository_records').select('jurisdiction').eq('project_id', projectId)
  const set = new Set((data ?? []).map((r) => r.jurisdiction).filter((j): j is string => !!j))
  return Array.from(set).sort()
}

/** Whether a project has any repository content of its own, or any declared grounding in someone else's -- used to decide whether the "Repository" nav tab should even appear for a given project. */
export async function hasRepositoryContent(supabase: Client, projectId: string): Promise<boolean> {
  const [{ count: ownRecords }, { count: links }] = await Promise.all([
    supabase.from('curriculum_repository_records').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('project_repository_links').select('id', { count: 'exact', head: true }).or(`project_id.eq.${projectId},repository_project_id.eq.${projectId}`),
  ])
  return !!ownRecords || !!links
}

export async function listProjectRepositoryLinks(supabase: Client, projectId: string): Promise<(ProjectRepositoryLinkRow & { repository: { id: string; name: string; slug: string } })[]> {
  const { data } = await supabase
    .from('project_repository_links')
    .select('*, repository:projects!project_repository_links_repository_project_id_fkey(id, name, slug)')
    .eq('project_id', projectId)
  return (data ?? []) as unknown as (ProjectRepositoryLinkRow & { repository: { id: string; name: string; slug: string } })[]
}

export async function createProjectRepositoryLink(
  supabase: Client,
  params: { projectId: string; repositoryProjectId: string; jurisdiction?: string | null; note?: string | null }
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('project_repository_links').insert({
    project_id: params.projectId,
    repository_project_id: params.repositoryProjectId,
    jurisdiction: params.jurisdiction || null,
    note: params.note || null,
    created_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}

export async function listContentLinksForRecord(supabase: Client, repositoryRecordId: string): Promise<(RepositoryContentLinkRow & { data_object: { id: string; title: string; project_id: string } })[]> {
  const { data } = await supabase
    .from('curriculum_repository_links')
    .select('*, data_object:lpm_data_objects(id, title, project_id)')
    .eq('repository_record_id', repositoryRecordId)
  return (data ?? []) as unknown as (RepositoryContentLinkRow & { data_object: { id: string; title: string; project_id: string } })[]
}

export async function createContentLink(
  supabase: Client,
  params: { projectId: string; dataObjectId: string; repositoryRecordId: string; rationale?: string | null; relationType?: string }
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('curriculum_repository_links').insert({
    project_id: params.projectId,
    data_object_id: params.dataObjectId,
    repository_record_id: params.repositoryRecordId,
    relation_type: params.relationType || 'relates_to',
    rationale: params.rationale || null,
    created_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}
