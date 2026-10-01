import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { Anchor, Info, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { ancestorAtDepth, bkAbbreviation, bkEntries, buildBkLabelMap, elementDepth, getConceptElementsById, getRootConcepts, type BkbEntry } from '@/lib/supabase/basiskonzepte'
import { listAcceptedConnections, listTopicContents, listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import { layoutTier } from '@/lib/graph-layout'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
const MAP_PALETTE = ['--map-1', '--map-2', '--map-3', '--map-4', '--map-5', '--map-6']

// The real, field-verified Konzeptanker definition, from EvoMentor DE
// v1.2's own tooltip text (apps/evomentor_de_v1_2.html's KONZEPTANKER_DEF
// constant) -- not paraphrased.
const KONZEPTANKER_DEF = 'ein Lernziel, das einen besonders konkreten, anschaulichen Einstiegspunkt in ein Basiskonzept bildet.'

// Added 2026-09-30: this page had no explanation anywhere of why teaching is
// organized around Basiskonzepte at all. Short, plain-language rationale +
// citation, not a paraphrase of the source's academic language -- see
// literaturebase/records/neuhaus-2023.yaml and
// methodsbase/records/methods.yaml (OE-METHOD-basiskonzeptorientierte-unterrichtsplanung).
const BASISKONZEPTE_RATIONALE =
  'Wiederkehrende Grundideen wie "Struktur und Funktion" tauchen in ganz verschiedenen Themen wieder auf. Unterricht, der Inhalte immer wieder darauf zurückbezieht, hilft Lernenden, Wissen besser zu vernetzen und zu behalten, statt einzelne Fakten isoliert zu lernen. Quelle: Neuhaus (2023), Fachdidaktik Biologie, Kap. 6.'

const TABS = ['dashboard', 'netz', 'detail'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { dashboard: 'Dashboard', netz: 'Netz', detail: 'Detail' }

export default function StudentBasiskonzeptePage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { tab } = useParams<{ tab?: Tab }>()
  const navigate = useNavigate()
  const activeTab: Tab = (tab && TABS.includes(tab as Tab) ? tab : 'dashboard') as Tab

  const [rootConcepts, setRootConcepts] = useState<SchemaElement[]>([])
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [contentById, setContentById] = useState<Map<string, unknown>>(new Map())
  // Every schema element (roots AND their real Unterkonzepte) -- the Netz
  // tab's 3rd tier, added 2026-10-01 once migrations 059/063 made the real
  // sub-concept tags on each Lernziel actually resolve.
  const [conceptElementsById, setConceptElementsById] = useState<Map<string, SchemaElement>>(new Map())

  useEffect(() => {
    getRootConcepts(supabase, project).then(setRootConcepts)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listTopicContents(supabase, project.id).then(setContentById)
    getConceptElementsById(supabase, project).then(setConceptElementsById)
  }, [supabase, project, defaultBranchId])

  return (
    <div className="student-page">
      <h1>
        Basiskonzepte{' '}
        <span title={BASISKONZEPTE_RATIONALE} style={{ cursor: 'help' }}>
          <Info size={14} style={{ verticalAlign: 'middle' }} />
        </span>
      </h1>
      <p className="muted" style={{ marginBottom: 12 }}>Dashboard, Konzeptnetz, Details</p>

      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`chip-btn${activeTab === t ? ' active' : ''}`}
            onClick={() => navigate(t === 'dashboard' ? `/dashboard/${project.slug}/basiskonzepte` : `/dashboard/${project.slug}/basiskonzepte/${t}`)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab rootConcepts={rootConcepts} topics={topics} contentById={contentById} />}
      {activeTab === 'netz' && <NetzTab project={project} supabase={supabase} rootConcepts={rootConcepts} contentById={contentById} topics={topics} conceptElementsById={conceptElementsById} />}
      {activeTab === 'detail' && <DetailTab rootConcepts={rootConcepts} />}
    </div>
  )
}

// ============================================================================
// Dashboard: 5 real stat tiles + a grade x concept relevance grid, matching
// EvoMentor DE v1.2's own real layout and field names (geschaetzte_
// unterrichtsstunden, ist_konzeptanker, ist_praktisch) -- read defensively,
// since these are richer fields the base import may or may not have
// carried over for every row (same discipline prompt-generator-page.tsx
// already established for didaktische_strategien/originaltext).
// ============================================================================

function DashboardTab({
  rootConcepts,
  topics,
  contentById,
}: {
  rootConcepts: SchemaElement[]
  topics: TopicListItem[] | null
  contentById: Map<string, unknown>
}) {
  const contents = Array.from(contentById.values())
  const konzeptanker = contents.filter((c) => (c as any)?.ist_konzeptanker).length
  const praktisch = contents.filter((c) => (c as any)?.ist_praktisch).length
  const stundenValues = contents.map((c) => (c as any)?.geschaetzte_unterrichtsstunden).filter((v) => typeof v === 'number')
  const stundenGesamt = stundenValues.reduce((a, b) => a + b, 0)
  const hasStunden = stundenValues.length > 0

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  return (
    <div>
      <div className="bk-stat-tiles">
        <div className="card bk-stat-tile"><div className="n">{topics?.length ?? '—'}</div><div className="l">Lernziele gesamt</div></div>
        <div className="card bk-stat-tile"><div className="n">{rootConcepts.length}</div><div className="l">Basiskonzepte</div></div>
        <div className="card bk-stat-tile"><div className="n">{konzeptanker}</div><div className="l">Konzeptanker <span title={KONZEPTANKER_DEF} style={{ cursor: 'help' }}><Info size={11} style={{ verticalAlign: 'middle' }} /></span></div></div>
        <div className="card bk-stat-tile"><div className="n">{praktisch}</div><div className="l">praktische Lernziele</div></div>
        {hasStunden && <div className="card bk-stat-tile"><div className="n">{stundenGesamt}</div><div className="l">Unterrichtsstunden gesamt</div></div>}
      </div>

      <div className="card">
        <h3>Relevanzverteilung je Basiskonzept × Klassenstufe</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Je Zelle: wie viele Lernziele dieser Klassenstufe für das jeweilige Basiskonzept niedrige, mittlere bzw. hohe Relevanz haben.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Basiskonzept</th>
                {grades.map((g) => <th key={g} style={{ padding: '4px 8px' }}>Kl. {g}</th>)}
              </tr>
            </thead>
            <tbody>
              {rootConcepts.map((c, i) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 8px' }}><span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}</td>
                  {grades.map((g) => {
                    // Real feedback 2026-10-01: the old cell only counted
                    // high-relevance (3/3) goals, hiding the real low/medium
                    // tail entirely. Count all three tiers and render a
                    // small stacked bar so the real distribution -- not just
                    // the top of it -- is visible per concept x grade cell.
                    const counts = [0, 0, 0]
                    for (const t of topics ?? []) {
                      if (t.grade_band !== g) continue
                      for (const e of bkEntries(contentById.get(t.id))) {
                        if (!looksLikeBk(e.basiskonzept_id, c.label)) continue
                        if (e.relevanz_beurteilung >= 1 && e.relevanz_beurteilung <= 3) counts[e.relevanz_beurteilung - 1]++
                      }
                    }
                    const total = counts[0] + counts[1] + counts[2]
                    const color = `var(--map-${(i % 6) + 1})`
                    return (
                      <td key={g} style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {total === 0 ? (
                          '—'
                        ) : (
                          <div
                            className="tip"
                            data-tip={`niedrig ${counts[0]} · mittel ${counts[1]} · hoch ${counts[2]}`}
                            style={{ display: 'inline-block', width: '100%', maxWidth: 70 }}
                          >
                            <div style={{ display: 'flex', height: 7, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}>
                              {counts[0] > 0 && <div style={{ flex: counts[0], background: color, opacity: 0.35 }} />}
                              {counts[1] > 0 && <div style={{ flex: counts[1], background: color, opacity: 0.65 }} />}
                              {counts[2] > 0 && <div style={{ flex: counts[2], background: color, opacity: 1 }} />}
                            </div>
                            <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{counts[0]} / {counts[1]} / {counts[2]}</div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Balken und Zahlen: niedrig / mittel / hoch.</p>
      </div>

      {/* Real feedback 2026-10-01 (Susan): wanted to see WHERE (in which
          grade) and how many Konzeptanker sit per Basiskonzept, not just the
          single top-level "43 Konzeptanker" stat tile above -- same table
          shape as the relevance distribution above, counting
          ist_konzeptanker instead. */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3><Anchor size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Konzeptanker je Basiskonzept × Klassenstufe</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Je Zelle: wie viele Konzeptanker-Lernziele dieser Klassenstufe zu diesem Basiskonzept gehören.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Basiskonzept</th>
                {grades.map((g) => <th key={g} style={{ padding: '4px 8px' }}>Kl. {g}</th>)}
              </tr>
            </thead>
            <tbody>
              {rootConcepts.map((c, i) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 8px' }}><span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}</td>
                  {grades.map((g) => {
                    let count = 0
                    for (const t of topics ?? []) {
                      if (t.grade_band !== g) continue
                      const tc = contentById.get(t.id) as any
                      if (!tc?.ist_konzeptanker) continue
                      if (bkEntries(tc).some((e) => looksLikeBk(e.basiskonzept_id, c.label))) count++
                    }
                    return (
                      <td key={g} style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {count === 0 ? (
                          '—'
                        ) : (
                          <span className="row" style={{ justifyContent: 'center', gap: 3 }}>
                            <Anchor size={10} />{count}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function looksLikeBk(bkId: string, label: string): boolean {
  const tokens = bkId.replace(/^bk_/, '').split('_').filter(Boolean)
  const norm = label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '')
  return tokens.every((t) => norm.includes(t))
}

// ============================================================================
// Netz: a real 3-tier concept map. Basiskonzepte (always shown, fixed top
// row) -> their real Unterkonzepte (toggleable 2nd tier, added 2026-10-01
// once migrations 059/063 made every Lernziel's own sub-concept tag
// actually resolve -- see the design note this work is documented under) ->
// individual Lernziele (toggleable 3rd tier). Still the same deterministic
// tiered-column layout Dustin asked for explicitly (2026-09-30:
// "basiskonzepte appear as disconnected islands... arranged as nodes on an
// upper row... lernziele links arranged systematically... in tiered/
// staggering rows below") -- a 3rd tier extends that proven pattern rather
// than switching to a force-directed layout he already rejected once (the
// old 'cose' layout scattered disconnected components unpredictably).
//
// The dashed gray arcs between Basiskonzepte (derivedRelations) and the
// growth-over-time strip are unchanged from before.
//
// Real feedback 2026-10-01 (Dustin, after asking how this new sub-concept
// work related to Netz at all -- it didn't, until now): "consider UI/UX
// options (toggle levels, zoom, relative node size, edge length)... a
// couple of helpful graph measures with interpretation assistance... make
// this visually amazing, intuitive, practical, and functional." Delivered
// as: level toggles, a node-size-by control, a density (edge-length)
// control, real zoom buttons, click-to-highlight a concept's whole
// neighborhood, richer hover tooltips pulling real definitions, and two
// insight panels (richest sub-concepts by real lesson count, most
// cross-cutting Lernziele) each with a plain-language "what this means"
// line, not just a bare number.
// ============================================================================

// A Lernziel<->Basiskonzept pairing counts as a real edge worth drawing once
// its own relevance rating reaches "relevant" (2/3) or above -- below that,
// a 0 or 1 rating is real data too, but showing it as a full edge would
// bury the meaningful overlap under near-universal noise (most Lernziele
// score at least 1/3 against most Basiskonzepte). 2/3 is the same
// real-world threshold a teacher reading the Lernziele cards' own dot
// indicators would read as "yes, this genuinely relates."
const RELEVANCE_EDGE_THRESHOLD = 2

const BK_ROW_Y = 50
const UK_ROW_GAP = 60
const UK_ROW_HEIGHT_BASE = 34
const UK_CHILD_WIDTH_BASE = 96
const LZ_ROW_HEIGHT_BASE = 38
const LZ_GAP_ABOVE_BASE = 70
const DENSITY_SCALE: Record<Density, number> = { kompakt: 1, weit: 1.55 }

type Density = 'kompakt' | 'weit'
type SizeBy = 'count' | 'relevance'

interface GraphNodeDatum {
  id: string
  label: string
  kind: 'bk' | 'uk' | 'lz'
  color: string
  size: number
  opacity: number
  x: number
  y: number
  tooltip: string
}
interface GraphEdgeDatum {
  id: string
  source: string
  target: string
  color: string
  weight: number
  kind: 'hierarchy' | 'relevance'
}
interface NetzInsightUk { id: string; label: string; rootLabel: string; rootIdx: number; count: number }
interface NetzInsightLz { id: string; title: string; rootCount: number; rootLabels: string[] }

function NetzTab({
  project,
  supabase,
  rootConcepts,
  contentById,
  topics,
  conceptElementsById,
}: {
  project: ProjectOutletContext['project']
  supabase: ProjectOutletContext['supabase']
  rootConcepts: SchemaElement[]
  contentById: Map<string, unknown>
  topics: TopicListItem[] | null
  conceptElementsById: Map<string, SchemaElement>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const navigate = useNavigate()
  const [threads, setThreads] = useState<
    { id: string; created_at: string; title: string; stations: { data_object_id: string; via_element_id: string | null; object_title: string }[] }[] | null
  >(null)
  const [connections, setConnections] = useState<{ from_object_id: string; to_object_id: string }[] | null>(null)

  const [showUk, setShowUk] = useState(true)
  const [showUk2, setShowUk2] = useState(false)
  const [showLz, setShowLz] = useState(true)
  const [sizeBy, setSizeBy] = useState<SizeBy>('count')
  const [density, setDensity] = useState<Density>('kompakt')
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    const projectIds = Array.from(new Set([project.parent_project_id ?? project.id, project.id]))
    supabase
      .from('lpm_threads')
      .select('id, created_at, title, status, lpm_thread_stations(data_object_id, via_element_id, lpm_data_objects(title))')
      .in('project_id', projectIds)
      .eq('status', 'accepted')
      .then(({ data }) => {
        setThreads(
          (data ?? []).map((t: any) => ({
            id: t.id,
            created_at: t.created_at,
            title: t.title,
            stations: (t.lpm_thread_stations ?? []).map((s: any) => ({
              data_object_id: s.data_object_id,
              via_element_id: s.via_element_id,
              object_title: s.lpm_data_objects?.title ?? '?',
            })),
          }))
        )
      })
  }, [supabase, project])

  useEffect(() => {
    listAcceptedConnections(supabase, project.id).then(setConnections)
  }, [supabase, project.id])

  // Real, derived Basiskonzept<->Basiskonzept relation -- see the crosswalk
  // comment block above this component. First tried as arced lines drawn
  // straight into the graph, arcing above a Basiskonzept row that sits too
  // close to the top of the canvas to fit them -- confirmed visually messy
  // live (a tangle of overlapping loops), Dustin's own read matched mine.
  // A short list below the graph carries the same real, counted data
  // without fighting bezier-curve geometry over six closely-spaced nodes.
  const derivedRelations = useMemo(() => {
    if (!connections || rootConcepts.length === 0) return []
    // Real bug found live 2026-09-30: every Lernziel carries a
    // basiskonzeptbezug entry for ALL SIX Basiskonzepte (a relevance rating
    // 0-3 against each one, not just its own "primary" concept) -- counting
    // every one of those as "this Lernziel belongs to that Basiskonzept"
    // made every pair's count identical (746 for all 15 possible pairs, the
    // same connection total inflated by the full 6x6 cross product every
    // time). Only a high-relevance rating (3/3) counts as real, meaningful
    // membership -- the same threshold the Dashboard tab's own relevance
    // table already uses (looksLikeBk's caller, above).
    const bkIdsForObject = new Map<string, string[]>()
    for (const [objId, content] of contentById.entries()) {
      bkIdsForObject.set(objId, bkEntries(content).filter((e) => e.relevanz_beurteilung === 3).map((e) => e.basiskonzept_id))
    }
    const allBkIds = Array.from(new Set(Array.from(bkIdsForObject.values()).flat()))
    const resolvedLabel = buildBkLabelMap(allBkIds, rootConcepts)
    const labelToRoot = new Map(rootConcepts.map((r, i) => [r.label, { id: r.id, label: r.label, i }]))
    const pairCounts = new Map<string, number>()
    for (const conn of connections) {
      const fromRoots = new Set((bkIdsForObject.get(conn.from_object_id) ?? []).map((id) => labelToRoot.get(resolvedLabel[id] ?? '')).filter((v): v is NonNullable<typeof v> => !!v))
      const toRoots = new Set((bkIdsForObject.get(conn.to_object_id) ?? []).map((id) => labelToRoot.get(resolvedLabel[id] ?? '')).filter((v): v is NonNullable<typeof v> => !!v))
      for (const a of fromRoots) {
        for (const b of toRoots) {
          if (a.id === b.id) continue
          const key = [a.id, b.id].sort().join('|')
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
        }
      }
    }
    const byId = new Map(rootConcepts.map((r, i) => [r.id, { label: r.label, i }]))
    return Array.from(pairCounts.entries())
      .map(([key, count]) => {
        const [aId, bId] = key.split('|')
        const a = byId.get(aId)!
        const b = byId.get(bId)!
        return { aId, aLabel: a.label, aColor: cssVar(MAP_PALETTE[a.i % 6], '#999'), bId, bLabel: b.label, bColor: cssVar(MAP_PALETTE[b.i % 6], '#999'), count }
      })
      .sort((x, y) => y.count - x.count)
  }, [connections, rootConcepts, contentById])

  // The real graph model -- nodes, edges, and the 2 insight stats -- built
  // once per real data/toggle change, kept separate from the Cytoscape
  // rendering effect below so toggling the highlight (a CSS class, no
  // layout change) never has to rebuild or re-fit the graph.
  const model = useMemo((): {
    nodes: GraphNodeDatum[]
    edges: GraphEdgeDatum[]
    height: number
    topUkByCount: NetzInsightUk[]
    mostCrossCutting: NetzInsightLz[]
    ukCoverage: { total: number; covered: number }
  } | null => {
    if (!topics || rootConcepts.length === 0) return null
    const width = containerRef.current?.clientWidth || 900
    const scale = DENSITY_SCALE[density]
    const rootIndex = new Map(rootConcepts.map((r, i) => [r.id, i]))
    const rootColor = (rootId: string) => cssVar(MAP_PALETTE[(rootIndex.get(rootId) ?? 0) % 6], '#2a78d6')

    // Real bug found live 2026-09-30 ("it should be that many lernziele
    // connect to many basiskonzepte... the whole point is to model the
    // conceptual overlap"): every real Lernziel draws a real edge to every
    // Basiskonzept it scores RELEVANCE_EDGE_THRESHOLD or higher against.
    const allBkIds = Array.from(new Set(Array.from(contentById.values()).flatMap((c) => bkEntries(c).map((e) => e.basiskonzept_id))))
    const resolvedLabel = buildBkLabelMap(allBkIds, rootConcepts)
    const labelToRootId = new Map(rootConcepts.map((r) => [r.label, r.id]))

    // Each qualifying (Lernziel, Basiskonzept) pairing's REAL target --
    // the Basiskonzept itself when the Unterkonzept tier is off, or the
    // specific sub-concept(s) that pairing was actually tagged against
    // (migrations 059/063) once it's on. One pairing can resolve to
    // several distinct Unterkonzepte (a Lernziel's own relevance judgment
    // against one Basiskonzept can name more than one sub-concept within
    // it) -- each becomes its own edge, which is the real structure, not
    // an artifact.
    interface RawEdge { topicId: string; targetId: string; weight: number; rootId: string }
    const rawEdges: RawEdge[] = []
    // Every distinct real Basiskonzept this Lernziel scores >=threshold
    // against, independent of the Unterkonzept toggle -- the "most
    // cross-cutting" insight stays meaningful even with Unterkonzepte off.
    const crossCuttingByTopic = new Map<string, Set<string>>()

    for (const t of topics) {
      const entries = bkEntries(contentById.get(t.id))
      for (const e of entries) {
        if (e.relevanz_beurteilung < RELEVANCE_EDGE_THRESHOLD) continue
        const rootId = labelToRootId.get(resolvedLabel[e.basiskonzept_id] ?? '')
        if (!rootId) continue
        if (!crossCuttingByTopic.has(t.id)) crossCuttingByTopic.set(t.id, new Set())
        crossCuttingByTopic.get(t.id)!.add(rootId)

        if (!showUk) {
          rawEdges.push({ topicId: t.id, targetId: rootId, weight: e.relevanz_beurteilung, rootId })
          continue
        }
        const tags = [...(e.relevante_unterkonzepte_taxonomie ?? []), ...(e.relevante_evolutionskonzepte_taxonomie ?? [])]
        const targets = new Set<string>()
        for (const tag of tags) {
          if (!tag.taxonomyElementId) continue
          const el = conceptElementsById.get(tag.taxonomyElementId)
          if (!el) continue
          const depth = elementDepth(el.id, conceptElementsById)
          const target = depth === 2 && !showUk2 ? ancestorAtDepth(el.id, 1, conceptElementsById) : el
          if (target) targets.add(target.id)
        }
        if (targets.size === 0) rawEdges.push({ topicId: t.id, targetId: rootId, weight: e.relevanz_beurteilung, rootId })
        else for (const targetId of targets) rawEdges.push({ topicId: t.id, targetId, weight: e.relevanz_beurteilung, rootId })
      }
    }

    // Per-target aggregate (every Basiskonzept AND every used Unterkonzept):
    // which real Lernziele anchor there, and with what total weight --
    // drives both node sizing and the "richest sub-concepts" insight.
    const byTarget = new Map<string, { topicIds: Set<string>; totalWeight: number }>()
    for (const e of rawEdges) {
      if (!byTarget.has(e.targetId)) byTarget.set(e.targetId, { topicIds: new Set(), totalWeight: 0 })
      const agg = byTarget.get(e.targetId)!
      agg.topicIds.add(e.topicId)
      agg.totalWeight += e.weight
    }

    // Each Lernziel's own PRIMARY anchor (its single strongest pairing) --
    // where it gets positioned/tiered under, same "closer = more central"
    // convention as before, one tier deeper when Unterkonzepte are shown.
    const edgesByTopic = new Map<string, RawEdge[]>()
    for (const e of rawEdges) {
      if (!edgesByTopic.has(e.topicId)) edgesByTopic.set(e.topicId, [])
      edgesByTopic.get(e.topicId)!.push(e)
    }
    const primaryByTopic = new Map<string, { targetId: string; rootId: string; totalWeight: number }>()
    for (const [topicId, edges] of edgesByTopic) {
      const strongest = edges.reduce((best, e) => (e.weight > best.weight ? e : best), edges[0])
      const totalWeight = edges.reduce((s, e) => s + e.weight, 0)
      primaryByTopic.set(topicId, { targetId: strongest.targetId, rootId: strongest.rootId, totalWeight })
    }

    // ---- Layout: tier 0 (Basiskonzepte, fixed row) ----
    const colWidth = width / rootConcepts.length
    const nodePositions = new Map<string, { x: number; y: number }>()
    rootConcepts.forEach((c, i) => nodePositions.set(c.id, { x: (i + 0.5) * colWidth, y: BK_ROW_Y }))

    // ---- Tier 1 (Unterkonzepte, toggleable) ----
    const ukRowHeight = UK_ROW_HEIGHT_BASE * scale
    let maxUkRows = 0
    const usedUkIds: string[] = []
    if (showUk) {
      rootConcepts.forEach((c) => {
        const ukForThisRoot = Array.from(byTarget.entries())
          .filter(([id]) => id !== c.id && conceptElementsById.get(id) && ancestorAtDepth(id, 0, conceptElementsById)?.id === c.id)
          .sort((a, b) => b[1].topicIds.size - a[1].topicIds.size)
          .map(([id]) => ({ id }))
        usedUkIds.push(...ukForThisRoot.map((u) => u.id))
        const { positions, rows } = layoutTier(ukForThisRoot, nodePositions.get(c.id)!.x, BK_ROW_Y + UK_ROW_GAP * scale, colWidth - 16, ukRowHeight, 78)
        for (const [id, pos] of positions) nodePositions.set(id, pos)
        maxUkRows = Math.max(maxUkRows, rows)
      })
    }

    // ---- Tier 2 (Lernziele, toggleable) ----
    const lzRowHeight = LZ_ROW_HEIGHT_BASE * scale
    const lzStartY = showUk ? BK_ROW_Y + UK_ROW_GAP * scale + maxUkRows * ukRowHeight + LZ_GAP_ABOVE_BASE * scale * 0.6 : BK_ROW_Y + LZ_GAP_ABOVE_BASE * scale
    let maxLzRows = 0
    if (showLz) {
      const groupedByAnchor = new Map<string, string[]>()
      for (const [topicId, p] of primaryByTopic) {
        const arr = groupedByAnchor.get(p.targetId) ?? []
        arr.push(topicId)
        groupedByAnchor.set(p.targetId, arr)
      }
      for (const arr of groupedByAnchor.values()) arr.sort((a, b) => (primaryByTopic.get(b)?.totalWeight ?? 0) - (primaryByTopic.get(a)?.totalWeight ?? 0))
      for (const [anchorId, topicIds] of groupedByAnchor) {
        const anchorPos = nodePositions.get(anchorId)
        if (!anchorPos) continue
        const isRootAnchor = rootIndex.has(anchorId)
        const maxWidth = isRootAnchor ? colWidth - 16 : UK_CHILD_WIDTH_BASE * scale
        const { positions, rows } = layoutTier(topicIds.map((id) => ({ id })), anchorPos.x, lzStartY, maxWidth, lzRowHeight, isRootAnchor ? 34 : 24)
        for (const [id, pos] of positions) nodePositions.set(id, pos)
        maxLzRows = Math.max(maxLzRows, rows)
      }
    }

    const neededHeight = Math.min(1600, Math.max(480, lzStartY + 90 + maxLzRows * lzRowHeight))

    // ---- Nodes ----
    const totalLzForRoot = (rootId: string) => {
      const seen = new Set<string>()
      for (const [id, agg] of byTarget) {
        if (id === rootId || ancestorAtDepth(id, 0, conceptElementsById)?.id === rootId) for (const t of agg.topicIds) seen.add(t)
      }
      return seen.size
    }
    const nodes: GraphNodeDatum[] = []
    rootConcepts.forEach((c) => {
      const count = totalLzForRoot(c.id)
      const weight = Array.from(byTarget.entries()).filter(([id]) => id === c.id || ancestorAtDepth(id, 0, conceptElementsById)?.id === c.id).reduce((s, [, a]) => s + a.totalWeight, 0)
      const metricVal = sizeBy === 'count' ? count : weight
      const def = (c as any).didactic_definition as string | undefined
      nodes.push({
        id: c.id, label: c.label, kind: 'bk', color: rootColor(c.id),
        size: Math.min(58, 34 + Math.sqrt(metricVal) * 3.2), opacity: 1,
        x: nodePositions.get(c.id)!.x, y: nodePositions.get(c.id)!.y,
        tooltip: def ? `${c.label}: ${def.length > 160 ? def.slice(0, 158) + '…' : def}` : c.label,
      })
    })
    if (showUk) {
      for (const ukId of usedUkIds) {
        const el = conceptElementsById.get(ukId)
        const pos = nodePositions.get(ukId)
        const agg = byTarget.get(ukId)
        if (!el || !pos || !agg) continue
        const root = ancestorAtDepth(ukId, 0, conceptElementsById)
        const metricVal = sizeBy === 'count' ? agg.topicIds.size : agg.totalWeight
        const beispiel = (el.metadata as any)?.beispiel as string | undefined
        const tooltipBase = el.definition ? `${el.label}: ${el.definition}` : el.label
        nodes.push({
          id: ukId, label: el.label.length > 22 ? el.label.slice(0, 20) + '…' : el.label, kind: 'uk',
          color: root ? rootColor(root.id) : '#999', size: Math.min(26, 11 + Math.sqrt(metricVal) * 3), opacity: 0.88,
          x: pos.x, y: pos.y,
          tooltip: (tooltipBase.length > 180 ? tooltipBase.slice(0, 178) + '…' : tooltipBase) + (beispiel ? ` (Beispiel: ${beispiel.length > 80 ? beispiel.slice(0, 78) + '…' : beispiel})` : ''),
        })
      }
    }
    if (showLz) {
      for (const [topicId, p] of primaryByTopic) {
        const pos = nodePositions.get(topicId)
        const title = topics.find((t) => t.id === topicId)?.title ?? '?'
        if (!pos) continue
        nodes.push({
          id: topicId, label: '', kind: 'lz',
          color: rootColor(p.rootId), size: Math.min(26, 9 + Math.sqrt(p.totalWeight) * 5), opacity: Math.max(0.4, p.totalWeight / 6),
          x: pos.x, y: pos.y, tooltip: title,
        })
      }
    }

    // ---- Edges ----
    const edges: GraphEdgeDatum[] = []
    if (showUk) {
      for (const ukId of usedUkIds) {
        const root = ancestorAtDepth(ukId, 0, conceptElementsById)
        if (!root) continue
        edges.push({ id: `h-${ukId}`, source: root.id, target: ukId, color: cssVar('--border', '#ccc'), weight: 1, kind: 'hierarchy' })
      }
    }
    if (showLz) {
      rawEdges.forEach((e, i) => {
        edges.push({ id: `r-${i}`, source: e.targetId, target: e.topicId, color: rootColor(e.rootId), weight: e.weight, kind: 'relevance' })
      })
    }

    // ---- Insights ----
    const topUkByCount: NetzInsightUk[] = usedUkIds
      .map((id) => {
        const el = conceptElementsById.get(id)
        const root = el ? ancestorAtDepth(id, 0, conceptElementsById) : undefined
        const agg = byTarget.get(id)
        if (!el || !root || !agg) return null
        return { id, label: el.label, rootLabel: root.label, rootIdx: rootIndex.get(root.id) ?? 0, count: agg.topicIds.size }
      })
      .filter((v): v is NetzInsightUk => !!v)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const mostCrossCutting: NetzInsightLz[] = Array.from(crossCuttingByTopic.entries())
      .map(([topicId, roots]) => ({
        id: topicId,
        title: topics.find((t) => t.id === topicId)?.title ?? '?',
        rootCount: roots.size,
        rootLabels: Array.from(roots).map((rid) => rootConcepts.find((r) => r.id === rid)?.label ?? '?'),
      }))
      .filter((r) => r.rootCount >= 3)
      .sort((a, b) => b.rootCount - a.rootCount)
      .slice(0, 5)

    // How much of the real taxonomy actually has a Lernziel attached to it
    // yet -- the bonus coverage-gap stat shown under the first insight
    // panel. depth-2 only counts once that finer tier is itself toggled on
    // (otherwise its Lernziele collapse up into their depth-1 parent, so a
    // depth-2 node was never a real target to begin with this view).
    const relevantDepths = showUk2 ? [1, 2] : [1]
    const totalRealUk = Array.from(conceptElementsById.values()).filter((e) => relevantDepths.includes(elementDepth(e.id, conceptElementsById))).length
    const ukCoverage = { total: totalRealUk, covered: usedUkIds.length }

    return { nodes, edges, height: neededHeight, topUkByCount, mostCrossCutting, ukCoverage }
  }, [topics, rootConcepts, contentById, conceptElementsById, showUk, showUk2, showLz, sizeBy, density])

  useEffect(() => {
    if (!containerRef.current || !model) return
    containerRef.current.style.height = `${model.height}px`

    const elements: ElementDefinition[] = [
      ...model.nodes.map((n) => ({ data: { id: n.id, label: n.label, color: n.color, size: n.size, opacity: n.opacity, kind: n.kind, tooltip: n.tooltip }, position: { x: n.x, y: n.y } })),
      ...model.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, color: e.color, weight: e.weight, kind: e.kind } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      minZoom: 0.35,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)', 'background-opacity': 'data(opacity)',
            width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 8, 'text-wrap': 'wrap', 'text-max-width': '60px',
            'text-valign': 'bottom', 'text-margin-y': 3, color: cssVar('--text-primary', '#0b0b0b'),
            'transition-property': 'opacity', 'transition-duration': 180,
          } as any,
        },
        {
          selector: 'node[kind="bk"]',
          style: {
            'font-size': 11, 'font-weight': 700, 'text-valign': 'top', 'text-margin-y': -8,
            'text-max-width': '100px', color: cssVar('--text-primary', '#0b0b0b'), 'text-outline-width': 0,
          },
        },
        {
          selector: 'node[kind="uk"]',
          style: { 'font-size': 8.5, 'font-weight': 600, 'text-valign': 'top', 'text-margin-y': -6, 'text-max-width': '80px' },
        },
        {
          // Real bug found live 2026-09-30: with every qualifying Lernziel
          // drawing a real edge, there can be 200+ leaf nodes on screen --
          // permanently-on labels overlap into an unreadable smear. The
          // crossing EDGES are the real signal; a label only needs to show
          // once someone is actually looking at that one node.
          selector: 'node[kind="lz"]',
          style: { label: '' },
        },
        {
          selector: 'node.hover-label',
          style: {
            label: 'data(tooltip)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1,
            'text-background-padding': '4px', 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc'),
            'text-wrap': 'wrap', 'text-max-width': '160px',
          } as any,
        },
        {
          selector: 'edge[kind="relevance"]',
          style: {
            width: 'mapData(weight, 0, 3, 1, 4)', 'line-color': 'data(color)', 'curve-style': 'bezier',
            'target-arrow-shape': 'none', opacity: 'mapData(weight, 0, 3, 0.2, 0.7)', 'transition-property': 'opacity', 'transition-duration': 180,
          } as any,
        },
        {
          selector: 'edge[kind="hierarchy"]',
          style: { width: 1, 'line-color': 'data(color)', 'curve-style': 'bezier', 'target-arrow-shape': 'none', opacity: 0.5, 'line-style': 'dashed' } as any,
        },
        { selector: '.dimmed', style: { opacity: 0.08 } },
      ],
    })
    cyRef.current = cy

    cy.on('tap', 'node[kind="lz"]', (evt) => navigate(`/dashboard/${project.slug}/${evt.target.id()}`))
    cy.on('tap', 'node[kind="bk"], node[kind="uk"]', (evt) => setHighlightId((prev) => (prev === evt.target.id() ? null : evt.target.id())))
    cy.on('tap', (evt) => { if (evt.target === cy) setHighlightId(null) })
    cy.on('mouseover', 'node', (evt) => {
      if (containerRef.current) containerRef.current.style.cursor = evt.target.data('kind') === 'lz' ? 'pointer' : 'default'
      evt.target.addClass('hover-label')
    })
    cy.on('mouseout', 'node', (evt) => {
      if (containerRef.current) containerRef.current.style.cursor = ''
      evt.target.removeClass('hover-label')
    })
    return () => { cy.destroy(); cyRef.current = null }
  }, [model, project.slug, navigate])

  // Click-to-highlight: applies/clears the .dimmed class on the ALREADY
  // rendered graph (no rebuild, no lost zoom/pan) -- expands outward up to
  // 2 hops (Basiskonzept -> Unterkonzept -> Lernziel) so clicking a
  // Basiskonzept highlights its whole real sub-tree, not just itself.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    if (!highlightId) { cy.elements().removeClass('dimmed'); return }
    const visited = new Set([highlightId])
    let frontier = [highlightId]
    for (let hop = 0; hop < 2; hop++) {
      const next: string[] = []
      for (const id of frontier) {
        cy.getElementById(id).connectedEdges().forEach((edge) => {
          const other = edge.source().id() === id ? edge.target().id() : edge.source().id()
          if (!visited.has(other)) { visited.add(other); next.push(other) }
        })
      }
      frontier = next
    }
    cy.nodes().forEach((n) => { n.toggleClass('dimmed', !visited.has(n.id())) })
    cy.edges().forEach((e) => { e.toggleClass('dimmed', !(visited.has(e.source().id()) && visited.has(e.target().id()))) })
  }, [highlightId])

  const zoomBy = (factor: number) => {
    const cy = cyRef.current
    if (!cy || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: rect.width / 2, y: rect.height / 2 } })
  }
  const fitView = () => cyRef.current?.fit(undefined, 30)

  const growthWeeks = useMemo(() => {
    if (!threads) return []
    const byWeek = new Map<string, number>()
    for (const t of threads) {
      const d = new Date(t.created_at)
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = monday.toISOString().slice(0, 10)
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
    }
    const weeks = Array.from(byWeek.keys()).sort()
    let cumulative = 0
    return weeks.map((w) => {
      cumulative += byWeek.get(w)!
      return { week: w, cumulative }
    })
  }, [threads])

  return (
    <div>
      <div className="netz-controls">
        <div className="netz-control-group">
          <button className={`chip-btn${showUk ? ' active' : ''}`} onClick={() => setShowUk((v) => !v)}>Unterkonzepte</button>
          <button className={`chip-btn${showUk2 ? ' active' : ''}`} disabled={!showUk} style={{ opacity: showUk ? 1 : 0.45 }} onClick={() => setShowUk2((v) => !v)}>Feinere Unterkonzepte</button>
          <button className={`chip-btn${showLz ? ' active' : ''}`} onClick={() => setShowLz((v) => !v)}>Lernziele</button>
        </div>
        <div className="netz-control-group">
          <span className="muted" style={{ fontSize: 11 }}>Größe nach:</span>
          <button className={`chip-btn${sizeBy === 'count' ? ' active' : ''}`} onClick={() => setSizeBy('count')}>Anzahl Lernziele</button>
          <button className={`chip-btn${sizeBy === 'relevance' ? ' active' : ''}`} onClick={() => setSizeBy('relevance')}>Relevanz-Summe</button>
        </div>
        <div className="netz-control-group">
          <span className="muted" style={{ fontSize: 11 }}>Abstand:</span>
          <button className={`chip-btn${density === 'kompakt' ? ' active' : ''}`} onClick={() => setDensity('kompakt')}>Kompakt</button>
          <button className={`chip-btn${density === 'weit' ? ' active' : ''}`} onClick={() => setDensity('weit')}>Weit</button>
        </div>
        <div className="netz-control-group">
          <button className="btn btn-mini" aria-label="Verkleinern" onClick={() => zoomBy(0.8)}><ZoomOut size={13} /></button>
          <button className="btn btn-mini" aria-label="Einpassen" onClick={fitView}><Maximize2 size={13} /></button>
          <button className="btn btn-mini" aria-label="Vergrößern" onClick={() => zoomBy(1.25)}><ZoomIn size={13} /></button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ height: 480, minHeight: 480 }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Große Kreise (obere Reihe) = Basiskonzepte{showUk && ', mittlere Punkte = ihre echten Unterkonzepte'}.
        {showLz && ' Kleine Punkte = einzelne Lernziele, mit einer echten, bewerteten Linie zu '}
        {showLz && (showUk ? 'dem Unterkonzept (oder Basiskonzept, falls kein spezifisches Unterkonzept erfasst ist)' : 'jedem Basiskonzept')}
        {showLz && ', dem sie wirklich zugeordnet sind — viele Lernziele gehören zu mehreren Konzepten zugleich, deshalb kreuzen manche Linien.'}
        {' '}Dickere, kräftigere Linien = höhere bewertete Relevanz. Antippen eines Basiskonzepts oder Unterkonzepts hebt nur seinen eigenen Bereich hervor (nochmal antippen hebt die Hervorhebung auf); antippen eines Lernziels öffnet es.
      </p>

      {(model && (model.topUkByCount.length > 0 || model.mostCrossCutting.length > 0)) && (
        <div className="netz-insights">
          {model.topUkByCount.length > 0 && (
            <div className="card">
              <h3>Am stärksten ausgearbeitete Unterkonzepte</h3>
              <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
                Die Unterkonzepte mit den meisten echten Lernzielen — guter Ausgangspunkt, um zu sehen, wo
                dieses Basiskonzept im Lehrplan am konkretesten wird.
              </p>
              {model.topUkByCount.map((u) => (
                <div key={u.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
                    <span className={`bk-dot bk-dot-${u.rootIdx % 6}`} />
                    {u.label}
                    <span className="muted" style={{ fontSize: 11 }}>({u.rootLabel})</span>
                  </span>
                  <strong style={{ fontSize: 12.5 }}>{u.count}</strong>
                </div>
              ))}
              {model.ukCoverage.total > 0 && (
                <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                  {model.ukCoverage.covered} von {model.ukCoverage.total} Unterkonzepten haben mindestens ein
                  echtes Lernziel — der Rest ist im Lehrplan zwar definiert, aber noch keinem Lernziel zugeordnet.
                </p>
              )}
            </div>
          )}
          {model.mostCrossCutting.length > 0 && (
            <div className="card">
              <h3>Fächerübergreifende Lernziele</h3>
              <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
                Lernziele, die mit hoher Relevanz zu mindestens 3 verschiedenen Basiskonzepten gleichzeitig
                gehören — gut geeignet, um Schüler:innen Zusammenhänge zwischen Themen zu zeigen, statt
                Konzepte isoliert zu behandeln.
              </p>
              {model.mostCrossCutting.map((l) => (
                <button key={l.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate(`/dashboard/${project.slug}/${l.id}`)}>
                  <span className="tip" data-tip={l.rootLabels.join(' · ')} style={{ fontSize: 12.5 }}>{l.title}</span>
                  <strong style={{ fontSize: 12.5 }}>{l.rootCount}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {derivedRelations.length > 0 && (
        <div className="card">
          <h3>Verwandte Basiskonzepte</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            Wie oft echte, geprüfte Lehrplan-Verbindungen ein Lernziel aus dem einen Basiskonzept
            mit einem Lernziel aus dem anderen verknüpfen.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {derivedRelations.map((r) => (
              <span key={`${r.aId}-${r.bId}`} className="chip" style={{ fontSize: 12.5 }}>
                <span className={`bk-dot`} style={{ background: r.aColor }} />
                {r.aLabel}
                <span className="muted" style={{ margin: '0 4px' }}>↔</span>
                <span className={`bk-dot`} style={{ background: r.bColor }} />
                {r.bLabel}
                <span className="muted" style={{ marginLeft: 6 }}>× {r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Wachstum über die Zeit</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Wie viele geprüfte Verbindungen zwischen Basiskonzepten und Lernzielen im Laufe des Semesters entstanden sind.
        </p>
        {growthWeeks.length === 0 ? (
          <p className="muted">Noch keine geprüften Verbindungen — dieses Diagramm füllt sich, sobald welche angenommen werden.</p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 80 }}>
            {growthWeeks.map((w) => {
              const max = growthWeeks[growthWeeks.length - 1].cumulative
              return (
                <div key={w.week} className="tip" data-tip={`${w.week}: ${w.cumulative} gesamt`} style={{ flex: 1, background: 'var(--series-a)', height: `${Math.max(6, (w.cumulative / max) * 80)}px`, borderRadius: '3px 3px 0 0' }} />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Detail: per-Basiskonzept definition, misconception pairs (X/✓), everyday
// anchors -- real content imported from EvoMentor DE's own source data
// (migration 042), not placeholder text. Falls back honestly ("noch keine
// Detailinhalte") for a project that hasn't had this content imported.
// ============================================================================

function DetailTab({ rootConcepts }: { rootConcepts: SchemaElement[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(rootConcepts[0]?.id ?? null)
  useEffect(() => {
    if (!selectedId && rootConcepts[0]) setSelectedId(rootConcepts[0].id)
  }, [rootConcepts, selectedId])

  const selected = rootConcepts.find((c) => c.id === selectedId)

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        {rootConcepts.map((c, i) => (
          <button
            key={c.id}
            className="btn-linklike"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: c.id === selectedId ? 700 : 400 }}
            onClick={() => setSelectedId(c.id)}
          >
            <span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ flex: 1 }}>
        {!selected ? (
          <p className="muted">Kein Basiskonzept ausgewählt.</p>
        ) : (
          <StudentBkDetail concept={selected} abbr={bkAbbreviation(selected.label)} />
        )}
      </div>
    </div>
  )
}

function StudentBkDetail({ concept }: { concept: SchemaElement; abbr: string }) {
  const definition = (concept as any).didactic_definition as string | null
  const misconceptions = ((concept as any).common_misconceptions ?? []) as { falsch: string; richtig: string; hinweis?: string }[]
  const anchors = ((concept as any).everyday_anchors ?? []) as string[]
  const principles = ((concept as any).core_principles ?? []) as string[]

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{concept.label}</h2>
      {!definition ? (
        <p className="muted">Noch keine Detailinhalte für dieses Basiskonzept hinterlegt.</p>
      ) : (
        <>
          <p>{definition}</p>

          {principles.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {principles.map((p) => <span key={p} className="chip">{p}</span>)}
            </div>
          )}

          {misconceptions.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h3>Häufige Schülervorstellungen</h3>
              {misconceptions.map((m, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={{ color: 'var(--critical)', margin: 0 }}>✗ {m.falsch}</p>
                  <p style={{ color: 'var(--good)', margin: '2px 0 0' }}>✓ {m.richtig}</p>
                  {m.hinweis && <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{m.hinweis}</p>}
                </div>
              ))}
            </section>
          )}

          {anchors.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h3>Alltagsanker</h3>
              <ul>{anchors.map((a) => <li key={a}>{a}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
