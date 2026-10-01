import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import cytoscape, { type ElementDefinition } from 'cytoscape'
import { Info } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { bkAbbreviation, bkEntries, buildBkLabelMap, getRootConcepts } from '@/lib/supabase/basiskonzepte'
import { listAcceptedConnections, listTopicContents, listTopics, type TopicListItem } from '@/lib/supabase/curriculum'

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

  useEffect(() => {
    getRootConcepts(supabase, project).then(setRootConcepts)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listTopicContents(supabase, project.id).then(setContentById)
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
      {activeTab === 'netz' && <NetzTab project={project} supabase={supabase} rootConcepts={rootConcepts} contentById={contentById} topics={topics} />}
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
    </div>
  )
}

function looksLikeBk(bkId: string, label: string): boolean {
  const tokens = bkId.replace(/^bk_/, '').split('_').filter(Boolean)
  const norm = label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '')
  return tokens.every((t) => norm.includes(t))
}

// ============================================================================
// Netz: Basiskonzepte pinned to a fixed top row, each one's own real
// Lernziele arranged in tiered/staggered rows beneath it -- Dustin's own
// explicit, twice-given spec (live feedback 2026-09-30: "basiskonzepte
// appear as disconnected islands... arranged as nodes on an upper row...
// lernziele links arranged systematically... in tiered/staggering rows
// below"). Positions are computed explicitly (Cytoscape's 'preset' layout),
// not left to a force-directed physics simulation -- the previous 'cose'
// layout treated each Basiskonzept's star of Lernziel connections as its own
// disconnected component (there's no real bk-to-bk edge in the base data),
// which is exactly what a physics layout does with disconnected components:
// scatters them, unpredictably from render to render.
//
// The dashed gray arcs between Basiskonzepte ARE new, and they're real, not
// fabricated: two Lernziele under different Basiskonzepte that have a real,
// accepted curriculum connection between them (lpm_connections) count as one
// piece of evidence those two Basiskonzepte relate. The number on each arc is
// that real count. This is a DERIVED aggregate, not a first-class OpenLPM
// construct -- see the crosswalk note atop lib/supabase/basiskonzepte.ts.
//
// The solid colored spokes are unchanged from before: real Basiskonzept<->
// Lernziel edges from lpm_thread_stations.via_element_id (migration 010's
// real coherence-thread data), colored by which Basiskonzept a Lernziel
// connects through. Tapping a Lernziel node opens its own detail page. A
// growth-over-time strip beneath it plots real lpm_threads.created_at
// timestamps -- the class's own coherence work filling in over the
// semester, not a synthetic demo metric.
// ============================================================================

// A Lernziel<->Basiskonzept pairing counts as a real edge worth drawing once
// its own relevance rating reaches "relevant" (2/3) or above -- below that,
// a 0 or 1 rating is real data too, but showing it as a full edge would
// bury the meaningful overlap under near-universal noise (most Lernziele
// score at least 1/3 against most Basiskonzepte). 2/3 is the same
// real-world threshold a teacher reading the Lernziele cards' own dot
// indicators would read as "yes, this genuinely relates."
const RELEVANCE_EDGE_THRESHOLD = 2

function NetzTab({
  project,
  supabase,
  rootConcepts,
  contentById,
  topics,
}: {
  project: ProjectOutletContext['project']
  supabase: ProjectOutletContext['supabase']
  rootConcepts: SchemaElement[]
  contentById: Map<string, unknown>
  topics: TopicListItem[] | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [threads, setThreads] = useState<
    { id: string; created_at: string; title: string; stations: { data_object_id: string; via_element_id: string | null; object_title: string }[] }[] | null
  >(null)
  const [connections, setConnections] = useState<{ from_object_id: string; to_object_id: string }[] | null>(null)

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

  useEffect(() => {
    if (!containerRef.current || !topics || rootConcepts.length === 0) return
    const width = containerRef.current.clientWidth || 900
    const rootIndex = new Map(rootConcepts.map((r, i) => [r.id, i]))

    // Real bug found live 2026-09-30 ("it should be that many lernziele
    // connect to many basiskonzepte... the whole point is to model the
    // conceptual overlap"): the spokes used to come only from accepted
    // coherence threads (lpm_thread_stations) -- a real but narrow, curated
    // construct (4 threads, 24 stations total in this project). The much
    // richer real data is every Lernziel's own basiskonzeptbezug relevance
    // rating against ALL SIX Basiskonzepte (the same field the Lernziele
    // cards' own relevance dots show) -- a Lernziel can genuinely score
    // "relevant" or "highly relevant" against three or four Basiskonzepte
    // at once, and that overlap is exactly what wasn't showing. Every real
    // Lernziel now draws a real edge to every Basiskonzept it scores
    // RELEVANCE_EDGE_THRESHOLD or higher against -- not just the one thread
    // curation happened to route it through.
    const allBkIds = Array.from(new Set(Array.from(contentById.values()).flatMap((c) => bkEntries(c).map((e) => e.basiskonzept_id))))
    const resolvedLabel = buildBkLabelMap(allBkIds, rootConcepts)
    const labelToRootId = new Map(rootConcepts.map((r) => [r.label, r.id]))

    const leafTitle = new Map<string, string>()
    const leavesByBk = new Map<string, string[]>() // primary (highest-scoring) column only, for layout
    const bkLeafEdges: { source: string; target: string; color: string; weight: number }[] = []
    // Per-Lernziel centrality: the SUM of its kept (>=RELEVANCE_EDGE_THRESHOLD)
    // relevance weights across every Basiskonzept it connects to -- not a raw
    // edge count, so one genuine 3/3 connection doesn't score lower than three
    // near-threshold 2/3s, and a Lernziel relevant to several Basiskonzepte at
    // once (the real overlap this graph exists to show) scores higher than one
    // relevant to only one. Drives node size, fill strength, and sort order
    // below -- Dustin's own explicit ask (feedback 2026-09-30, 18:41): "sort,
    // size, and/or shade the lernziele nodes in relation to their
    // basiskonzepte link centrality and strength."
    const leafMeta = new Map<string, { primaryColor: string; primaryWeight: number; totalWeight: number }>()
    for (const t of topics) {
      const scored = bkEntries(contentById.get(t.id))
        .map((e) => ({ rootId: labelToRootId.get(resolvedLabel[e.basiskonzept_id] ?? ''), weight: e.relevanz_beurteilung }))
        .filter((e): e is { rootId: string; weight: number } => !!e.rootId && e.weight >= RELEVANCE_EDGE_THRESHOLD)
      if (scored.length === 0) continue
      leafTitle.set(t.id, t.title)
      const primary = scored.reduce((best, e) => (e.weight > best.weight ? e : best), scored[0])
      const primaryIdx = rootIndex.get(primary.rootId)!
      const totalWeight = scored.reduce((sum, e) => sum + e.weight, 0)
      leafMeta.set(t.id, { primaryColor: cssVar(MAP_PALETTE[primaryIdx % 6], '#999'), primaryWeight: primary.weight, totalWeight })
      const arr = leavesByBk.get(primary.rootId) ?? []
      arr.push(t.id)
      leavesByBk.set(primary.rootId, arr)
      for (const e of scored) {
        const idx = rootIndex.get(e.rootId)!
        bkLeafEdges.push({ source: e.rootId, target: t.id, color: cssVar(MAP_PALETTE[idx % 6], '#999'), weight: e.weight })
      }
    }
    // Most-central Lernziele sort first within their column -- the layout
    // below fills each column's tiered rows in array order, so this places
    // the strongest/broadest connections closest to their Basiskonzept.
    // "Closer to the hub = more central" reads intuitively without a legend.
    for (const arr of leavesByBk.values()) {
      arr.sort((a, b) => (leafMeta.get(b)?.totalWeight ?? 0) - (leafMeta.get(a)?.totalWeight ?? 0))
    }

    // Deterministic positions: Basiskonzepte on a fixed row, each one's own
    // Lernziele (by their strongest concept) tiered in staggered rows
    // beneath it. A Lernziel that's ALSO relevant to other Basiskonzepte
    // still draws a real edge across to them from wherever it's anchored --
    // that's what shows the real overlap between columns.
    const colWidth = width / rootConcepts.length
    const rowY0 = 60
    const rowHeight = 40
    const positions = new Map<string, { x: number; y: number }>()
    rootConcepts.forEach((c, i) => positions.set(c.id, { x: (i + 0.5) * colWidth, y: rowY0 }))
    let maxRows = 1
    rootConcepts.forEach((c) => {
      const leaves = leavesByBk.get(c.id) ?? []
      const cols = Math.max(2, Math.ceil(Math.sqrt(leaves.length || 1)))
      const colW = Math.min(80, (colWidth - 16) / cols)
      leaves.forEach((leafId, i) => {
        const row = Math.floor(i / cols)
        maxRows = Math.max(maxRows, row + 1)
        const col = i % cols
        const rowLeaves = Math.min(cols, leaves.length - row * cols)
        const rowWidth = rowLeaves * colW
        const stagger = row % 2 === 1 ? colW / 2 : 0
        const startX = positions.get(c.id)!.x - rowWidth / 2 + colW / 2 + stagger
        positions.set(leafId, { x: startX + col * colW, y: rowY0 + 110 + row * rowHeight })
      })
    })
    const neededHeight = Math.min(1400, Math.max(480, rowY0 + 150 + maxRows * rowHeight))
    containerRef.current.style.height = `${neededHeight}px`

    const elements: ElementDefinition[] = [
      ...rootConcepts.map((c, i) => ({
        data: { id: c.id, label: c.label, color: cssVar(MAP_PALETTE[i % 6], '#2a78d6'), size: 44, opacity: 1, kind: 'bk' },
        position: positions.get(c.id),
      })),
      ...Array.from(leafTitle.entries()).map(([id, title]) => {
        const meta = leafMeta.get(id)
        // Size scales with centrality (sqrt-damped so a handful of
        // high-overlap outliers don't blow out the rest of the grid); fill
        // opacity reflects the primary connection's own relevance strength
        // (the same 0-3 scale the spokes already use), so a node's own
        // solidity visually agrees with the edge feeding it -- this is the
        // "colorization" + "size/shade by centrality and strength" fix.
        const size = meta ? Math.min(26, 9 + Math.sqrt(meta.totalWeight) * 5) : 12
        const opacity = meta ? Math.max(0.4, meta.primaryWeight / 3) : 0.5
        return {
          data: {
            id,
            label: title.length > 26 ? title.slice(0, 24) + '…' : title,
            color: meta?.primaryColor ?? cssVar('--surface-1', '#eee'),
            size,
            opacity,
            kind: 'lz',
          },
          position: positions.get(id) ?? { x: width / 2, y: rowY0 + 110 },
        }
      }),
      ...bkLeafEdges.map((e, i) => ({ data: { id: `lz-e-${i}`, source: e.source, target: e.target, color: e.color, weight: e.weight, kind: 'lz-edge' } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      minZoom: 0.5,
      maxZoom: 2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)', 'background-opacity': 'data(opacity)',
            width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 8, 'text-wrap': 'wrap', 'text-max-width': '60px',
            'text-valign': 'bottom', 'text-margin-y': 3, color: cssVar('--text-primary', '#0b0b0b'),
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
          // Real bug found live 2026-09-30: once every Lernziel draws a real
          // edge to every Basiskonzept it's genuinely relevant to (see the
          // comment above this effect), there can be 200+ Lernziel nodes on
          // screen -- their labels permanently on, all at once, overlapped
          // into an unreadable smear. The crossing EDGES are the actual
          // signal here (that's what shows the real overlap); a label only
          // needs to appear once someone is actually looking at that one
          // node.
          selector: 'node[kind="lz"]',
          style: { label: '' },
        },
        {
          selector: 'node[kind="lz"].lz-hover',
          style: {
            label: 'data(label)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1,
            'text-background-padding': '3px', 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc'),
          } as any,
        },
        {
          // Weighted by the real relevanz_beurteilung (0-3) between this
          // specific Lernziel and this specific Basiskonzept -- a highly
          // relevant pairing (3/3) draws a visibly thicker, more opaque
          // spoke than a marginal one (1/3), instead of every accepted
          // connection looking equally strong regardless of how relevant it
          // actually is.
          selector: 'edge[kind="lz-edge"]',
          style: {
            width: 'mapData(weight, 0, 3, 1, 4)', 'line-color': 'data(color)', 'curve-style': 'bezier',
            'target-arrow-shape': 'none', opacity: 'mapData(weight, 0, 3, 0.25, 0.75)',
          } as any,
        },
      ],
    })
    cy.on('tap', 'node[kind="lz"]', (evt) => navigate(`/dashboard/${project.slug}/${evt.target.id()}`))
    cy.on('mouseover', 'node[kind="lz"]', (evt) => {
      if (containerRef.current) containerRef.current.style.cursor = 'pointer'
      evt.target.addClass('lz-hover')
    })
    cy.on('mouseout', 'node[kind="lz"]', (evt) => {
      if (containerRef.current) containerRef.current.style.cursor = ''
      evt.target.removeClass('lz-hover')
    })
    return () => cy.destroy()
  }, [topics, rootConcepts, contentById, project.slug, navigate])

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
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ height: 480, minHeight: 480 }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Große Kreise (obere Reihe) = Basiskonzepte. Kleine Punkte darunter = einzelne Lernziele,
        mit einer echten, bewerteten Linie zu jedem Basiskonzept, dem sie wirklich zugeordnet
        sind — viele Lernziele gehören zu mehreren Basiskonzepten zugleich, deshalb kreuzen
        manche Linien zwischen den Spalten. Dickere, kräftigere Linien = höhere bewertete
        Relevanz. Ein Lernziel-Punkt ist in der Farbe seines stärksten Basiskonzepts eingefärbt;
        größere, kräftigere Punkte hängen insgesamt stärker und mit mehreren Basiskonzepten
        zugleich zusammen, und stehen näher an ihrem Basiskonzept — antippen öffnet ein Lernziel.
      </p>

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
