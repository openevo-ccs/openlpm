import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Compass, Search, Star } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import {
  getAssertedConnections,
  getFullThread,
  getThreadStationsForTopic,
  listTopicContents,
  listTopics,
  type FullThread,
  type ResolvedConnection,
  type ThreadStationWithThread,
  type TopicListItem,
} from '@/lib/supabase/curriculum'
import { bkAbbreviation, bkEntries, buildBkLabelMap, getRootConcepts, groupBkIdsByRoot, type BkbEntry } from '@/lib/supabase/basiskonzepte'
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

export default function StudentLernzielePage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { objectId } = useParams<{ objectId?: string }>()

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
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])
  // Replaces the old objectId-driven side drawer (real bug, feedback
  // 2026-10-01: changing Klassenstufe left a mismatched drawer stuck open).
  // Expand state now lives here, keyed by topic id, decoupled from the URL --
  // a card that's no longer in `filtered` just doesn't render, instead of a
  // separate panel staying stuck on screen referencing it.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listFavoriteIds(supabase).then(setFavorites)
    getRootConcepts(supabase, project).then(setRootConcepts)
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
      if (!q) return true
      return t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
    })
  }, [topics, query, selectedRawGrades, themaFilter, unterthemaFilter, favoritesOnly, favorites, conceptLevels, contentById, rawIdToGroupKey])

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
                    <div className="row" style={{ gap: 3, marginLeft: 21, marginTop: 3 }}>
                      {RELEVANCE_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          className={`chip-btn${activeLevels.has(lvl) ? ' active' : ''}`}
                          style={{ padding: '1px 6px', fontSize: 10.5 }}
                          title={RELEVANCE_LEVEL_LABEL[lvl]}
                          onClick={() => toggleConceptLevel(g.rootId, lvl)}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <label className="row" style={{ gap: 6, fontSize: 12.5, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
            <Star size={13} />nur Favoriten
          </label>
        </aside>

        <div className="student-lernziele-main">
          <div className="topic-card-grid">
            {topics === null ? (
              <p className="muted">Lädt…</p>
            ) : displayed.length === 0 ? (
              <div className="card empty">
                <Compass size={28} />
                <p>Keine Lernziele gefunden.</p>
              </div>
            ) : (
              displayed.map((t) => (
                <LernzielCard
                  key={t.id}
                  topic={t}
                  entries={bkEntries(contentById.get(t.id))}
                  bkLabels={bkLabels}
                  rootIdxById={rootIdxById}
                  rawIdToGroupKey={rawIdToGroupKey}
                  isFavorite={favorites.has(t.id)}
                  onToggleFavorite={onToggleFavorite}
                  isExpanded={expandedIds.has(t.id)}
                  onToggleExpand={onToggleExpand}
                  projectSlug={project.slug}
                  supabase={supabase}
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
  entries,
  bkLabels,
  rootIdxById,
  rawIdToGroupKey,
  isFavorite,
  onToggleFavorite,
  isExpanded,
  onToggleExpand,
  projectSlug,
  supabase,
}: {
  topic: TopicListItem
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  projectSlug: string
  supabase: ProjectOutletContext['supabase']
}) {
  return (
    <div
      id={`lz-card-${topic.id}`}
      key={topic.id}
      className={`card topic-card${isExpanded ? ' active' : ''}`}
      style={{ gridColumn: isExpanded ? '1 / -1' : undefined }}
      onClick={() => onToggleExpand(topic.id)}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="chip">{gradeChipLabel(topic.grade_band ?? '?')}</span>
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
                <span style={{ letterSpacing: 1, color: rootIdx !== undefined ? `var(--map-${(rootIdx % 6) + 1})` : undefined }}>
                  {'●'.repeat(e.relevanz_beurteilung)}{'○'.repeat(3 - e.relevanz_beurteilung)}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {isExpanded && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <LernzielCardDetail objectId={topic.id} projectSlug={projectSlug} supabase={supabase} entries={entries} bkLabels={bkLabels} rootIdxById={rootIdxById} rawIdToGroupKey={rawIdToGroupKey} />
        </div>
      )}
    </div>
  )
}

function LernzielCardDetail({
  objectId,
  projectSlug,
  supabase,
  entries,
  bkLabels,
  rootIdxById,
  rawIdToGroupKey,
}: {
  objectId: string
  projectSlug: string
  supabase: ProjectOutletContext['supabase']
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
}) {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<ResolvedConnection[] | null>(null)
  const [stations, setStations] = useState<ThreadStationWithThread[] | null>(null)

  // Fetched once per expand (this component only mounts while the card is
  // expanded) -- no separate re-fetch-on-filter-change logic needed, unlike
  // the old URL-objectId-driven drawer.
  useEffect(() => {
    getAssertedConnections(supabase, objectId).then(setConnections)
    getThreadStationsForTopic(supabase, objectId).then(setStations)
  }, [supabase, objectId])

  const before = (connections ?? []).filter((c) => c.direction === 'incoming')
  const after = (connections ?? []).filter((c) => c.direction === 'outgoing')

  return (
    <div>
      <BkRelevanceSection entries={entries} bkLabels={bkLabels} rootIdxById={rootIdxById} rawIdToGroupKey={rawIdToGroupKey} />

      {(before.length > 0 || after.length > 0) && (
        <section style={{ marginBottom: 18 }}>
          <h3>Reihenfolge im Lehrplan</h3>
          <p className="muted" style={{ marginTop: -4 }}>So ordnet der Lehrplan selbst diese Lernziele an.</p>
          {before.map((c) => (
            <button key={c.connection.id} className="conn-line conn-asserted" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/dashboard/${projectSlug}/${c.other.id}`)}>
              <span className="muted" style={{ fontSize: 12 }}>Davor</span>
              <span className="row" style={{ justifyContent: 'space-between' }}><strong>{c.other.title}</strong><ArrowRight size={13} /></span>
            </button>
          ))}
          {after.map((c) => (
            <button key={c.connection.id} className="conn-line conn-asserted" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/dashboard/${projectSlug}/${c.other.id}`)}>
              <span className="muted" style={{ fontSize: 12 }}>Danach</span>
              <span className="row" style={{ justifyContent: 'space-between' }}><strong>{c.other.title}</strong><ArrowRight size={13} /></span>
            </button>
          ))}
        </section>
      )}

      {stations && stations.length > 0 && stations.map((s) => <StudentThreadCard key={s.id} station={s} supabase={supabase} />)}

      {connections?.length === 0 && stations?.length === 0 && entries.length === 0 && (
        <p className="muted">Noch keine erfassten Verbindungen für dieses Lernziel.</p>
      )}
    </div>
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
}: {
  entries: BkbEntry[]
  bkLabels: Record<string, string>
  rootIdxById: Map<string, number>
  rawIdToGroupKey: Map<string, string>
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
            return (
              <div key={e.basiskonzept_id} style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="bk-dot" style={{ background: rootIdx !== undefined ? `var(--map-${(rootIdx % 6) + 1})` : undefined }} />
                  <strong style={{ fontSize: 13 }}>{bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{'●'.repeat(e.relevanz_beurteilung)}{'○'.repeat(3 - e.relevanz_beurteilung)}</span>
                </div>
                {e.begruendung && <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{e.begruendung}</p>}
              </div>
            )
          })}
        </div>
      )}
    </section>
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
