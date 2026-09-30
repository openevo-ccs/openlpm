import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Compass, Search, Star } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import {
  getAssertedConnections,
  getFullThread,
  getThreadStationsForTopic,
  getTopic,
  listTopicContents,
  listTopics,
  type DataObjectRow,
  type FullThread,
  type ResolvedConnection,
  type ThreadStationWithThread,
  type TopicListItem,
} from '@/lib/supabase/curriculum'
import { bkAbbreviation, bkEntries, buildBkLabelMap, getRootConcepts, groupBkIdsByRoot } from '@/lib/supabase/basiskonzepte'
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

export default function StudentLernzielePage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { objectId } = useParams<{ objectId?: string }>()
  const navigate = useNavigate()

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [contentById, setContentById] = useState<Map<string, unknown>>(new Map())
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [conceptFilter, setConceptFilter] = useState<Set<string>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])

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

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  const filtered = useMemo(() => {
    if (!topics) return []
    const q = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (gradeFilter !== 'all' && t.grade_band !== gradeFilter) return false
      if (favoritesOnly && !favorites.has(t.id)) return false
      if (conceptFilter.size > 0) {
        const entries = bkEntries(contentById.get(t.id))
        if (!entries.some((e) => conceptFilter.has(rawIdToGroupKey.get(e.basiskonzept_id) ?? e.basiskonzept_id))) return false
      }
      if (!q) return true
      return t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
    })
  }, [topics, query, gradeFilter, favoritesOnly, favorites, conceptFilter, contentById, rawIdToGroupKey])

  const toggleConcept = (bkId: string) => {
    setConceptFilter((prev) => {
      const next = new Set(prev)
      if (next.has(bkId)) next.delete(bkId)
      else next.add(bkId)
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
            <button className={`chip-btn${gradeFilter === 'all' ? ' active' : ''}`} onClick={() => setGradeFilter('all')}>Alle</button>
            {grades.map((g) => (
              <button key={g} className={`chip-btn${gradeFilter === g ? ' active' : ''}`} onClick={() => setGradeFilter(g)}>{gradeChipLabel(g)}</button>
            ))}
          </div>

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
              return (
                // Real bug found live 2026-09-30: the longest German label
                // ("Information und Kommunikation") doesn't fit this narrow
                // sidebar on one line, and `.row`'s own `flex-wrap: wrap`
                // (globals.css) wraps the WHOLE flex row rather than just the
                // text -- the checkbox+dot end up on their own line with an
                // orphaned, unindented label line below. `nowrap` + top-
                // aligned items keeps the checkbox/dot fixed while the label
                // itself wraps internally, staying visually attached to them.
                <label
                  key={g.rootId}
                  className="row"
                  style={{ gap: 6, fontSize: 12.5, marginBottom: 4, cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}
                >
                  <input type="checkbox" checked={conceptFilter.has(g.rootId)} onChange={() => toggleConcept(g.rootId)} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span className={`bk-dot bk-dot-${rootIdx >= 0 ? rootIdx % 6 : 0}`} style={{ flexShrink: 0, marginTop: 4 }} />
                  <span style={{ minWidth: 0 }}>{g.label}</span>
                </label>
              )
            })}
          </div>

          <label className="row" style={{ gap: 6, fontSize: 12.5, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
            <Star size={13} />nur Favoriten
          </label>
        </aside>

        <div className="student-lernziele-main">
          <div className="student-card-grid">
            {topics === null ? (
              <p className="muted">Lädt…</p>
            ) : filtered.length === 0 ? (
              <div className="card empty">
                <Compass size={28} />
                <p>Keine Lernziele gefunden.</p>
              </div>
            ) : (
              filtered.map((t) => {
                const entries = bkEntries(contentById.get(t.id))
                return (
                  <div key={t.id} className="card student-lz-card" onClick={() => navigate(`/dashboard/${project.slug}/${t.id}`)}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="chip">{gradeChipLabel(t.grade_band ?? '?')}</span>
                      <button
                        className="btn-linklike"
                        aria-label="Favorit"
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(t.id) }}
                      >
                        <Star size={16} fill={favorites.has(t.id) ? 'var(--series-a, gold)' : 'none'} />
                      </button>
                    </div>
                    <strong style={{ display: 'block', marginTop: 6 }}>{t.title}</strong>
                    {t.description && <p className="muted" style={{ fontSize: 12.5 }}>{t.description}</p>}
                    {entries.length > 0 && (
                      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {entries.map((e) => (
                          <span key={e.basiskonzept_id} className="row" style={{ gap: 3, fontSize: 11 }} title={bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id}>
                            {bkAbbreviation(bkLabels[e.basiskonzept_id] ?? e.basiskonzept_id)}
                            <span style={{ letterSpacing: 1 }}>{'●'.repeat(e.relevanz_beurteilung)}{'○'.repeat(3 - e.relevanz_beurteilung)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {objectId && (
            <div className="drawer-shell wide">
              <div className="drawer">
                <StudentTopicDetail objectId={objectId} projectSlug={project.slug} supabase={supabase} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentTopicDetail({
  objectId,
  projectSlug,
  supabase,
}: {
  objectId: string
  projectSlug: string
  supabase: ProjectOutletContext['supabase']
}) {
  const navigate = useNavigate()
  const [topic, setTopic] = useState<DataObjectRow | null | undefined>(undefined)
  const [connections, setConnections] = useState<ResolvedConnection[] | null>(null)
  const [stations, setStations] = useState<ThreadStationWithThread[] | null>(null)

  useEffect(() => {
    setTopic(undefined)
    setConnections(null)
    setStations(null)
    getTopic(supabase, objectId).then(setTopic)
    getAssertedConnections(supabase, objectId).then(setConnections)
    getThreadStationsForTopic(supabase, objectId).then(setStations)
  }, [supabase, objectId])

  if (topic === undefined) return <p className="muted">Lädt…</p>
  if (topic === null) return <div className="notice notice-bad">Lernziel nicht gefunden.</div>

  const before = (connections ?? []).filter((c) => c.direction === 'incoming')
  const after = (connections ?? []).filter((c) => c.direction === 'outgoing')

  return (
    <div>
      <h2 style={{ marginBottom: 2 }}>{topic.title}</h2>
      {topic.description && (
        <blockquote style={{ margin: '8px 0 16px', paddingLeft: 10, borderLeft: '3px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>
          &bdquo;{topic.description}&ldquo;
        </blockquote>
      )}

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

      {connections?.length === 0 && stations?.length === 0 && <p className="muted">Noch keine erfassten Verbindungen für dieses Lernziel.</p>}
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
