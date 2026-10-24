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

/**
 * A repo's own column set for the single-repo table view (Susan Hanisch,
 * 2026-10-24: "each repo probably needs a different view... similar to how
 * a reference manager like Zotero shows a citation"). Only used once a
 * single repo tab is selected -- the cross-repo "All" table stays the
 * generic Label/Detail layout, since a column like "Authors" means
 * nothing for a TheoryBase row.
 */
export interface TableColumn {
  header: string
  get: (row: SnapshotRow) => string
}

/**
 * A second, array-valued field worth its own filter/sort beyond
 * filterColumn (which only supports a single flat value) -- e.g.
 * MethodsBase's learningApproaches, where one method can carry several
 * tags at once (Susan Hanisch, 2026-10-24, feedback 6649af0d).
 */
export interface SecondaryFilter {
  /** Field name inside `data` holding a string or string[] value. */
  dataKey: string
  label: string
}

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
  /** Per-repo table column set for the single-repo view (see TableColumn). */
  tableColumns?: TableColumn[]
  /** A second, array-valued filter/sort field (see SecondaryFilter). */
  secondaryFilter?: SecondaryFilter
  /** JSONB field names inside `data` that point at other Base Repo records, for the graph view. Each is {targetRepo, field}. */
  relationFields: { field: string; targetRepo: BaseRepoKey }[]
}

// Susan Hanisch, 2026-10-24: "show only the first two authors, then 'et
// al.'" if there are more.
function formatAuthorsShort(authors: unknown): string {
  if (!Array.isArray(authors) || authors.length === 0) return '—'
  const names = authors.map(String)
  if (names.length <= 2) return names.join(', ')
  return `${names[0]}, ${names[1]}, et al.`
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
    // Susan Hanisch, 2026-10-24 (feedback 1ad705ff): "default columns should
    // be Authors (first two + et al.), Year, Title."
    tableColumns: [
      { header: 'Authors', get: (row) => formatAuthorsShort((row.data as any)?.citation?.authors) },
      { header: 'Year', get: (row) => String((row.data as any)?.citation?.year ?? row.secondary ?? '—') },
      { header: 'Title', get: (row) => row.label },
    ],
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
    // Susan Hanisch, 2026-10-24 (feedback 6649af0d): "Learning approaches"
    // as its own filterable/sortable column.
    secondaryFilter: { dataKey: 'learningApproaches', label: 'Learning approach' },
    tableColumns: [
      { header: 'Label', get: (row) => row.label },
      { header: 'Method-class', get: (row) => row.secondary ?? '—' },
      {
        header: 'Learning approaches',
        get: (row) => (row.secondaryFilterValues.length > 0 ? row.secondaryFilterValues.join(', ') : '—'),
      },
    ],
    relationFields: [
      { field: 'relatedQuestions', targetRepo: 'questionbase' },
      // Susan Hanisch, 2026-10-24 (feedback aee0b27e): "related approaches"
      // shouldn't show raw "OE-METHOD-..." ids -- resolve to the real
      // method's own readable label instead.
      { field: 'relatedApproaches', targetRepo: 'methodsbase' },
    ],
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
    // Real feedback (Susan Hanisch, 2026-10-23): show a standard's own
    // official code (e.g. the German KMK Biologie-Abitur's "B 1"), and
    // split its place in the vocabulary's own hierarchy into two columns --
    // the top-level competency area ("Kompetenzbereich") and, where the
    // chain goes deeper, the narrower sub-area ("Teilbereich"). Built
    // entirely from each record's own real `broader` relation chain (see
    // resolveCompetencyHierarchy below) -- no new schema field, no
    // fabricated data. Exact for vocabularies shaped like KMK's three-tier
    // structure; best-effort (often blank) for flatter or differently-
    // shaped ones, since not every source vocabulary's broader/narrower
    // tree maps cleanly onto "area" + "sub-area."
    tableColumns: [
      { header: 'ID', get: (row) => (row.data as any)?.humanCodingScheme ?? '—' },
      { header: 'Label', get: (row) => row.label },
      { header: 'Competency area', get: (row) => (row.data as any)?.__competencyArea ?? '—' },
      { header: 'Teilbereich', get: (row) => (row.data as any)?.__competencySubArea ?? '—' },
      { header: 'Source', get: (row) => row.secondary ?? '—' },
    ],
    // Susan Hanisch, 2026-10-23 (feedback 84efcad2): "add a column on
    // pedagogical approaches" -- competencybase RFC-0027 added a real
    // schema field for this (pedagogicalApproaches, an array of real
    // MethodsBase method ids). Listed here the same way every other
    // relation field already is, so the existing generic machinery (the
    // detail panel's idLabels resolution, the Graph view's edges) picks
    // it up for free -- no new UI mechanism needed.
    relationFields: [
      { field: 'broader', targetRepo: 'competencybase' },
      { field: 'pedagogicalApproaches', targetRepo: 'methodsbase' },
    ],
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
  /**
   * Which languages this record's own text is tagged in, e.g. ["en"] or
   * ["de"] -- derived from the raw record's own fields (methodsbase's
   * label/description/whenToUse/protocolSteps are now language-keyed
   * objects, e.g. {"en": "...", "de": "..."}, matching conceptbase's and
   * competencybase's pattern). A field still stored as a plain string isn't
   * tagged at all -- reported here as [] ("untagged"), not guessed at,
   * since guessing a language from untagged text risks being wrong. Works
   * for any repo generically: a repo with no language-keyed fields yet
   * (the common case today, outside MethodsBase) just reports [] for every
   * row, which the UI treats as "nothing to show here yet" rather than an
   * error (Susan Hanisch's feedback, OpenLPM, 2026-10-24).
   */
  languages: string[]
  /** Values from this repo's secondaryFilter.dataKey, coerced to an array -- [] if the repo has no secondaryFilter or the record has no values. */
  secondaryFilterValues: string[]
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value) return [value]
  return []
}

// Fields worth checking for a per-record language tag, in priority order.
// Not every repo/record has all of these; whichever ones exist and are
// language-keyed objects contribute their keys.
const LANGUAGE_CANDIDATE_FIELDS = ['label', 'description', 'whenToUse', 'protocolSteps', 'statement']

function detectLanguages(data: Record<string, unknown>): string[] {
  const found = new Set<string>()
  for (const field of LANGUAGE_CANDIDATE_FIELDS) {
    const value = (data as any)?.[field]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) found.add(key)
    }
  }
  return Array.from(found).sort()
}

function normalizeRow(cfg: BaseRepoConfig, raw: any): SnapshotRow {
  const data = raw.data ?? {}
  return {
    id: raw.id,
    label: raw[cfg.labelColumn] ?? raw.id,
    secondary: cfg.secondaryColumn ? raw[cfg.secondaryColumn] ?? null : null,
    filterValue: cfg.filterColumn ? raw[cfg.filterColumn] ?? null : null,
    review_status: raw.review_status ?? data?.provenance?.review_status ?? null,
    data,
    languages: detectLanguages(data),
    secondaryFilterValues: cfg.secondaryFilter ? toStringArray((data as any)?.[cfg.secondaryFilter.dataKey]) : [],
  }
}

interface CompetencyNode {
  label: string
  broader: string[]
}

/**
 * Walks a competency record's own real `broader` chain (fetched unfiltered,
 * so a search filter on the display rows can't cut an ancestor out of the
 * lookup) to find its top-level competency area and, when the chain goes
 * deeper than one level, its narrower sub-area ("Teilbereich"). Only
 * follows the first `broader` target per step -- real records are
 * overwhelmingly single-parent, and the display is best-effort for the
 * few that aren't. `seen` guards against a cycle in hand-authored data.
 */
function resolveCompetencyHierarchy(
  id: string,
  nodes: Map<string, CompetencyNode>
): { area: string | null; subArea: string | null } {
  const chain: string[] = []
  const seen = new Set<string>([id])
  let current = id
  for (let i = 0; i < 10; i++) {
    const parentId = nodes.get(current)?.broader[0]
    if (!parentId || seen.has(parentId)) break
    chain.push(parentId)
    seen.add(parentId)
    current = parentId
  }
  if (chain.length === 0) return { area: null, subArea: null }
  return {
    area: nodes.get(chain[chain.length - 1])?.label ?? null,
    subArea: chain.length > 1 ? nodes.get(chain[0])?.label ?? null : null,
  }
}

async function enrichCompetencyHierarchy(supabase: Client, rows: SnapshotRow[]): Promise<void> {
  const { data } = await (supabase as any).from('competencybase_snapshot').select('id, label, data')
  const nodes = new Map<string, CompetencyNode>()
  for (const r of data ?? []) {
    const broaderRaw = (r.data as any)?.broader
    nodes.set(r.id, {
      label: r.label ?? r.id,
      broader: Array.isArray(broaderRaw) ? broaderRaw : broaderRaw ? [broaderRaw] : [],
    })
  }
  for (const row of rows) {
    const { area, subArea } = resolveCompetencyHierarchy(row.id, nodes)
    row.data = { ...row.data, __competencyArea: area, __competencySubArea: subArea }
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
  const rows = ((data ?? []) as any[]).map((r) => normalizeRow(cfg, r))
  if (repoKey === 'competencybase' && rows.length > 0) await enrichCompetencyHierarchy(supabase, rows)
  return rows
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

export interface ResolvedLabel {
  label: string
}

/**
 * Resolves a short list of (repoKey, id) pairs across possibly-different
 * repos into display labels, for rendering a relation field's targets
 * (e.g. a method's relatedApproaches ids) as reader-friendly text instead
 * of raw "OE-METHOD-..." ids -- Susan Hanisch, 2026-10-24 (feedback
 * aee0b27e). Keyed `${repoKey}:${id}`; a caller with just a raw id string
 * and no known target repo (e.g. FieldValue's generic fallback) builds its
 * own flat id-keyed map from this one's entries, since OE-* id prefixes
 * are unique per repo.
 */
export async function resolveCrossRepoLabels(
  supabase: Client,
  refs: { repoKey: BaseRepoKey; id: string }[]
): Promise<Map<string, ResolvedLabel>> {
  const out = new Map<string, ResolvedLabel>()
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
      for (const row of data ?? []) out.set(`${repoKey}:${row.id}`, { label: row[cfg.labelColumn] ?? row.id })
    })
  )
  return out
}
