import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { BookOpen, CheckCircle2, Clock, LayoutGrid, MessageSquare, Network, Search, Table2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import {
  BASE_REPO_CONFIGS,
  listSnapshotRows,
  resolveCrossRepoLabels,
  type BaseRepoKey,
  type SnapshotRow,
  type TableColumn,
  type ResolvedLabel,
} from '@/lib/supabase/base-repo-explorer'
import {
  completeGenericReview,
  listGlobalReviewQueue,
  submitBaseRepoRecordForReview,
  resolveBaseRepoReviewTarget,
  type GenericReviewItem,
} from '@/lib/supabase/generic-review'
import { createGlobalTopic, createPost, listGlobalTopicsForTarget, listPosts, type PostWithAuthor } from '@/lib/supabase/discussions'
import { layoutTier } from '@/lib/graph-layout'

// Base Repo Explorer (2026-10-21): a site-wide, admin-only area to browse,
// review, and discuss real content from the OpenEvo CCS Foundational
// Repos -- across every project, not any one project's own local copy of
// one. Admin-gated for now (Dustin's own call) -- the broader
// "approved, not necessarily admin" access tier this will eventually need
// is a later phase, once this first version proves out.
//
// Scope: Base Repos only -- ConceptBase already has its own working
// live-fetch browse path elsewhere (Schema page) and isn't duplicated
// here; SpeciesBase/TeachingBase have no snapshot pipeline yet; the
// ccs-graph/openevo-graph/eva-graph layer is a deliberately separate
// layer and explicitly out of scope (Dustin, 2026-10-21).
//
// Table/Cards/Graph view-mode toggle mirrors PortfolioExplorer's existing
// pattern (src/components/portfolio-explorer.tsx). The graph view uses the
// same deterministic tiered layout (src/lib/graph-layout.ts) every other
// concept/learning-goal graph in this app uses, not a physics layout --
// Dustin's own explicit, twice-given feedback (2026-09-30, Netz tab)
// rejected 'cose' for exactly this shape of graph (many nodes sharing a
// category, no dense direct edges) because it reads as "random" even when
// it technically isn't.

type ViewMode = 'table' | 'cards' | 'graph'
type TabKey = 'all' | BaseRepoKey

const REPO_COLOR: Record<BaseRepoKey, string> = {
  theorybase: '#2a78d6',
  literaturebase: '#008300',
  methodsbase: '#c98500',
  questionbase: '#7a4fd1',
  quotebase: '#0d8f8f',
  competencybase: '#a3365b',
  projectbase: '#5a6b2e',
}

const REPO_SHAPE: Record<BaseRepoKey, string> = {
  theorybase: 'ellipse',
  literaturebase: 'round-rectangle',
  methodsbase: 'triangle',
  questionbase: 'diamond',
  quotebase: 'hexagon',
  competencybase: 'pentagon',
  projectbase: 'star',
}

function token(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

interface NodeRef {
  repoKey: BaseRepoKey
  row: SnapshotRow
}

export default function AdminBaseRepoExplorerPage() {
  const { isAdmin } = useSession()
  const supabase = useMemo(() => createClient(), [])

  const [tab, setTab] = useState<TabKey>('all')
  const [view, setView] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [filterValue, setFilterValue] = useState<string>('')
  const [langFilter, setLangFilter] = useState<string>('')
  const [secondaryFilterValue, setSecondaryFilterValue] = useState<string>('')
  const [sortBy, setSortBy] = useState<'label' | 'filterValue' | 'review_status' | 'secondaryFilter'>('label')
  const [rowsByRepo, setRowsByRepo] = useState<Map<BaseRepoKey, SnapshotRow[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<NodeRef | null>(null)
  const [reviewQueue, setReviewQueue] = useState<GenericReviewItem[] | null>(null)
  const [showReviewQueue, setShowReviewQueue] = useState(false)

  const reloadReviewQueue = () => listGlobalReviewQueue(supabase).then(setReviewQueue)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    setLoading(true)
    const repoKeys: BaseRepoKey[] = tab === 'all' ? BASE_REPO_CONFIGS.map((c) => c.key) : [tab]
    Promise.all(repoKeys.map(async (key) => [key, await listSnapshotRows(supabase, key, search)] as const)).then((pairs) => {
      if (!active) return
      setRowsByRepo(new Map(pairs))
      setLoading(false)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isAdmin, tab, search])

  useEffect(() => {
    if (isAdmin) reloadReviewQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // Real feedback 68d278e2 (Susan, 2026-10-21): "add options to filter and
  // sort, especially filter by Method-class." The filter dropdown only
  // makes sense once a single repo is selected -- each repo's filterColumn
  // means something different (method_class vs question_type vs
  // source_vocabulary), so mixing them under "All" would filter apples
  // against oranges. Resets whenever the tab changes so a stale filter
  // value from one repo doesn't silently carry into another.
  const activeFilterCfg = tab !== 'all' ? BASE_REPO_CONFIGS.find((c) => c.key === tab) : undefined
  const activeFilterColumn = activeFilterCfg?.filterColumn
  // Real feedback cc89fc1c (Susan, 2026-10-21... reconfirmed 2026-10-24):
  // "once one has selected a Repo, do not show the column 'Repo' because
  // there is no information added for the user" -- and that's also
  // exactly when a repo's own column set (tableColumns) applies, since the
  // generic cross-repo table only makes sense across more than one repo.
  const showRepoColumn = tab === 'all'
  const activeTableColumns: TableColumn[] | undefined = activeFilterCfg?.tableColumns
  const activeSecondaryFilter = activeFilterCfg?.secondaryFilter
  useEffect(() => { setFilterValue(''); setLangFilter(''); setSecondaryFilterValue('') }, [tab])

  // Real feedback a3408216 (Susan, 2026-10-24): no way to tell, or filter,
  // which language a record's text is actually in -- MethodsBase content
  // reads as an undifferentiated mix. Only shown once at least one loaded
  // row actually carries a language tag (today: MethodsBase, since that's
  // the one repo whose schema was changed for this -- see base-repo-
  // explorer.ts's detectLanguages), so every other repo's view is
  // unchanged until it gets the same treatment.
  const anyLanguageTagged = useMemo(() => {
    for (const rows of rowsByRepo.values()) for (const row of rows) if (row.languages.length > 0) return true
    return false
  }, [rowsByRepo])

  const langFilterOptions = useMemo(() => {
    const values = new Set<string>()
    for (const rows of rowsByRepo.values()) for (const row of rows) for (const l of row.languages) values.add(l)
    return Array.from(values).sort()
  }, [rowsByRepo])

  const allRows: NodeRef[] = useMemo(() => {
    const out: NodeRef[] = []
    for (const [repoKey, rows] of rowsByRepo) for (const row of rows) out.push({ repoKey, row })
    let filtered = filterValue ? out.filter((r) => r.row.filterValue === filterValue) : out
    if (langFilter === '__untagged__') filtered = filtered.filter((r) => r.row.languages.length === 0)
    else if (langFilter) filtered = filtered.filter((r) => r.row.languages.includes(langFilter))
    if (secondaryFilterValue) filtered = filtered.filter((r) => r.row.secondaryFilterValues.includes(secondaryFilterValue))
    const sorted = [...filtered].sort((a, b) => {
      const value = (r: NodeRef) =>
        sortBy === 'label' ? r.row.label
        : sortBy === 'filterValue' ? r.row.filterValue
        : sortBy === 'secondaryFilter' ? r.row.secondaryFilterValues.join(', ')
        : r.row.review_status
      return (value(a) ?? '').localeCompare(value(b) ?? '')
    })
    return sorted
  }, [rowsByRepo, filterValue, langFilter, secondaryFilterValue, sortBy])

  const filterOptions = useMemo(() => {
    if (!activeFilterColumn) return []
    const values = new Set<string>()
    for (const rows of rowsByRepo.values()) for (const row of rows) if (row.filterValue) values.add(row.filterValue)
    return Array.from(values).sort()
  }, [rowsByRepo, activeFilterColumn])

  const secondaryFilterOptions = useMemo(() => {
    if (!activeSecondaryFilter) return []
    const values = new Set<string>()
    for (const rows of rowsByRepo.values()) for (const row of rows) for (const v of row.secondaryFilterValues) values.add(v)
    return Array.from(values).sort()
  }, [rowsByRepo, activeSecondaryFilter])

  const totalCount = allRows.length

  if (!isAdmin) {
    return (
      <div>
        <h1>Base Repo Explorer</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="row"><BookOpen size={18} style={{ color: 'var(--text-muted)' }} />Base Repo Explorer</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Browse, review, and discuss real content from the OpenEvo CCS Foundational Repos, across every
        project. Admin-only for now. ConceptBase is browsable via its own Schema page; the dispute/graph
        layer isn&apos;t covered here.
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn btn-mini${tab === 'all' ? ' btn-primary' : ''}`} onClick={() => setTab('all')}>
          All ({totalCount})
        </button>
        {BASE_REPO_CONFIGS.map((cfg) => (
          <button
            key={cfg.key}
            className={`btn btn-mini${tab === cfg.key ? ' btn-primary' : ''}`}
            onClick={() => setTab(cfg.key)}
          >
            {cfg.name} ({rowsByRepo.get(cfg.key)?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search label…" />
            </div>
          </div>
          {activeFilterColumn && (
            <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="">All {filterColumnLabel(activeFilterColumn).toLowerCase()}</option>
              {filterOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {anyLanguageTagged && (
            <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
              <option value="">All languages</option>
              {langFilterOptions.map((v) => <option key={v} value={v}>{LANGUAGE_NAMES[v] ?? v.toUpperCase()}</option>)}
              <option value="__untagged__">Not yet language-tagged</option>
            </select>
          )}
          {activeSecondaryFilter && (
            <select value={secondaryFilterValue} onChange={(e) => setSecondaryFilterValue(e.target.value)}>
              <option value="">All {activeSecondaryFilter.label.toLowerCase()}s</option>
              {secondaryFilterOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="label">Sort: Label</option>
            <option value="filterValue">Sort: {activeFilterColumn ? filterColumnLabel(activeFilterColumn) : 'Detail'}</option>
            {activeSecondaryFilter && <option value="secondaryFilter">Sort: {activeSecondaryFilter.label}</option>}
            <option value="review_status">Sort: Review status</option>
          </select>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className={`btn btn-mini${view === 'table' ? ' btn-primary' : ''}`} onClick={() => setView('table')}><Table2 size={13} />Table</button>
          <button className={`btn btn-mini${view === 'cards' ? ' btn-primary' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={13} />Cards</button>
          <button className={`btn btn-mini${view === 'graph' ? ' btn-primary' : ''}`} onClick={() => setView('graph')}><Network size={13} />Graph</button>
          <button className="btn btn-mini" onClick={() => setShowReviewQueue((v) => !v)}>
            <Clock size={13} />Review queue {reviewQueue ? `(${reviewQueue.filter((i) => i.assignment.status === 'pending').length})` : ''}
          </button>
        </div>
      </div>

      {showReviewQueue && (
        <ReviewQueuePanel items={reviewQueue} supabase={supabase} onReviewed={reloadReviewQueue} />
      )}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : totalCount === 0 ? (
            <div className="card empty"><p>No records match.</p></div>
          ) : view === 'table' ? (
            <TableView
              rows={allRows}
              onSelect={setSelected}
              detailColumnLabel={activeFilterColumn ? filterColumnLabel(activeFilterColumn) : 'Detail'}
              showLanguage={anyLanguageTagged}
              showRepoColumn={showRepoColumn}
              columns={activeTableColumns}
            />
          ) : view === 'cards' ? (
            <CardsView rows={allRows} onSelect={setSelected} showLanguage={anyLanguageTagged} showRepoChip={showRepoColumn} />
          ) : (
            <GraphView rows={allRows} onSelect={setSelected} />
          )}
        </div>

        {selected && (
          <DetailPanel
            nodeRef={selected}
            supabase={supabase}
            onClose={() => setSelected(null)}
            onSubmittedForReview={reloadReviewQueue}
          />
        )}
      </div>
    </div>
  )
}

// Full names in the filter dropdown and the detail panel; short codes in
// the dense table/card badge (EN/DE), same two-letter tags methodsbase's
// own records now use as language keys.
const LANGUAGE_NAMES: Partial<Record<string, string>> = { en: 'English', de: 'German' }

function LanguageBadge({ languages }: { languages: string[] }) {
  if (languages.length === 0) {
    return <span className="chip muted" title="No language tag yet -- this record predates the language-tagging work">untagged</span>
  }
  return (
    <span className="row" style={{ gap: 3, display: 'inline-flex' }}>
      {languages.map((l) => (
        <span key={l} className="chip" title={LANGUAGE_NAMES[l] ?? l} style={{ fontSize: 10 }}>{l.toUpperCase()}</span>
      ))}
    </span>
  )
}

function TableView({
  rows,
  onSelect,
  detailColumnLabel,
  showLanguage,
  showRepoColumn,
  columns,
}: {
  rows: NodeRef[]
  onSelect: (r: NodeRef) => void
  detailColumnLabel: string
  showLanguage: boolean
  showRepoColumn: boolean
  columns?: TableColumn[]
}) {
  return (
    <table>
      <thead>
        <tr>
          {showRepoColumn && <th>Repo</th>}
          {columns ? columns.map((c) => <th key={c.header}>{c.header}</th>) : <th>Label</th>}
          {showLanguage && <th>Language</th>}
          {!columns && <th>{detailColumnLabel}</th>}
          <th>Review status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ repoKey, row }) => (
          <tr key={`${repoKey}:${row.id}`} onClick={() => onSelect({ repoKey, row })} style={{ cursor: 'pointer' }}>
            {showRepoColumn && <td><span className="chip" style={{ borderColor: REPO_COLOR[repoKey], color: REPO_COLOR[repoKey] }}>{repoKey}</span></td>}
            {columns ? columns.map((c) => <td key={c.header}>{c.get(row)}</td>) : <td>{row.label}</td>}
            {showLanguage && <td><LanguageBadge languages={row.languages} /></td>}
            {!columns && <td className="muted">{row.secondary ?? row.filterValue ?? ''}</td>}
            <td className="muted">{row.review_status ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CardsView({
  rows,
  onSelect,
  showLanguage,
  showRepoChip,
}: {
  rows: NodeRef[]
  onSelect: (r: NodeRef) => void
  showLanguage: boolean
  showRepoChip: boolean
}) {
  return (
    <div className="grid grid-3">
      {rows.map(({ repoKey, row }) => (
        <div key={`${repoKey}:${row.id}`} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelect({ repoKey, row })}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {showRepoChip && <span className="chip" style={{ borderColor: REPO_COLOR[repoKey], color: REPO_COLOR[repoKey], marginBottom: 6 }}>{repoKey}</span>}
            {showLanguage && <LanguageBadge languages={row.languages} />}
          </div>
          <h3 style={{ marginBottom: 4 }}>{row.label}</h3>
          {row.secondary && <p className="muted" style={{ fontSize: 12 }}>{row.secondary}</p>}
          {row.review_status && <p className="muted" style={{ fontSize: 11 }}>Review: {row.review_status}</p>}
        </div>
      ))}
    </div>
  )
}

function GraphView({ rows, onSelect }: { rows: NodeRef[]; onSelect: (r: NodeRef) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const byId = new Map(rows.map((r) => [`${r.repoKey}:${r.row.id}`, r]))
    const { positions } = layoutTier(
      rows.map((r) => ({ id: `${r.repoKey}:${r.row.id}` })),
      0, 0, 900, 90, 70
    )

    const edges: { source: string; target: string; field: string }[] = []
    for (const r of rows) {
      const cfg = BASE_REPO_CONFIGS.find((c) => c.key === r.repoKey)
      if (!cfg) continue
      for (const rel of cfg.relationFields) {
        const raw = (r.row.data as any)?.[rel.field]
        const targetIds: string[] = Array.isArray(raw) ? raw : raw ? [raw] : []
        for (const targetId of targetIds) {
          const targetKey = `${rel.targetRepo}:${targetId}`
          if (byId.has(targetKey)) edges.push({ source: `${r.repoKey}:${r.row.id}`, target: targetKey, field: rel.field })
        }
      }
    }

    const elements: ElementDefinition[] = [
      ...rows.map((r) => {
        const id = `${r.repoKey}:${r.row.id}`
        const pos = positions.get(id)
        return { data: { id, label: r.row.label, repoKey: r.repoKey }, position: pos ? { x: pos.x, y: pos.y } : undefined }
      }),
      ...edges.map((e, i) => ({ data: { id: `edge-${i}`, source: e.source, target: e.target, label: e.field } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '90px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: token('--text-primary', '#0b0b0b'),
            width: 26, height: 26,
          },
        },
        ...(Object.keys(REPO_COLOR) as BaseRepoKey[]).map((key) => ({
          selector: `node[repoKey = "${key}"]`,
          style: { 'background-color': REPO_COLOR[key], shape: REPO_SHAPE[key] as any },
        })),
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': token('--text-primary', '#0b0b0b') } },
        {
          selector: 'edge',
          style: {
            width: 1, 'line-color': token('--baseline', '#c3c2b7'), 'target-arrow-color': token('--baseline', '#c3c2b7'),
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'font-size': 8, color: token('--text-secondary', '#52514e'),
            'opacity': 0.6,
          },
        },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id() as string
      const found = byId.get(id)
      if (found) onSelect(found)
    })

    cyRef.current = cy
    return () => { cy.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 8, flexWrap: 'wrap', fontSize: 12 }}>
        {(Object.keys(REPO_COLOR) as BaseRepoKey[]).map((key) => (
          <span key={key} className="row" style={{ gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: REPO_COLOR[key], display: 'inline-block' }} />
            {key}
          </span>
        ))}
      </div>
      <div ref={containerRef} style={{ height: 560, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Edges show relations already present in each record&apos;s own data (e.g. a question&apos;s
        <code> motivatedBy</code>, a method&apos;s <code>relatedQuestions</code>) where the target is also loaded here.
      </p>
    </div>
  )
}

// Field names every base repo record roughly shares and that are already
// shown elsewhere in the panel (id/label in the header, review_status
// above) -- hidden here so the readable view doesn't repeat them.
const HIDDEN_RECORD_FIELDS = new Set(['id', 'slug', '$schema'])

function humanizeFieldName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

// Real feedback d84ccffa (Susan, 2026-10-21): the filter/sort/detail-column
// label for a repo's own filterColumn should read as that repo's actual
// term, not the generic word-split of its snake_case DB column name --
// "method_class" -> "Method-class" (MethodsBase's own real vocabulary
// term), not "Method class".
const FILTER_COLUMN_LABELS: Partial<Record<string, string>> = {
  method_class: 'Method-class',
}
function filterColumnLabel(column: string): string {
  return FILTER_COLUMN_LABELS[column] ?? humanizeFieldName(column)
}

// Picks a field's display text/array out of a language-keyed object (e.g.
// MethodsBase's label/description/whenToUse/protocolSteps, now
// {"en": ..., "de": ...} per the 2026-10-24 language-field work) -- prefers
// English, then German, then whatever's there. Leaves anything that isn't
// a flat language-code-keyed object alone (a normal nested object like
// `citation` has keys like "title"/"authors", which never match).
function pickLang(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length > 0 && keys.every((k) => /^[a-z]{2}(-[A-Z]{2})?$/.test(k))) {
      return obj.en ?? obj.de ?? obj[keys[0]]
    }
  }
  return value
}

// Real base-repo records nest arbitrarily (a method's protocolSteps is a
// plain string array; its basiskonzeptbezug is an array of objects with
// their own nested fields) -- recurse rather than special-case each repo's
// shape, so this stays correct as new fields show up in any repo's data.
//
// idLabels (Susan Hanisch, 2026-10-24, feedback aee0b27e): when a string
// value is itself a real Base Repo id (e.g. "OE-METHOD-cooperative-
// learning") and its readable label was already resolved, show that label
// instead of the raw id -- anywhere in the generic field dump, for any
// repo, not just the one field Susan named, since it's the same
// mechanism either way.
function FieldValue({ value, idLabels }: { value: unknown; idLabels?: Map<string, ResolvedLabel> }) {
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>
  if (typeof value === 'string') {
    const resolved = idLabels?.get(value)
    if (resolved) return <span>{resolved.label}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">—</span>
    // Short strings (ids, tags) read fine comma-joined on one line; longer
    // ones (a method's protocolSteps, each a full sentence) need their own
    // line each or they run together into an unreadable blob.
    const isShortTagList = value.every((v) => (typeof v === 'string' || typeof v === 'number') && String(v).length <= 60)
    if (isShortTagList) {
      return (
        <span>
          {value
            .map((v) => {
              const resolved = typeof v === 'string' ? idLabels?.get(v) : undefined
              return resolved ? resolved.label : String(v)
            })
            .join(', ')}
        </span>
      )
    }
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return (
        <ol style={{ margin: '2px 0', paddingLeft: 18 }}>
          {value.map((v, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{String(v)}</li>
          ))}
        </ol>
      )
    }
    return (
      <ul style={{ margin: '2px 0', paddingLeft: 16 }}>
        {value.map((v, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <FieldValue value={v} idLabels={idLabels} />
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return (
      <div style={{ paddingLeft: 10, borderLeft: '2px solid var(--border)', marginTop: 2 }}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 4 }}>
            <strong style={{ fontSize: 11 }}>{humanizeFieldName(k)}:</strong> <FieldValue value={v} idLabels={idLabels} />
          </div>
        ))}
      </div>
    )
  }
  return <span style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>
}

function RecordDetails({
  data,
  skipKeys,
  idLabels,
}: {
  data: Record<string, unknown>
  /** Field keys already shown in a repo-specific ordered section above this one -- left out here so "Other info" doesn't repeat them. */
  skipKeys?: Set<string>
  idLabels?: Map<string, ResolvedLabel>
}) {
  const [showRaw, setShowRaw] = useState(false)
  const entries = Object.entries(data).filter(
    ([k, v]) => !HIDDEN_RECORD_FIELDS.has(k) && !skipKeys?.has(k) && v !== null && v !== undefined && v !== ''
  )

  return (
    <div style={{ fontSize: 12 }}>
      {entries.length === 0 ? (
        <p className="muted">No further fields.</p>
      ) : (
        entries.map(([key, value]) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{filterColumnLabel(key)}</div>
            <div>
              <FieldValue value={value} idLabels={idLabels} />
            </div>
          </div>
        ))
      )}
      <button className="btn btn-mini" onClick={() => setShowRaw((v) => !v)} style={{ marginTop: 4 }}>
        {showRaw ? 'Hide raw data' : 'View raw data'}
      </button>
      {showRaw && (
        <pre style={{ fontSize: 10, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}

// Susan Hanisch, 2026-10-24 (feedback 859758b3): "show fields in this
// order (similar to how Zotero does it): Type, title, authors, year,
// Publication (journal/book, volume, issue, pages), doi/url, abstract,
// keywords, then any further info." LiteratureBase has no literal
// "keywords" field -- domains (the closest existing analog, a topic-tag
// list) is shown under that label.
function LiteratureDetailSections({ data }: { data: Record<string, unknown> }) {
  const citation = (data.citation as Record<string, unknown>) ?? {}
  const authors = Array.isArray(citation.authors) ? (citation.authors as unknown[]).map(String) : []
  const pubParts: string[] = []
  if (citation.venue) pubParts.push(String(citation.venue))
  if (citation.publisher) pubParts.push(String(citation.publisher))
  if (citation.volume) pubParts.push(`vol. ${citation.volume}`)
  if (citation.issue) pubParts.push(`no. ${citation.issue}`)
  if (citation.pages) pubParts.push(`pp. ${citation.pages}`)
  const publicationInfo = pubParts.join(', ')
  const doiOrUrl = citation.doi ? `doi.org/${citation.doi}` : (citation.open_access_url as string | undefined) ?? (citation.isbn as string | undefined) ?? null
  const abstract = (data.plain_language_summary as Record<string, unknown> | undefined)?.text as string | undefined
  const keywords = Array.isArray(data.domains) ? (data.domains as unknown[]).map(String) : []

  const skip = new Set(['citation', 'type', 'plain_language_summary', 'domains'])

  return (
    <div style={{ fontSize: 12 }}>
      {!!data.type && <DetailRow label="Type">{String(data.type)}</DetailRow>}
      {!!citation.title && <DetailRow label="Title">{String(citation.title)}</DetailRow>}
      {authors.length > 0 && <DetailRow label="Authors">{authors.join(', ')}</DetailRow>}
      {!!citation.year && <DetailRow label="Year">{String(citation.year)}</DetailRow>}
      {!!publicationInfo && <DetailRow label="Publication">{publicationInfo}</DetailRow>}
      {!!doiOrUrl && <DetailRow label="DOI / URL">{doiOrUrl}</DetailRow>}
      {!!abstract && <DetailRow label="Abstract">{abstract}</DetailRow>}
      {keywords.length > 0 && <DetailRow label="Keywords">{keywords.join(', ')}</DetailRow>}
      <details style={{ marginTop: 8 }}>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Other info</summary>
        <div style={{ marginTop: 6 }}>
          <RecordDetails data={data} skipKeys={skip} />
        </div>
      </details>
    </div>
  )
}

// Susan Hanisch, 2026-10-24 (feedback c4eea3fd): "show information in this
// order: Label, Learning approach, discipline, lesson phases, When to use,
// description, protocol steps, related approaches, primary sources, then
// other info (active/review status etc.)." Related approaches resolves to
// the real target method's own label via idLabels (feedback aee0b27e) --
// skips the optional "class info in parentheses" idea from that same
// feedback, since most method labels already carry their own parenthetical
// (e.g. "Cooperative Learning (Kooperative Lernformen)"), and appending the
// method_class enum value too (e.g. "(pedagogical-practice)") produced a
// confusing double-parenthetical rather than something more readable.
function MethodsDetailSections({ data, idLabels }: { data: Record<string, unknown>; idLabels: Map<string, ResolvedLabel> }) {
  const label = pickLang(data.label) as string | undefined
  const learningApproaches = Array.isArray(data.learningApproaches) ? (data.learningApproaches as unknown[]).map(String) : []
  const discipline = data.discipline as string | undefined
  const lessonPhases = Array.isArray(data.lessonPhases) ? (data.lessonPhases as unknown[]).map(String) : []
  const whenToUse = pickLang(data.whenToUse) as string | undefined
  const description = pickLang(data.description) as string | undefined
  const protocolSteps = pickLang(data.protocolSteps) as string[] | undefined
  const relatedApproaches = Array.isArray(data.relatedApproaches) ? (data.relatedApproaches as unknown[]).map(String) : []
  const primarySources = Array.isArray(data.primarySources) ? (data.primarySources as Record<string, string>[]) : []

  const skip = new Set([
    'label', 'learningApproaches', 'discipline', 'lessonPhases', 'whenToUse',
    'description', 'protocolSteps', 'relatedApproaches', 'primarySources',
  ])

  return (
    <div style={{ fontSize: 12 }}>
      {!!label && <DetailRow label="Label">{label}</DetailRow>}
      {learningApproaches.length > 0 && <DetailRow label="Learning approach">{learningApproaches.join(', ')}</DetailRow>}
      {!!discipline && <DetailRow label="Discipline">{discipline}</DetailRow>}
      {lessonPhases.length > 0 && <DetailRow label="Lesson phases">{lessonPhases.join(', ')}</DetailRow>}
      {!!whenToUse && <DetailRow label="When to use">{whenToUse}</DetailRow>}
      {!!description && <DetailRow label="Description">{description}</DetailRow>}
      {!!protocolSteps?.length && (
        <DetailRow label="Protocol steps">
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {protocolSteps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
          </ol>
        </DetailRow>
      )}
      {relatedApproaches.length > 0 && (
        <DetailRow label="Related approaches">
          {relatedApproaches
            .map((id) => {
              const resolved = idLabels.get(id)
              return resolved ? resolved.label : id
            })
            .join(', ')}
        </DetailRow>
      )}
      {primarySources.length > 0 && (
        <DetailRow label="Primary sources">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {primarySources.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {s.citation ?? s.literatureRef ?? s.doi ?? s.url ?? '—'}
              </li>
            ))}
          </ul>
        </DetailRow>
      )}
      <details style={{ marginTop: 8 }}>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Other info</summary>
        <div style={{ marginTop: 6 }}>
          <RecordDetails data={data} skipKeys={skip} idLabels={idLabels} />
        </div>
      </details>
    </div>
  )
}

function DetailPanel({
  nodeRef,
  supabase,
  onClose,
  onSubmittedForReview,
}: {
  nodeRef: NodeRef
  supabase: ReturnType<typeof createClient>
  onClose: () => void
  onSubmittedForReview: () => void
}) {
  const { repoKey, row } = nodeRef
  const [targetId, setTargetId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof listGlobalTopicsForTarget>> | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [newPost, setNewPost] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [idLabels, setIdLabels] = useState<Map<string, ResolvedLabel>>(new Map())

  useEffect(() => {
    let active = true
    setTargetId(null); setTopics(null); setPosts([]); setNotice(null)
    resolveBaseRepoReviewTarget(supabase, { baseRepo: repoKey, recordId: row.id }).then(async (id) => {
      if (!active) return
      setTargetId(id)
      const t = await listGlobalTopicsForTarget(supabase, 'base_repo_record', id)
      if (!active) return
      setTopics(t)
      if (t.length > 0) setPosts(await listPosts(supabase, t[0].id))
    })
    return () => { active = false }
  }, [repoKey, row.id, supabase])

  // Real feedback aee0b27e (Susan, 2026-10-24): resolve this record's own
  // relation fields (e.g. a method's relatedApproaches/relatedQuestions)
  // into readable labels before rendering, flattened by bare id so
  // FieldValue's generic fallback can use the same map regardless of
  // which field an id turns up in.
  useEffect(() => {
    let active = true
    setIdLabels(new Map())
    const cfg = BASE_REPO_CONFIGS.find((c) => c.key === repoKey)
    const refs: { repoKey: BaseRepoKey; id: string }[] = []
    for (const rel of cfg?.relationFields ?? []) {
      const raw = (row.data as any)?.[rel.field]
      const ids: string[] = Array.isArray(raw) ? raw.filter((v) => typeof v === 'string') : typeof raw === 'string' ? [raw] : []
      for (const id of ids) refs.push({ repoKey: rel.targetRepo, id })
    }
    if (refs.length === 0) return
    resolveCrossRepoLabels(supabase, refs).then((resolved) => {
      if (!active) return
      const flat = new Map<string, ResolvedLabel>()
      for (const [key, value] of resolved) flat.set(key.split(':').slice(1).join(':'), value)
      setIdLabels(flat)
    })
    return () => { active = false }
  }, [repoKey, row.data, supabase])

  const submitReview = async () => {
    setBusy(true); setNotice(null)
    const { error } = await submitBaseRepoRecordForReview(supabase, { baseRepo: repoKey, recordId: row.id })
    setBusy(false)
    setNotice(error ? error.message : 'Submitted for review.')
    if (!error) onSubmittedForReview()
  }

  const startDiscussion = async () => {
    if (!targetId || !newTopicTitle.trim()) return
    setBusy(true); setNotice(null)
    const { data, error } = await createGlobalTopic(supabase, { title: newTopicTitle.trim(), linkedType: 'base_repo_record', linkedId: targetId })
    setBusy(false)
    if (error) { setNotice(error.message); return }
    setNewTopicTitle('')
    setTopics(data ? [data, ...(topics ?? [])] : topics)
  }

  const submitPost = async () => {
    const topicId = topics?.[0]?.id
    if (!topicId || !newPost.trim()) return
    setBusy(true); setNotice(null)
    const { error } = await createPost(supabase, { topicId, content: newPost.trim() })
    setBusy(false)
    if (error) { setNotice(error.message); return }
    setNewPost('')
    setPosts(await listPosts(supabase, topicId))
  }

  return (
    <div className="card" style={{ width: 360, flexShrink: 0, position: 'sticky', top: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginBottom: 4 }}>{row.label}</h3>
        <button className="btn btn-mini" onClick={onClose}>×</button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{repoKey} · {row.id}</p>
      {row.review_status && <p className="muted" style={{ fontSize: 12 }}>Review status (source repo): {row.review_status}</p>}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }} className="muted">Full record</summary>
        <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 6 }}>
          {repoKey === 'literaturebase' ? (
            <LiteratureDetailSections data={row.data} />
          ) : repoKey === 'methodsbase' ? (
            <MethodsDetailSections data={row.data} idLabels={idLabels} />
          ) : (
            <RecordDetails data={row.data} idLabels={idLabels} />
          )}
        </div>
      </details>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn btn-mini" disabled={busy} onClick={submitReview}><CheckCircle2 size={13} />Submit for review</button>
      </div>
      {notice && <p className="muted" style={{ fontSize: 12 }}>{notice}</p>}

      <h4 className="row" style={{ marginTop: 16, fontSize: 13 }}><MessageSquare size={13} />Discuss</h4>
      {!topics ? (
        <p className="muted" style={{ fontSize: 12 }}>Loading…</p>
      ) : topics.length === 0 ? (
        <div className="row" style={{ gap: 6 }}>
          <input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="Start a discussion…" style={{ fontSize: 12 }} />
          <button className="btn btn-mini" disabled={busy || !newTopicTitle.trim()} onClick={startDiscussion}>Start</button>
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 6 }}>
            {posts.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No posts yet.</p>
            ) : (
              posts.map((p) => (
                <div key={p.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <strong>{p.author?.name ?? p.author?.email ?? 'Someone'}</strong>: {p.content}
                </div>
              ))
            )}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Add a comment…" style={{ fontSize: 12 }} />
            <button className="btn btn-mini" disabled={busy || !newPost.trim()} onClick={submitPost}>Post</button>
          </div>
        </>
      )}
    </div>
  )
}

function ReviewQueuePanel({
  items,
  supabase,
  onReviewed,
}: {
  items: GenericReviewItem[] | null
  supabase: ReturnType<typeof createClient>
  onReviewed: () => void
}) {
  const { session } = useSession()
  const [reviewText, setReviewText] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const decide = async (assignmentId: string, decision: 'accept' | 'reject') => {
    const text = reviewText[assignmentId]?.trim()
    if (!text) return
    setBusy(assignmentId)
    await completeGenericReview(supabase, { assignmentId, decision, reviewText: text })
    setBusy(null)
    onReviewed()
  }

  const pending = (items ?? []).filter((i) => i.assignment.status === 'pending')

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Review queue</h3>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="muted">Nothing waiting for review.</p>
      ) : (
        pending.map((item) => {
          // A2 fix (2026-10-23 mechanism audit): mirrors review-page.tsx's GenericReviewCard --
          // the DB-level guard (migration 164) now excludes a self-submitted assignment too, but
          // this UI check is what actually stops an admin from seeing their own Accept/Reject
          // form in the first place, same as every other reviewable type already does.
          const isOwnProposal = !!session && item.assignment.submitted_by === session.user.id
          return (
            <div key={item.assignment.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <p><strong>{item.label}</strong> {item.detail && <span className="muted">— {item.detail}</span>}</p>
              {isOwnProposal ? (
                <div className="notice">You submitted this one — someone else needs to review it.</div>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  <input
                    placeholder="Your reasoning…"
                    value={reviewText[item.assignment.id] ?? ''}
                    onChange={(e) => setReviewText((s) => ({ ...s, [item.assignment.id]: e.target.value }))}
                    style={{ fontSize: 12, flex: 1 }}
                  />
                  <button className="btn btn-mini" disabled={busy === item.assignment.id} onClick={() => decide(item.assignment.id, 'accept')}>
                    <CheckCircle2 size={13} />Accept
                  </button>
                  <button className="btn btn-mini btn-danger" disabled={busy === item.assignment.id} onClick={() => decide(item.assignment.id, 'reject')}>
                    <XCircle size={13} />Reject
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
