import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// The Base Repo Explorer (2026-10-21): a site-wide, admin-only area to
// browse, review, and discuss real content from the OpenEvo CCS Foundational
// Repos -- across every project, not any one project's own local copy.
// Scope is Base Repos only (ConceptBase/TheoryBase/LiteratureBase/
// QuestionBase/MethodsBase/CompetencyBase/QuoteBase/ProjectBase) --
// SpeciesBase and TeachingBase have no snapshot pipeline yet, and the
// ccs-graph/openevo-graph/eva-graph dispute-and-relations layer is a
// deliberately separate layer, out of scope here (Dustin, 2026-10-21).
//
// ConceptBase isn't included below -- it's the one public repo and already
// has its own working live-GitHub-fetch browse path (schema-page.tsx);
// this file covers the seven repos whose only route into OpenLPM is the
// periodically-refreshed snapshot-table pattern (TheoryBase/LiteratureBase/
// MethodsBase already existed; QuestionBase/QuoteBase/CompetencyBase/
// ProjectBase are new as of migration 155).

export type BaseRepoKey =
  | 'theorybase'
  | 'literaturebase'
  | 'methodsbase'
  | 'questionbase'
  | 'quotebase'
  | 'competencybase'
  | 'projectbase'

export interface BaseRepoConfig {
  key: BaseRepoKey
  name: string
  table: string
  /** Column holding the record's own real id (e.g. "OE-METHOD-..."). */
  idColumn: 'id'
  /** Column(s) used for the table/card title. */
  labelColumn: string
  /** Optional column for a secondary line (card subtitle / table column). */
  secondaryColumn?: string
  /** Column used to group/filter (method_class, question_type, source_vocabulary, ...). */
  filterColumn?: string
  /** JSONB field names inside `data` that point at other Base Repo records, for the graph view. Each is {targetRepo, field}. */
  relationFields: { field: string; targetRepo: BaseRepoKey }[]
}

export const BASE_REPO_CONFIGS: BaseRepoConfig[] = [
  {
    key: 'theorybase',
    name: 'TheoryBase',
    table: 'theorybase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'record_type',
    filterColumn: 'record_type',
    relationFields: [
      { field: 'relatedLiterature', targetRepo: 'literaturebase' },
      { field: 'relatedQuestions', targetRepo: 'questionbase' },
    ],
  },
  {
    key: 'literaturebase',
    name: 'LiteratureBase',
    table: 'literaturebase_snapshot',
    idColumn: 'id',
    labelColumn: 'title',
    secondaryColumn: 'year',
    relationFields: [],
  },
  {
    key: 'methodsbase',
    name: 'MethodsBase',
    table: 'methodsbase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'method_class',
    filterColumn: 'method_class',
    relationFields: [{ field: 'relatedQuestions', targetRepo: 'questionbase' }],
  },
  {
    key: 'questionbase',
    name: 'QuestionBase',
    table: 'questionbase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'question_type',
    filterColumn: 'question_type',
    relationFields: [
      { field: 'motivatedBy', targetRepo: 'theorybase' },
      { field: 'relatedLiterature', targetRepo: 'literaturebase' },
      { field: 'relatedMethods', targetRepo: 'methodsbase' },
    ],
  },
  {
    key: 'quotebase',
    name: 'QuoteBase',
    table: 'quotebase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'attribution',
    relationFields: [
      { field: 'relatedTheories', targetRepo: 'theorybase' },
      { field: 'relatedQuestions', targetRepo: 'questionbase' },
    ],
  },
  {
    key: 'competencybase',
    name: 'CompetencyBase',
    table: 'competencybase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'source_vocabulary',
    filterColumn: 'source_vocabulary',
    relationFields: [],
  },
  {
    key: 'projectbase',
    name: 'ProjectBase',
    table: 'projectbase_snapshot',
    idColumn: 'id',
    labelColumn: 'label',
    secondaryColumn: 'status',
    relationFields: [
      { field: 'literature_used', targetRepo: 'literaturebase' },
      { field: 'theoretical_framing', targetRepo: 'theorybase' },
    ],
  },
]

export interface SnapshotRow {
  id: string
  label: string
  secondary: string | null
  filterValue: string | null
  review_status: string | null
  data: Record<string, unknown>
}

function normalizeRow(cfg: BaseRepoConfig, raw: any): SnapshotRow {
  return {
    id: raw.id,
    label: raw[cfg.labelColumn] ?? raw.id,
    secondary: cfg.secondaryColumn ? raw[cfg.secondaryColumn] ?? null : null,
    filterValue: cfg.filterColumn ? raw[cfg.filterColumn] ?? null : null,
    review_status: raw.review_status ?? raw.data?.provenance?.review_status ?? null,
    data: raw.data ?? {},
  }
}

export async function listSnapshotRows(supabase: Client, repoKey: BaseRepoKey, search?: string): Promise<SnapshotRow[]> {
  const cfg = BASE_REPO_CONFIGS.find((c) => c.key === repoKey)
  if (!cfg) return []
  let query = (supabase as any).from(cfg.table).select('*').order(cfg.labelColumn, { ascending: true }).limit(500)
  if (search?.trim()) {
    query = query.ilike(cfg.labelColumn, `%${search.trim()}%`)
  }
  const { data } = await query
  return ((data ?? []) as any[]).map((r) => normalizeRow(cfg, r))
}

/** One search across every configured Base Repo's snapshot, for the cross-repo view. */
export async function searchAllSnapshots(supabase: Client, search: string): Promise<Map<BaseRepoKey, SnapshotRow[]>> {
  const result = new Map<BaseRepoKey, SnapshotRow[]>()
  await Promise.all(
    BASE_REPO_CONFIGS.map(async (cfg) => {
      const rows = await listSnapshotRows(supabase, cfg.key, search)
      if (rows.length) result.set(cfg.key, rows)
    })
  )
  return result
}

/** Resolves a short list of (repoKey, id) pairs across possibly-different repos into display labels, for rendering a relation field's targets. */
export async function resolveCrossRepoLabels(
  supabase: Client,
  refs: { repoKey: BaseRepoKey; id: string }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const byRepo = new Map<BaseRepoKey, string[]>()
  for (const r of refs) {
    const list = byRepo.get(r.repoKey) ?? []
    list.push(r.id)
    byRepo.set(r.repoKey, list)
  }
  await Promise.all(
    Array.from(byRepo.entries()).map(async ([repoKey, ids]) => {
      const cfg = BASE_REPO_CONFIGS.find((c) => c.key === repoKey)
      if (!cfg) return
      const { data } = await (supabase as any).from(cfg.table).select(`id, ${cfg.labelColumn}`).in('id', ids)
      for (const row of data ?? []) out.set(`${repoKey}:${row.id}`, row[cfg.labelColumn] ?? row.id)
    })
  )
  return out
}
