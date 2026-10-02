import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Compass, Search, Star } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import {
  getFullThread,
  getThreadStationsForTopic,
  listAcceptedConnections,
  listTopicContents,
  listTopics,
  type FullThread,
  type ThreadStationWithThread,
  type TopicListItem,
} from '@/lib/supabase/curriculum'
import { bkAbbreviation, bkEntries, buildBkLabelMap, getConceptElementsById, getRootConcepts, groupBkIdsByRoot, type BkbEntry } from '@/lib/supabase/basiskonzepte'
import { getLibraryForProject, resolveOptionLists } from '@/lib/supabase/prompt-libraries'
import type { Database } from '@/lib/supabase/database.types'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']
import { listFavoriteIds, toggleFavorite } from '@/lib/supabase/favorites'

// The German, student-facing Lernziele explorer -- same real data as the
// researcher Learning Goals page (same listTopics/getTopic/thread helpers),
// a deliberately simpler presentation modeled directly on EvoMentor DE
// v1.2's own real "Lernziele" screen: grade-band chips, a concept-relevance
// filter, a card grid with per-concept relevance dots, and favoriting --
// none of which the researcher-facing page has, by design (it's built for
// browsing/importing/connecting, not for a student picking what to study).

function gradeChipLabel(g: string): string {
  return `Kl. ${g}`
}

// Real Thuringia curriculum structure, named directly by Susan Hanisch
// (feedback 2026-10-01): grades 5/6 and 7/8 are taught as one combined band,
// not as six separate single-grade steps -- Kl.9 and Kl.10 stay their own
// band. Grouping happens purely in this filter UI; `grade_band` itself still
// stores a single real grade per Lernziel, so no data migration is needed.
const GRADE_BAND_KEY: Record<string, string> = { '5': '5/6', '6': '5/6', '7': '7/8', '8': '7/8' }
function bandKeyForGrade(g: string): string {
  return GRADE_BAND_KEY[g] ?? g
}

const RELEVANCE_LEVELS = [1, 2, 3] as const
const RELEVANCE_LEVEL_LABEL: Record<number, string> = { 1: 'niedrig', 2: 'mittel', 3: 'hoch' }

// Real feedback ee644d5d (Susan, 2026-10-02): "I see you incorporated the
// didactic methods I suggest here [the AI Prompt Generator's own methods
// checklist], but they are not yet integrated in the learning goals window,
// i.e. in the search function there." The root cause: the Prompt
// Generator's own method vocabulary is real, live, database-driven data
// (prompt_template_libraries.option_lists.methods, read via
// getLibraryForProject/resolveOptionLists) -- it had already been expanded
// and renamed there (15 real methods, including her more specific
// "(bioethische) Diskussion" and "Erfahrungs-/handlungsorientiertes Lernen"
// in place of the plainer originals, plus 4 genuinely new ones). This
// filter was a SEPARATE, hand-copied, hardcoded list that was never updated
// to match -- fetched live here from the same source instead, so the two
// can't drift apart again. Falls back to whatever methods are actually
// present in the real data if no library resolves for this project (same
// "never offer an option that matches nothing real" spirit as the original
// hardcoded list's own comment).
const METHOD_ICON: Record<string, string> = {
  'Forschendes Lernen': '🔬', 'Analogien und Vergleiche': '🔗', 'Konzeptuelles Lernen': '🧩',
  '(bioethische) Diskussion': '💬', 'Narrativer Zugang': '📖', 'Modelle und Simulationen': '🧪',
  'Erfahrungs-/handlungsorientiertes Lernen': '🖐️', 'Digitale Medien': '💻', 'Recherche': '📚',
  'Kooperative Lernformen': '👥', 'Projektbasiertes Lernen': '🛠️', 'Problembasiertes Lernen': '🧠',
  'Außerschulische Lernorte': '🏞️', 'Stationenlernen': '📍', 'Gestalterische/kreative Aufgaben': '🎨',
}
const DEFAULT_METHOD_ICON = '•'

/**
 * Fixed-size CSS dots for a relevance level, always in the given color --
 * replaces the old plain "●●○" text glyphs (see globals.css's .rel-dot
 * comment for why: inconsistent glyph size, and one call site rendered
 * these in grey instead of the Basiskonzept's own color). One shared
 * component so both real call sites on this page (the card summary row and
 * the expanded detail section) can't drift from each other again.
 */
function RelevanceDots({ level, color }: { level: number; color?: string }) {
  return (
    <span className="rel-dots" style={{ color }}>
      {RELEVANCE_LEVELS.map((lvl) => (
        <span key={lvl} className={`rel-dot${lvl > level ? ' rel-dot-empty' : ''}`} />
      ))}
    </span>
  )
}

type SortBy = 'default' | 'grade' | 'thema' | 'favorites' | 'sequence'
type ViewMode = 'cards' | 'list'

// Real feedback fba146fa (Susan, 2026-10-02): the curriculum-order info
// ("Davor"/"Danach") shouldn't live on the Lernziel card at all -- she wants
// it as a sort option instead. The real data behind it (lpm_connections,
// 'accepted' status) is a sparse, curriculum-asserted graph, not a single
// field to sort by: checked live against the real Thuringia data before
// building this (306 topics, 373 accepted connections, 272 topics touched by
// at least one, 52 connections crossing a Thema boundary) -- common enough to
// be worth a real topological sort across the whole filtered list (not just
// within one Thema), rare enough on the cross-Thema edges that restricting
// to one Thema at a time would silently drop real curriculum sequencing.
// Kahn's algorithm, stably tie-broken by each topic's current position (so a
// topic with no connection info at all stays near its original place instead
// of being pushed to one end) -- a real cycle in asserted data shouldn't
// happen, but falls back to original order for whatever's left rather than
// dropping topics if it ever does.
function sortByCurriculumOrder(items: TopicListItem[], connections: { from_object_id: string; to_object_id: string }[]): TopicListItem[] {
  const idToIndex = new Map(items.map((t, i) => [t.id, i]))
  const indegree = new Map(items.map((t) => [t.id, 0]))
  const outEdges = new Map<string, string[]>(items.map((t) => [t.id, []]))
  for (const c of connections) {
    if (!idToIndex.has(c.from_object_id) || !idToIndex.has(c.to_object_id)) continue
    outEdges.get(c.from_object_id)!.push(c.to_object_id)
    indegree.set(c.to_object_id, (indegree.get(c.to_object_id) ?? 0) + 1)
  }
  const remaining = new Set(items.map((t) => t.id))
  const result: TopicListItem[] = []
  while (remaining.size > 0) {
    let bestId: string | null = null
    let bestIdx = Infinity
    for (const id of remaining) {
      if ((indegree.get(id) ?? 0) === 0) {
        const idx = idToIndex.get(id)!
        if (idx < bestIdx) { bestIdx = idx; bestId = id }
      }
    }
    if (bestId === null) {
      bestId = Array.from(remaining).sort((a, b) => idToIndex.get(a)! - idToIndex.get(b)!)[0]
    }
    result.push(items[idToIndex.get(bestId)!])
    remaining.delete(bestId)
    for (const next of outEdges.get(bestId) ?? []) {
      if (remaining.has(next)) indegree.set(next, (indegree.get(next) ?? 0) - 1)
    }
  }
  return result
}

// Real feedback 2026-10-01 (Susan): the space above the card grid was just
// empty -- EvoMentor DE v1.2 has sorting, a list/card view toggle, expand/
// collapse-all, and export (JSON/CSV/Markdown/print), modeled directly on
// its own real `EM.openExportModal`/`toCsv`/`toMarkdownPlan` -- same four
// formats, same "export respects the current filter, favorites get called
// out in the Markdown plan" behavior, re-expressed against OpenLPM's own
// real field names since there's no shared module to import from.
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportLernzieleJson(list: TopicListItem[], contentById: Map<string, unknown>, favorites: Set<string>) {
  const payload = {
    exportiert: new Date().toISOString(),
    anzahl: list.length,
    lernziele: list.map((t) => ({ ...t, favorit: favorites.has(t.id), content: contentById.get(t.id) ?? null })),
  }
  downloadFile('lernziele_export.json', JSON.stringify(payload, null, 2), 'application/json')
}

function exportLernzieleCsv(list: TopicListItem[], contentById: Map<string, unknown>, favorites: Set<string>, bkLabels: Record<string, string>) {
  const header = ['id', 'klassenstufe', 'thema', 'unterthema', 'titel', 'beschreibung', 'basiskonzepte', 'favorit']
  const rows = [header.join(';')]
  for (const t of list) {
    const bks = bkEntries(contentById.get(t.id)).map((e) => bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id)
    rows.push(
      [t.id, t.grade_band ?? '', t.thema ?? '', t.unterthema ?? '', t.title, t.description ?? '', bks.join('|'), favorites.has(t.id) ? 'ja' : 'nein']
        .map(csvEscape)
        .join(';')
    )
  }
  downloadFile('lernziele_export.csv', rows.join('\r\n'), 'text/csv')
}

function exportLernzieleMarkdown(list: TopicListItem[], contentById: Map<string, unknown>, favorites: Set<string>, bkLabels: Record<string, string>) {
  const favs = list.filter((t) => favorites.has(t.id))
  const useList = favs.length ? favs : list
  const byThema = new Map<string, TopicListItem[]>()
  for (const t of useList) {
    const key = t.thema ?? 'Ohne Thema'
    if (!byThema.has(key)) byThema.set(key, [])
    byThema.get(key)!.push(t)
  }
  let md = `# Lernziele-Export\n\n_Erstellt: ${new Date().toLocaleString('de-DE')}_\n\n`
  if (favs.length) md += `> Nur Favoriten (${favs.length} von ${list.length} Lernzielen im aktuellen Filter)\n\n`
  for (const [thema, items] of byThema) {
    md += `## ${thema}\n\n`
    for (const t of items) {
      md += `### Kl. ${t.grade_band ?? '?'} — ${t.title}\n\n`
      if (t.description) md += `${t.description}\n\n`
      for (const e of bkEntries(contentById.get(t.id))) {
        md += `**${bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id}** (Relevanz ${e.relevanz_beurteilung}/3): ${e.begruendung}\n\n`
      }
      const ds = (contentById.get(t.id) as any)?.didaktische_strategien
      if (ds?.evolutionsdidaktischer_impuls) md += `**Leitfrage:** ${ds.evolutionsdidaktischer_impuls}\n\n`
      md += `---\n\n`
    }
  }
  downloadFile('lernziele_export.md', md, 'text/markdown')
}

export default function StudentLernzielePage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { objectId } = useParams<{ objectId?: string }>()
  const navigate = useNavigate()

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [contentById, setContentById] = useState<Map<string, unknown>>(new Map())
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<Set<string>>(new Set())
  const [themaFilter, setThemaFilter] = useState('')
  const [unterthemaFilter, setUnterthemaFilter] = useState('')
  // rootId -> set of selected relevance levels (1/2/3). A concept with no
  // entry here doesn't constrain the result at all -- same as the old
  // presence-only checkbox being unchecked.
  const [conceptLevels, setConceptLevels] = useState<Map<string, Set<number>>>(new Map())
  // Real feedback 2026-10-01 (Susan): "add option to filter by/select-
  // deselect didactic methods (which should be coded in the knowledge
  // graph)" -- they already are (content.didaktische_strategien.
  // top3_methoden[].methode, present on 302 of 306 real Lernziele), just
  // never exposed as a filter. Empty set = no constraint, same convention
  // as conceptLevels above.
  const [methodFilter, setMethodFilter] = useState<Set<string>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])
  // Every schema element (root Basiskonzepte AND their real sub-concepts),
  // keyed by id -- resolves relevante_unterkonzepte_taxonomie[].
  // taxonomyElementId to its real label+definition+example for display.
  const [conceptElementsById, setConceptElementsById] = useState<Map<string, SchemaElement>>(new Map())
  // Replaces the old objectId-driven side drawer (real bug, feedback
  // 2026-10-01: changing Klassenstufe left a mismatched drawer stuck open).
  // Expand state now lives here, keyed by topic id, decoupled from the URL --
  // a card that's no longer in `filtered` just doesn't render, instead of a
  // separate panel staying stuck on screen referencing it.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('default')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  // Real, curriculum-asserted Davor/Danach edges -- fetched once per project,
  // same bulk-query reasoning as listTopicContents below. Only used for the
  // 'sequence' sort option now (feedback fba146fa); no longer rendered on
  // the card itself.
  const [connections, setConnections] = useState<{ from_object_id: string; to_object_id: string }[]>([])
  // The real, live method vocabulary -- see METHOD_ICON's own comment above.
  // Empty until the project's prompt library resolves; the filter falls
  // back to whatever methods are actually tagged in the real data below.
  const [libraryMethods, setLibraryMethods] = useState<string[]>([])

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listFavoriteIds(supabase).then(setFavorites)
    getRootConcepts(supabase, project).then(setRootConcepts)
    getConceptElementsById(supabase, project).then(setConceptElementsById)
    listAcceptedConnections(supabase, project.id).then(setConnections)
    getLibraryForProject(supabase, project).then((lib) => setLibraryMethods(lib ? resolveOptionLists(lib.option_lists).methods : []))
  }, [supabase, project.id, defaultBranchId])

  // The list view deliberately doesn't carry `content` (300+ rows), but
  // per-concept relevance dots need it -- one bulk query for every topic's
  // content, not one request per card (305 individual round trips was the
  // first real version of this, confirmed live as a genuine, needless
  // slowdown before this fix).
  useEffect(() => {
    listTopicContents(supabase, project.id).then(setContentById)
  }, [supabase, project.id])

  // A deep link from elsewhere (e.g. tapping a Lernziel node in the
  // Basiskonzepte Netz graph) still lands on /dashboard/{slug}/{objectId} --
  // auto-expand that card and scroll to it, instead of the old side drawer.
  useEffect(() => {
    if (!objectId || !topics) return
    setExpandedIds((prev) => (prev.has(objectId) ? prev : new Set(prev).add(objectId)))
    const raf = requestAnimationFrame(() => {
      document.getElementById(`lz-card-${objectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(raf)
  }, [objectId, topics])

  const allBkIds = useMemo(() => {
    const ids = new Set<string>()
    for (const content of contentById.values()) for (const e of bkEntries(content)) ids.add(e.basiskonzept_id)
    return Array.from(ids)
  }, [contentById])
  const methodOptions = useMemo(() => {
    if (libraryMethods.length > 0) return libraryMethods
    const ids = new Set<string>()
    for (const content of contentById.values()) {
      for (const m of (content as any)?.didaktische_strategien?.top3_methoden ?? []) {
        if (m?.methode) ids.add(m.methode)
      }
    }
    return Array.from(ids).sort()
  }, [libraryMethods, contentById])
  const bkLabels = useMemo(() => buildBkLabelMap(allBkIds, rootConcepts), [allBkIds, rootConcepts])
  // Real bug found live 2026-09-30, reported with a screenshot: the real
  // Thuringia data has more than one raw id spelling for the same
  // Basiskonzept (see groupBkIdsByRoot's own comment) -- rendering one
  // filter checkbox per raw id showed "Evolutive Entwicklung" twice, in two
  // different colors. The filter itself now operates on the resolved root
  // concept, not the raw string, so ticking one box catches a Lernziel
  // regardless of which raw id spelling its own entry happens to use.
  const bkGroups = useMemo(() => groupBkIdsByRoot(allBkIds, rootConcepts), [allBkIds, rootConcepts])
  const rawIdToGroupKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of bkGroups) for (const rawId of g.rawIds) map.set(rawId, g.rootId)
    return map
  }, [bkGroups])
  const rootIdxById = useMemo(() => {
    const map = new Map<string, number>()
    rootConcepts.forEach((c, i) => map.set(c.id, i))
    return map
  }, [rootConcepts])

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  const gradeBands = useMemo(() => {
    const byKey = new Map<string, Set<string>>()
    for (const g of grades) {
      const key = bandKeyForGrade(g)
      if (!byKey.has(key)) byKey.set(key, new Set())
      byKey.get(key)!.add(g)
    }
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(byKey.entries())
      .map(([key, rawGrades]) => ({ key, rawGrades }))
      .sort((a, b) => leadingNumber(a.key) - leadingNumber(b.key))
  }, [grades])

  const selectedRawGrades = useMemo(() => {
    const set = new Set<string>()
    for (const b of gradeBands) if (gradeFilter.has(b.key)) for (const g of b.rawGrades) set.add(g)
    return set
  }, [gradeBands, gradeFilter])

  const toggleGradeBand = (key: string) => {
    setGradeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setThemaFilter('')
    setUnterthemaFilter('')
  }

  // Thema options narrow to the currently-picked grade band(s) (if any);
  // Unterthema options narrow further to the currently-picked Thema -- each
  // level only ever offers choices that can actually return something. Same
  // cascading pattern as the Prompt Generator's own Thema/Unterthema
  // narrowing (student-prompt-page.tsx), added here per the same real
  // feedback item (2026-10-01): this page never got it the first time.
  const themen = useMemo(() => {
    const relevant = (topics ?? []).filter((t) => selectedRawGrades.size === 0 || selectedRawGrades.has(t.grade_band ?? ''))
    return Array.from(new Set(relevant.map((t) => t.thema).filter(Boolean) as string[])).sort()
  }, [topics, selectedRawGrades])

  const unterthemen = useMemo(() => {
    if (!themaFilter) return []
    const relevant = (topics ?? []).filter(
      (t) => (selectedRawGrades.size === 0 || selectedRawGrades.has(t.grade_band ?? '')) && t.thema === themaFilter
    )
    return Array.from(new Set(relevant.map((t) => t.unterthema).filter(Boolean) as string[])).sort()
  }, [topics, selectedRawGrades, themaFilter])

  const filtered = useMemo(() => {
    if (!topics) return []
    const q = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (selectedRawGrades.size > 0 && !selectedRawGrades.has(t.grade_band ?? '')) return false
      if (themaFilter && t.thema !== themaFilter) return false
      if (unterthemaFilter && t.unterthema !== unterthemaFilter) return false
      if (favoritesOnly && !favorites.has(t.id)) return false
      if (conceptLevels.size > 0) {
        const entries = bkEntries(contentById.get(t.id))
        const passes = entries.some((e) => {
          const rootKey = rawIdToGroupKey.get(e.basiskonzept_id) ?? e.basiskonzept_id
          const levels = conceptLevels.get(rootKey)
          return levels && levels.has(e.relevanz_beurteilung)
        })
        if (!passes) return false
      }
      if (methodFilter.size > 0) {
        const methoden: string[] = ((contentById.get(t.id) as any)?.didaktische_strategien?.top3_methoden ?? []).map((m: any) => m?.methode)
        if (!methoden.some((m) => methodFilter.has(m))) return false
      }
      if (!q) return true
      return t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
    })
  }, [topics, query, selectedRawGrades, themaFilter, unterthemaFilter, favoritesOnly, favorites, conceptLevels, methodFilter, contentById, rawIdToGroupKey])

  // A deep link (Davor/Danach, or a Netz-tab tap) can point at a Lernziel
  // the current filters would otherwise hide (different grade, excluded
  // concept, etc.) -- the old side drawer always worked regardless of the
  // grid's own filters since it was a separate panel; keep that same
  // guarantee here by unioning the linked-to topic into what's displayed,
  // without silently resetting the filters the student actually chose.
  const deepLinkedTopic = useMemo(() => (objectId ? (topics ?? []).find((t) => t.id === objectId) ?? null : null), [objectId, topics])
  const displayed = useMemo(() => {
    if (deepLinkedTopic && !filtered.some((t) => t.id === deepLinkedTopic.id)) return [deepLinkedTopic, ...filtered]
    return filtered
  }, [filtered, deepLinkedTopic])

  const sortedDisplayed = useMemo(() => {
    if (sortBy === 'default') return displayed
    const arr = [...displayed]
    if (sortBy === 'grade') arr.sort((a, b) => (parseInt(a.grade_band ?? '', 10) || 0) - (parseInt(b.grade_band ?? '', 10) || 0))
    else if (sortBy === 'thema') arr.sort((a, b) => (a.thema ?? '').localeCompare(b.thema ?? '', 'de'))
    else if (sortBy === 'favorites') arr.sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)))
    else if (sortBy === 'sequence') return sortByCurriculumOrder(arr, connections)
    return arr
  }, [displayed, sortBy, favorites, connections])

  const allExpanded = sortedDisplayed.length > 0 && sortedDisplayed.every((t) => expandedIds.has(t.id))
  const toggleExpandAll = () => setExpandedIds(allExpanded ? new Set() : new Set(sortedDisplayed.map((t) => t.id)))

  const toggleConceptAll = (rootId: string) => {
    setConceptLevels((prev) => {
      const next = new Map(prev)
      if (next.has(rootId)) next.delete(rootId)
      else next.set(rootId, new Set(RELEVANCE_LEVELS))
      return next
    })
  }

  const toggleConceptLevel = (rootId: string, level: number) => {
    setConceptLevels((prev) => {
      const next = new Map(prev)
      const current = new Set(next.get(rootId) ?? [])
      if (current.has(level)) current.delete(level)
      else current.add(level)
      if (current.size === 0) next.delete(rootId)
      else next.set(rootId, current)
      return next
    })
  }

  const toggleMethod = (methode: string) => {
    setMethodFilter((prev) => {
      const next = new Set(prev)
      if (next.has(methode)) next.delete(methode)
      else next.add(methode)
      return next
    })
  }

  const onToggleFavorite = async (id: string) => {
    const isFav = favorites.has(id)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(id)
      else next.add(id)
      return next
    })
    await toggleFavorite(supabase, id, isFav)
  }

  const onToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="student-page">
      <h1>Lernziele</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        {topics === null ? 'Lädt…' : `${filtered.length} von ${topics.length} Lernzielen`}
      </p>

      <div className="student-lernziele-layout">
        <aside className="student-filters">
          <div className="field">
            <div className="row"><Search size={14} style={{ color: 'var(--text-muted)' }} /><input type="search" placeholder="Suchen…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>

          <p className="muted student-filter-label">KLASSENSTUFE</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <button className={`chip-btn${gradeFilter.size === 0 ? ' active' : ''}`} onClick={() => { setGradeFilter(new Set()); setThemaFilter(''); setUnterthemaFilter('') }}>Alle</button>
            {gradeBands.map((b) => (
              <button key={b.key} className={`chip-btn${gradeFilter.has(b.key) ? ' active' : ''}`} onClick={() => toggleGradeBand(b.key)}>{gradeChipLabel(b.key)}</button>
            ))}
          </div>

          {themen.length > 0 && (
            <div className="field" style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11 }}>Thema</label>
              <select value={themaFilter} onChange={(e) => { setThemaFilter(e.target.value); setUnterthemaFilter('') }}>
                <option value="">Alle Themen</option>
                {themen.map((th) => <option key={th} value={th}>{th}</option>)}
              </select>
            </div>
          )}
          {themaFilter && unterthemen.length > 0 && (
            <div className="field">
              <label style={{ fontSize: 11 }}>Unterthema</label>
              <select value={unterthemaFilter} onChange={(e) => setUnterthemaFilter(e.target.value)}>
                <option value="">Alle Unterthemen</option>
                {unterthemen.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}

          <p className="muted student-filter-label">BASISKONZEPTE &amp; RELEVANZ</p>
          <div className="student-concept-filter">
            {bkGroups.map((g) => {
              // Color by the concept's own real position among rootConcepts
              // (same order used everywhere else it's colored -- Dashboard,
              // Detail, Netz), not by this deduped list's own order -- the
              // other real bug in the same screenshot report: the two
              // duplicate rows for "Evolutive Entwicklung" showed up in two
              // DIFFERENT colors, because color used to be assigned by
              // position in an arbitrary, insertion-ordered raw-id list.
              const rootIdx = rootConcepts.findIndex((r) => r.id === g.rootId)
              const activeLevels = conceptLevels.get(g.rootId)
              return (
                <div key={g.rootId} style={{ marginBottom: 6 }}>
                  {/* Real bug found live 2026-09-30: the longest German label
                      ("Information und Kommunikation") doesn't fit this narrow
                      sidebar on one line, and `.row`'s own `flex-wrap: wrap`
                      (globals.css) wraps the WHOLE flex row rather than just the
                      text -- the checkbox+dot end up on their own line with an
                      orphaned, unindented label line below. `nowrap` + top-
                      aligned items keeps the checkbox/dot fixed while the label
                      itself wraps internally, staying visually attached to them. */}
                  <label
                    className="row"
                    style={{ gap: 6, fontSize: 12.5, cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}
                  >
                    <input type="checkbox" checked={!!activeLevels} onChange={() => toggleConceptAll(g.rootId)} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span className={`bk-dot bk-dot-${rootIdx >= 0 ? rootIdx % 6 : 0}`} style={{ flexShrink: 0, marginTop: 4 }} />
                    <span style={{ minWidth: 0 }}>{g.label}</span>
                  </label>
                  {/* Real feedback 2026-10-01: a plain presence checkbox
                      wasn't enough -- Susan wanted to narrow by relevance
                      tier (niedrig/mittel/hoch), and have it actually filter.
                      Ticking the main checkbox above defaults to all three
                      levels; these let a level be excluded without dropping
                      the concept entirely. */}
                  {activeLevels && (
                    <div className="row" style={{ gap: 5, marginLeft: 21, marginTop: 3, alignItems: 'center' }}>
                      <span className="muted" style={{ fontSize: 10 }}>Relevanz:</span>
                      {RELEVANCE_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          className={`chip-btn${activeLevels.has(lvl) ? ' active' : ''}`}
                          style={{ padding: '1px 7px', fontSize: 10.5 }}
                          title={RELEVANCE_LEVEL_LABEL[lvl]}
                          onClick={() => toggleConceptLevel(g.rootId, lvl)}
                        >
                          <RelevanceDots level={lvl} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="muted student-filter-label">DIDAKTISCHE METHODEN</p>
          <div className="student-concept-filter">
            {methodOptions.map((m) => (
              <label key={m} className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer', marginBottom: 3 }}>
                <input type="checkbox" checked={methodFilter.has(m)} onChange={() => toggleMethod(m)} />
                <span aria-hidden="true">{METHOD_ICON[m] ?? DEFAULT_METHOD_ICON}</span>
                <span>{m}</span>
              </label>
            ))}
          </div>

          <label className="row" style={{ gap: 6, fontSize: 12.5, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
            <Star size={13} />nur Favoriten
          </label>
        </aside>

        <div className="student-lernziele-main" style={{ flexDirection: 'column' }}>
          {objectId && (
            <button
              className="btn btn-mini"
              style={{ alignSelf: 'flex-start', marginBottom: 10 }}
              onClick={() => { setExpandedIds(new Set()); navigate(`/dashboard/${project.slug}`) }}
            >
              ← Zurück zur vollständigen Übersicht
            </button>
          )}
          <div className="student-toolbar">
            <div className="student-toolbar-group">
              <label className="muted" style={{ fontSize: 11.5 }}>Sortieren:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} style={{ fontSize: 12.5 }}>
                <option value="default">Standard</option>
                <option value="grade">Klassenstufe</option>
                <option value="thema">Thema</option>
                <option value="favorites">Favoriten zuerst</option>
                <option value="sequence">Reihenfolge im Lehrplan</option>
              </select>
              <button className={`chip-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}>
                {viewMode === 'cards' ? 'Listenansicht' : 'Kartenansicht'}
              </button>
              <button className="chip-btn" onClick={toggleExpandAll} disabled={sortedDisplayed.length === 0}>
                {allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
              </button>
            </div>
            <div className="student-toolbar-group">
              <span className="muted" style={{ fontSize: 11.5 }}>Export:</span>
              <button className="btn btn-mini" onClick={() => exportLernzieleJson(sortedDisplayed, contentById, favorites)} disabled={sortedDisplayed.length === 0}>JSON</button>
              <button className="btn btn-mini" onClick={() => exportLernzieleCsv(sortedDisplayed, contentById, favorites, bkLabels)} disabled={sortedDisplayed.length === 0}>CSV</button>
              <button className="btn btn-mini" onClick={() => exportLernzieleMarkdown(sortedDisplayed, contentById, favorites, bkLabels)} disabled={sortedDisplayed.length === 0}>Markdown</button>
              <button className="btn btn-mini" onClick={() => window.print()} disabled={sortedDisplayed.length === 0}>Drucken / PDF</button>
            </div>
          </div>

          <div className={viewMode === 'cards' ? 'topic-card-grid' : 'topic-list-rows'}>
            {topics === null ? (
              <p className="muted">Lädt…</p>
            ) : sortedDisplayed.length === 0 ? (
              <div className="card empty">
                <Compass size={28} />
                <p>Keine Lernziele gefunden.</p>
              </div>
            ) : (
              sortedDisplayed.map((t) => (
                <LernzielCard
                  key={t.id}
                  topic={t}
                  content={contentById.get(t.id)}
                  entries={bkEntries(contentById.get(t.id))}
                  bkLabels={bkLabels}
                  rootIdxById={rootIdxById}
                  rawIdToGroupKey={rawIdToGroupKey}
                  conceptElementsById={conceptElementsById}
                  isFavorite={favorites.has(t.id)}
                  onToggleFavorite={onToggleFavorite}
                  isExpanded={expandedIds.has(t.id)}
                  onToggleExpand={onToggleExpand}
                  supabase={supabase}
                  compact={viewMode === 'list'}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LernzielCard({
  topic,
  content,
  entries,
  bkLabels,
  rootIdxById,
  rawIdToGroupKey,
  conceptElementsById,
  isFavorite,
  onToggleFavorite,
  isExpanded,
  onToggleExpand,
  supabase,
  compact,
}: {
  topic: TopicListItem
  content: unknown
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
  conceptElementsById: Map<string, SchemaElement>
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  supabase: ProjectOutletContext['supabase']
  compact: boolean
}) {
  // Real feedback 2026-10-01 (Susan): "view does not switch back to card
  // view" -- the real cause was that Listenansicht and Kartenansicht
  // rendered the exact same markup for a collapsed Lernziel (full
  // description + relevance chips either way), just in one column instead
  // of a grid, so toggling the button had no visible effect a student could
  // notice. A COLLAPSED row in list mode now actually renders as a compact
  // single line (grade chip, title, favorite star) -- an EXPANDED card
  // still shows full detail either way, since the detail itself isn't
  // something "list mode" should hide.
  if (compact && !isExpanded) {
    return (
      <div
        id={`lz-card-${topic.id}`}
        key={topic.id}
        className="card topic-card topic-row-compact"
        onClick={() => onToggleExpand(topic.id)}
      >
        <span className="chip">{gradeChipLabel(topic.grade_band ?? '?')}</span>
        <strong style={{ flex: 1, minWidth: 0 }}>{topic.title}</strong>
        <button
          className="btn-linklike"
          aria-label="Favorit"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(topic.id) }}
        >
          <Star size={15} fill={isFavorite ? 'var(--series-a, gold)' : 'none'} />
        </button>
      </div>
    )
  }

  return (
    <div
      id={`lz-card-${topic.id}`}
      key={topic.id}
      className={`card topic-card${isExpanded ? ' active' : ''}`}
      style={{ gridColumn: isExpanded && !compact ? '1 / -1' : undefined }}
      onClick={() => onToggleExpand(topic.id)}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          <span className="chip">{gradeChipLabel(topic.grade_band ?? '?')}</span>
          {/* Real feedback fd88f0cd (Susan, 2026-10-02): "the listing of
              topic - subtopic fits better above the learning goal title,
              next to the grade, and maybe highlight the topic-subtopic some
              more, e.g. by colored tag" -- moved out of the plain muted line
              below the title into a colored chip next to the grade chip. */}
          {(topic.thema || topic.unterthema) && (
            <span className="chip chip-thema" title={[topic.thema, topic.unterthema].filter(Boolean).join(' › ')}>
              {[topic.thema, topic.unterthema].filter(Boolean).join(' › ')}
            </span>
          )}
        </div>
        <button
          className="btn-linklike"
          aria-label="Favorit"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(topic.id) }}
        >
          <Star size={16} fill={isFavorite ? 'var(--series-a, gold)' : 'none'} />
        </button>
      </div>
      <strong style={{ display: 'block', marginTop: 6 }}>{topic.title}</strong>
      {topic.description && <p className="muted" style={{ fontSize: 12.5 }}>{topic.description}</p>}
      {entries.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {entries.map((e) => {
            const rootKey = rawIdToGroupKey.get(e.basiskonzept_id) ?? e.basiskonzept_id
            const rootIdx = rootIdxById.get(rootKey)
            return (
              <span key={e.basiskonzept_id} className="row" style={{ gap: 3, fontSize: 11 }} title={bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id}>
                {bkAbbreviation(bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id)}
                <RelevanceDots level={e.relevanz_beurteilung} color={rootIdx !== undefined ? `var(--map-${(rootIdx % 6) + 1})` : undefined} />
              </span>
            )
          })}
        </div>
      )}

      {isExpanded && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <LernzielCardDetail objectId={topic.id} content={content} supabase={supabase} entries={entries} bkLabels={bkLabels} rootIdxById={rootIdxById} rawIdToGroupKey={rawIdToGroupKey} conceptElementsById={conceptElementsById} />
        </div>
      )}
    </div>
  )
}

function LernzielCardDetail({
  objectId,
  content,
  supabase,
  entries,
  bkLabels,
  rootIdxById,
  rawIdToGroupKey,
  conceptElementsById,
}: {
  objectId: string
  content: unknown
  supabase: ProjectOutletContext['supabase']
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
  conceptElementsById: Map<string, SchemaElement>
}) {
  const [stations, setStations] = useState<ThreadStationWithThread[] | null>(null)

  // Fetched once per expand (this component only mounts while the card is
  // expanded) -- no separate re-fetch-on-filter-change logic needed, unlike
  // the old URL-objectId-driven drawer.
  useEffect(() => {
    getThreadStationsForTopic(supabase, objectId).then(setStations)
  }, [supabase, objectId])

  return (
    <div>
      <BkRelevanceSection entries={entries} bkLabels={bkLabels} rootIdxById={rootIdxById} rawIdToGroupKey={rawIdToGroupKey} conceptElementsById={conceptElementsById} />

      <DidaktischeStrategienSection content={content} />

      {stations && stations.length > 0 && stations.map((s) => <StudentThreadCard key={s.id} station={s} supabase={supabase} />)}

      {stations?.length === 0 && entries.length === 0 && (
        <p className="muted">Noch keine erfassten Verbindungen für dieses Lernziel.</p>
      )}
    </div>
  )
}

// Real feedback 2026-10-01 (Susan): wanted a "Didaktische Strategien"
// section, collapsible like the Basiskonzept-Bezüge one above it, with an
// example guiding question (Leitfrage), 3 method suggestions, and possible
// student misconceptions -- as in EvoMentor DE v1.2. The underlying field
// (content.didaktische_strategien) already exists and is already read by
// the AI Prompt Generator (prompt-builder.tsx) -- this just surfaces the
// same real content here. Read defensively: not every imported Lernziel
// has this field populated, same discipline as prompt-builder.tsx's own
// comment about didaktische_strategien/originaltext.
function DidaktischeStrategienSection({ content }: { content: unknown }) {
  const [open, setOpen] = useState(false)
  const ds = (content as any)?.didaktische_strategien
  if (!ds) return null
  // Real feedback 2026-10-01 (Susan), 2nd pass: "you should expand on each
  // method... each method should be highlighted on a different line,
  // possibly with an icon" -- this was previously dropping the real
  // per-method `beschreibung` text entirely (present on 302 of 306 real
  // Thuringia Lernziele, already imported, same shape as EvoMentor DE
  // v1.2's own top3_methoden -- this isn't new content to source, just
  // data this view was throwing away). Matches v1.2's own real layout:
  // icon + bold method name + em dash + its topic-specific description,
  // one per line.
  const methoden = (ds.top3_methoden ?? []).filter((m: any) => m?.methode)
  return (
    <section style={{ marginBottom: 18 }}>
      <button className="btn btn-mini" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? 'Didaktische Strategien ausblenden' : 'Didaktische Strategien anzeigen'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {ds.evolutionsdidaktischer_impuls && (
            <p style={{ margin: '0 0 8px' }}><strong>Leitfrage:</strong> {ds.evolutionsdidaktischer_impuls}</p>
          )}
          {methoden.length > 0 && (
            <div style={{ margin: '0 0 8px' }}>
              <strong>Methoden:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                {methoden.map((m: any, i: number) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
                    <span aria-hidden="true">{METHOD_ICON[m.methode] ?? '•'}</span>
                    <span><strong>{m.methode}</strong>{m.beschreibung ? <> — {m.beschreibung}</> : null}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ds.moegliche_fehlvorstellungen && (
            <p style={{ margin: 0 }}><strong>Mögliche Fehlvorstellungen:</strong> {ds.moegliche_fehlvorstellungen}</p>
          )}
        </div>
      )}
    </section>
  )
}

// Real feedback 2026-10-01 (Susan, previewing as a student): the relevance
// justification for each Basiskonzept (content.basiskonzeptbezug[].
// begruendung -- real, already-imported content, the same field the
// researcher Concepts page and the AI prompt builder already read) wasn't
// shown anywhere in the student view. She asked for it inside a collapsible
// section on the Lernziel card itself, not a separate page.
function BkRelevanceSection({
  entries,
  bkLabels,
  rootIdxById,
  rawIdToGroupKey,
  conceptElementsById,
}: {
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
  conceptElementsById: Map<string, SchemaElement>
}) {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) return null
  return (
    <section style={{ marginBottom: 18 }}>
      <button className="btn btn-mini" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? 'Basiskonzept-Bezüge ausblenden' : 'Basiskonzept-Bezüge anzeigen'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {entries.map((e) => {
            const rootKey = rawIdToGroupKey.get(e.basiskonzept_id) ?? e.basiskonzept_id
            const rootIdx = rootIdxById.get(rootKey)
            // Real feedback 2026-10-01 (Dustin, after checking the real
            // Basiskonzepte data against a richer EvoMentor_DE taxonomy):
            // this is where the SPECIFIC sub-concept each Lernziel is
            // tagged against belongs -- a Lernziel can genuinely relate to
            // "Multilevel-Selektion" generally, but what it's REALLY about
            // is the one specific sub-concept ("Evolution von Einzellern
            // zu Vielzellern") tagged at authoring time. Those tags
            // (relevante_unterkonzepte_taxonomie/
            // relevante_evolutionskonzepte_taxonomie) were broken for
            // nearly all real Lernziele until migrations 059/060 -- a
            // sub-concept chip below that shows nothing resolved means
            // those migrations haven't been applied to this database yet.
            const subTags = [...(e.relevante_unterkonzepte_taxonomie ?? []), ...(e.relevante_evolutionskonzepte_taxonomie ?? [])]
            return (
              <div key={e.basiskonzept_id} style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="bk-dot" style={{ background: rootIdx !== undefined ? `var(--map-${(rootIdx % 6) + 1})` : undefined }} />
                  <strong style={{ fontSize: 13 }}>{bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id}</strong>
                  <RelevanceDots level={e.relevanz_beurteilung} color={rootIdx !== undefined ? `var(--map-${(rootIdx % 6) + 1})` : undefined} />
                </div>
                {e.begruendung && <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{e.begruendung}</p>}
                {subTags.length > 0 && (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {subTags.map((tag, i) => (
                      <SubConceptChip key={`${tag.taxonomyElementId ?? tag.value}-${i}`} tag={tag} element={tag.taxonomyElementId ? conceptElementsById.get(tag.taxonomyElementId) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// A small, independently-toggleable chip for ONE specific sub-concept tag
// (e.g. "Evolution von Einzellern zu Vielzellern") -- shows just the label
// by default, expands in place to the real definition + worked example
// from the source taxonomy (migration 059). `element` is undefined when
// the tag's own taxonomyElementId doesn't resolve (migrations 059/060 not
// applied yet, or a genuinely unresolvable tag) -- falls back to the
// tag's own preserved text rather than showing nothing, since that text
// is real content either way.
function SubConceptChip({ tag, element }: { tag: { value: string; taxonomyElementId: string | null }; element: SchemaElement | undefined }) {
  const [open, setOpen] = useState(false)
  const beispiel = (element?.metadata as any)?.beispiel as string | undefined
  const hasDetail = !!(element?.definition || beispiel)
  return (
    <div style={{ maxWidth: '100%' }}>
      <button
        className={`chip-btn${open ? ' active' : ''}`}
        style={{ fontSize: 11, padding: '2px 8px', cursor: hasDetail ? 'pointer' : 'default' }}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        {element?.label ?? tag.value}
      </button>
      {open && hasDetail && (
        <div style={{ fontSize: 12, margin: '4px 0 2px', padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 6, maxWidth: 420 }}>
          {element?.definition && <p style={{ margin: 0 }}>{element.definition}</p>}
          {beispiel && <p className="muted" style={{ margin: '4px 0 0' }}><em>Beispiel:</em> {beispiel}</p>}
        </div>
      )}
    </div>
  )
}

function StudentThreadCard({ station, supabase }: { station: ThreadStationWithThread; supabase: ProjectOutletContext['supabase'] }) {
  const [expanded, setExpanded] = useState(false)
  const [full, setFull] = useState<FullThread | null>(null)
  const hubLabel = station.thread.explained_by?.label ?? null

  const toggle = async () => {
    if (!expanded && !full) setFull(await getFullThread(supabase, station.thread_id))
    setExpanded((v) => !v)
  }

  return (
    <div className="card conn-suggested" style={{ marginBottom: 10 }}>
      {hubLabel && <span className="muted" style={{ fontSize: 12 }}>Verbunden durch: {hubLabel}</span>}
      <h3 style={{ marginTop: 8, marginBottom: 4 }}>{station.thread.title}</h3>
      <p style={{ marginBottom: 8 }}>{station.role_note}</p>
      <button className="btn btn-mini" onClick={toggle}>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Erklärung ausblenden' : 'Warum hängt das zusammen?'}
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          <p><strong>Verbindende Idee:</strong> {station.thread.connecting_idea}</p>
          <p>{station.thread.narrative}</p>
          {full && (
            <ol className="thread-path">
              {full.stations.map((st) => (
                <li key={st.id} className="thread-station">
                  <strong>{st.object.title}</strong>
                  <p className="muted" style={{ margin: '2px 0 0' }}>{st.role_note}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
