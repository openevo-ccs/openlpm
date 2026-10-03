import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { ChevronDown, ChevronRight, LayoutList, Layers, Loader2, Maximize2, Network, Shapes, X } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { layoutTier } from '@/lib/graph-layout'

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const MAP_PALETTE = ['--map-1', '--map-2', '--map-3', '--map-4', '--map-5', '--map-6']

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
        connect to real content, or manage the taxonomy itself.
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

  if (taxonomy === null) return <p className="muted">Loading…</p>

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        One concept structure, shared across every real regional curriculum in {hubName} — for
        finding what a specific concept looks like across states, and for comparing how much weight
        each state's curriculum actually gives it.
      </p>

      {children.length > 1 && (
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
        <div className="explorer-body" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <ConceptGraph taxonomy={taxonomy} hitsByTaxId={hitsByTaxId} roots={roots} selectedId={selectedNode?.id ?? null} onSelect={selectNode} />
          <div className="drawer-shell wide">
            <div className="drawer">
              {!selectedNode ? (
                <>
                  <h2>Concept map</h2>
                  <p className="muted">
                    Each circle is a concept, sized by how much real content touches it. Click one to see what
                    connects to it. Scroll to zoom, drag to pan.
                  </p>
                </>
              ) : (
                <ConceptDetail node={selectedNode} hits={hitsByTaxId.get(selectedNode.id) ?? []} onClose={closeNode} />
              )}
            </div>
          </div>
        </div>
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
  selectedId,
  onSelect,
}: {
  taxonomy: SchemaElement[]
  hitsByTaxId: Map<string, Hit[]>
  roots: SchemaElement[]
  selectedId: string | null
  onSelect: (n: SchemaElement) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

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

  useEffect(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth || 700

    // Real bug found live 2026-10-01 (Dustin: "makes little to no sense"):
    // Cytoscape's 'breadthfirst'+circle layout treats this real tree (a
    // handful of root concepts, each with a real and sometimes-large
    // number of its own sub-concepts, no edges between siblings) as a
    // tangle -- the same category of problem the student Netz tab's own
    // 'cose' layout had, rejected there 2026-09-30 for the identical
    // reason. Same fix: a deterministic tiered layout, one row per real
    // depth level, reusing the exact layoutTier helper Netz already
    // proved out rather than inventing a second algorithm. Depth isn't
    // hardcoded to 2 -- this walks however many real levels the taxonomy
    // actually has, same generality the original code already had.
    const maxDepth = taxonomy.reduce((m, n) => Math.max(m, depthOf.get(n.id) ?? 0), 0)
    const positions = new Map<string, { x: number; y: number }>()
    const ROW_GAP = 64
    const CHILD_SPACING = 74
    roots.forEach((r, i) => positions.set(r.id, { x: (i + 0.5) * (width / Math.max(1, roots.length)), y: 36 }))
    let currentLevel = roots.map((r) => r.id)
    let y = 36
    for (let depth = 1; depth <= maxDepth; depth++) {
      let maxRowsThisLevel = 0
      const nextLevel: string[] = []
      for (const parentId of currentLevel) {
        const kids = taxonomy.filter((n) => n.parent_id === parentId)
        if (kids.length === 0) continue
        const parentPos = positions.get(parentId)
        if (!parentPos) continue
        const maxWidth = Math.max(CHILD_SPACING, CHILD_SPACING * Math.ceil(Math.sqrt(kids.length)))
        const { positions: kidPositions, rows } = layoutTier(kids.map((k) => ({ id: k.id })), parentPos.x, y + ROW_GAP, maxWidth, ROW_GAP * 0.65, CHILD_SPACING)
        for (const [id, pos] of kidPositions) positions.set(id, pos)
        maxRowsThisLevel = Math.max(maxRowsThisLevel, rows)
        nextLevel.push(...kids.map((k) => k.id))
      }
      y += ROW_GAP + maxRowsThisLevel * (ROW_GAP * 0.65)
      currentLevel = nextLevel
    }

    const elements: ElementDefinition[] = [
      ...taxonomy.map((n) => {
        const count = hitsByTaxId.get(n.id)?.length ?? 0
        const depth = depthOf.get(n.id) ?? 0
        const colorVar = MAP_PALETTE[(rootIndexOf.get(n.id) ?? 0) % MAP_PALETTE.length]
        const size = Math.max(10, 36 - depth * 8) + Math.min(count, 10) * 1.3
        return {
          data: { id: n.id, label: n.label, color: cssVar(colorVar, '#2a78d6'), size, depth },
          position: positions.get(n.id) ?? { x: width / 2, y: y + 60 },
        }
      }),
      ...taxonomy
        .filter((n): n is SchemaElement & { parent_id: string } => !!n.parent_id)
        .map((n) => ({ data: { id: `e-${n.id}`, source: n.parent_id, target: n.id } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '70px',
            'text-valign': 'bottom', 'text-margin-y': 4, color: cssVar('--text-primary', '#0b0b0b'),
          },
        },
        {
          // Real bug found live 2026-10-01: every sub-concept's label
          // permanently on, all at once, overlapped into unreadable text
          // -- the same fix Netz already proved: deep (leaf-ish) labels
          // only show on hover, same as a Lernziel node there.
          selector: 'node[depth >= 2]',
          style: { label: '' },
        },
        {
          selector: 'node.hover-label',
          style: {
            label: 'data(label)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-background-color': cssVar('--surface-0', '#fff'), 'text-background-opacity': 1,
            'text-background-padding': '3px', 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc'),
          } as any,
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--text-primary', '#0b0b0b') } },
        {
          selector: 'edge',
          style: { width: 1, 'line-color': cssVar('--baseline', '#c3c2b7'), 'curve-style': 'bezier', 'target-arrow-shape': 'none' },
        },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const n = taxonomy.find((e) => e.id === evt.target.id())
      if (n) onSelect(n)
    })
    cy.on('mouseover', 'node', (evt) => evt.target.addClass('hover-label'))
    cy.on('mouseout', 'node', (evt) => evt.target.removeClass('hover-label'))

    // `.graph-canvas` fills whatever height its flex parent gives it
    // (position:absolute; inset:0 -- unlike the student Netz tab's plain
    // block container, this page's split-pane "explorer" shell drives
    // height from the viewport, not page scroll), so a real multi-row
    // tiered tree needs an explicit fit rather than a JS-set pixel height
    // (which `inset:0` would just override anyway).
    cy.fit(undefined, 24)
    cyRef.current = cy
    return () => { cy.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy, hitsByTaxId, rootIndexOf, depthOf])

  // Keep the graph's own selection in sync with the URL-driven selectedId
  // (a search-bar link, a shared link, or a plain refresh) without
  // re-running the mount/layout effect above.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes(':selected').unselect()
    if (selectedId) {
      const el = cy.getElementById(selectedId)
      if (el.length) { el.select(); cy.center(el) }
    }
  }, [selectedId])

  return (
    <div className="graph-host">
      <div ref={containerRef} className="graph-canvas" />
      <button
        className="btn btn-mini"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}
        aria-label="Fit to screen"
        onClick={() => cyRef.current?.fit(undefined, 24)}
      >
        <Maximize2 size={12} />
      </button>
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
      {node.definition && <p className="muted">{node.definition}</p>}
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
                it connects to real content.
              </p>
            ) : (
              <ManageConceptDetail
                node={selected}
                parent={selectedParent}
                kids={childrenOf(selected.id)}
                onSelect={setSelectedId}
                onViewInMap={() => navigate(`/dashboard/${project.slug}/concepts/${selected.id}`)}
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
}: {
  node: SchemaElement
  parent: SchemaElement | null
  kids: SchemaElement[]
  onSelect: (id: string) => void
  onViewInMap: () => void
}) {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>
  const source =
    metadata.source === 'conceptbase'
      ? `Imported from ConceptBase — ${(metadata.vocabulary as string) ?? 'vocabulary unknown'}${metadata.version ? ` v${metadata.version}` : ''}`
      : 'Added directly to this project.'

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
      <p style={{ marginTop: 8 }}>{node.definition || 'No definition yet.'}</p>
      <p className="muted" style={{ fontSize: 12 }}>{source}</p>

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
