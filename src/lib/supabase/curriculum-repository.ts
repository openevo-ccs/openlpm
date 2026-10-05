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

// Same four values and researcher-facing wording as new-project-wizard.tsx's
// own ACCESS_TIER_OPTIONS (project_source_declarations/standards_documents,
// migration 044) -- kept as a separate copy here rather than a shared import
// since this table's access_tier is NOT NULL with no "not sure yet" state.
export const ACCESS_TIER_OPTIONS: { value: RepositoryRecordRow['access_tier']; label: string }[] = [
  { value: 'full-text-stored', label: 'The full document — we have clear rights to keep all of it' },
  { value: 'excerpt-only', label: 'Short excerpts only — a few quoted lines at a time, never the whole document' },
  { value: 'summary-only', label: 'A summary only — described in our own words, no direct quotes' },
  { value: 'citation-only', label: "Just a citation — we'll link to the original without storing any of its text" },
]

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

// `supersedes`/`supersededBy` are the raw source-repo ids the import script
// already resolves into the real `supersedes_record_id` foreign key
// (migration 100) -- hidden here so a record shows the one real, clickable
// link (see getSupersessionInfo) instead of also listing the bare
// unresolved source id as an ordinary text field.
const ALWAYS_HIDDEN_KEYS = new Set(['id', 'slug', 'label', '$schema', 'provenance', 'accessTier', 'licenseOrRightsNote', 'supersedes', 'supersededBy'])

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

export interface SupersessionInfo {
  predecessor: { id: string; title: string } | null
  successor: { id: string; title: string } | null
}

// A record's place in an edition chain (migration 100), e.g. Thuringia
// Biologie's 1999 -> 2024 -> 2026-Erprobungsfassung -- which prior edition
// this one directly replaced, and (the reverse lookup, since the FK only
// points one direction) which later edition replaced this one, if any.
// Most records are in no chain at all and get both sides null.
export async function getSupersessionInfo(supabase: Client, record: RepositoryRecordRow): Promise<SupersessionInfo> {
  const [predecessorRes, successorRes] = await Promise.all([
    record.supersedes_record_id
      ? supabase.from('curriculum_repository_records').select('id, title').eq('id', record.supersedes_record_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('curriculum_repository_records').select('id, title').eq('supersedes_record_id', record.id).maybeSingle(),
  ])
  return {
    predecessor: predecessorRes.data ?? null,
    successor: successorRes.data ?? null,
  }
}

export interface RepositoryRecordDraft {
  recordType: RepositoryRecordRow['record_type']
  title: string
  jurisdiction: string | null
  accessTier: RepositoryRecordRow['access_tier']
  licenseOrRightsNote: string | null
  // Alternatives, not both: a point-in-time record sets eventDate; a
  // standing one sets effectiveFrom/effectiveUntil. Enforced by the form,
  // not here -- this layer just writes whatever it's given.
  eventDate: string | null
  effectiveFrom: string | null
  effectiveUntil: string | null
}

/** Maintainer/owner only (RLS-enforced) -- a hand-entered record never produced by scripts/import_curriculum_repository.py, so it gets its own source_repo marker and a generated source_record_id rather than colliding with a real import's (source_repo, source_record_id) identity. */
export async function createRepositoryRecord(
  supabase: Client,
  projectId: string,
  draft: RepositoryRecordDraft
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('curriculum_repository_records')
    .insert({
      project_id: projectId,
      record_type: draft.recordType,
      title: draft.title.trim(),
      jurisdiction: draft.jurisdiction?.trim() || null,
      source_repo: 'openlpm-manual',
      source_record_id: crypto.randomUUID(),
      access_tier: draft.accessTier,
      license_or_rights_note: draft.licenseOrRightsNote?.trim() || null,
      event_date: draft.eventDate || null,
      effective_from: draft.effectiveFrom || null,
      effective_until: draft.effectiveUntil || null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

/** Maintainer/owner only (RLS-enforced). Never touches source_repo/source_record_id -- a record's import identity (or its manual-entry marker) doesn't change after creation. */
export async function updateRepositoryRecord(
  supabase: Client,
  recordId: string,
  draft: RepositoryRecordDraft
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('curriculum_repository_records')
    .update({
      record_type: draft.recordType,
      title: draft.title.trim(),
      jurisdiction: draft.jurisdiction?.trim() || null,
      access_tier: draft.accessTier,
      license_or_rights_note: draft.licenseOrRightsNote?.trim() || null,
      event_date: draft.eventDate || null,
      effective_from: draft.effectiveFrom || null,
      effective_until: draft.effectiveUntil || null,
    })
    .eq('id', recordId)
  return { error: error?.message ?? null }
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

export interface ContentLinkWithContext extends RepositoryContentLinkRow {
  data_object: { id: string; title: string; project_id: string }
  // The record's own project_id column (same one listRepositoryLinkSummaryForProject
  // filters on below), joined here so "which OpenLPM projects actually use
  // this" (real feedback ea3a4c01) never has to be inferred from the data
  // object's own project_id in two different places.
  project: { id: string; name: string; slug: string } | null
}

export async function listContentLinksForRecord(supabase: Client, repositoryRecordId: string): Promise<ContentLinkWithContext[]> {
  const { data } = await supabase
    .from('curriculum_repository_links')
    .select('*, data_object:lpm_data_objects(id, title, project_id), project:projects(id, name, slug)')
    .eq('repository_record_id', repositoryRecordId)
  return (data ?? []) as unknown as ContentLinkWithContext[]
}

/** Distinct projects that have linked content to this record -- the compact "used by" summary, e.g. for the Timeline's detail panel. */
export function distinctLinkedProjects(links: ContentLinkWithContext[]): { id: string; name: string; slug: string }[] {
  const seen = new Map<string, { id: string; name: string; slug: string }>()
  for (const l of links) if (l.project && !seen.has(l.project.id)) seen.set(l.project.id, l.project)
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export interface ProjectRepositoryLinkSummary {
  record: RepositoryRecordRow
  linkedContentCount: number
  supersession: SupersessionInfo
}

// The content side of the "browse + connect" feature (migration 066's
// curriculum_repository_links, Level 2) -- which Repository record(s) THIS
// project's own content points at, with a count of how many of its items
// point at each one, and whether a newer edition already exists. Needs
// migration 105's read-access policy to actually see the records
// themselves (this project's members aren't necessarily Repository
// members) -- without it, record comes back null and this silently drops
// that row.
export async function listRepositoryLinkSummaryForProject(supabase: Client, projectId: string): Promise<ProjectRepositoryLinkSummary[]> {
  const { data } = await supabase
    .from('curriculum_repository_links')
    .select('repository_record_id, record:curriculum_repository_records(*)')
    .eq('project_id', projectId)
  const rows = (data ?? []) as unknown as { repository_record_id: string; record: RepositoryRecordRow | null }[]

  const counts = new Map<string, number>()
  const records = new Map<string, RepositoryRecordRow>()
  for (const row of rows) {
    counts.set(row.repository_record_id, (counts.get(row.repository_record_id) ?? 0) + 1)
    if (row.record && !records.has(row.repository_record_id)) records.set(row.repository_record_id, row.record)
  }

  const summaries = await Promise.all(
    Array.from(records.values()).map(async (record) => ({
      record,
      linkedContentCount: counts.get(record.id) ?? 0,
      supersession: await getSupersessionInfo(supabase, record),
    }))
  )
  return summaries.sort((a, b) => a.record.title.localeCompare(b.record.title))
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
