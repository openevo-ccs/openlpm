import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { Anchor, Info, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { ancestorAtDepth, bandKeyForGrade, bkAbbreviation, bkEntries, buildBkLabelMap, elementDepth, getConceptElementsById, getRootConcepts, type BkbEntry } from '@/lib/supabase/basiskonzepte'
import { listAcceptedConnections, listTopicContents, listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import { createConceptRelation, deleteConceptRelation, listConceptRelations, type ConceptRelation } from '@/lib/supabase/concept-relations'
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
      {activeTab === 'detail' && <DetailTab rootConcepts={rootConcepts} conceptElementsById={conceptElementsById} />}
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

  // Real feedback b0323f40 (Susan): this used to group on each topic's raw
  // grade_band value directly, which showed separate "Kl. 5"/"Kl. 6" columns
  // next to an all-dash "Kl. 5/6" column (some MNT content genuinely carries
  // the combined band as its literal value, migration 104) -- same real
  // curriculum structure the Lernziele page's own filter already buckets
  // correctly (bandKeyForGrade), just never applied here.
  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean).map((g) => bandKeyForGrade(g as string)))
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  // Real feedback 2026-10-01 (Susan), 2nd pass: the split-out Konzeptanker
  // table below had a real bug -- every row showed the exact same number
  // per grade column. Root cause: a Konzeptanker topic's basiskonzeptbezug
  // array carries a relevance ENTRY for all six Basiskonzepte (that's by
  // design -- every Lernziel is rated against every concept), so matching
  // "this topic counts toward concept X" on mere presence of an entry
  // matched every topic to every concept equally. A Konzeptanker's own
  // definition (KONZEPTANKER_DEF above) is "ein besonders konkreter
  // Einstiegspunkt in EIN Basiskonzept" -- singular -- so it should only
  // count toward the concept(s) where its relevance is actually "hoch"
  // (3/3), not every concept it has any rating for at all.
  const konzeptankerByRootAndGrade = (rootLabel: string, grade: string) => {
    let count = 0
    for (const t of topics ?? []) {
      if (!t.grade_band || bandKeyForGrade(t.grade_band) !== grade) continue
      const tc = contentById.get(t.id) as any
      if (!tc?.ist_konzeptanker) continue
      if (bkEntries(tc).some((e) => e.relevanz_beurteilung === 3 && looksLikeBk(e.basiskonzept_id, rootLabel))) count++
    }
    return count
  }

  return (
    <div>
      <div className="bk-stat-tiles">
        <div className="card bk-stat-tile"><div className="n">{topics?.length ?? '—'}</div><div className="l">Lernziele gesamt</div></div>
        <div className="card bk-stat-tile"><div className="n">{rootConcepts.length}</div><div className="l">Basiskonzepte</div></div>
        <div className="card bk-stat-tile"><div className="n">{konzeptanker}</div><div className="l">Konzeptanker <span title={KONZEPTANKER_DEF} style={{ cursor: 'help' }}><Info size={11} style={{ verticalAlign: 'middle' }} /></span></div></div>
        <div className="card bk-stat-tile"><div className="n">{praktisch}</div><div className="l">praktische Lernziele</div></div>
        {hasStunden && <div className="card bk-stat-tile"><div className="n">{stundenGesamt}</div><div className="l">Unterrichtsstunden gesamt</div></div>}
      </div>

      {/* Real feedback 2026-10-01 (Susan), 2nd pass: in EvoMentor DE v1.2
          this was ONE integrated view, not two separate tables -- the
          Konzeptanker count sits right after each Basiskonzept's name, the
          anchor count per cell sits under that cell's relevance bar, and the
          niedrig/mittel/hoch counts are printed directly inside the bar
          segments themselves rather than in a caption line below. Merged
          back into one table here to match. */}
      <div className="card">
        <h3>Basiskonzepte × Klassenstufe</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Je Zelle: Relevanzverteilung (niedrig / mittel / hoch) der Lernziele dieser Klassenstufe, plus Konzeptanker darunter.
        </p>
        {/* Real feedback bb8b075b/b9df99c1 (Susan): table-layout: fixed stops
            the browser's own auto column sizing from leaving unnecessary gaps
            around narrow grade columns and triggering a horizontal scrollbar
            that wasn't actually needed -- columns now split the real
            available width evenly, so each bar (width: 100% below) gets more
            real room instead of sitting inside a fixed 76px box with blank
            space around it. */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: '28%' }}>Basiskonzept</th>
                {grades.map((g) => <th key={g} style={{ padding: '4px 4px' }}>Kl. {g}</th>)}
              </tr>
            </thead>
            <tbody>
              {rootConcepts.map((c, i) => {
                const rootKonzeptankerTotal = grades.reduce((sum, g) => sum + konzeptankerByRootAndGrade(c.label, g), 0)
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}
                      {rootKonzeptankerTotal > 0 && (
                        <span className="row tip" data-tip={KONZEPTANKER_DEF} style={{ display: 'inline-flex', gap: 2, marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                          <Anchor size={10} />{rootKonzeptankerTotal}
                        </span>
                      )}
                    </td>
                    {grades.map((g) => {
                      // Real feedback 2026-10-01: the old cell only counted
                      // high-relevance (3/3) goals, hiding the real low/medium
                      // tail entirely. Count all three tiers and render a
                      // small stacked bar so the real distribution -- not just
                      // the top of it -- is visible per concept x grade cell.
                      const counts = [0, 0, 0]
                      for (const t of topics ?? []) {
                        if (!t.grade_band || bandKeyForGrade(t.grade_band) !== g) continue
                        for (const e of bkEntries(contentById.get(t.id))) {
                          if (!looksLikeBk(e.basiskonzept_id, c.label)) continue
                          if (e.relevanz_beurteilung >= 1 && e.relevanz_beurteilung <= 3) counts[e.relevanz_beurteilung - 1]++
                        }
                      }
                      const total = counts[0] + counts[1] + counts[2]
                      const anchorCount = konzeptankerByRootAndGrade(c.label, g)
                      const color = `var(--map-${(i % 6) + 1})`
                      return (
                        <td key={g} style={{ padding: '4px 4px', textAlign: 'center' }}>
                          {total === 0 ? (
                            '—'
                          ) : (
                            <div style={{ width: '100%' }}>
                              <div
                                className="tip"
                                data-tip={`niedrig ${counts[0]} · mittel ${counts[1]} · hoch ${counts[2]}`}
                                style={{ display: 'flex', height: 16, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}
                              >
                                {/* Real feedback bb8b075b (Susan): "the grey
                                    numbers in the bars are hard to see, make
                                    the font black" -- applying opacity to the
                                    same div that held the number faded the
                                    text along with the background tint. The
                                    tint (which bar level = niedrig/mittel/
                                    hoch) now lives on its own absolutely-
                                    positioned layer behind the number, so the
                                    number itself always renders at full
                                    opacity, in the page's real text color. */}
                                {([0, 1, 2] as const).map((lvl) =>
                                  counts[lvl] > 0 ? (
                                    <div key={lvl} style={{ flex: counts[lvl], position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <div style={{ position: 'absolute', inset: 0, background: color, opacity: 0.35 + lvl * 0.3 }} />
                                      <span style={{ position: 'relative', fontSize: 9.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{counts[lvl]}</span>
                                    </div>
                                  ) : null
                                )}
                              </div>
                              {anchorCount > 0 && (
                                <div className="row tip" data-tip={KONZEPTANKER_DEF} style={{ justifyContent: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                  <Anchor size={9} />{anchorCount}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Balken: niedrig / mittel / hoch (Zahlen im Balken). <Anchor size={10} style={{ verticalAlign: 'middle' }} /> darunter: Konzeptanker.</p>
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
  kind: 'hierarchy' | 'relevance' | 'relation'
  tooltip?: string
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
  // Real feedback e7333af2 (Susan, 2026-10-02): named, directed links
  // between any two concepts, not just the parent/child tree -- off by
  // default so a project with none yet doesn't add visual noise.
  const [showRelations, setShowRelations] = useState(false)
  const [relations, setRelations] = useState<ConceptRelation[]>([])
  const [sizeBy, setSizeBy] = useState<SizeBy>('count')
  const [density, setDensity] = useState<Density>('kompakt')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  // Tracks the real rendered width so column sizing actually adapts when
  // the window/pane is resized, not just once at first mount -- the real
  // gap the 2026-10-01 "adaptive spacing in relation to the screen size"
  // feedback named.
  const [containerWidth, setContainerWidth] = useState(0)

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

  const reloadRelations = () => listConceptRelations(supabase, project.id).then(setRelations)
  useEffect(() => {
    reloadRelations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
    const width = containerWidth || containerRef.current?.clientWidth || 900
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

    // Real, total Lernziel count anchored under each Basiskonzept (direct or
    // via one of its Unterkonzepte) -- drives both that root's own node size
    // (below) and, more importantly, its column width. Real bug this fixes
    // (2026-10-01 feedback): every root used to get the same fixed 1/6 share
    // of the canvas regardless of how much it actually holds --
    // "Evolutive Entwicklung" carries roughly 3x the Unterkonzepte/Lernziele
    // of the other five, so its equal-width column rendered as an
    // illegible solid block while the others sat mostly empty.
    const lzCountByRoot = new Map(rootConcepts.map((c) => {
      const seen = new Set<string>()
      for (const [id, agg] of byTarget) {
        if (id === c.id || ancestorAtDepth(id, 0, conceptElementsById)?.id === c.id) for (const t of agg.topicIds) seen.add(t)
      }
      return [c.id, seen.size] as const
    }))

    // ---- Layout: tier 0 (Basiskonzepte, proportionally-sized columns) ----
    // Weighted by sqrt(content + 1), not raw count, so one very dense root
    // doesn't starve the others down to nothing; a floor keeps every column
    // usable even for a root that doesn't have much content yet.
    const rootWeights = rootConcepts.map((c) => Math.sqrt((lzCountByRoot.get(c.id) ?? 0) + 1))
    const totalRootWeight = rootWeights.reduce((s, w) => s + w, 0) || 1
    const minColWidth = width / (rootConcepts.length * 1.8)
    const rawColWidths = rootWeights.map((w) => Math.max(minColWidth, (w / totalRootWeight) * width))
    const rawColTotal = rawColWidths.reduce((s, w) => s + w, 0) || 1
    const colWidthByRoot = new Map<string, number>()
    const nodePositions = new Map<string, { x: number; y: number }>()
    let colCursor = 0
    rootConcepts.forEach((c, i) => {
      const colWidth = (rawColWidths[i] / rawColTotal) * width
      colWidthByRoot.set(c.id, colWidth)
      nodePositions.set(c.id, { x: colCursor + colWidth / 2, y: BK_ROW_Y })
      colCursor += colWidth
    })

    // ---- Tier 1+ (Unterkonzepte, toggleable, one pass per real depth) ----
    // Real bug fixed here (feedback 50a7983a, Susan 2026-10-02): every used
    // sub-concept under a root, at ANY real depth (the real Thuringia data
    // goes 3 deep -- checked directly: 46 depth-1, 71 depth-2, 2 depth-3
    // elements), used to be flattened into one row and edged straight to
    // the root -- "balancierende Selektion" (a real depth-2 child of
    // depth-1 "natürliche Selektion") rendered as if it split directly off
    // the root "Evolutive Entwicklung" instead of off its own real parent.
    // Laid out one real depth at a time instead: each depth's nodes are
    // grouped by their own real parent_id and placed with layoutTier under
    // THAT parent's already-computed position, not the root's -- so the
    // rendered tree matches the real conceptElementsById hierarchy.
    // parentOfUk records each node's real immediate parent for the edges
    // section below, so an edge is drawn to the true parent too.
    const ukRowHeight = UK_ROW_HEIGHT_BASE * scale
    let maxUkRows = 0
    const usedUkIds: string[] = []
    const parentOfUk = new Map<string, string>()
    // Zero-weight aggregate for a node that's only here as a real connector
    // (nothing directly anchored to it, but a real descendant needs it to
    // have somewhere true to attach) -- see the ancestor-closure note below.
    const EMPTY_AGG = { topicIds: new Set<string>(), totalWeight: 0 }
    if (showUk) {
      rootConcepts.forEach((c) => {
        const directlyUsed = Array.from(byTarget.entries())
          .filter(([id]) => id !== c.id && conceptElementsById.get(id) && ancestorAtDepth(id, 0, conceptElementsById)?.id === c.id)
        // A directly-tagged depth-2+ node's own real parent might never have
        // been tagged by any Lernziel itself -- without this closure, that
        // parent (and so its whole subtree) would never get positioned, and
        // the child would either vanish or (the original bug) get wired
        // straight to the root. Walk every directly-used node's real
        // ancestor chain up to (not including) the root, adding each as a
        // real, positioned connector node with zero weight of its own.
        const includedById = new Map<string, { topicIds: Set<string>; totalWeight: number }>(directlyUsed)
        for (const [id] of directlyUsed) {
          let cur = conceptElementsById.get(id)?.parent_id
          while (cur && cur !== c.id && !includedById.has(cur)) {
            includedById.set(cur, byTarget.get(cur) ?? EMPTY_AGG)
            cur = conceptElementsById.get(cur)?.parent_id
          }
        }
        const included = Array.from(includedById.entries())
        const maxDepth = included.reduce((m, [id]) => Math.max(m, elementDepth(id, conceptElementsById)), 0)
        const colWidth = (colWidthByRoot.get(c.id) ?? width / rootConcepts.length) - 16
        let rowsSoFar = 0
        for (let depth = 1; depth <= maxDepth; depth++) {
          const atThisDepth = included.filter(([id]) => elementDepth(id, conceptElementsById) === depth)
          if (atThisDepth.length === 0) continue
          const byParent = new Map<string, [string, { topicIds: Set<string>; totalWeight: number }][]>()
          for (const entry of atThisDepth) {
            const parentId = depth === 1 ? c.id : (conceptElementsById.get(entry[0])?.parent_id ?? c.id)
            if (!byParent.has(parentId)) byParent.set(parentId, [])
            byParent.get(parentId)!.push(entry)
          }
          let rowsAtThisDepth = 0
          for (const [parentId, entries] of byParent) {
            const parentPos = nodePositions.get(parentId)
            if (!parentPos) continue // parent is at a shallower depth that hasn't laid out yet this pass only if maxDepth tracking is wrong -- defensive, shouldn't trigger given the closure above
            const items = entries.sort((a, b) => b[1].topicIds.size - a[1].topicIds.size).map(([id]) => ({ id }))
            usedUkIds.push(...items.map((u) => u.id))
            for (const item of items) parentOfUk.set(item.id, parentId)
            const { positions, rows } = layoutTier(items, parentPos.x, BK_ROW_Y + UK_ROW_GAP * scale + rowsSoFar * ukRowHeight, colWidth, ukRowHeight, 78)
            for (const [id, pos] of positions) nodePositions.set(id, pos)
            rowsAtThisDepth = Math.max(rowsAtThisDepth, rows)
          }
          rowsSoFar += rowsAtThisDepth
        }
        maxUkRows = Math.max(maxUkRows, rowsSoFar)
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
        const maxWidth = isRootAnchor ? (colWidthByRoot.get(anchorId) ?? width / rootConcepts.length) - 16 : UK_CHILD_WIDTH_BASE * scale
        const { positions, rows } = layoutTier(topicIds.map((id) => ({ id })), anchorPos.x, lzStartY, maxWidth, lzRowHeight, isRootAnchor ? 34 : 24)
        for (const [id, pos] of positions) nodePositions.set(id, pos)
        maxLzRows = Math.max(maxLzRows, rows)
      }
    }

    const neededHeight = Math.min(1600, Math.max(480, lzStartY + 90 + maxLzRows * lzRowHeight))

    // ---- Nodes ----
    const nodes: GraphNodeDatum[] = []
    rootConcepts.forEach((c) => {
      const count = lzCountByRoot.get(c.id) ?? 0
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
        // A real connector node (see the ancestor-closure note above) has
        // no byTarget entry of its own -- rendered anyway, at the floor
        // size, so its real children have a real node to visibly nest
        // under instead of being dropped or misattached to the root.
        const agg = byTarget.get(ukId) ?? EMPTY_AGG
        if (!el || !pos) continue
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
      // Real fix for feedback 50a7983a: each hierarchy edge now goes to the
      // node's REAL immediate parent (parentOfUk, built during layout above),
      // not blindly to the root every time.
      for (const ukId of usedUkIds) {
        const parentId = parentOfUk.get(ukId)
        if (!parentId) continue
        edges.push({ id: `h-${ukId}`, source: parentId, target: ukId, color: cssVar('--border', '#ccc'), weight: 1, kind: 'hierarchy' })
      }
    }
    if (showLz) {
      rawEdges.forEach((e, i) => {
        edges.push({ id: `r-${i}`, source: e.targetId, target: e.topicId, color: rootColor(e.rootId), weight: e.weight, kind: 'relevance' })
      })
    }
    // Real feedback e7333af2 (Susan, 2026-10-02): named, directed links
    // between any two concepts. Only rendered when BOTH endpoints are
    // already positioned (i.e. currently visible under the Unterkonzepte/
    // Feinere toggles) -- same "don't invent a node that isn't otherwise
    // shown" rule the rest of this graph already follows.
    if (showRelations) {
      for (const rel of relations) {
        const fromPos = nodePositions.get(rel.from_element_id)
        const toPos = nodePositions.get(rel.to_element_id)
        if (!fromPos || !toPos) continue
        edges.push({
          id: `rel-${rel.id}`, source: rel.from_element_id, target: rel.to_element_id,
          color: cssVar('--series-a', '#006c66'), weight: 1, kind: 'relation', tooltip: rel.relation_type,
        })
      }
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
  }, [topics, rootConcepts, contentById, conceptElementsById, showUk, showUk2, showLz, showRelations, relations, sizeBy, density, containerWidth])

  useEffect(() => {
    if (!containerRef.current || !model) return
    containerRef.current.style.height = `${model.height}px`

    const elements: ElementDefinition[] = [
      ...model.nodes.map((n) => ({ data: { id: n.id, label: n.label, color: n.color, size: n.size, opacity: n.opacity, kind: n.kind, tooltip: n.tooltip }, position: { x: n.x, y: n.y } })),
      ...model.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, color: e.color, weight: e.weight, kind: e.kind, tooltip: e.tooltip ?? '' } })),
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
          // Lighter range than before (was 0.2-0.7) -- a dense cluster (many
          // overlapping edges) now reads as "busy" rather than stacking up
          // into a near-solid block of color. Real 2026-10-01 feedback.
          selector: 'edge[kind="relevance"]',
          style: {
            width: 'mapData(weight, 0, 3, 1, 4)', 'line-color': 'data(color)', 'curve-style': 'bezier',
            'target-arrow-shape': 'none', opacity: 'mapData(weight, 0, 3, 0.12, 0.5)', 'transition-property': 'opacity', 'transition-duration': 180,
          } as any,
        },
        {
          selector: 'edge[kind="hierarchy"]',
          style: { width: 1, 'line-color': 'data(color)', 'curve-style': 'bezier', 'target-arrow-shape': 'none', opacity: 0.35, 'line-style': 'dashed' } as any,
        },
        {
          // Real feedback e7333af2 (Susan, 2026-10-02): a named, directed
          // cross-link -- solid and arrowed, unlike the dashed hierarchy
          // lines and the thin relevance lines, so it visually reads as its
          // own real category of connection rather than either of those.
          selector: 'edge[kind="relation"]',
          style: {
            width: 2, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'curve-style': 'bezier',
            'target-arrow-shape': 'triangle', 'arrow-scale': 1.1, opacity: 0.75,
          } as any,
        },
        {
          selector: 'edge.hover-label',
          style: {
            label: 'data(tooltip)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1,
            'text-background-padding': '4px', 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc'),
            'text-wrap': 'wrap', 'text-max-width': '160px', 'text-rotation': 'autorotate',
          } as any,
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
    cy.on('mouseover', 'edge[kind="relation"]', (evt) => evt.target.addClass('hover-label'))
    cy.on('mouseout', 'edge[kind="relation"]', (evt) => evt.target.removeClass('hover-label'))
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
          <button className={`chip-btn${showRelations ? ' active' : ''}`} onClick={() => setShowRelations((v) => !v)}>Querverbindungen</button>
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

      {showRelations && (
        <RelationPanel
          supabase={supabase}
          projectId={project.id}
          highlightId={highlightId}
          conceptElementsById={conceptElementsById}
          rootConcepts={rootConcepts}
          relations={relations}
          onChanged={reloadRelations}
        />
      )}

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

// Real feedback e7333af2 (Susan, 2026-10-02): create/review named, directed
// links between any two concepts. Tap a concept in the graph above (sets
// highlightId) to open the "create a link from this concept" form; every
// relation touching the tapped concept is listed below it with a way to
// remove it. A plain <select>, not a click-two-nodes graph gesture -- more
// reliable to build correctly, and 125 real concepts is navigable with
// optgroups by root.
function RelationPanel({
  supabase,
  projectId,
  highlightId,
  conceptElementsById,
  rootConcepts,
  relations,
  onChanged,
}: {
  supabase: ProjectOutletContext['supabase']
  projectId: string
  highlightId: string | null
  conceptElementsById: Map<string, SchemaElement>
  rootConcepts: SchemaElement[]
  relations: ConceptRelation[]
  onChanged: () => void
}) {
  const [targetId, setTargetId] = useState('')
  const [label, setLabel] = useState('')
  const [reverse, setReverse] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTargetId('')
    setLabel('')
    setReverse(false)
  }, [highlightId])

  if (!highlightId) {
    return <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>Ein Basiskonzept oder Unterkonzept antippen, um eine Querverbindung zu erstellen.</p>
  }
  const highlighted = conceptElementsById.get(highlightId)
  if (!highlighted) return null

  // One option per real concept except the highlighted one itself, grouped
  // by root the same way the Lernziele sidebar's Basiskonzepte filter is --
  // a flat 125-item list would be unusable otherwise.
  const byRoot = new Map<string, SchemaElement[]>()
  for (const el of conceptElementsById.values()) {
    if (el.id === highlightId) continue
    const root = ancestorAtDepth(el.id, 0, conceptElementsById) ?? el
    if (!byRoot.has(root.id)) byRoot.set(root.id, [])
    byRoot.get(root.id)!.push(el)
  }

  const touching = relations.filter((r) => r.from_element_id === highlightId || r.to_element_id === highlightId)

  const submit = async () => {
    if (!targetId || !label.trim()) return
    setSaving(true)
    const [fromId, toId] = reverse ? [targetId, highlightId] : [highlightId, targetId]
    await createConceptRelation(supabase, projectId, fromId, toId, label.trim())
    setSaving(false)
    setTargetId('')
    setLabel('')
    onChanged()
  }

  const remove = async (id: string) => {
    await deleteConceptRelation(supabase, id)
    onChanged()
  }

  return (
    <div className="card" style={{ marginTop: -4, marginBottom: 16 }}>
      <strong style={{ fontSize: 13 }}>Querverbindung von {highlighted.label}</strong>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="chip-btn"
          title="Richtung umkehren"
          onClick={() => setReverse((v) => !v)}
          style={{ fontFamily: 'monospace' }}
        >
          {reverse ? '←' : '→'}
        </button>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">Konzept wählen…</option>
          {rootConcepts.map((root) => (
            <optgroup key={root.id} label={root.label}>
              {(byRoot.get(root.id) ?? []).map((el) => (
                <option key={el.id} value={el.id}>{el.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="text"
          placeholder="Art der Verbindung (z. B. „ist ein Mechanismus von“)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ minWidth: 220, flex: 1 }}
        />
        <button className="btn btn-mini" disabled={!targetId || !label.trim() || saving} onClick={submit}>Verknüpfen</button>
      </div>

      {touching.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {touching.map((r) => {
            const outgoing = r.from_element_id === highlightId
            const other = conceptElementsById.get(outgoing ? r.to_element_id : r.from_element_id)
            return (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
                <span>{outgoing ? '→' : '←'} <strong>{r.relation_type}</strong> {other?.label ?? '?'}</span>
                <button className="btn-linklike" aria-label="Entfernen" onClick={() => remove(r.id)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Detail: per-Basiskonzept definition, misconception pairs (X/✓), everyday
// anchors -- real content imported from EvoMentor DE's own source data
// (migration 042), not placeholder text. Falls back honestly ("noch keine
// Detailinhalte") for a project that hasn't had this content imported.
// ============================================================================

function DetailTab({ rootConcepts, conceptElementsById }: { rootConcepts: SchemaElement[]; conceptElementsById: Map<string, SchemaElement> }) {
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
          <StudentBkDetail concept={selected} abbr={bkAbbreviation(selected.label)} conceptElementsById={conceptElementsById} />
        )}
      </div>
    </div>
  )
}

// Real feedback 87b2bb99 + 7fb73846 (Susan): add every Basiskonzept's real
// Unterkonzepte here, each with the same short explanation already shown on
// the Lernziele page's sub-concept chips (element.definition +
// metadata.beispiel, migration 059) -- same data, not new content.
//
// Real feedback (Susan, 2026-10-09/10, rows b4b1aade/0182976c/6a9b7103/
// 29e5eb06): this used to render BELOW a second, separately-curated
// "core_principles" chip row (migration 041/042 static content) that
// listed near-identical sub-concept names with slightly different
// wording -- e.g. "Biologisches System als offenes System" here vs.
// "Offene Systeme" in core_principles for the same real concept. Two
// never-reconciled data sources describing the same thing, shown twice,
// inconsistently. Fixed by deleting that redundant static row entirely
// (StudentBkDetail no longer reads core_principles) and keeping only this
// one real, taxonomy-backed list -- restyled as inline tags near the top
// of the page (Susan's own suggested pattern: "the subconcepts should
// just show up once, ideally at the top as tags, and when one clicks on
// the tabs, a window opens with the description... similar to how it is
// implemented in the learning goals cards"). A tag with no real
// definition or example yet (hasDetail = false) still renders -- it's
// real taxonomy, not nothing -- but visibly muted and non-interactive,
// instead of silently doing nothing on click (the "no explanation given"
// complaint: previously a tag you could click with no visible sign it had
// nothing to show).
function Subkonzepte({ rootId, conceptElementsById }: { rootId: string; conceptElementsById: Map<string, SchemaElement> }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const children = Array.from(conceptElementsById.values())
    .filter((el) => el.parent_id === rootId)
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
  if (children.length === 0) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {children.map((el) => {
          const beispiel = (el.metadata as any)?.beispiel as string | undefined
          const hasDetail = !!(el.definition || beispiel)
          const isOpen = openId === el.id
          return (
            <button
              key={el.id}
              className={`chip-btn${isOpen ? ' active' : ''}`}
              style={{ cursor: hasDetail ? 'pointer' : 'default', opacity: hasDetail ? 1 : 0.5 }}
              title={hasDetail ? undefined : 'Noch keine Beschreibung hinterlegt'}
              onClick={() => hasDetail && setOpenId(isOpen ? null : el.id)}
            >
              {el.label}
            </button>
          )
        })}
      </div>
      {openId && (() => {
        const el = children.find((c) => c.id === openId)
        if (!el) return null
        const beispiel = (el.metadata as any)?.beispiel as string | undefined
        return (
          <div style={{ fontSize: 13, margin: '6px 0 0', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, maxWidth: 560 }}>
            {el.definition && <p style={{ margin: 0 }}>{el.definition}</p>}
            {beispiel && <p className="muted" style={{ margin: '4px 0 0' }}><em>Beispiel:</em> {beispiel}</p>}
          </div>
        )
      })()}
    </div>
  )
}

function StudentBkDetail({ concept, conceptElementsById }: { concept: SchemaElement; abbr: string; conceptElementsById: Map<string, SchemaElement> }) {
  const definition = (concept as any).didactic_definition as string | null
  const misconceptions = ((concept as any).common_misconceptions ?? []) as { falsch: string; richtig: string; hinweis?: string }[]
  const anchors = ((concept as any).everyday_anchors ?? []) as string[]

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{concept.label}</h2>
      {!definition ? (
        <p className="muted">Noch keine Detailinhalte für dieses Basiskonzept hinterlegt.</p>
      ) : (
        <p>{definition}</p>
      )}

      <Subkonzepte rootId={concept.id} conceptElementsById={conceptElementsById} />

      {definition && (
        <>
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
