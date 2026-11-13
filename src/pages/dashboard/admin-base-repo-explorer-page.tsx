import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DraftChip, LangChip } from '@/components/method-detail-card'
import { LanguageSwitch } from '@/components/language-switch'
import { methodClassReading, methodClassesOf, methodClassesReading, normalizeTag, pickLocalized, pickLocalizedList, tagReading, withoutGermanGloss } from '@/lib/method-text'
import { Link, useSearchParams } from 'react-router-dom'
import { CONCEPTBASE_TAB_PATH } from '@/components/base-repo-tabs'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { applyGraphSettings, applyLineLooks, attachHover, hoverStyles, type NodeLabelInfo } from '@/lib/graph-cytoscape'
import { blockLayoutPositions } from '@/lib/graph-standards'
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Check, CheckCircle2, Clock, Copy, Download, Filter, LayoutGrid, MessageSquare, Network, Pencil, ListTree, PlayCircle, Search, Table2, XCircle } from 'lucide-react'
import { ReviewSpace, type ReviewSectionInfo, type ReviewSectionKey } from '@/components/explorer-review-space'
import { MethodTreeView } from '@/components/method-tree-view'
import { apaToHtml, apaToPlainText, doiUrl, formatApa, recordLink } from '@/lib/apa-citation'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { RecordEditor, EditHistory } from '@/components/base-repo-record-editor'
import type { FieldVocabulary } from '@/lib/base-repo-edit-fields'
import { applyEdits, historyFor, listEdits, markSentBack, pendingEdits, type BaseRepoEdit } from '@/lib/supabase/base-repo-edits'
import {
  BASE_REPO_CONFIGS,
  listSnapshotRows,
  labelIsFallback,
  rowLabel,
  rowMatchesSearch,
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
import { TeachingBaseLessonBody } from '@/components/teachingbase-lesson-card'
import { TeachingBaseToolbar } from '@/components/teachingbase-toolbar'
import { TeachingBaseReviewMode } from '@/components/teachingbase-review-mode'
import { loadPointer, pointerIfValid, type Ref as ReviewRef } from '@/lib/teachingbase-review-mode'
import {
  addVerdict, currentReviewer, hasStartHere, isNamedReviewer, isStillOpen, latestVerdicts, listVerdicts, ownJudgedKeys, summaryOf, verdictsExport,
  type ItemKind, type LessonData, type LessonLink, type Verdict, type VerdictRow,
} from '@/lib/supabase/teaching-lessons-review'
import { T as TB_T, type Lang as TbLang } from '@/lib/teachingbase-review-strings'
import { createGlobalTopic, createPost, listGlobalTopicsForTarget, listPosts, type PostWithAuthor } from '@/lib/supabase/discussions'

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

type ViewMode = 'table' | 'cards' | 'graph' | 'tree'
type TabKey = 'all' | BaseRepoKey

const REPO_COLOR: Record<BaseRepoKey, string> = {
  theorybase: '#2a78d6',
  literaturebase: '#008300',
  methodsbase: '#c98500',
  questionbase: '#7a4fd1',
  quotebase: '#0d8f8f',
  competencybase: '#a3365b',
  projectbase: '#5a6b2e',
  teachingbase: '#8a4b1f',
}

const REPO_SHAPE: Record<BaseRepoKey, string> = {
  theorybase: 'ellipse',
  literaturebase: 'round-rectangle',
  methodsbase: 'triangle',
  questionbase: 'diamond',
  quotebase: 'hexagon',
  competencybase: 'pentagon',
  projectbase: 'star',
  teachingbase: 'octagon',
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

// One table column. Built per tab in the page (see `columns` below) from the
// repo's own tableColumns, or from the generic Label/Detail layout, plus the
// Repo, Language and Review status columns where they apply. Sorting and
// filtering both hang off the same definition, so the heading is the one
// place to do either (Susan Hanisch, 2026-10-25, feedback 1f216e51).
interface ColumnDef {
  id: string
  header: string
  get: (n: NodeRef) => string
  /** Present = the heading gets a filter control with these values as its choices. */
  filterValues?: (n: NodeRef) => string[]
  filterLabel?: (value: string) => string
  sortValue?: (n: NodeRef) => string
  render?: (n: NodeRef) => ReactNode
}

type SortState = { id: string; dir: 'asc' | 'desc' }

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

// `reviewerOnly` is the second way in (migration 241): a named reviewer who is not an admin opens /dashboard/teaching-base and gets this page
// with only the TeachingBase tab. Everything else in the Explorer stays admin-only: the other tabs are not loaded, and the edit, discussion,
// review-queue and Reviewers parts are not shown. The database rules are the boundary underneath.
export default function AdminBaseRepoExplorerPage({ reviewerOnly = false }: { reviewerOnly?: boolean }) {
  const { isAdmin, session, loading: sessionLoading } = useSession()
  const supabase = useMemo(() => createClient(), [])
  const userId = session?.user.id ?? null
  const [named, setNamed] = useState<boolean | null>(null)
  useEffect(() => {
    if (!reviewerOnly || sessionLoading || isAdmin || !userId) return
    let alive = true
    isNamedReviewer(supabase, userId).then((r) => { if (alive) setNamed(r) })
    return () => { alive = false }
  }, [supabase, reviewerOnly, sessionLoading, isAdmin, userId])
  const allowed = isAdmin || (reviewerOnly && named === true)
  const restricted = reviewerOnly && !isAdmin
  // The language of the TeachingBase checking wording follows the page-wide English/German switch.

  // The ConceptBase tab links back here with ?tab=<repo>, so the tab asked for is the one shown first.
  const [searchParams] = useSearchParams()
  const askedTab = searchParams.get('tab')
  const [tab, setTab] = useState<TabKey>(reviewerOnly ? 'teachingbase' : BASE_REPO_CONFIGS.some((c) => c.key === askedTab) ? (askedTab as BaseRepoKey) : 'all')
  const [view, setView] = useState<ViewMode>('table')
  // The page-wide English/German view. Names, descriptions and tags of records that have both show in this language.
  const [viewLang, setViewLangState] = useState<string>(() => {
    try { return localStorage.getItem('base-repo-explorer-language') === 'de' ? 'de' : 'en' } catch { return 'en' }
  })
  const setViewLang = (l: string) => {
    setViewLangState(l)
    try { localStorage.setItem('base-repo-explorer-language', l) } catch { /* the choice is just not remembered */ }
  }
  const [search, setSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<SortState | null>(null)
  // A base is loaded once and kept, so switching tabs back and forth (and
  // searching) never refetches. Searching happens in the browser over the
  // whole loaded record -- see rowMatchesSearch.
  const [rowsByRepo, setRowsByRepo] = useState<Map<BaseRepoKey, SnapshotRow[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<NodeRef | null>(null)
  const [reviewQueue, setReviewQueue] = useState<GenericReviewItem[] | null>(null)
  // In-app edits (feedback 0afc62a5): kept per base, laid over the repo copy below. `editsAvailable` is false until migration 237 is live.
  const [editsByRepo, setEditsByRepo] = useState<Map<BaseRepoKey, BaseRepoEdit[]>>(new Map())
  const [editsAvailable, setEditsAvailable] = useState(true)
  const [onlyEdited, setOnlyEdited] = useState(false)
  // Everything about reviewing sits behind one Review button and opens in its own space instead of above the table (Dustin, 2026-11-13).
  const [reviewSection, setReviewSection] = useState<ReviewSectionKey | null>(null)
  // TeachingBase link checking (migrations 240 and 241). Loaded when the TeachingBase tab is open.
  const [verdicts, setVerdicts] = useState<VerdictRow[]>([])
  const [reviewer, setReviewer] = useState<{ id: string; name: string } | null>(null)
  const [onlyStartHere, setOnlyStartHere] = useState(false)
  const [onlyOpen, setOnlyOpen] = useState(false)
  // Review mode (one decision at a time) is the front door of the TeachingBase tab; the table and cards stay as the overview.
  const [review, setReview] = useState<{ initial: ReviewRef | null; view: 'decide' | 'map' } | null>(null)

  const reloadEdits = async (repoKey: BaseRepoKey) => {
    const { edits, available } = await listEdits(supabase, repoKey)
    setEditsAvailable(available)
    setEditsByRepo((prev) => new Map(prev).set(repoKey, edits))
  }

  const reloadReviewQueue = () => listGlobalReviewQueue(supabase).then(setReviewQueue)

  useEffect(() => {
    if (!allowed) return
    const wanted: BaseRepoKey[] = restricted ? ['teachingbase'] : tab === 'all' ? BASE_REPO_CONFIGS.map((c) => c.key) : [tab]
    const missing = wanted.filter((key) => !rowsByRepo.has(key))
    if (missing.length === 0) return
    let active = true
    setLoading(true)
    Promise.all(missing.map(async (key) => [key, await listSnapshotRows(supabase, key), restricted ? { edits: [] as BaseRepoEdit[], available: false } : await listEdits(supabase, key)] as const)).then((triples) => {
      if (!active) return
      setRowsByRepo((prev) => {
        const next = new Map(prev)
        for (const [key, rows] of triples) next.set(key, rows)
        return next
      })
      setEditsByRepo((prev) => {
        const next = new Map(prev)
        for (const [key, , result] of triples) next.set(key, result.edits)
        return next
      })
      setEditsAvailable((was) => triples.every(([, , result]) => result.available) && was)
      setLoading(false)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, allowed, restricted, tab])

  useEffect(() => {
    if (isAdmin && !restricted) reloadReviewQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, restricted])

  const [verdictsLoaded, setVerdictsLoaded] = useState(false)
  useEffect(() => {
    if (!allowed || tab !== 'teachingbase' || verdictsLoaded) return
    let alive = true
    Promise.all([listVerdicts(supabase), currentReviewer(supabase)]).then(([v, r]) => {
      if (!alive) return
      setVerdicts(v.rows)
      setReviewer(r)
      setVerdictsLoaded(true)
    })
    return () => { alive = false }
  }, [supabase, allowed, tab, verdictsLoaded])
  const latest = useMemo(() => latestVerdicts(verdicts), [verdicts])
  const ownJudged = useMemo(() => ownJudgedKeys(verdicts, reviewer?.id ?? null), [verdicts, reviewer])
  const tbLang: TbLang = viewLang === 'de' ? 'de' : 'en'

  const judge = async (lessonId: string, kind: ItemKind, item: LessonLink | LessonData['components'][number], verdict: Verdict, note: string | null): Promise<string | null> => {
    if (!reviewer) return 'not signed in'
    const { row, error } = await addVerdict(supabase, reviewer, { lesson_id: lessonId, item_kind: kind, item_key: item.item_key, item_summary: summaryOf(item, kind), verdict, note })
    if (error || !row) return error ?? 'unknown error'
    setVerdicts((cur) => [...cur, row])
    return null
  }

  const downloadVerdicts = () => {
    const payload = { exported_at: new Date().toISOString(), source: 'teachingbase_link_verdicts', verdicts: verdictsExport(latest) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `teachingbase-verdicts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeFilterCfg = tab !== 'all' ? BASE_REPO_CONFIGS.find((c) => c.key === tab) : undefined
  const activeFilterColumn = activeFilterCfg?.filterColumn
  // Real feedback cc89fc1c (Susan, 2026-10-21... reconfirmed 2026-10-24):
  // "once one has selected a Repo, do not show the column 'Repo' because
  // there is no information added for the user" -- and that's also
  // exactly when a repo's own column set (tableColumns) applies, since the
  // generic cross-repo table only makes sense across more than one repo.
  const showRepoColumn = tab === 'all'
  const activeTableColumns: TableColumn[] | undefined = activeFilterCfg?.tableColumns
  // A filter or sort set for one base's columns means nothing on another's.
  useEffect(() => { setColumnFilters({}); setSort(null) }, [tab])
  // Filters on tags and method classes hold the text of the language they were picked in, so they are cleared when the language changes.
  useEffect(() => { setColumnFilters({}) }, [viewLang])

  // The repo copy with the in-app edits on top. Records without edits are the same objects as in rowsByRepo.
  const effectiveRowsByRepo = useMemo(() => {
    const out = new Map<BaseRepoKey, SnapshotRow[]>()
    for (const [key, rows] of rowsByRepo) out.set(key, applyEdits(key, rows, editsByRepo.get(key) ?? []))
    return out
  }, [rowsByRepo, editsByRepo])

  // The rows for this tab, before any search or filter.
  const tabRows: NodeRef[] = useMemo(() => {
    const out: NodeRef[] = []
    const keys: BaseRepoKey[] = tab === 'all' ? BASE_REPO_CONFIGS.map((c) => c.key) : [tab]
    for (const repoKey of keys) for (const row of effectiveRowsByRepo.get(repoKey) ?? []) out.push({ repoKey, row })
    return out
  }, [effectiveRowsByRepo, tab])

  const reviewLessons = useMemo(() => (tab === 'teachingbase' ? tabRows.map((n) => ({ id: n.row.id, label: n.row.label, data: n.row.data as unknown as LessonData })) : []), [tab, tabRows])
  const resumePointer = useMemo(() => (tab === 'teachingbase' ? pointerIfValid(reviewLessons, loadPointer(userId)) : null), [tab, reviewLessons, userId, review])
  // Words other records already use, offered as suggestions in the edit form.
  const vocab: FieldVocabulary = useMemo(() => {
    const methods = effectiveRowsByRepo.get('methodsbase') ?? []
    const approaches = new Set<string>()
    const classes = new Set<string>(['pedagogical-practice', 'research-method'])
    for (const r of methods) {
      for (const a of r.secondaryFilterValues) approaches.add(normalizeTag(a))
      for (const c of methodClassesOf((r.data as any)?.methodClass)) classes.add(c)
    }
    const methodList = methods.map((r) => ({ id: r.id, label: rowLabel(r, 'en') })).sort((a, b) => compareText(a.label, b.label))
    return { learningApproaches: Array.from(approaches).sort(compareText), methodClasses: Array.from(classes).sort(compareText), methods: methodList }
  }, [effectiveRowsByRepo])

  const selectedLive: NodeRef | null = useMemo(() => {
    if (!selected) return null
    const fresh = (effectiveRowsByRepo.get(selected.repoKey) ?? []).find((r) => r.id === selected.row.id)
    return { repoKey: selected.repoKey, row: fresh ?? selected.row }
  }, [selected, effectiveRowsByRepo])

  const allEdits = useMemo(() => Array.from(editsByRepo.values()).flat(), [editsByRepo])
  const waitingEdits = useMemo(() => pendingEdits(allEdits), [allEdits])

  // Real feedback a3408216 (Susan, 2026-10-24): no way to tell, or filter,
  // which language a record's text is actually in -- MethodsBase content
  // reads as an undifferentiated mix. Only shown once at least one loaded
  // row carries a language tag (today: MethodsBase), so every other
  // repo's view is unchanged until it gets the same treatment.
  const anyLanguageTagged = useMemo(() => tabRows.some((n) => n.row.languages.length > 0), [tabRows])

  const columns: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = []
    if (showRepoColumn) {
      cols.push({
        id: 'repo', header: 'Repo', get: (n) => n.repoKey, filterValues: (n) => [n.repoKey],
        render: (n) => <span className="chip" style={{ borderColor: REPO_COLOR[n.repoKey], color: REPO_COLOR[n.repoKey] }}>{n.repoKey}</span>,
      })
    }
    if (activeTableColumns) {
      for (const c of activeTableColumns) {
        cols.push({
          id: `col:${c.header}`, header: c.header, get: (n) => c.get(n.row, viewLang),
          sortValue: c.sortKey ? (n) => c.sortKey!(n.row) : undefined,
          filterValues: c.filterValues ? (n) => c.filterValues!(n.row, viewLang) : undefined,
          render: c.header === 'Label' ? (n) => <LabelCell n={n} lang={viewLang} /> : undefined,
        })
      }
    } else {
      cols.push({ id: 'label', header: 'Label', get: (n) => rowLabel(n.row, viewLang), render: (n) => <LabelCell n={n} lang={viewLang} /> })
    }
    if (anyLanguageTagged) {
      cols.push({
        id: 'language', header: 'Language',
        get: (n) => (n.row.languages.length > 0 ? n.row.languages.join(' ') : 'untagged'),
        filterValues: (n) => (n.row.languages.length > 0 ? n.row.languages : ['__untagged__']),
        filterLabel: (v) => (v === '__untagged__' ? 'Not yet language-tagged' : LANGUAGE_NAMES[v] ?? v.toUpperCase()),
        render: (n) => <LanguageBadge languages={n.row.languages} />,
      })
    }
    if (!activeTableColumns) {
      cols.push({
        id: 'detail', header: activeFilterColumn ? filterColumnLabel(activeFilterColumn) : 'Detail',
        get: (n) => n.row.secondary ?? n.row.filterValue ?? '',
        filterValues: activeFilterColumn ? (n) => (n.row.filterValue ? [n.row.filterValue] : []) : undefined,
        render: (n) => <span className="muted">{n.row.secondary ?? n.row.filterValue ?? ''}</span>,
      })
    }
    cols.push({
      id: 'review', header: 'Review status', get: (n) => n.row.review_status ?? '—',
      filterValues: (n) => [n.row.review_status ?? '—'],
      render: (n) => <span className="muted">{n.row.review_status ?? '—'}</span>,
    })
    return cols
  }, [showRepoColumn, activeTableColumns, anyLanguageTagged, activeFilterColumn, viewLang])

  // Each filterable column's choices come from every row loaded for the tab,
  // so picking one filter doesn't shrink the choices in another heading.
  const filterOptions = useMemo(() => {
    const out = new Map<string, string[]>()
    for (const col of columns) {
      if (!col.filterValues) continue
      const values = new Set<string>()
      for (const n of tabRows) for (const v of col.filterValues(n)) values.add(v)
      out.set(col.id, Array.from(values).sort(compareText))
    }
    return out
  }, [columns, tabRows])

  const searched = useMemo(
    () => tabRows.filter((n) => rowMatchesSearch(n.row, search) && (!onlyEdited || (n.row.editedPaths?.length ?? 0) > 0)
      && (tab !== 'teachingbase' || ((!onlyStartHere || hasStartHere(n.row as any)) && (!onlyOpen || isStillOpen(n.row as any, latest))))),
    [tabRows, search, onlyEdited, tab, onlyStartHere, onlyOpen, latest]
  )

  // Until someone clicks a heading, rows are in title order, as before.
  // On the TeachingBase tab the lessons with the most doubtful links come first, until someone clicks a heading.
  const defaultSortColumn = (tab === 'teachingbase' ? columns.find((c) => c.header === 'Check first') : undefined) ?? columns.find((c) => c.id === 'label' || c.header === 'Label' || c.header === 'Title') ?? columns.find((c) => c.id !== 'repo') ?? columns[0]
  const effectiveSort: SortState = sort ?? { id: defaultSortColumn.id, dir: 'asc' }

  const allRows: NodeRef[] = useMemo(() => {
    const active = columns.filter((c) => c.filterValues && columnFilters[c.id])
    const filtered = searched.filter((n) => active.every((c) => c.filterValues!(n).includes(columnFilters[c.id])))
    const sortCol = columns.find((c) => c.id === effectiveSort.id) ?? columns[0]
    const dir = effectiveSort.dir === 'desc' ? -1 : 1
    const key = (n: NodeRef) => (sortCol.sortValue ? sortCol.sortValue(n) : sortCol.get(n)) ?? ''
    return [...filtered].sort((a, b) => dir * compareText(key(a), key(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, columns, columnFilters, effectiveSort.id, effectiveSort.dir])

  const activeFilterChips = columns.filter((c) => c.filterValues && columnFilters[c.id])

  const totalCount = allRows.length
  // Tab counts cover every base already loaded, including tabs that aren't open, and follow the search box.
  const pendingQueueCount = reviewQueue ? reviewQueue.filter((i) => i.assignment.status === 'pending').length : null
  const waitingTotal = (pendingQueueCount ?? 0) + waitingEdits.length
  const inReviewSpace = !restricted && reviewSection !== null
  const reviewSections: ReviewSectionInfo[] = [
    { key: 'queue', label: 'Waiting for review', count: pendingQueueCount },
    { key: 'edits', label: 'Edits to send back', count: waitingEdits.length },
    ...(tab === 'teachingbase' ? [{ key: 'lessons' as const, label: 'Lesson links' }] : []),
  ]
  const repoViewName = tab === 'all' ? 'all repos' : BASE_REPO_CONFIGS.find((c) => c.key === tab)?.name ?? 'the records'
  const searchedCountFor = (key: BaseRepoKey) => (effectiveRowsByRepo.get(key) ?? []).filter((r) => rowMatchesSearch(r, search) && (!onlyEdited || (r.editedPaths?.length ?? 0) > 0)).length

  if (!allowed) {
    const checking = sessionLoading || (reviewerOnly && !isAdmin && named === null && !!userId)
    return (
      <div>
        <h1>{reviewerOnly ? 'TeachingBase' : 'Base Repo Explorer'}</h1>
        <p className="muted" data-testid="no-access">{checking ? 'Loading…' : "This page isn't available to your account."}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="row"><BookOpen size={18} style={{ color: 'var(--text-muted)' }} />{restricted ? 'TeachingBase' : 'Base Repo Explorer'}</h1>
      {!restricted && (
        <p className="muted" style={{ marginBottom: 16 }}>
          Browse, review, and discuss the content of the OpenEvo CCS Foundational Repos, across every
          project. Admin-only for now. The ConceptBase tab shows what each concept means. The dispute and
          graph layer is not covered here.
        </p>
      )}

      {review && tab === 'teachingbase' && (
        <TeachingBaseReviewMode
          lessons={reviewLessons}
          latest={latest}
          ownJudged={ownJudged}
          lang={tbLang}
          onLang={(l) => setViewLang(l)}
          reviewerId={reviewer?.id ?? userId}
          supabase={supabase}
          onJudge={(lessonId, link, verdict, note) => judge(lessonId, 'link', link, verdict, note)}
          onClose={() => setReview(null)}
          initial={review.initial}
          initialView={review.view}
        />
      )}

      {anyLanguageTagged && (
        <div className="row tlr-lang" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <LanguageSwitch value={viewLang} onChange={setViewLang} uiLang="en" languages={['en', 'de']} />
          <span className="muted" style={{ fontSize: 12 }}>
            Names, descriptions and tags show in this language where a record has them. Where it has no text in this language yet, the English text shows with an EN tag.
          </span>
        </div>
      )}

      {!restricted && <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn btn-mini${tab === 'all' ? ' btn-primary' : ''}`} onClick={() => setTab('all')}>
          All{tab === 'all' && !loading ? ` (${totalCount})` : ''}
        </button>
        {BASE_REPO_CONFIGS.map((cfg) => (
          <button
            key={cfg.key}
            className={`btn btn-mini${tab === cfg.key ? ' btn-primary' : ''}`}
            onClick={() => setTab(cfg.key)}
          >
            {cfg.name}{rowsByRepo.has(cfg.key) ? ` (${searchedCountFor(cfg.key)})` : ''}
          </button>
        ))}
        <Link to={CONCEPTBASE_TAB_PATH} className="btn btn-mini" title="What ConceptBase says each concept means">ConceptBase</Link>
      </div>}

      {restricted && tab === 'teachingbase' && (
        <TeachingBaseToolbar
          lessons={tabRows.map((n) => n.row as any)}
          latest={latest}
          lang={tbLang}
          onlyStartHere={onlyStartHere}
          onlyOpen={onlyOpen}
          onToggleStartHere={() => setOnlyStartHere((v) => !v)}
          onToggleOpen={() => setOnlyOpen((v) => !v)}
          onDownload={downloadVerdicts}
          onStartReview={() => setReview({ initial: null, view: 'decide' })}
          onResumeReview={resumePointer ? () => setReview({ initial: resumePointer, view: 'decide' }) : null}
          supabase={supabase}
          adminId={isAdmin ? userId : null}
        />
      )}

      {inReviewSpace ? (
        <ReviewSpace
          repoName={repoViewName}
          sections={reviewSections}
          section={reviewSection === 'lessons' && tab !== 'teachingbase' ? 'queue' : reviewSection!}
          onSection={setReviewSection}
          onClose={() => setReviewSection(null)}
        >
          {(reviewSection === 'queue' || (reviewSection === 'lessons' && tab !== 'teachingbase')) && (
            <ReviewQueuePanel items={reviewQueue} supabase={supabase} onReviewed={reloadReviewQueue} />
          )}
          {reviewSection === 'edits' && (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <button className="btn btn-mini" onClick={() => { setOnlyEdited(true); setReviewSection(null) }} title="Close this and show only the records that were edited in OpenLPM">
                  <Pencil size={13} />Show the edited records in the table
                </button>
              </div>
              <EditsExportPanel
                edits={waitingEdits}
                labelFor={(repoKey, id) => (effectiveRowsByRepo.get(repoKey) ?? []).find((r) => r.id === id)?.label ?? id}
                supabase={supabase}
                onMarked={() => Promise.all(Array.from(editsByRepo.keys()).map(reloadEdits))}
              />
            </>
          )}
          {reviewSection === 'lessons' && tab === 'teachingbase' && (
            <TeachingBaseToolbar
              lessons={tabRows.map((n) => n.row as any)}
              latest={latest}
              lang={tbLang}
              onlyStartHere={onlyStartHere}
              onlyOpen={onlyOpen}
              onToggleStartHere={() => setOnlyStartHere((v) => !v)}
              onToggleOpen={() => setOnlyOpen((v) => !v)}
              onDownload={downloadVerdicts}
              onStartReview={() => setReview({ initial: null, view: 'decide' })}
              onResumeReview={resumePointer ? () => setReview({ initial: resumePointer, view: 'decide' }) : null}
              supabase={supabase}
              adminId={isAdmin ? userId : null}
              inReviewSpace
            />
          )}
        </ReviewSpace>
      ) : (
      <>
      <div className="row" style={{ gap: 8, marginBottom: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search all fields…"
                title="Searches everything in each record: title, authors, abstract, keywords, descriptions, related ids and more. Every word you type has to appear somewhere in the record."
                aria-label="Search all fields"
                style={{ minWidth: 240 }}
              />
            </div>
          </div>
          {view !== 'table' && (
            // The table sorts from its column headings; the card and graph
            // views have no headings, so they get a plain sort menu instead.
            <select
              value={sort?.id ?? ''}
              onChange={(e) => setSort(e.target.value ? { id: e.target.value, dir: 'asc' } : null)}
              aria-label="Sort by"
            >
              <option value="">Sort: default</option>
              {columns.map((c) => <option key={c.id} value={c.id}>Sort: {c.header}</option>)}
            </select>
          )}
          {activeFilterChips.map((c) => (
            <button
              key={c.id}
              className="btn btn-mini active"
              title="Clear this filter"
              onClick={() => setColumnFilters((f) => ({ ...f, [c.id]: '' }))}
            >
              {c.header}: {(c.filterLabel ?? ((v: string) => v))(columnFilters[c.id])} ×
            </button>
          ))}
          {/* Dustin, 2026-11-13 (feedback 452bcae4): how many records are among the filtered. */}
          {!loading && (
            <span className="muted" style={{ fontSize: 12 }} data-testid="result-count" aria-live="polite">
              {allRows.length === tabRows.length ? `${tabRows.length.toLocaleString('en-US')} records` : `${allRows.length.toLocaleString('en-US')} of ${tabRows.length.toLocaleString('en-US')} records match`}
            </span>
          )}
          {!restricted && onlyEdited && <button className="btn btn-mini active" title="Show every record again" onClick={() => setOnlyEdited(false)}>Edited only ×</button>}
          {tab === 'teachingbase' && onlyStartHere && <button className="btn btn-mini active" title="Show every lesson again" onClick={() => setOnlyStartHere(false)}>Start-here selection only ×</button>}
          {tab === 'teachingbase' && onlyOpen && <button className="btn btn-mini active" title="Show every lesson again" onClick={() => setOnlyOpen(false)}>Still to check ×</button>}
          {activeFilterChips.length > 1 && (
            <button className="btn-linklike" style={{ fontSize: 12 }} onClick={() => setColumnFilters({})}>Clear all</button>
          )}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className={`btn btn-mini${view === 'table' ? ' btn-primary' : ''}`} onClick={() => setView('table')}><Table2 size={13} />Table</button>
          <button className={`btn btn-mini${view === 'cards' ? ' btn-primary' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={13} />Cards</button>
          <button className={`btn btn-mini${view === 'graph' ? ' btn-primary' : ''}`} onClick={() => setView('graph')}><Network size={13} />Graph</button>
          {tab === 'methodsbase' && <button className={`btn btn-mini${view === 'tree' ? ' btn-primary' : ''}`} onClick={() => setView('tree')} title="The methods from general to specific"><ListTree size={13} />Hierarchy</button>}
          {!restricted && tab === 'teachingbase' && (
            <button className="btn btn-mini btn-primary" data-testid="start-review" onClick={() => setReview({ initial: null, view: 'decide' })} title="Go through the suggested lesson links one at a time">
              <PlayCircle size={13} />Start reviewing
            </button>
          )}
          {!restricted && (
            <button
              className="btn btn-mini"
              data-testid="open-review-space"
              onClick={() => setReviewSection(tab === 'teachingbase' ? 'lessons' : 'queue')}
              title={`Review: ${pendingQueueCount ?? 0} waiting for review, ${waitingEdits.length} edits to send back${tab === 'teachingbase' ? ', lesson links and reviewers' : ''}`}
            >
              <Clock size={13} />Review{waitingTotal > 0 ? ` (${waitingTotal})` : ''}
            </button>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : totalCount === 0 ? (
            <div className="card empty"><p>No records match.</p></div>
          ) : view === 'table' ? (
            // A table wider than its column scrolls sideways inside it. Without this wrapper the extra width ran
            // underneath the record card on the right (feedback ca05a77a, Susan 2026-11-08).
            <div style={{ overflowX: 'auto' }}><TableView
              rows={allRows}
              columns={columns}
              filterOptions={filterOptions}
              columnFilters={columnFilters}
              sort={effectiveSort}
              onSort={setSort}
              onFilter={(id, value) => setColumnFilters((f) => ({ ...f, [id]: value }))}
              onSelect={setSelected}
            /></div>
          ) : view === 'cards' ? (
            <CardsView rows={allRows} onSelect={setSelected} showLanguage={anyLanguageTagged} showRepoChip={showRepoColumn} lang={viewLang} />
          ) : view === 'tree' && tab === 'methodsbase' ? (
            <MethodTreeView rows={allRows} onSelect={setSelected} lang={viewLang} />
          ) : (
            <GraphView rows={allRows} onSelect={setSelected} lang={viewLang} />
          )}
        </div>

        {selectedLive && (
          <DetailPanel
            nodeRef={selectedLive}
            supabase={supabase}
            userId={userId}
            restricted={restricted}
            tbLang={tbLang}
            latest={latest}
            ownJudged={ownJudged}
            onJudge={(kind, item, verdict, note) => judge(selectedLive.row.id, kind, item, verdict, note)}
            vocab={vocab}
            lang={viewLang}
            methodRows={effectiveRowsByRepo.get('methodsbase') ?? []}
            onOpenMethod={(id) => { const r = (effectiveRowsByRepo.get('methodsbase') ?? []).find((x) => x.id === id); if (r) setSelected({ repoKey: 'methodsbase', row: r }) }}
            history={historyFor(editsByRepo.get(selectedLive.repoKey) ?? [], selectedLive.row.id)}
            editsAvailable={editsAvailable}
            onEditsChanged={() => reloadEdits(selectedLive.repoKey)}
            onClose={() => setSelected(null)}
            onSubmittedForReview={reloadReviewQueue}
          />
        )}
      </div>
      </>
      )}
    </div>
  )
}

// Full names in the filter dropdown and the detail panel; short codes in
// the dense table/card badge (EN/DE), same two-letter tags methodsbase's
// own records now use as language keys.
const LANGUAGE_NAMES: Partial<Record<string, string>> = { en: 'English', de: 'German' }

function LabelCell({ n, lang }: { n: NodeRef; lang: string }) {
  const text = rowLabel(n.row, lang)
  if (!labelIsFallback(n.row, lang)) return <>{text}</>
  const shown = pickLocalized((n.row.data as any)?.label, lang)?.lang ?? ''
  return <>{text}<span className="chip muted" style={{ fontSize: 10, marginLeft: 6 }} title="No text in the chosen language yet, so this one shows">{shown.toUpperCase()}</span></>
}

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
  columns,
  filterOptions,
  columnFilters,
  sort,
  onSort,
  onFilter,
  onSelect,
}: {
  rows: NodeRef[]
  columns: ColumnDef[]
  filterOptions: Map<string, string[]>
  columnFilters: Record<string, string>
  sort: SortState
  onSort: (s: SortState) => void
  onFilter: (columnId: string, value: string) => void
  onSelect: (r: NodeRef) => void
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => {
            const sorted = sort.id === c.id
            const options = filterOptions.get(c.id)
            return (
              <th key={c.id} aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <span className="row" style={{ gap: 2, alignItems: 'center', flexWrap: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn-linklike"
                    style={{ color: 'inherit', textDecoration: 'none', textTransform: 'inherit', letterSpacing: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    title={`Sort by ${c.header.toLowerCase()}`}
                    onClick={() => onSort({ id: c.id, dir: sorted && sort.dir === 'asc' ? 'desc' : 'asc' })}
                  >
                    {c.header}
                    {sorted
                      ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                      : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}
                  </button>
                  {options && options.length > 0 && (
                    <HeaderFilter
                      header={c.header}
                      options={options}
                      value={columnFilters[c.id] ?? ''}
                      labelFor={c.filterLabel}
                      onChange={(v) => onFilter(c.id, v)}
                    />
                  )}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => (
          <tr key={`${n.repoKey}:${n.row.id}`} onClick={() => onSelect(n)} style={{ cursor: 'pointer' }}>
            {columns.map((c) => <td key={c.id}>{c.render ? c.render(n) : c.get(n)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// A small filter button that lives in a column heading and opens a pick-list
// of that column's values. Closes on a click anywhere else or on Escape.
function HeaderFilter({
  header,
  options,
  value,
  labelFor,
  onChange,
}: {
  header: string
  options: string[]
  value: string
  labelFor?: (value: string) => string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const label = (v: string) => (labelFor ? labelFor(v) : v)
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', textTransform: 'none', letterSpacing: 'normal' }}>
      <button
        type="button"
        className={`btn btn-mini${value ? ' active' : ''}`}
        style={{ padding: '1px 4px', minHeight: 0, lineHeight: 1 }}
        aria-label={`Filter ${header}${value ? ` (currently ${label(value)})` : ''}`}
        aria-expanded={open}
        title={value ? `Filtered: ${label(value)}` : `Filter ${header.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Filter size={11} />
      </button>
      {open && (
        <div className="popover" style={{ width: 'max-content', minWidth: 160, maxWidth: 320, maxHeight: 320, overflowY: 'auto', padding: 6, fontWeight: 400, fontSize: 13, color: 'var(--text-primary)' }}>
          <div className="menu">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={{ fontWeight: value === '' ? 600 : 400 }}>
              All
            </button>
            {options.map((o) => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }} style={{ fontWeight: value === o ? 600 : 400 }}>
                {label(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}

function CardsView({
  rows,
  onSelect,
  showLanguage,
  showRepoChip,
  lang,
}: {
  rows: NodeRef[]
  onSelect: (r: NodeRef) => void
  showLanguage: boolean
  showRepoChip: boolean
  lang: string
}) {
  return (
    <div className="grid grid-3">
      {rows.map(({ repoKey, row }) => (
        <div key={`${repoKey}:${row.id}`} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelect({ repoKey, row })}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {showRepoChip && <span className="chip" style={{ borderColor: REPO_COLOR[repoKey], color: REPO_COLOR[repoKey], marginBottom: 6 }}>{repoKey}</span>}
            {showLanguage && <LanguageBadge languages={row.languages} />}
          </div>
          <h3 style={{ marginBottom: 4 }}>{rowLabel(row, lang)}</h3>
          {row.secondary && <p className="muted" style={{ fontSize: 12 }}>{row.secondary}</p>}
          {row.review_status && <p className="muted" style={{ fontSize: 11 }}>Review: {row.review_status}</p>}
          {(row.editedPaths?.length ?? 0) > 0 && <p style={{ fontSize: 11, marginTop: 4 }}><span className="chip" title="Edited in OpenLPM on top of the repo copy">edited</span></p>}
        </div>
      ))}
    </div>
  )
}

// Follows the shared graph standards (feedback 2a3c04e3). Records start on the
// fixed tiered layout (physics is an option), labels never overlap, each link's
// field name shows when you point at a record, and the control panel is the
// same as on every other graph. The seven repo colors stay outside the six
// concept colors on purpose: each repo also has its own shape, so color is
// never the only way to tell them apart.
// With the records without a link left out, the Explorer's graph holds about a thousand records, and the spreading layout runs in a few seconds
// from the grouped starting picture. The kit's general limit (500) stays for every other graph.
const EXPLORER_PHYSICS_MAX = 1200

function GraphView({ rows, onSelect, lang }: { rows: NodeRef[]; onSelect: (r: NodeRef) => void; lang: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('base-repo-explorer')
  const [physicsSkipped, setPhysicsSkipped] = useState(false)
  // Feedback 31cea347 (Dustin, 2026-11-13): with every repo loaded the graph was a grid of 3,509 records, three quarters of them
  // with no link to anything, and "Free spread" changed nothing. Records without a link are left out unless asked for.
  // Automatic until someone ticks or unticks the box: a view of more than 500 records starts with the linked ones only. A smaller view starts with
  // every record, as before. Links are only counted between records of the same view, so a single repo whose links go to other repos has none
  // (links to other repos are drawn on the All tab). A view with no links at all shows every record and says why, so the graph is never blank.
  const [linkedChoice, setLinkedChoice] = useState<boolean | null>(null)
  const wantLinkedOnly = linkedChoice ?? rows.length > 500
  const [counts, setCounts] = useState({ shown: 0, total: 0, linked: 0 })
  const [drawing, setDrawing] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    // The drawing of a big graph takes a few seconds and blocks the page, so the page first shows that it is working.
    setDrawing(true)
    let built: Core | null = null
    const timer = setTimeout(() => {
      if (!containerRef.current) return
      const keyOf = (r: NodeRef) => `${r.repoKey}:${r.row.id}`
      const byId = new Map(rows.map((r) => [keyOf(r), r]))

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

      const linkedIds = new Set<string>()
      for (const e of edges) { linkedIds.add(e.source); linkedIds.add(e.target) }
      const shown = wantLinkedOnly && linkedIds.size > 0 ? rows.filter((r) => linkedIds.has(keyOf(r))) : rows
      setCounts({ shown: shown.length, total: rows.length, linked: linkedIds.size })

      // Linked records form blocks, one block for each group that is linked together, biggest first, and the records without a
      // link fill one block at the end. A fixed order (repo, then name) keeps the picture the same every time.
      const ordered = [...shown].sort((a, b) => a.repoKey.localeCompare(b.repoKey) || rowLabel(a.row, lang).localeCompare(rowLabel(b.row, lang)))
      const positions = blockLayoutPositions(ordered.map(keyOf), edges.map((e) => [e.source, e.target] as [string, string]))

      const info = new Map<string, NodeLabelInfo>()
      const elements: ElementDefinition[] = [
        ...shown.map((r) => {
          const id = `${r.repoKey}:${r.row.id}`
          const pos = positions.get(id)
          info.set(id, { full: rowLabel(r.row, lang), priority: 10, fontPx: 10, maxWidthPx: 100, maxChars: 28 })
          return { data: { id, repoKey: r.repoKey, size: 24 }, position: pos ? { x: pos.x, y: pos.y } : undefined }
        }),
        ...edges.map((e, i) => ({ data: { id: `edge-${i}`, source: e.source, target: e.target, name: e.field } })),
      ]

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        boxSelectionEnabled: false,
        layout: { name: 'preset' },
        minZoom: 0.15,
        maxZoom: 3,
        style: [
          {
            selector: 'node',
            style: {
              width: 'data(size)', height: 'data(size)', label: 'data(label)', 'font-size': 10, 'font-weight': 600,
              'text-wrap': 'wrap', 'text-max-width': '100px', 'text-valign': 'bottom', 'text-margin-y': 5,
              color: token('--text-primary', '#0b0b0b'), 'border-width': 2, 'border-color': token('--surface-0', '#fff'),
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
              width: 1.4, 'line-color': token('--place-other', '#6f7d8c'), 'target-arrow-color': token('--place-other', '#6f7d8c'),
              'target-arrow-shape': 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 'data(op)',
              'font-size': 9, color: token('--text-primary', '#0b0b0b'),
            },
          },
          ...hoverStyles(),
        ] as never,
      })

      // Records with more links get a label first when space is short.
      cy.nodes().forEach((n) => { const i = info.get(n.id()); if (i) i.priority += n.degree(false) * 10 })
      setPhysicsSkipped(applyGraphSettings(cy, gs, { name: 'preset' }, info, () => false, EXPLORER_PHYSICS_MAX).physicsSkipped)
      applyLineLooks(cy, gs.lineStrength, () => 2)
      attachHover(cy)

      cy.on('tap', 'node', (evt) => {
        const id = evt.target.id() as string
        const found = byId.get(id)
        if (found) onSelect(found)
      })

      cyRef.current = cy
      built = cy
      setDrawing(false)
    }, 40)
    return () => { clearTimeout(timer); if (built) { built.destroy(); if (cyRef.current === built) cyRef.current = null } }
    // gs.lineStrength is applied by the effect below, so dragging the slider does not rebuild the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lang, wantLinkedOnly, gs.layout, gs.labels, gs.spacing])

  useEffect(() => {
    if (cyRef.current) applyLineLooks(cyRef.current, gs.lineStrength, () => 2)
  }, [gs.lineStrength])

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  return (
    <div>
      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang="en" showConnections={false} showLayout
        wording={{ fixed: { label: 'Tiers', hint: 'Rows of records. Always the same.' } }}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current?.fit(undefined, 30)}
      />
      <label className="row" style={{ gap: 6, fontSize: 12, margin: '0 0 6px', opacity: counts.linked === 0 ? 0.6 : 1 }}>
        <input type="checkbox" checked={wantLinkedOnly && counts.linked > 0} disabled={counts.linked === 0} onChange={(e) => setLinkedChoice(e.target.checked)} />
        Only records that have a link to another record
        <span className="muted">({counts.linked === 0 ? 'none in this view' : wantLinkedOnly ? `${counts.shown} of ${counts.total} shown` : `all ${counts.total} shown, ${counts.total - counts.linked} without a link`})</span>
      </label>
      {drawing && <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }} role="status">Drawing the graph…</p>}
      {counts.total > 0 && counts.linked === 0 && <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>No record in this view links to another record in this view, so every record is shown. Links to records of other repos are drawn on the All tab.</p>}
      {physicsSkipped && <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>Free spread is off for more than {EXPLORER_PHYSICS_MAX} records, because it would freeze the page. {wantLinkedOnly && counts.linked > 0 ? 'Pick one repo above to use it.' : counts.linked > 0 ? 'Tick the box above to leave out the records without a link, or pick one repo.' : 'Pick a smaller repo above to use it.'}</p>}
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
        Point at a record to see its full name and what its links are called.
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

// A link that opens in a new tab (feedback 6ad9269a, Susan 2026-11-08: "doi/url should be a hyperlink that opens in a new tab").
function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
}

// The full APA reference with one click to copy it. The copy carries italics (journal and book titles) for a word processor and plain text
// for everything else (feedback b8454f68, Susan 2026-11-08).
function ApaCitation({ type, citation }: { type: string | undefined; citation: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false)
  const parts = useMemo(() => formatApa(type, citation), [type, citation])
  const copy = async () => {
    const plain = apaToPlainText(parts)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([apaToHtml(parts)], { type: 'text/html' }),
        })])
      } else {
        await navigator.clipboard.writeText(plain)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      try { await navigator.clipboard.writeText(plain); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
    }
  }
  return (
    <div data-testid="apa-citation" style={{ margin: '4px 0 8px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 12 }}>
      <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 3 }}>Citation (APA 7)</div>
      <div style={{ overflowWrap: 'anywhere' }}>
        {parts.map((p, i) => (p.italic ? <i key={i}>{p.text}</i> : <span key={i}>{p.text}</span>))}
      </div>
      <button type="button" className="btn btn-mini" onClick={copy} style={{ marginTop: 6 }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy citation'}
      </button>
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
  const doiLink = recordLink(citation)
  const doiText = citation.doi ? `doi.org/${String(citation.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : (citation.open_access_url as string | undefined) ?? null
  const isbn = (citation.isbn as string | undefined) ?? null
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
      {!!doiText && <DetailRow label="DOI / URL"><ExternalLink href={doiLink}>{doiText}</ExternalLink></DetailRow>}
      {!doiText && !!isbn && <DetailRow label="ISBN">{isbn}</DetailRow>}
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
function MethodsDetailSections({ data, recordId, methodRows, onOpenMethod, idLabels, lang }: { data: Record<string, unknown>; recordId: string; methodRows: SnapshotRow[]; onOpenMethod: (id: string) => void; idLabels: Map<string, ResolvedLabel>; lang: string }) {
  // One language at a time, chosen with the switch at the top of the page. A text that only exists in the other language
  // shows with a small language tag so nobody mistakes it for a translation.
  const uiLang = 'en'
  const textLang = lang
  const name = pickLocalized(data.label, textLang)
  const germanName = pickLocalized(data.label, 'de')
  const gloss = germanName && germanName.lang === 'de' ? germanName.text : undefined
  const clean = (text: string, textIsLang: string) => (lang === 'en' && textIsLang === 'en' ? withoutGermanGloss(text, gloss) : text)
  const tag = (l: string) => (l && l !== lang ? <LangChip lang={l} uiLang={uiLang} /> : null)
  const learningApproaches = Array.isArray(data.learningApproaches) ? (data.learningApproaches as unknown[]).map(String) : []
  const discipline = data.discipline as string | undefined
  const lessonPhases = Array.isArray(data.lessonPhases) ? (data.lessonPhases as unknown[]).map(String) : []
  const whenToUse = pickLocalized(data.whenToUse, textLang)
  const description = pickLocalized(data.description, textLang)
  const protocolSteps = pickLocalizedList(data.protocolSteps, textLang)
  const relatedApproaches = Array.isArray(data.relatedApproaches) ? (data.relatedApproaches as unknown[]).map(String) : []
  const primarySources = Array.isArray(data.primarySources) ? (data.primarySources as Record<string, string>[]) : []
  // The ladder from general to specific methods (Dustin, 2026-11-13). Only the narrower method stores the link, so the more specific
  // methods of this one are the records that name it.
  const classes = methodClassesOf(data.methodClass)
  const broaderIds = Array.isArray(data.broaderMethods) ? (data.broaderMethods as unknown[]).map(String) : []
  const narrowerIds = methodRows.filter((r) => Array.isArray((r.data as any)?.broaderMethods) && ((r.data as any).broaderMethods as string[]).includes(recordId)).map((r) => r.id)
  const methodLabel = (id: string) => { const r = methodRows.find((x) => x.id === id); return r ? rowLabel(r, lang) : id }
  const methodLinks = (ids: string[]) => ids.map((id, i) => (
    <span key={id}>{i > 0 ? ', ' : ''}<button type="button" className="btn-linklike" style={{ fontSize: 'inherit' }} onClick={() => onOpenMethod(id)}>{methodLabel(id)}</button></span>
  ))

  const skip = new Set([
    'label', 'methodClass', 'broaderMethods', 'learningApproaches', 'discipline', 'lessonPhases', 'whenToUse',
    'description', 'protocolSteps', 'relatedApproaches', 'primarySources',
  ])

  return (
    <div style={{ fontSize: 12 }}>
      {!!name && <DetailRow label="Label">{name.text}{tag(name.lang)}</DetailRow>}
      {classes.length > 0 && <DetailRow label="Method class">{methodClassesReading(data.methodClass, lang)}</DetailRow>}
      {broaderIds.length > 0 && <DetailRow label="More general method">{methodLinks(broaderIds)}</DetailRow>}
      {narrowerIds.length > 0 && <DetailRow label="More specific methods">{methodLinks(narrowerIds)}</DetailRow>}
      {/* Susan Hanisch, 2026-11-12 (feedback cf57a372): a classroom method always shows this row, also when it is empty,
          so it is clear that something can be added. Research methods have no learning approach and show nothing. */}
      {learningApproaches.length > 0
        ? <DetailRow label="Learning approach">{learningApproaches.map((t) => tagReading('learningApproaches', t, lang)).join(', ')}</DetailRow>
        : classes.includes('pedagogical-practice') && <DetailRow label="Learning approach"><span className="muted">Not set yet. Press Edit to add one.</span></DetailRow>}
      {!!discipline && <DetailRow label="Discipline">{discipline}</DetailRow>}
      {lessonPhases.length > 0 && <DetailRow label="Lesson phases">{lessonPhases.map((t) => tagReading('lessonPhases', t, lang)).join(', ')}</DetailRow>}
      {!!whenToUse && <DetailRow label="When to use">{clean(whenToUse.text, whenToUse.lang)}{tag(whenToUse.lang)}</DetailRow>}
      {!!description && <DetailRow label="Description">{clean(description.text, description.lang)}{tag(description.lang)}<DraftChip data={data} lang={description.lang} label="Claude draft, not yet reviewed by an expert" title="Claude drafted this text. No one with Biologiedidaktik expertise has read it yet." /></DetailRow>}
      {!!protocolSteps?.items.length && (
        <DetailRow label="Protocol steps">
          {tag(protocolSteps.lang)}
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {protocolSteps.items.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{clean(s, protocolSteps.lang)}</li>)}
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
                {(s.doi || s.url) && (
                  <> <ExternalLink href={s.url ?? doiUrl(s.doi)}>{s.url ?? `doi.org/${s.doi}`}</ExternalLink></>
                )}
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
  userId,
  restricted,
  tbLang,
  latest,
  ownJudged,
  onJudge,
  vocab,
  lang,
  methodRows,
  onOpenMethod,
  history,
  editsAvailable,
  onEditsChanged,
  onClose,
  onSubmittedForReview,
}: {
  nodeRef: NodeRef
  supabase: ReturnType<typeof createClient>
  userId: string | null
  /** A named reviewer who is not an admin: no edit, discussion or review-queue parts. */
  restricted: boolean
  tbLang: TbLang
  latest: Map<string, VerdictRow>
  ownJudged: Set<string>
  onJudge: (kind: ItemKind, item: LessonLink | LessonData['components'][number], verdict: Verdict, note: string | null) => Promise<string | null>
  vocab: FieldVocabulary
  lang: string
  /** Every method record, so a method can show the methods above and below it in the hierarchy. */
  methodRows: SnapshotRow[]
  onOpenMethod: (id: string) => void
  history: BaseRepoEdit[]
  editsAvailable: boolean
  onEditsChanged: () => void
  onClose: () => void
  onSubmittedForReview: () => void
}) {
  const { repoKey, row } = nodeRef
  const [editing, setEditing] = useState(false)
  useEffect(() => { setEditing(false) }, [repoKey, row.id])
  const [targetId, setTargetId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof listGlobalTopicsForTarget>> | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [newPost, setNewPost] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [idLabels, setIdLabels] = useState<Map<string, ResolvedLabel>>(new Map())

  useEffect(() => {
    if (restricted) return
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
  }, [repoKey, row.id, supabase, restricted])

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
    <div className="card" style={{ width: repoKey === 'teachingbase' ? 'min(100%, 520px)' : 360, flexShrink: repoKey === 'teachingbase' ? 1 : 0, position: 'sticky', top: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginBottom: 4 }}>{rowLabel(row, lang)}</h3>
        <button className="btn btn-mini" onClick={onClose}>×</button>
      </div>
      {repoKey === 'literaturebase' && (
        <ApaCitation type={row.data.type as string | undefined} citation={(row.data.citation as Record<string, unknown>) ?? {}} />
      )}
      <p className="muted" style={{ fontSize: 12 }}>{repoKey} · {row.id}</p>
      {(row.editedPaths?.length ?? 0) > 0 && (
        <p style={{ fontSize: 12 }}>
          <span className="chip" title="Shown on top of the repo copy">edited in OpenLPM</span>{' '}
          <span className="muted">{row.pendingEditCount ? `${row.pendingEditCount} waiting to be sent back to the repo` : 'all sent back to the repo'}</span>
        </p>
      )}
      {row.review_status && <p className="muted" style={{ fontSize: 12 }}>Review status (source repo): {row.review_status}</p>}

      {repoKey === 'teachingbase' ? (
        <div style={{ marginTop: 8 }}>
          <TeachingBaseLessonBody lessonId={row.id} data={row.data as unknown as LessonData} lang={tbLang} latest={latest} ownJudged={ownJudged} onJudge={onJudge} />
        </div>
      ) : editing && userId ? (
        <div style={{ marginTop: 8 }}>
          <RecordEditor
            supabase={supabase}
            userId={userId}
            repoKey={repoKey}
            row={row}
            vocab={vocab}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); onEditsChanged() }}
          />
        </div>
      ) : (
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }} className="muted">Full record</summary>
        <div style={{ marginTop: 6 }}>
          {repoKey === 'literaturebase' ? (
            <LiteratureDetailSections data={row.data} />
          ) : repoKey === 'methodsbase' ? (
            <MethodsDetailSections data={row.data} recordId={row.id} methodRows={methodRows} onOpenMethod={onOpenMethod} idLabels={idLabels} lang={lang} />
          ) : (
            <RecordDetails data={row.data} idLabels={idLabels} />
          )}
        </div>
      </details>
      )}

      {!editing && userId && repoKey !== 'teachingbase' && (
        <EditHistory supabase={supabase} userId={userId} repoKey={repoKey} row={row} history={history} onChanged={onEditsChanged} />
      )}

      {!restricted && <div className="row" style={{ marginTop: 12, gap: 8 }}>
        {!editing && repoKey !== 'teachingbase' && (
          <button
            className="btn btn-mini"
            disabled={!userId || !editsAvailable}
            title={editsAvailable ? 'Edit this record here. The source repo is not changed until the edits are sent back.' : 'Editing starts once the database update for it is applied.'}
            onClick={() => setEditing(true)}
          >
            <Pencil size={13} />Edit
          </button>
        )}
        <button className="btn btn-mini" disabled={busy} onClick={submitReview}><CheckCircle2 size={13} />Submit for review</button>
      </div>}
      {notice && <p className="muted" style={{ fontSize: 12 }}>{notice}</p>}

      {!restricted && <h4 className="row" style={{ marginTop: 16, fontSize: 13 }}><MessageSquare size={13} />Discuss</h4>}
      {restricted ? null : !topics ? (
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

// The edits made here that the source repos do not have yet. An admin downloads them, a session applies them to the repos through a normal
// pull request, and then marks them as sent back, which takes them off this list (feedback 0afc62a5).
function EditsExportPanel({
  edits,
  labelFor,
  supabase,
  onMarked,
}: {
  edits: BaseRepoEdit[]
  labelFor: (repoKey: BaseRepoKey, id: string) => string
  supabase: ReturnType<typeof createClient>
  onMarked: () => unknown
}) {
  const [batch, setBatch] = useState(() => `batch-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const download = () => {
    const payload = {
      kind: 'openlpm-base-repo-edits',
      created_at: new Date().toISOString(),
      batch,
      edits: edits.map((e) => ({
        edit_id: e.id, base_repo: e.base_repo, record_id: e.record_id, record_label: labelFor(e.base_repo, e.record_id), field_path: e.field_path,
        before: e.before_value, after: e.after_value, note: e.note, edited_by: e.editor_name ?? e.edited_by, edited_at: e.edited_at,
      })),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `openlpm-base-repo-edits-${batch}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const markAll = async () => {
    if (!window.confirm(`Mark these ${edits.length} edits as applied to the source repos? Do this only after the change has been made there.`)) return
    setBusy(true); setMessage(null)
    const error = await markSentBack(supabase, edits.map((e) => e.id), batch)
    setBusy(false)
    if (error) setMessage(error)
    else { setMessage('Marked as sent back.'); await onMarked() }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="edits-export">
      <h3 style={{ marginBottom: 8 }}>Edits to send back to the repos</h3>
      {edits.length === 0 ? (
        <p className="muted">Nothing is waiting. Every edit made here is already in the source repos.</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12 }}>These changes are shown in this app but are not in the source repos yet. Download them, ask for them to be applied through a normal pull request, then mark them as sent back.</p>
          <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 8 }}>
            {edits.map((e) => (
              <div key={e.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <strong>{labelFor(e.base_repo, e.record_id)}</strong> <span className="muted">· {e.base_repo} · {e.field_path} · {e.editor_name ?? 'Someone'} · {new Date(e.edited_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input value={batch} onChange={(ev) => setBatch(ev.target.value)} aria-label="Batch name" style={{ fontSize: 12, minWidth: 200 }} />
            <button className="btn btn-mini" onClick={download}><Download size={13} />Download file</button>
            <button className="btn btn-mini" disabled={busy} onClick={markAll}><Check size={13} />Mark as sent back</button>
          </div>
        </>
      )}
      {message && <p className="muted" style={{ fontSize: 12 }}>{message}</p>}
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
