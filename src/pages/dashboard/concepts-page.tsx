import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { ChevronDown, ChevronRight, Download, LayoutList, Layers, Loader2, Maximize2, Network, Shapes, X } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { listConceptRelations, type ConceptRelation } from '@/lib/supabase/concept-relations'
import { conceptDefinition, conceptSource } from '@/lib/concept-source'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { ReviewQuestionsPanel } from '@/components/review-questions-panel'
import {
  DEFAULT_GRAPH_SETTINGS,
  arcHeight,
  lineOpacity,
  physicsLayoutOptions,
  pickVisibleLabels,
  truncateLabel,
  type GraphEdgeMode,
  type GraphViewSettings,
  type LabelCandidate,
} from '@/lib/graph-standards'

cytoscape.use(dagre)

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const MAP_PALETTE = ['--map-1', '--map-2', '--map-3', '--map-4', '--map-5', '--map-6']

// Real feedback 2427b091 (Dustin): "zooming the full map to fit perfectly
// within the window on loading" -- a plain cy.fit() does exactly that, but
// for a real tree this size (EvoMentor Thuringia: ~130 nodes once laid out
// with real, non-overlapping spacing) that means zooming out far enough
// that every node and label becomes illegible, which defeats the point of
// fitting in the first place. Fits, then refuses to go below a zoom level
// where a label would still be readable -- the whole tree may no longer
// fit in that case, but what's on screen is actually usable, and panning
// reaches the rest.
const MIN_READABLE_ZOOM = 0.45
function fitWithReadableFloor(cy: Core) {
  cy.fit(undefined, 24)
  if (cy.zoom() < MIN_READABLE_ZOOM) {
    cy.zoom(MIN_READABLE_ZOOM)
    cy.center()
  }
}

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']
type ProjectBaseLink = Database['public']['Tables']['project_base_links']['Row']

// 2026-09-13 restructure: Schema (taxonomy management + ConceptBase import)
// and Concepts (cross-project concept map + relevance analytics) folded
// into one sidebar space, per Dustin's explicit "Schema gets replaced by
// Concepts" instruction. Both tabs below are the same two components that
// used to be separate pages, unmodified internally -- still reading/writing
// `lpm_schema_elements` directly. The plan's longer-term design moves this
// onto the new `frameworks`/`framework_tags` tables (migration
// 018_frameworks_and_crosswalks.sql) instead, generalized to also cover
// subject-area and grade-band taxonomies -- deliberately not done in this
// pass: that migration hasn't reached the live database yet, and moving
// real, already-live Basiskonzepte content onto a new table is exactly the
// kind of change that needs its own careful, separately-verified pass, not
// bundled into a page-layout reorganization.

const CONCEPTBASE_REPO = 'openevo-ccs/conceptbase'

interface ConceptBaseConcept {
  id: string
  type: string
  status: string
  version: string
  definedInVocabulary: string
  labels: Record<string, string>
  definitions?: Record<string, Record<string, string>>
  relations?: Record<string, string[]>
}

function mapStatus(cbStatus: string): 'proposed' | 'discussed' | 'accepted' | 'deprecated' {
  if (cbStatus === 'stable') return 'accepted'
  if (cbStatus === 'deprecated') return 'deprecated'
  return 'proposed'
}

type Tab = 'explore' | 'manage'

export default function ConceptsPage() {
  const { conceptId } = useParams<{ conceptId?: string }>()
  const [tab, setTab] = useState<Tab>('explore')

  // A concept link only ever points at the Explore tab's tree+detail view
  // (where real cross-project connections live) -- land there regardless of
  // which tab was open before, whether the link came from the Manage tab's
  // own "see how this connects to real content" button, a shared link, or
  // the search bar.
  useEffect(() => {
    if (conceptId) setTab('explore')
  }, [conceptId])

  return (
    <div>
      <h1 className="row"><Layers size={18} style={{ color: 'var(--text-muted)' }} />Concepts</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        The concepts and concept-domain relations this LPM is organized around — browse how they
        connect to the parts of the progression, or manage the taxonomy itself.
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 20 }}>
        <button className={`btn btn-mini${tab === 'explore' ? ' btn-primary' : ''}`} onClick={() => setTab('explore')}>
          Explore
        </button>
        <button className={`btn btn-mini${tab === 'manage' ? ' btn-primary' : ''}`} onClick={() => setTab('manage')}>
          Manage taxonomy
        </button>
      </div>

      {tab === 'explore' ? <ConceptMapTab /> : <ManageConceptsTab />}
    </div>
  )
}

// ============================================================================
// Explore tab -- formerly the standalone Concepts page: a shared concept
// tree cross-referenced against every real regional sub-project's own
// tagged learning goals.
// ============================================================================

interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
}

interface Hit {
  projectSlug: string
  projectName: string
  objectId: string
  title: string
  gradeBand: string | null
  relevance: number
  reasoning: string
}

function ConceptMapTab() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const { conceptId } = useParams<{ conceptId?: string }>()
  const navigate = useNavigate()
  const [taxonomy, setTaxonomy] = useState<SchemaElement[] | null>(null)
  const [relations, setRelations] = useState<ConceptRelation[]>([])
  const [children, setChildren] = useState<ProjectRow[]>([])
  const [hitsByTaxId, setHitsByTaxId] = useState<Map<string, Hit[]>>(new Map())
  const [hitsByBk, setHitsByBk] = useState<Map<string, Map<string, { sum: number; count: number }>>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hubName, setHubName] = useState<string>(project.name)
  const [view, setView] = useState<'map' | 'list'>('map')

  // The shared taxonomy and its full sibling list live on the Project Space
  // -- viewing this tab from inside a regional sub-project (Thuringia,
  // Bayern, Sachsen...) still needs the Space-level picture too, not only
  // that sub-project's own schema rows.
  const hubProjectId = project.parent_project_id ?? project.id

  // 2026-09-19: query BOTH the hub and this project's own id, not just the
  // hub -- an earlier version assumed a regional sub-project's own schema
  // rows are always empty and the real taxonomy always lives one level up,
  // but real content can land directly on a sub-project's own project_id
  // too (e.g. evomentor-thuringia's Basiskonzepte taxonomy, migration 028,
  // confirmed still there per migration 016's own live-data audit). Mirrors
  // the union ManageConceptsTab below already does for the same reason.
  const taxonomyProjectIds = useMemo(
    () => Array.from(new Set([hubProjectId, project.id])),
    [hubProjectId, project.id]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: hub } = await supabase.from('projects').select('*').eq('id', hubProjectId).maybeSingle()
      const hubProject = hub ?? project

      const { data: tax } = await supabase
        .from('lpm_schema_elements')
        .select('*')
        .in('project_id', taxonomyProjectIds)
        .order('created_at', { ascending: true })

      // Real bug found live 2026-10-01 (Dustin, reported directly: "the
      // list view has duplicates... the network graph frame makes little
      // to no sense"): the hub project ("evomentor") has its own full copy
      // of the 6 root Basiskonzepte (created 2026-09-12), separate from
      // evomentor-thuringia's own copy -- querying project_id IN (hub,
      // this project) therefore returns BOTH, 12 root rows for 6 real
      // concepts. Invisible to a regular project member (RLS correctly
      // hides hub-only rows from someone who isn't a hub member), which is
      // why this sat unnoticed since 2026-09-12 -- only an owner/admin, who
      // can see both, would ever see the duplication. The student-facing
      // getRootConcepts (lib/supabase/basiskonzepte.ts) already solved this
      // exact problem 2026-09-30 by deduping-by-label, preferring the
      // current project's own row; this page did its own separate,
      // un-deduped query and never got the same fix. Applying the identical
      // rule here, on the raw taxonomy itself (not just a `roots` filter)
      // so the graph and tree -- which both walk `taxonomy` directly, not
      // just its root-level rows -- stop rendering the hub's orphaned,
      // childless duplicates too.
      //
      // Found live while verifying this fix: the hub's own duplicate root
      // ISN'T childless -- it has its own real sub-concepts too. Dropping
      // only the duplicate root row left those children in `taxonomy`
      // pointing at a parent_id that no longer existed, which crashed
      // Cytoscape outright ("Can not create edge... with nonexistent
      // source"). The whole dropped root's subtree has to go, not just the
      // root row itself.
      const dedupedTax = (() => {
        const byId = new Map((tax ?? []).map((r) => [r.id, r]))
        const byLabelAtRoot = new Map<string, string>() // label -> id of the kept root row
        for (const row of tax ?? []) {
          if (row.parent_id) continue
          const existing = byLabelAtRoot.get(row.label)
          if (!existing) { byLabelAtRoot.set(row.label, row.id); continue }
          const existingRow = byId.get(existing)
          if (existingRow && existingRow.project_id !== project.id && row.project_id === project.id) byLabelAtRoot.set(row.label, row.id)
        }
        const droppedRootIds = (tax ?? []).filter((r) => !r.parent_id && byLabelAtRoot.get(r.label) !== r.id).map((r) => r.id)
        const droppedIds = new Set(droppedRootIds)
        let grew = true
        while (grew) {
          grew = false
          for (const row of tax ?? []) {
            if (row.parent_id && droppedIds.has(row.parent_id) && !droppedIds.has(row.id)) { droppedIds.add(row.id); grew = true }
          }
        }
        return (tax ?? []).filter((r) => !droppedIds.has(r.id))
      })()

      const { data: kids } = await supabase
        .from('projects')
        .select('*')
        .eq('parent_project_id', hubProjectId)

      const projectIds = [hubProjectId, ...(kids ?? []).map((k) => k.id)]
      const { data: objects } = await supabase
        .from('lpm_data_objects')
        .select('id, title, grade_band, project_id, content')
        .in('project_id', projectIds)

      if (cancelled) return

      const projById = new Map<string, ProjectRow>()
      if (kids) for (const k of kids) projById.set(k.id, k)
      projById.set(hubProjectId, hubProject)

      const byTaxId = new Map<string, Hit[]>()
      const byBk = new Map<string, Map<string, { sum: number; count: number }>>()

      for (const obj of objects ?? []) {
        const bkb: BkbEntry[] = (obj.content as any)?.basiskonzeptbezug ?? []
        const p = projById.get(obj.project_id)
        if (!p) continue
        for (const entry of bkb) {
          if (!entry.basiskonzept_id) continue
          if (!byBk.has(entry.basiskonzept_id)) byBk.set(entry.basiskonzept_id, new Map())
          const perProject = byBk.get(entry.basiskonzept_id)!
          const cur = perProject.get(p.slug) ?? { sum: 0, count: 0 }
          cur.sum += entry.relevanz_beurteilung ?? 0
          cur.count += 1
          perProject.set(p.slug, cur)

          if ((entry.relevanz_beurteilung ?? 0) < 2) continue
          const subTags = [...(entry.relevante_unterkonzepte_taxonomie ?? []), ...(entry.relevante_evolutionskonzepte_taxonomie ?? [])]
          const hit: Hit = {
            projectSlug: p.slug,
            projectName: p.name,
            objectId: obj.id,
            title: obj.title,
            gradeBand: obj.grade_band,
            relevance: entry.relevanz_beurteilung,
            reasoning: entry.begruendung,
          }
          for (const tag of subTags) {
            if (!tag.taxonomyElementId) continue
            if (!byTaxId.has(tag.taxonomyElementId)) byTaxId.set(tag.taxonomyElementId, [])
            byTaxId.get(tag.taxonomyElementId)!.push(hit)
          }
        }
      }

      setTaxonomy(dedupedTax)
      setChildren(kids ?? [])
      setHitsByTaxId(byTaxId)
      setHitsByBk(byBk)
      setHubName(hubProject.name)

      // Real feedback 553dc7cd (Dustin, 2026-10-20): "Why is this concept
      // map without links?" -- the graph below only ever drew parent_id
      // tree edges; lpm_concept_relations (migration 087) is a real,
      // separate many-to-many concept network that existed in the schema
      // but was never fetched here (only the Jena Basiskonzepte Netz tab
      // used it). Fetched for every taxonomy project, not just the hub --
      // same reasoning as taxonomyProjectIds above.
      const allRelations = (
        await Promise.all(taxonomyProjectIds.map((pid) => listConceptRelations(supabase, pid)))
      ).flat()
      if (!cancelled) setRelations(allRelations)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, hubProjectId, taxonomyProjectIds])

  const roots = useMemo(() => (taxonomy ?? []).filter((e) => !e.parent_id), [taxonomy])
  const childrenOf = (id: string) => (taxonomy ?? []).filter((e) => e.parent_id === id)

  const selectedNode = useMemo(
    () => (conceptId ? (taxonomy ?? []).find((e) => e.id === conceptId) ?? null : null),
    [taxonomy, conceptId]
  )

  // Refreshing or sharing a link to a specific concept should land on that
  // concept, not an empty picker -- but a nested node is only visible in the
  // tree once every ancestor above it is toggled open, so walk the chain up
  // to the root and expand each one.
  useEffect(() => {
    if (!taxonomy || !selectedNode) return
    const byId = new Map(taxonomy.map((e) => [e.id, e]))
    const ancestors: string[] = []
    let parentId = selectedNode.parent_id
    while (parentId) {
      ancestors.push(parentId)
      parentId = byId.get(parentId)?.parent_id ?? null
    }
    if (ancestors.length > 0) {
      setExpanded((prev) => new Set([...prev, ...ancestors]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy, selectedNode?.id])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectNode = (n: SchemaElement) => navigate(`/dashboard/${project.slug}/concepts/${n.id}`)
  const closeNode = () => navigate(`/dashboard/${project.slug}/concepts`)

  // A synthetic space has no regional sub-projects: its sandbox sub-projects would show up as columns of dashes.
  const isSyntheticSpace = project.epistemic_status === 'designed-thought-experiment'

  if (taxonomy === null) return <p className="muted">Loading…</p>

  return (
    <div>
      {isSyntheticSpace ? (
        <p className="muted" style={{ marginBottom: 16 }}>
          The concepts of {hubName}, with their definitions and how they relate. This space is a synthetic model: its vocabulary is an
          AI-drafted design that no subject expert has reviewed yet. The coverage of official curricula is on the comparison pages.
        </p>
      ) : (
        <p className="muted" style={{ marginBottom: 16 }}>
          One concept structure, shared across every real regional curriculum in {hubName} — for
          finding what a specific concept looks like across states, and for comparing how much weight
          each state's curriculum actually gives it.
        </p>
      )}

      {children.length > 1 && !isSyntheticSpace && (
        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>How much each state emphasizes each concept</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            Average relevance (1 = not relevant, 3 = central), computed from every item's own judgment.
          </p>
          <table>
            <thead>
              <tr>
                <th>Concept</th>
                {children.map((c) => <th key={c.id}>{c.name.replace('EvoMentor ', '')}</th>)}
              </tr>
            </thead>
            <tbody>
              {roots.map((bk) => {
                // Real bug found live 2026-10-01, surfaced by the dedup fix
                // above: the hub's own copy of a root concept stores this
                // cross-project lookup key under metadata.canonical_id, but
                // evomentor-thuringia's own copy (the one now kept, since it
                // has the real children) stores the SAME value under
                // metadata.source_id instead -- two different field names
                // for what every real Lernziel's basiskonzept_id actually
                // matches against. Checking both keeps this table working
                // regardless of which project's copy ends up being the one
                // kept for a given root.
                const canonicalId = (bk.metadata as any)?.canonical_id ?? (bk.metadata as any)?.source_id
                const perProject = hitsByBk.get(canonicalId)
                return (
                  <tr key={bk.id}>
                    <th>{bk.label}</th>
                    {children.map((c) => {
                      const cell = perProject?.get(c.slug)
                      const avg = cell ? cell.sum / cell.count : null
                      const color = avg === null ? 'var(--text-muted)' : avg >= 2.2 ? 'var(--good)' : avg >= 1.5 ? 'var(--series-a)' : 'var(--text-muted)'
                      return (
                        <td key={c.id} style={{ color, fontWeight: avg && avg >= 2.2 ? 700 : 400 }}>
                          {avg === null ? '—' : avg.toFixed(1)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button className={`btn btn-mini${view === 'map' ? ' btn-primary' : ''}`} onClick={() => setView('map')}>
          <Network size={12} />Map
        </button>
        <button className={`btn btn-mini${view === 'list' ? ' btn-primary' : ''}`} onClick={() => setView('list')}>
          <LayoutList size={12} />List
        </button>
      </div>

      {view === 'map' ? (
        <ConceptMapPanel
          taxonomy={taxonomy}
          hitsByTaxId={hitsByTaxId}
          roots={roots}
          relations={relations}
          selectedNode={selectedNode}
          onSelect={selectNode}
          onClose={closeNode}
        />
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Browse the concept tree</h3>
            {roots.map((bk) => (
              <ConceptNode
                key={bk.id}
                node={bk}
                depth={0}
                childrenOf={childrenOf}
                expanded={expanded}
                onToggle={toggle}
                onSelect={selectNode}
                selectedId={selectedNode?.id ?? null}
                hitsByTaxId={hitsByTaxId}
              />
            ))}
          </div>

          <div className="card" style={{ minHeight: 200 }}>
            {!selectedNode ? (
              <p className="muted">Pick a concept on the left to see which real learning goals, across which states, connect to it.</p>
            ) : (
              <ConceptDetail node={selectedNode} hits={hitsByTaxId.get(selectedNode.id) ?? []} onClose={closeNode} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// The Concepts map follows the OpenLPM graph standard (see
// lab_manager/docs/design-notes/openlpm-graph-visualization-standards-proposal-
// 2026-10-25.md, tracker row 2). Roles here:
//   item        a concept
//   group       a top-level concept (always labeled), when the taxonomy has a hierarchy
//   main link   the parent-to-child line of the hierarchy (always drawn)
//   other link  a named concept-to-concept relation (lpm_concept_relations)
//   arc         the number of relations between two top-level concepts' subtrees
// Two shapes of data exist today. A hierarchy of about six top-level concepts
// (EvoMentor) gets the tree layout and counted arcs. A flat list of 17 to 29
// concepts with dozens of co-occurrence relations (the synthetic spaces) gets
// a ring layout, because a tree layout would invent a ranking among peers, and
// the relations are the only structure, drawn quiet and brought into focus on
// hover.
function ConceptMapPanel({
  taxonomy,
  hitsByTaxId,
  roots,
  relations,
  selectedNode,
  onSelect,
  onClose,
}: {
  taxonomy: SchemaElement[]
  hitsByTaxId: Map<string, Hit[]>
  roots: SchemaElement[]
  relations: ConceptRelation[]
  selectedNode: SchemaElement | null
  onSelect: (n: SchemaElement) => void
  onClose: () => void
}) {
  const hasHierarchy = useMemo(() => taxonomy.some((n) => !!n.parent_id), [taxonomy])
  const relationCount = useMemo(() => {
    const ids = new Set(taxonomy.map((n) => n.id))
    return relations.filter((r) => ids.has(r.from_element_id) && ids.has(r.to_element_id)).length
  }, [taxonomy, relations])

  const defaults = useMemo(() => ({ ...DEFAULT_GRAPH_SETTINGS, edges: (hasHierarchy ? 'bundled' : 'all') as GraphEdgeMode }), [hasHierarchy])
  const [gs, updateGs, resetGs] = useGraphSettings(hasHierarchy ? 'concepts-map-tree' : 'concepts-map-flat', defaults)
  // Physics spacing fires on every pixel of a drag; the layout recomputes once it holds still.
  const [physicsSpacing, setPhysicsSpacing] = useState(gs.spacing)
  useEffect(() => {
    const t = window.setTimeout(() => setPhysicsSpacing(gs.spacing), 250)
    return () => window.clearTimeout(t)
  }, [gs.spacing])

  const apiRef = useRef<{ zoomBy: (f: number) => void; fit: () => void } | null>(null)

  return (
    <>
      <GraphControls
        settings={gs}
        onChange={updateGs}
        onReset={() => resetGs()}
        lang="en"
        showConnections={relationCount > 0}
        edgeModes={hasHierarchy ? ['tree', 'bundled', 'all'] : ['tree', 'all']}
        wording={{
          tree: hasHierarchy
            ? { label: 'Hierarchy only', hint: 'Only the parent and child lines. A concept’s named relations appear when you point at it or select it.' }
            : { label: 'On hover only', hint: 'No relation lines until you point at a concept or select it.' },
          bundled: { label: 'Bundled', hint: 'The hierarchy, plus thick arcs between the top-level concepts with the number of relations between their subtrees. A concept’s own relations appear when you point at it.' },
          all: { label: 'All relations', hint: 'Every named relation is drawn. Pointing at a concept brings its relations forward.' },
          fixed: hasHierarchy
            ? { label: 'Tree', hint: 'A fixed top-down tree, always the same.' }
            : { label: 'Ring', hint: 'A fixed ring in alphabetical order, always the same.' },
        }}
        onZoomIn={() => apiRef.current?.zoomBy(1.25)}
        onZoomOut={() => apiRef.current?.zoomBy(0.8)}
        onFit={() => apiRef.current?.fit()}
      />
      <div className="explorer-body" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <ConceptGraph
          taxonomy={taxonomy}
          hitsByTaxId={hitsByTaxId}
          roots={roots}
          relations={relations}
          selectedId={selectedNode?.id ?? null}
          onSelect={onSelect}
          gs={gs}
          physicsSpacing={physicsSpacing}
          hasHierarchy={hasHierarchy}
          apiRef={apiRef}
        />
        <div className="drawer-shell wide">
          <div className="drawer">
            {!selectedNode ? (
              <>
                <h2>Concept map</h2>
                <p className="muted">
                  Each circle is a concept, sized by how much of the progression uses it
                  {hasHierarchy ? '' : ' and by how many relations it has'}. Click one to see what connects to
                  it. Scroll to zoom, drag to pan.
                </p>
                {relationCount > 0 && (
                  <p className="muted">
                    {relationCount} named relations connect these concepts. Point at a concept to bring its own
                    relations forward, or change what is drawn with the controls above the map.
                  </p>
                )}
              </>
            ) : (
              <ConceptDetail node={selectedNode} hits={hitsByTaxId.get(selectedNode.id) ?? []} onClose={onClose} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// A real interactive diagram instead of an indented list -- the single
// biggest gap found comparing this page against EvoMentor DE v1.2's concept
// map (2026-09-19). Reuses the same graph-drawing library (Cytoscape)
// already working in Notebooks (portfolio-explorer.tsx) rather than
// building or learning new drawing tech. Deliberately generic: node count/
// depth/branching isn't assumed anywhere (no fixed "6 concepts" the way
// EvoMentor's hex layout hard-codes), and every node's color comes from
// walking up to its own top-level ancestor, not a hard-typed lookup.
function ConceptGraph({
  taxonomy,
  hitsByTaxId,
  roots,
  relations,
  selectedId,
  onSelect,
  gs,
  physicsSpacing,
  hasHierarchy,
  apiRef,
}: {
  taxonomy: SchemaElement[]
  hitsByTaxId: Map<string, Hit[]>
  roots: SchemaElement[]
  relations: ConceptRelation[]
  selectedId: string | null
  onSelect: (n: SchemaElement) => void
  gs: GraphViewSettings
  physicsSpacing: number
  hasHierarchy: boolean
  apiRef: React.MutableRefObject<{ zoomBy: (f: number) => void; fit: () => void } | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const selectedIdRef = useRef<string | null>(selectedId)
  selectedIdRef.current = selectedId

  const rootIndexOf = useMemo(() => {
    const byId = new Map(taxonomy.map((e) => [e.id, e]))
    const rootIndex = new Map(roots.map((r, i) => [r.id, i]))
    const memo = new Map<string, number>()
    const resolve = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!
      const node = byId.get(id)
      const idx = node?.parent_id ? resolve(node.parent_id) : (rootIndex.get(id) ?? 0)
      memo.set(id, idx)
      return idx
    }
    for (const e of taxonomy) resolve(e.id)
    return memo
  }, [taxonomy, roots])

  const depthOf = useMemo(() => {
    const byId = new Map(taxonomy.map((e) => [e.id, e]))
    const memo = new Map<string, number>()
    const resolve = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!
      const node = byId.get(id)
      const d = node?.parent_id ? resolve(node.parent_id) + 1 : 0
      memo.set(id, d)
      return d
    }
    for (const e of taxonomy) resolve(e.id)
    return memo
  }, [taxonomy])

  // Colors mean "which top-level concept this belongs to", so they only appear
  // when there is a hierarchy with few enough top-level concepts for the
  // six-color palette. A flat list of 29 peers would cycle the six colors
  // with no meaning, so it gets one neutral color instead.
  const groupColored = hasHierarchy && roots.length <= MAP_PALETTE.length

  useEffect(() => {
    if (!containerRef.current) return

    const taxIds = new Set(taxonomy.map((n) => n.id))
    const validRelations = relations.filter((r) => taxIds.has(r.from_element_id) && taxIds.has(r.to_element_id))
    const neutral = cssVar('--series-a', '#2a78d6')

    // Rule 2: one counted arc per pair of top-level concepts, summarizing the
    // relations between their subtrees. Only meaningful with a hierarchy.
    const bundleEdges: ElementDefinition[] = []
    if (hasHierarchy && gs.edges !== 'tree') {
      const pairCount = new Map<string, number>()
      for (const r of validRelations) {
        const a = rootIndexOf.get(r.from_element_id) ?? 0
        const b = rootIndexOf.get(r.to_element_id) ?? 0
        if (a === b) continue
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
      }
      for (const [key, count] of pairCount) {
        const [a, b] = key.split('|').map(Number)
        bundleEdges.push({
          data: { id: `b-${key}`, source: roots[a].id, target: roots[b].id, weight: count, tooltip: `${count} relations between “${roots[a].label}” and “${roots[b].label}”` },
          classes: 'bundle',
        })
      }
    }

    // In a flat list there is no hierarchy to size by, so a concept grows with
    // how many relations it has: the hubs stand out.
    const degree = new Map<string, number>()
    for (const r of validRelations) {
      degree.set(r.from_element_id, (degree.get(r.from_element_id) ?? 0) + 1)
      degree.set(r.to_element_id, (degree.get(r.to_element_id) ?? 0) + 1)
    }

    const elements: ElementDefinition[] = [
      ...taxonomy.map((n) => {
        const count = hitsByTaxId.get(n.id)?.length ?? 0
        const depth = depthOf.get(n.id) ?? 0
        const colorVar = MAP_PALETTE[(rootIndexOf.get(n.id) ?? 0) % MAP_PALETTE.length]
        const base = hasHierarchy ? Math.max(10, 36 - depth * 8) : 22
        const size = base + Math.min(count, 10) * 1.3 + (hasHierarchy ? 0 : Math.min(degree.get(n.id) ?? 0, 16) * 1.1)
        // Labels at depth 0 and 1 are on while the tree is laid out, so the
        // layout leaves room for them; the final set is chosen afterwards.
        return { data: { id: n.id, label: depth < 2 ? n.label : '', fullLabel: n.label, color: groupColored ? cssVar(colorVar, '#2a78d6') : neutral, size, depth } }
      }),
      ...taxonomy
        .filter((n): n is SchemaElement & { parent_id: string } => !!n.parent_id)
        .map((n) => ({ data: { id: `e-${n.id}`, source: n.parent_id, target: n.id }, classes: 'tree' })),
      // lpm_concept_relations: a separate many-to-many network (migration
      // 087), distinct from the parent_id tree. Dropped silently when one end
      // is outside the loaded set, so Cytoscape never sees a dangling edge.
      ...validRelations.map((r) => ({
        data: { id: `rel-${r.id}`, source: r.from_element_id, target: r.to_element_id, relationType: r.relation_type },
        classes: 'relation',
      })),
      ...bundleEdges,
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)', 'background-opacity': 0.92,
            'border-width': 1.5, 'border-color': cssVar('--surface-0', '#ffffff'),
            width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '70px',
            'text-valign': 'bottom', 'text-margin-y': 4, color: cssVar('--text-primary', '#0b0b0b'),
          } as any,
        },
        {
          selector: 'node.hover-label',
          style: {
            label: 'data(fullLabel)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1,
            'text-background-padding': '3px', 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc'),
          } as any,
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--text-primary', '#0b0b0b') } },
        {
          selector: 'edge.tree',
          style: { width: 1, 'line-color': cssVar('--baseline', '#c3c2b7'), 'curve-style': 'bezier', 'target-arrow-shape': 'none' },
        },
        {
          // Named relations: thin, solid, quiet (opacity comes from the line
          // strength control through data(op)). Hidden unless the mode is
          // "all", and brought forward on hover or selection (.reveal).
          selector: 'edge.relation',
          style: {
            width: 0.9, 'line-color': '#6f7d8c', 'curve-style': 'bezier', 'target-arrow-shape': 'none',
            opacity: 'data(op)', display: gs.edges === 'all' ? 'element' : 'none',
          } as any,
        },
        { selector: 'edge.relation.reveal, edge.relation.reveal-selected', style: { display: 'element', opacity: 0.85, width: 1.8, 'line-color': cssVar('--series-a', '#006c66'), 'z-index': 50 } as any },
        {
          selector: 'edge.bundle',
          style: {
            width: 'mapData(weight, 1, 40, 1.5, 8)', 'line-color': '#8896a5', opacity: 0.3, 'curve-style': 'unbundled-bezier',
            'target-arrow-shape': 'none', 'z-index': 1,
          } as any,
        },
        {
          selector: 'edge.bundle.hover-label',
          style: {
            opacity: 0.7, label: 'data(tooltip)', 'font-size': 10, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': '180px', 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1, 'text-background-padding': '4px',
          } as any,
        },
        { selector: '.dimmed', style: { opacity: 0.1 } },
      ],
    })

    // ---- Layout (graph standards rule 6): fixed by default, physics optional ----
    // A hierarchy is laid out with dagre on the parent/child lines only. Left
    // to see the relations too, dagre ranked peers above and below one another
    // and implied a hierarchy that does not exist.
    const runFixed = () => {
      if (hasHierarchy) {
        cy.elements().not('.relation').not('.bundle').layout({
          name: 'dagre', rankDir: 'TB', nodeSep: 26, rankSep: 64, nodeDimensionsIncludeLabels: true, fit: false, animate: false,
        } as any).run()
      } else {
        cy.nodes().layout({
          name: 'circle', animate: false, fit: false, padding: 40,
          sort: (a: any, b: any) => String(a.data('fullLabel')).localeCompare(String(b.data('fullLabel'))),
        } as any).run()
      }
    }
    runFixed()
    if (gs.layout === 'physics') {
      cy.edges('.bundle').style('curve-style', 'bezier')
      // With a hierarchy, the top-level concepts stay put (when there are few
      // enough to read as groups) and the rest moves around them. A flat set
      // has no groups to pin; its relations pull related concepts together.
      const pinned = hasHierarchy && roots.length <= MAP_PALETTE.length ? cy.nodes('[depth = 0]') : cy.collection()
      pinned.lock()
      const simulated = hasHierarchy ? cy.elements().not('.relation').not('.bundle') : cy.elements().not('.bundle')
      simulated.layout(physicsLayoutOptions(physicsSpacing) as any).run()
      pinned.unlock()
    }

    cy.edges('.bundle').forEach((e) => {
      const gap = Math.abs(e.source().position('x') - e.target().position('x'))
      e.style('control-point-distances', [-arcHeight(gap, Math.max(95, Math.min(420, gap * 0.14)))])
      e.style('control-point-weights', [0.5])
    })

    // ---- Labels (graph standards rule 4): none overlap ----
    {
      const candidates: LabelCandidate[] = cy.nodes().map((n) => ({
        id: n.id(), label: n.data('fullLabel'), x: n.position('x'), y: n.position('y'), size: n.data('size'),
        priority: n.data('size'), alwaysShow: hasHierarchy && n.data('depth') === 0, fontPx: 9, maxWidthPx: 70, labelSide: 'below',
      }))
      const visible = gs.labels === 'few' ? pickVisibleLabels(candidates) : null
      cy.nodes().forEach((n) => {
        const full = String(n.data('fullLabel'))
        const isGroup = hasHierarchy && n.data('depth') === 0
        if (visible && !visible.has(n.id())) n.data('label', '')
        else n.data('label', isGroup ? full : truncateLabel(full, gs.labels === 'few' ? 24 : 30))
      })
    }

    // Line strength is applied through data(op) so the hover styles above can
    // still override it (a direct style bypass would win over them).
    cy.edges('.relation').forEach((e) => { e.data('op', lineOpacity(1.5, gs.lineStrength)) })

    cy.on('tap', 'node', (evt) => {
      const n = taxonomy.find((e) => e.id === evt.target.id())
      if (n) onSelect(n)
    })
    // Pointing at a concept shows its full name and brings its relations
    // forward, dimming the rest. A concept with no relations just shows its name.
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target
      node.addClass('hover-label')
      const rel = node.connectedEdges('.relation')
      if (rel.length === 0) return
      rel.addClass('reveal')
      cy.elements().not(node.closedNeighborhood()).addClass('dimmed')
    })
    cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('hover-label')
      cy.elements().removeClass('dimmed')
      cy.edges('.reveal').removeClass('reveal')
    })
    cy.on('mouseout', (evt) => { if (evt.target === cy) { cy.elements().removeClass('dimmed'); cy.edges('.reveal').removeClass('reveal') } })
    cy.on('mouseover', 'edge.bundle', (evt) => evt.target.addClass('hover-label'))
    cy.on('mouseout', 'edge.bundle', (evt) => evt.target.removeClass('hover-label'))

    // `.graph-canvas` fills whatever height its flex parent gives it
    // (position:absolute; inset:0 -- unlike the student Netz tab's plain
    // block container, this page's split-pane "explorer" shell drives
    // height from the viewport, not page scroll), so a real multi-row
    // tiered tree needs an explicit fit rather than a JS-set pixel height
    // (which `inset:0` would just override anyway).
    fitWithReadableFloor(cy)
    cyRef.current = cy
    apiRef.current = {
      zoomBy: (factor: number) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: rect.width / 2, y: rect.height / 2 } })
      },
      fit: () => fitWithReadableFloor(cy),
    }
    // A rebuild (new setting or new data) keeps the concept that is selected.
    const keep = selectedIdRef.current
    if (keep) {
      const el = cy.getElementById(keep)
      if (el.length) { el.select(); el.connectedEdges('.relation').addClass('reveal-selected') }
    }
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null; apiRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy, hitsByTaxId, relations, rootIndexOf, depthOf, gs.edges, gs.labels, gs.layout, physicsSpacing, hasHierarchy])

  // Line strength restyles the existing lines in place (no rebuild, so zoom and pan are kept).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.edges('.relation').forEach((e) => { e.data('op', lineOpacity(1.5, gs.lineStrength)) })
  }, [gs.lineStrength, taxonomy, relations])

  // Keep the graph's own selection in sync with the URL-driven selectedId
  // (a search-bar link, a shared link, or a plain refresh) without
  // re-running the mount/layout effect above. The selected concept's
  // relations stay forward until another concept is chosen.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes(':selected').unselect()
    cy.edges('.reveal-selected').removeClass('reveal-selected')
    if (selectedId) {
      const el = cy.getElementById(selectedId)
      if (el.length) { el.select(); el.connectedEdges('.relation').addClass('reveal-selected'); cy.center(el) }
    }
  }, [selectedId])

  // Real feedback 2427b091 (Dustin): "let users download the map image as
  // PNG." Cytoscape's own built-in export -- `full: true` captures the
  // whole graph, not just the current viewport, so the downloaded image
  // matches what "Fit to screen" shows, not whatever happened to be
  // scrolled into view; `bg` set explicitly since a transparent PNG
  // dropped onto a slide or doc would otherwise pick up whatever's behind
  // it, not this page's own background.
  const downloadPng = () => {
    const cy = cyRef.current
    if (!cy) return
    const uri = cy.png({ full: true, scale: 2, bg: cssVar('--surface-0', '#ffffff') })
    const a = document.createElement('a')
    a.href = uri
    a.download = 'concept-map.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    // Real feedback 2427b091 (Dustin): the default 400px floor (shared with
    // Notebooks/Learning Goals' own smaller graphs) left too little room
    // once overlap-free spacing made this particular tree genuinely wide --
    // fitting ~130 real nodes into 400px of height forced the zoom down to
    // illegible. Taller here specifically (not changed globally, since the
    // other two consumers' graphs are usually much smaller).
    <div className="graph-host" style={{ minHeight: 640 }}>
      <div ref={containerRef} className="graph-canvas" />
      <div className="row" style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, gap: 6 }}>
        <button className="btn btn-mini" aria-label="Download as PNG" title="Download as PNG" onClick={downloadPng}>
          <Download size={12} />
        </button>
        <button
          className="btn btn-mini"
          aria-label="Fit to screen"
          title="Fit to screen"
          onClick={() => apiRef.current?.fit()}
        >
          <Maximize2 size={12} />
        </button>
      </div>
      {taxonomy.length === 0 && (
        <div className="empty" style={{ position: 'absolute', inset: 0 }}>
          <Network size={32} />
          <p>No concepts yet.</p>
        </div>
      )}
    </div>
  )
}

function ConceptNode({
  node,
  depth,
  childrenOf,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  hitsByTaxId,
}: {
  node: SchemaElement
  depth: number
  childrenOf: (id: string) => SchemaElement[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (n: SchemaElement) => void
  selectedId: string | null
  hitsByTaxId: Map<string, Hit[]>
}) {
  const kids = childrenOf(node.id)
  const isOpen = expanded.has(node.id)
  const count = hitsByTaxId.get(node.id)?.length ?? 0
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="row" style={{ gap: 4, padding: '3px 0' }}>
        {kids.length > 0 ? (
          <button className="btn-linklike" onClick={() => onToggle(node.id)} style={{ textDecoration: 'none' }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 13 }} />
        )}
        <button
          className="btn-linklike"
          style={{ textDecoration: node.id === selectedId ? 'underline' : 'none', fontWeight: depth === 0 ? 600 : 400 }}
          onClick={() => onSelect(node)}
        >
          {node.label}
        </button>
        {count > 0 && <span className="chip" style={{ fontSize: 10 }}>{count}</span>}
      </div>
      {isOpen && kids.map((k) => (
        <ConceptNode key={k.id} node={k} depth={depth + 1} childrenOf={childrenOf} expanded={expanded} onToggle={onToggle} onSelect={onSelect} selectedId={selectedId} hitsByTaxId={hitsByTaxId} />
      ))}
    </div>
  )
}

function ConceptDetail({ node, hits, onClose }: { node: SchemaElement; hits: Hit[]; onClose: () => void }) {
  const byProject = useMemo(() => {
    const m = new Map<string, Hit[]>()
    for (const h of hits) {
      if (!m.has(h.projectName)) m.set(h.projectName, [])
      m.get(h.projectName)!.push(h)
    }
    return m
  }, [hits])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ marginTop: 0 }}>{node.label}</h3>
        <button className="btn btn-mini" onClick={onClose}><X size={11} /></button>
      </div>
      {conceptDefinition(node) && <p className="muted" style={{ whiteSpace: 'pre-line' }}>{conceptDefinition(node)}</p>}
      {hits.length === 0 ? (
        <p className="muted">No real learning goal has been tagged to this specific concept yet — it may still be relevant, just not tied to it at this level of detail.</p>
      ) : (
        Array.from(byProject.entries()).map(([projectName, list]) => (
          <div key={projectName} style={{ marginBottom: 14 }}>
            <h4 style={{ marginBottom: 4 }}>{projectName} ({list.length})</h4>
            {list.map((h) => (
              <div key={h.objectId} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <Link to={`/dashboard/${h.projectSlug}/learning-goals/${h.objectId}`} style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>
                    {h.title}
                  </Link>
                  <span className="muted" style={{ fontSize: 11 }}>{h.gradeBand ? `Grade ${h.gradeBand}` : ''} · relevance {h.relevance}/3</span>
                </div>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{h.reasoning}</p>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================================
// Manage-taxonomy tab -- formerly the standalone Schema page: the flat
// element list + import-from-ConceptBase tool.
// ============================================================================

function ManageConceptsTab() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const navigate = useNavigate()
  const [elements, setElements] = useState<SchemaElement[]>([])
  const [baseLink, setBaseLink] = useState<ProjectBaseLink | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const reload = async () => {
    const projectIds = [project.id, project.parent_project_id].filter((id): id is string => !!id)
    const { data } = await supabase
      .from('lpm_schema_elements')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true })
    setElements(data ?? [])
  }

  useEffect(() => {
    reload()
    supabase
      .from('project_base_links')
      .select('*')
      .eq('project_id', project.id)
      .eq('base_repo', 'conceptbase')
      .maybeSingle()
      .then(({ data }) => setBaseLink(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const canManage = role === 'owner' || role === 'maintainer'

  // A root is a top-level concept, OR a concept whose parent lives on a row
  // this tab never fetched (e.g. a cross-project parent) -- same orphan
  // guard as the Explore tab's dedup logic, just without needing the full
  // hub/dedup machinery since this tab only ever shows one project's rows.
  const roots = useMemo(
    () => elements.filter((e) => !e.parent_id || !elements.some((x) => x.id === e.parent_id)),
    [elements]
  )
  const childrenOf = (id: string) => elements.filter((e) => e.parent_id === id)
  const selected = useMemo(() => elements.find((e) => e.id === selectedId) ?? null, [elements, selectedId])
  const selectedParent = useMemo(
    () => (selected?.parent_id ? elements.find((e) => e.id === selected.parent_id) ?? null : null),
    [elements, selected]
  )

  // Short taxonomies (the common case) read better fully open than requiring
  // a click per root to see there's anything underneath them at all.
  const rootKey = roots.map((r) => r.id).join(',')
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const r of roots) next.add(r.id)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootKey])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const importConcepts = async (vocabulary: string, matching: ConceptBaseConcept[]) => {
    for (const concept of matching) {
      const label = concept.labels?.en ?? concept.id
      const definitionsForLang = concept.definitions?.en ?? {}
      const definition = Object.values(definitionsForLang)[0] ?? null

      const { data: existing } = await supabase
        .from('lpm_schema_elements')
        .select('id')
        .eq('project_id', project.id)
        .eq('metadata->>conceptbase_id', concept.id)
        .maybeSingle()

      const row = {
        project_id: project.id,
        element_type: 'concept' as const,
        label,
        definition,
        status: mapStatus(concept.status),
        metadata: {
          conceptbase_id: concept.id,
          vocabulary: concept.definedInVocabulary,
          version: concept.version,
          relations: concept.relations ?? {},
          source: 'conceptbase',
        },
      }

      if (existing) await supabase.from('lpm_schema_elements').update(row).eq('id', existing.id)
      else await supabase.from('lpm_schema_elements').insert(row)
    }

    setNotice({ kind: 'ok', text: `Imported ${matching.length} concept${matching.length === 1 ? '' : 's'} from "${vocabulary}".` })
    await reload()
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 20 }}>
        The concepts, competencies, and grade bands this project is organized around — some added
        directly, some imported from ConceptBase — shown here as the tree they form.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {elements.length === 0 ? (
        <div className="card empty">
          <Shapes size={32} />
          <p>No schema elements yet.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start', marginBottom: 20 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Taxonomy</h3>
            {roots.map((el) => (
              <ManageConceptNode
                key={el.id}
                node={el}
                depth={0}
                childrenOf={childrenOf}
                expanded={expanded}
                onToggle={toggle}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          <div className="card" style={{ minHeight: 200 }}>
            {!selected ? (
              <p className="muted">
                Pick a concept on the left to see its full definition, where it came from, and how
                it connects to the parts of the progression.
              </p>
            ) : (
              <ManageConceptDetail
                node={selected}
                parent={selectedParent}
                kids={childrenOf(selected.id)}
                onSelect={setSelectedId}
                onViewInMap={() => navigate(`/dashboard/${project.slug}/concepts/${selected.id}`)}
                questions={<ReviewQuestionsPanel supabase={supabase} projectId={project.id} projectSlug={project.slug} linkedType="schema_element" linkedId={selected.id} />}
              />
            )}
          </div>
        </div>
      )}

      {canManage && (
        <ImportFromConceptBase baseLink={baseLink} onImport={importConcepts} onNotice={setNotice} />
      )}
    </div>
  )
}

function ManageConceptNode({
  node,
  depth,
  childrenOf,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: SchemaElement
  depth: number
  childrenOf: (id: string) => SchemaElement[]
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const kids = childrenOf(node.id)
  const isOpen = expanded.has(node.id)
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="row" style={{ gap: 6, padding: '4px 0' }}>
        {kids.length > 0 ? (
          <button className="btn-linklike" onClick={() => onToggle(node.id)} style={{ textDecoration: 'none' }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 13 }} />
        )}
        <button
          className="btn-linklike"
          style={{ textDecoration: node.id === selectedId ? 'underline' : 'none', fontWeight: depth === 0 ? 600 : 400 }}
          onClick={() => onSelect(node.id)}
        >
          {node.label}
        </button>
        <Chip status={node.status} />
        {kids.length > 0 && <span className="chip" style={{ fontSize: 10 }}>{kids.length}</span>}
      </div>
      {isOpen && kids.map((k) => (
        <ManageConceptNode key={k.id} node={k} depth={depth + 1} childrenOf={childrenOf} expanded={expanded} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ManageConceptDetail({
  node,
  parent,
  kids,
  onSelect,
  onViewInMap,
  questions,
}: {
  node: SchemaElement
  parent: SchemaElement | null
  kids: SchemaElement[]
  onSelect: (id: string) => void
  onViewInMap: () => void
  questions?: React.ReactNode
}) {
  const definition = conceptDefinition(node)
  const origin = conceptSource(node)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginTop: 0 }}>{node.label}</h3>
        <Chip status={node.status} />
      </div>
      <p className="muted capitalize" style={{ marginTop: -8, fontSize: 12 }}>{node.element_type}</p>
      {parent && (
        <p className="muted" style={{ fontSize: 12 }}>
          Part of <button className="btn-linklike" onClick={() => onSelect(parent.id)}>{parent.label}</button>
        </p>
      )}
      <p style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{definition || 'No definition yet.'}</p>
      {origin.kind === 'conceptbase' ? (
        <p className="muted" style={{ fontSize: 12 }}>
          Linked to ConceptBase{origin.vocabulary ? ` — ${origin.vocabulary}${origin.version ? ` v${origin.version}` : ''}` : ''}.{' '}
          {definition ? 'The definition above comes from there. ' : ''}
          <a href={origin.url} target="_blank" rel="noopener noreferrer">See the ConceptBase record ({origin.conceptbaseId})</a>
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>
          Added directly to this project. It is not linked to a ConceptBase record{definition ? '' : ', so it has no shared definition yet'}.
        </p>
      )}

      {kids.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 4 }}>{kids.length} sub-concept{kids.length === 1 ? '' : 's'}</h4>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {kids.map((k) => (
              <button key={k.id} className="btn btn-mini" onClick={() => onSelect(k.id)}>{k.label}</button>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-mini" style={{ marginTop: 14 }} onClick={onViewInMap}>
        <Network size={12} />See how this connects to real content
      </button>
      {questions}
    </div>
  )
}

// Was a single blind text field (type the exact vocabulary id, hit Import,
// find out afterward what happened) -- real feedback 5f48d774 (2026-10-03,
// Dustin): "the Import from conceptbase needs a better ui/ux." Now a
// three-step flow sharing one registry fetch: browse what's actually in
// ConceptBase, pick a vocabulary from what's really there (no typing an id
// from memory), see exactly which concepts will be added before committing
// to anything.
function ImportFromConceptBase({
  baseLink,
  onImport,
  onNotice,
}: {
  baseLink: ProjectBaseLink | null
  onImport: (vocabulary: string, matching: ConceptBaseConcept[]) => Promise<void>
  onNotice: (notice: { kind: 'ok' | 'bad'; text: string } | null) => void
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [allConcepts, setAllConcepts] = useState<ConceptBaseConcept[]>([])
  const [vocabularies, setVocabularies] = useState<{ name: string; count: number }[]>([])
  const [selectedVocab, setSelectedVocab] = useState('')
  const [importing, setImporting] = useState(false)

  const browse = async () => {
    setStatus('loading'); setLoadError(null); onNotice(null)
    try {
      const treeRes = await fetch(`https://api.github.com/repos/${CONCEPTBASE_REPO}/git/trees/main?recursive=1`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!treeRes.ok) throw new Error(`Couldn't reach the ConceptBase registry (error ${treeRes.status}).`)
      const tree: { tree: { path: string; type: string }[] } = await treeRes.json()

      const conceptPaths = tree.tree
        .filter((entry) => entry.type === 'blob' && entry.path.startsWith('registry/concept/') && entry.path.endsWith('.json'))
        .map((entry) => entry.path)

      const fetched = await Promise.all(
        conceptPaths.map(async (path) => {
          const res = await fetch(`https://raw.githubusercontent.com/${CONCEPTBASE_REPO}/main/${path}`)
          if (!res.ok) return null
          return (await res.json()) as ConceptBaseConcept
        })
      )
      const concepts = fetched.filter((c): c is ConceptBaseConcept => c !== null)

      const counts = new Map<string, number>()
      for (const c of concepts) counts.set(c.definedInVocabulary, (counts.get(c.definedInVocabulary) ?? 0) + 1)
      const vocabList = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name))

      setAllConcepts(concepts)
      setVocabularies(vocabList)
      setSelectedVocab(vocabList[0]?.name ?? '')
      setStatus('loaded')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't reach the ConceptBase registry.")
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle'); setAllConcepts([]); setVocabularies([]); setSelectedVocab('')
  }

  const previewMatches = useMemo(
    () => allConcepts.filter((c) => c.definedInVocabulary === selectedVocab),
    [allConcepts, selectedVocab]
  )

  const confirmImport = async () => {
    if (!selectedVocab || previewMatches.length === 0) return
    setImporting(true)
    try {
      await onImport(selectedVocab, previewMatches)
      reset()
    } catch (err) {
      onNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Import failed.' })
    }
    setImporting(false)
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Import from ConceptBase</h3>
      <p className="muted">
        {baseLink?.can_import
          ? "Brings concept definitions from the shared ConceptBase registry into this project. It only reads from ConceptBase — nothing here is ever written back to it."
          : "This project isn't connected to ConceptBase for importing yet. Ask a lab admin to connect it."}
      </p>

      {baseLink?.can_import && (
        <>
          {status === 'idle' && (
            <button className="btn btn-primary" onClick={browse}>Browse ConceptBase vocabularies</button>
          )}

          {status === 'loading' && (
            <p className="row muted">
              <Loader2 size={14} style={{ animation: 'feedback-capturing-spin 0.9s linear infinite' }} />
              Looking up what's available in ConceptBase…
            </p>
          )}

          {status === 'error' && (
            <div className="notice notice-bad">
              {loadError}
              <button className="btn btn-mini" onClick={browse} style={{ marginLeft: 'auto' }}>Try again</button>
            </div>
          )}

          {status === 'loaded' && (
            vocabularies.length === 0 ? (
              <p className="muted">No concept vocabularies found in the ConceptBase registry.</p>
            ) : (
              <div>
                <div className="field" style={{ maxWidth: 320 }}>
                  <label>Vocabulary</label>
                  <select value={selectedVocab} onChange={(e) => setSelectedVocab(e.target.value)}>
                    {vocabularies.map((v) => (
                      <option key={v.name} value={v.name}>{v.name} ({v.count} concept{v.count === 1 ? '' : 's'})</option>
                    ))}
                  </select>
                </div>

                {previewMatches.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p className="muted" style={{ marginBottom: 4 }}>
                      This will add or update {previewMatches.length} concept{previewMatches.length === 1 ? '' : 's'} in this project:
                    </p>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
                      {previewMatches.map((c) => (
                        <span key={c.id} className="chip">{c.labels?.en ?? c.id}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                  <button className="btn btn-primary" disabled={importing || previewMatches.length === 0} onClick={confirmImport}>
                    {importing ? 'Importing…' : `Import ${previewMatches.length} concept${previewMatches.length === 1 ? '' : 's'}`}
                  </button>
                  <button className="btn btn-mini" onClick={reset} disabled={importing}>Cancel</button>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
