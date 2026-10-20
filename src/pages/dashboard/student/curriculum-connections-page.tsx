import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import { BarChart3, Download, GitCompare, Grid3x3, Layers, Link2, List, Maximize2, Minus, Pencil, Plus, Save, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import { TabPanels } from '@/components/tab-panels'
import { LpmComparisonProfileCard } from '@/components/lpm-comparison-profile-card'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import {
  RECORD_TYPE_LABEL,
  createContentLink,
  listContentLinksForDataObjects,
  listRepositoryRecordsForRegionSlugs,
  updateContentLinkRationale,
  type DataObjectLinkWithRecord,
  type RepositoryRecordRow,
} from '@/lib/supabase/curriculum-repository'
import {
  KNOWN_COMPARISON_PAIRS,
  getProjectComparisonProfile,
  listComparativeLinksBetweenProjects,
  listDivergenceCoverage,
  type ComparativeLinkWithTitles,
  type DivergenceCoverageRow,
  type ProjectComparisonProfile,
} from '@/lib/supabase/comparative-analysis'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { RecordKindIcon } from '@/lib/record-type-display'

cytoscape.use(coseBilkent)

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// Same floor concepts-page.tsx's own concept map uses for the same reason:
// a plain cy.fit() on a real, non-overlapping layout zooms out far enough
// to make every label illegible once the graph has any real size.
const MIN_READABLE_ZOOM = 0.45
function fitWithReadableFloor(cy: Core) {
  cy.fit(undefined, 32)
  if (cy.zoom() < MIN_READABLE_ZOOM) { cy.zoom(MIN_READABLE_ZOOM); cy.center() }
}

// Shared by all 4 of the 2026-10-20 German/US custom views (Bio-Core and
// Interdisciplinary LPM, each paired with a Sachsen/Thüringen view and a
// New York/California view). Redesigned 2026-10-20 (real feedback: "the
// custom views have a lot of data, but... it's just a wall of cards") into
// three real tabs -- Overview (what this LPM actually is, at a glance),
// Connections (the original topic<->real-world-record workspace, now with
// a real graph view alongside the list), Comparison (this LPM against its
// sibling, reusing the same real data coherence-page.tsx's own "Across
// curricula" tab shows) -- rather than one flat list of cards with no
// orientation.
const GRADE_BANDS = ['K-2', '3-5', '6-8', '9-12']

interface ConnectionsStrings {
  title: string
  intro: (region: string) => string
  tabOverview: string
  tabConnections: string
  tabComparison: string
  topics: string
  noConnections: string
  addConnection: string
  search: string
  rationaleLabel: string
  rationalePlaceholder: string
  save: string
  cancel: string
  edit: string
  connect: string
  connecting: string
  noMatches: string
  selectTopic: string
  viewList: string
  viewGraph: string
  graphHint: string
  overviewStrands: string
  overviewGradeBands: string
  overviewTheories: string
  overviewLiterature: string
  overviewRealWorld: string
  overviewComparisons: string
  overviewDivergences: string
  overviewCoverage: string
  comparingAgainst: (name: string) => string
  comparisonNotes: string
  noComparisonNotes: string
  illustrates: string
  legendTopic: string
  legendRecord: string
  controlFit: string
  controlZoomIn: string
  controlZoomOut: string
  controlDownload: string
  controlLabelsAlways: string
  controlLabelsHover: string
  controlSpacingLess: string
  controlSpacingMore: string
}

const STRINGS: Record<'de' | 'en', ConnectionsStrings> = {
  de: {
    title: 'Verbindungen zum Lehrplan',
    intro: (region: string) =>
      `Verbinde die Lernziele dieses LPM mit echten Lehrplan-Dokumenten aus ${region}, mit einer kurzen Begründung je Verbindung.`,
    tabOverview: 'Übersicht',
    tabConnections: 'Verbindungen',
    tabComparison: 'Vergleich',
    topics: 'Lernziele',
    noConnections: 'Noch keine Verbindung.',
    addConnection: 'Verbindung hinzufügen',
    search: 'Lehrplan-Dokument suchen…',
    rationaleLabel: 'Begründung (optional)',
    rationalePlaceholder: 'z. B. dieser Lehrplan-Beschluss ist der reale Hintergrund für dieses Lernziel',
    save: 'Speichern',
    cancel: 'Abbrechen',
    edit: 'Bearbeiten',
    connect: 'Verbinden',
    connecting: 'Verbinde…',
    noMatches: 'Keine Treffer.',
    selectTopic: 'Wähle links ein Lernziel.',
    viewList: 'Liste',
    viewGraph: 'Netzwerk',
    graphHint: 'Lernziele (groß) und reale Lehrplan-Dokumente (klein), verbunden durch echte Verknüpfungen. Klicken zum Hervorheben.',
    overviewStrands: 'Stränge',
    overviewGradeBands: 'Klassenstufen',
    overviewTheories: 'Theorien',
    overviewLiterature: 'Literatur',
    overviewRealWorld: 'Praxis-Verknüpfungen',
    overviewComparisons: 'Vergleichsnotizen',
    overviewDivergences: 'Geprüfte Thesen',
    overviewCoverage: 'Abdeckung nach Klassenstufe',
    comparingAgainst: (name: string) => `Im Vergleich mit ${name}`,
    comparisonNotes: 'Vergleichsnotizen',
    noComparisonNotes: 'Noch keine Vergleichsnotizen zwischen diesen beiden Projekten.',
    illustrates: 'Veranschaulicht',
    legendTopic: 'Lernziel',
    legendRecord: 'Lehrplan-Dokument',
    controlFit: 'Ganze Ansicht einpassen',
    controlZoomIn: 'Vergrößern',
    controlZoomOut: 'Verkleinern',
    controlDownload: 'Als PNG herunterladen',
    controlLabelsAlways: 'Alle Beschriftungen zeigen',
    controlLabelsHover: 'Beschriftungen nur bei Hover',
    controlSpacingLess: 'Enger anordnen',
    controlSpacingMore: 'Weiter auseinanderziehen',
  },
  en: {
    title: 'Curriculum Connections',
    intro: (region: string) =>
      `Connect this LPM's learning goals to real curriculum documents from ${region}, with a short rationale per connection.`,
    tabOverview: 'Overview',
    tabConnections: 'Connections',
    tabComparison: 'Comparison',
    topics: 'Learning Goals',
    noConnections: 'No connection yet.',
    addConnection: 'Add connection',
    search: 'Search curriculum documents…',
    rationaleLabel: 'Rationale (optional)',
    rationalePlaceholder: 'e.g. this policy mandate is the real-world background for this learning goal',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    connect: 'Connect',
    connecting: 'Connecting…',
    noMatches: 'No matches.',
    selectTopic: 'Select a learning goal on the left.',
    viewList: 'List',
    viewGraph: 'Network',
    graphHint: 'Learning goals (larger) and real curriculum documents (smaller), connected by real links. Click one to highlight it.',
    overviewStrands: 'Strands',
    overviewGradeBands: 'Grade bands',
    overviewTheories: 'Theories',
    overviewLiterature: 'Literature',
    overviewRealWorld: 'Real-world links',
    overviewComparisons: 'Comparison notes',
    overviewDivergences: 'Divergences reviewed',
    overviewCoverage: 'Coverage by grade band',
    comparingAgainst: (name: string) => `Compared against ${name}`,
    comparisonNotes: 'Comparison notes',
    noComparisonNotes: 'No comparison notes yet between these two projects.',
    illustrates: 'Illustrates',
    legendTopic: 'Learning goal',
    legendRecord: 'Curriculum document',
    controlFit: 'Fit to screen',
    controlZoomIn: 'Zoom in',
    controlZoomOut: 'Zoom out',
    controlDownload: 'Download as PNG',
    controlLabelsAlways: 'Show all labels',
    controlLabelsHover: 'Show labels on hover only',
    controlSpacingLess: 'Pack tighter',
    controlSpacingMore: 'Spread out',
  },
} as const

export default function CurriculumConnectionsPage() {
  const { project, defaultBranchId, role, supabase, templateId } = useOutletContext<ProjectOutletContext>()
  const config = getCurriculumConnectionsViewConfig(templateId)
  const t = STRINGS[config?.language ?? 'en']
  const canEdit = role !== 'viewer' && role !== 'reviewer'

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linksByObject, setLinksByObject] = useState<Record<string, DataObjectLinkWithRecord[]>>({})
  const [regionRecords, setRegionRecords] = useState<RepositoryRecordRow[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list')

  const [profile, setProfile] = useState<ProjectComparisonProfile | null>(null)
  const [compareProfile, setCompareProfile] = useState<ProjectComparisonProfile | null>(null)
  const [compareName, setCompareName] = useState('')
  const [compareProjectId, setCompareProjectId] = useState<string | null>(null)
  const [comparativeLinks, setComparativeLinks] = useState<ComparativeLinkWithTitles[] | null>(null)
  const [coverage, setCoverage] = useState<DivergenceCoverageRow[]>([])

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then((items) => {
      setTopics(items)
      if (!selectedId && items.length > 0) setSelectedId(items[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  useEffect(() => {
    if (!config) return
    listRepositoryRecordsForRegionSlugs(supabase, config.regionSlugs).then(setRegionRecords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, templateId])

  useEffect(() => {
    if (!topics || topics.length === 0) return
    listContentLinksForDataObjects(supabase, topics.map((tp) => tp.id)).then(setLinksByObject)
  }, [supabase, topics, refreshToken])

  useEffect(() => {
    getProjectComparisonProfile(supabase, project.id).then(setProfile)
    listDivergenceCoverage(supabase, project.id).then(setCoverage)
  }, [supabase, project.id, refreshToken])

  useEffect(() => {
    const compareSlug = KNOWN_COMPARISON_PAIRS[project.slug]
    if (!compareSlug) return
    supabase.from('projects').select('id,name').eq('slug', compareSlug).maybeSingle().then(({ data }) => {
      if (data) { setCompareProjectId(data.id); setCompareName(data.name) }
    })
  }, [supabase, project.slug])

  useEffect(() => {
    if (!compareProjectId) return
    getProjectComparisonProfile(supabase, compareProjectId).then(setCompareProfile)
    listComparativeLinksBetweenProjects(supabase, project.id, compareProjectId).then(setComparativeLinks)
  }, [supabase, project.id, compareProjectId, refreshToken])

  const selectedTopic = useMemo(() => topics?.find((tp) => tp.id === selectedId) ?? null, [topics, selectedId])
  const selectedLinks = selectedId ? linksByObject[selectedId] ?? [] : []

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><Link2 size={18} style={{ color: 'var(--text-muted)' }} />{t.title}</h1>
      <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>{t.intro(config.regionLabel)}</p>

      <TabPanels
        tabs={[
          {
            label: t.tabOverview,
            content: <OverviewTab t={t} profile={profile} topics={topics} coverage={coverage} comparativeLinksCount={comparativeLinks?.length ?? 0} />,
          },
          {
            label: t.tabConnections,
            content: (
              <ConnectionsTab
                t={t} canEdit={canEdit} supabase={supabase} project={project}
                topics={topics} selectedId={selectedId} setSelectedId={setSelectedId} setShowAdd={setShowAdd}
                selectedTopic={selectedTopic} selectedLinks={selectedLinks} linksByObject={linksByObject}
                showAdd={showAdd} regionRecords={regionRecords} viewMode={viewMode} setViewMode={setViewMode}
                onSaved={() => setRefreshToken((x) => x + 1)}
              />
            ),
          },
          {
            label: t.tabComparison,
            content: (
              <ComparisonTab
                t={t} language={config.language} profile={profile} compareProfile={compareProfile} compareName={compareName}
                ownName={project.name} comparativeLinks={comparativeLinks}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Overview

function OverviewTab({
  t,
  profile,
  topics,
  coverage,
  comparativeLinksCount,
}: {
  t: ConnectionsStrings
  profile: ProjectComparisonProfile | null
  topics: TopicListItem[] | null
  coverage: DivergenceCoverageRow[]
  comparativeLinksCount: number
}) {
  const bandCoverage = useMemo(() => {
    const present = new Set((topics ?? []).map((tp) => tp.grade_band).filter(Boolean))
    return GRADE_BANDS.map((b) => present.has(b))
  }, [topics])

  if (!profile) return <p className="muted">…</p>

  const tiles: { label: string; value: number }[] = [
    { label: t.overviewStrands, value: profile.strand_count },
    { label: t.overviewGradeBands, value: profile.grade_bands_covered },
    { label: t.overviewTheories, value: profile.theory_count },
    { label: t.overviewLiterature, value: profile.literature_count },
    { label: t.overviewRealWorld, value: profile.curriculum_repository_link_count },
    { label: t.overviewComparisons, value: comparativeLinksCount },
  ]

  return (
    <div style={{ marginTop: 10 }}>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {tiles.map((tile) => (
          <div key={tile.label} className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--series-a)' }}>{tile.value}</div>
            <div className="muted" style={{ fontSize: 12 }}>{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <strong style={{ fontSize: 13 }}>{t.overviewCoverage}</strong>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          {GRADE_BANDS.map((band, i) => (
            <div key={band} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bandCoverage[i] ? 'var(--series-a)' : 'var(--surface-1)',
                  color: bandCoverage[i] ? '#fff' : 'var(--text-muted)',
                  border: bandCoverage[i] ? 'none' : '1px dashed var(--border)', fontSize: 12, fontWeight: 600,
                }}
              >
                {band}
              </div>
            </div>
          ))}
        </div>
      </div>

      {coverage.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13 }}>{t.overviewDivergences}</strong>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            {coverage.length} · {coverage.filter((c) => c.is_stale).length > 0 ? `${coverage.filter((c) => c.is_stale).length} stale` : '0 stale'}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Connections (list + graph)

function ConnectionsTab({
  t, canEdit, supabase, project, topics, selectedId, setSelectedId, setShowAdd, selectedTopic, selectedLinks,
  linksByObject, showAdd, regionRecords, viewMode, setViewMode, onSaved,
}: {
  t: ConnectionsStrings
  canEdit: boolean
  supabase: ProjectOutletContext['supabase']
  project: ProjectOutletContext['project']
  topics: TopicListItem[] | null
  selectedId: string | null
  setSelectedId: (id: string) => void
  setShowAdd: (v: boolean) => void
  selectedTopic: TopicListItem | null | undefined
  selectedLinks: DataObjectLinkWithRecord[]
  linksByObject: Record<string, DataObjectLinkWithRecord[]>
  showAdd: boolean
  regionRecords: RepositoryRecordRow[]
  viewMode: 'list' | 'graph'
  setViewMode: (v: 'list' | 'graph') => void
  onSaved: () => void
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={12} />{t.viewList}</button>
        <button className={viewMode === 'graph' ? 'active' : ''} onClick={() => setViewMode('graph')}><GitCompare size={12} />{t.viewGraph}</button>
      </div>

      {viewMode === 'graph' ? (
        <ConnectionsGraph t={t} topics={topics} linksByObject={linksByObject} />
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <strong style={{ fontSize: 12 }}>{t.topics}</strong>
            {topics === null ? (
              <p className="muted">…</p>
            ) : (
              topics.map((tp) => (
                <button
                  key={tp.id}
                  className="btn-linklike"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: tp.id === selectedId ? 600 : 400 }}
                  onClick={() => { setSelectedId(tp.id); setShowAdd(false) }}
                >
                  {tp.title}
                  {linksByObject[tp.id]?.length ? <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>({linksByObject[tp.id].length})</span> : null}
                </button>
              ))
            )}
          </div>

          <div>
            {!selectedTopic ? (
              <p className="muted">{t.selectTopic}</p>
            ) : (
              <div className="card">
                <strong>{selectedTopic.title}</strong>
                <div style={{ marginTop: 10 }}>
                  {selectedLinks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t.noConnections}</p>}
                  {selectedLinks.map((link) => (
                    <ConnectionRow key={link.id} link={link} canEdit={canEdit} supabase={supabase} onSaved={onSaved} t={t} />
                  ))}
                </div>
                {canEdit && !showAdd && (
                  <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>
                    <Plus size={12} />{t.addConnection}
                  </button>
                )}
                {canEdit && showAdd && (
                  <AddConnectionForm
                    t={t}
                    supabase={supabase}
                    projectId={project.id}
                    dataObjectId={selectedTopic.id}
                    candidates={regionRecords}
                    onDone={() => { setShowAdd(false); onSaved() }}
                    onCancel={() => setShowAdd(false)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Spacing is a multiplier on cose-bilkent's own idealEdgeLength/nodeRepulsion
// (1 = its tuned defaults for this graph's typical size); the "Pack
// tighter"/"Spread out" buttons below step through this list live, re-running
// layout on the existing cy instance rather than rebuilding the graph.
const SPACING_STEPS = [0.65, 0.85, 1, 1.3, 1.7]

function buildGraphLayout(spacing: number, animate: boolean) {
  return {
    name: 'cose-bilkent',
    quality: 'proof',
    nodeRepulsion: 5500 * spacing,
    idealEdgeLength: 110 * spacing,
    edgeElasticity: 0.4,
    nestingFactor: 0.1,
    gravity: 0.25,
    gravityRange: 3.8,
    numIter: 3000,
    tile: true,
    tilingPaddingVertical: 20,
    tilingPaddingHorizontal: 20,
    animate: animate ? 'end' : false,
    animationDuration: 500,
    randomize: true,
    fit: true,
    padding: 36,
    nodeDimensionsIncludeLabels: true,
  } as any
}

function ConnectionsGraph({
  t,
  topics,
  linksByObject,
}: {
  t: ConnectionsStrings
  topics: TopicListItem[] | null
  linksByObject: Record<string, DataObjectLinkWithRecord[]>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const [selected, setSelected] = useState<{ label: string; detail: string } | null>(null)
  const [spacingIdx, setSpacingIdx] = useState(2) // index into SPACING_STEPS, 2 = 1x (default)
  const [labelsAlways, setLabelsAlways] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !topics) return
    const connectedTopics = topics.filter((tp) => (linksByObject[tp.id]?.length ?? 0) > 0)
    const recordById = new Map<string, DataObjectLinkWithRecord['record']>()
    for (const tp of connectedTopics) for (const link of linksByObject[tp.id]) recordById.set(link.record.id, link.record)

    const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

    const elements: ElementDefinition[] = [
      ...connectedTopics.map((tp) => ({
        data: {
          id: `topic:${tp.id}`, label: truncate(tp.title, 30), fullLabel: tp.title, kind: 'topic',
          size: 24 + Math.min(16, (linksByObject[tp.id]?.length ?? 0) * 3),
        },
      })),
      ...Array.from(recordById.values()).map((r) => ({
        data: { id: `record:${r.id}`, label: truncate(r.title, 24), fullLabel: r.title, kind: 'record', recordType: RECORD_TYPE_LABEL[r.record_type] },
      })),
      ...connectedTopics.flatMap((tp) =>
        (linksByObject[tp.id] ?? []).map((link) => ({ data: { id: `e-${link.id}`, source: `topic:${tp.id}`, target: `record:${link.record.id}` } }))
      ),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: buildGraphLayout(SPACING_STEPS[spacingIdx], false),
      minZoom: 0.15,
      maxZoom: 3,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: 'node[kind="topic"]',
          style: {
            'background-color': cssVar('--series-a', '#006c66') as any,
            'border-width': 2, 'border-color': cssVar('--surface-0', '#fff') as any,
            width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 11, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': '120px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: cssVar('--text-primary', '#0b0b0b') as any,
            'text-background-color': cssVar('--surface-0', '#fff') as any, 'text-background-opacity': 0.9, 'text-background-padding': '2px' as any,
            'transition-property': 'opacity, border-width' as any, 'transition-duration': 150 as any,
          },
        },
        {
          // Record (real-world document) nodes stay unlabeled by default --
          // same convention concepts-page.tsx's own deep concept nodes use --
          // and only light up on hover/select, so a graph with many more
          // documents than learning goals doesn't drown in overlapping text.
          selector: 'node[kind="record"]',
          style: {
            'background-color': '#3fae70', 'border-width': 1.5, 'border-color': cssVar('--surface-0', '#fff') as any,
            width: 13, height: 13, label: '',
            'transition-property': 'opacity, border-width' as any, 'transition-duration': 150 as any,
          },
        },
        {
          selector: 'node.hover-label, node.labels-always[kind="record"]',
          style: {
            label: 'data(label)', 'font-size': 9, 'z-index': 999,
            'text-wrap': 'wrap', 'text-max-width': '100px', 'text-valign': 'bottom', 'text-margin-y': 4,
            color: cssVar('--text-primary', '#0b0b0b') as any,
            'text-background-color': cssVar('--surface-0', '#fff') as any, 'text-background-opacity': 1,
            'text-background-padding': '3px' as any, 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc') as any,
          } as any,
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--text-primary', '#0b0b0b') as any } },
        {
          selector: 'edge',
          style: {
            width: 1.3, 'line-color': cssVar('--border', '#c3c2b7') as any, 'curve-style': 'bezier',
            'target-arrow-shape': 'none', opacity: 0.55,
            'transition-property': 'opacity, width' as any, 'transition-duration': 150 as any,
          },
        },
        { selector: 'edge.highlight', style: { opacity: 1, width: 2.2, 'line-color': cssVar('--series-a', '#006c66') as any } },
        { selector: '.dim', style: { opacity: 0.12 } },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const n = evt.target
      cy.elements().removeClass('dim highlight')
      const neighborhood = n.closedNeighborhood()
      cy.elements().difference(neighborhood).addClass('dim')
      neighborhood.edges().addClass('highlight')
      setSelected({ label: n.data('fullLabel'), detail: n.data('kind') === 'record' ? n.data('recordType') : '' })
    })
    cy.on('mouseover', 'node', (evt) => evt.target.addClass('hover-label'))
    cy.on('mouseout', 'node', (evt) => evt.target.removeClass('hover-label'))
    cy.on('tap', (evt) => {
      if (evt.target === cy) { cy.elements().removeClass('dim highlight'); setSelected(null) }
    })

    fitWithReadableFloor(cy)
    cyRef.current = cy
    return () => { cy.destroy() }
    // Spacing changes are applied live by the effect below without rebuilding
    // the graph, so it's deliberately left out of this dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, linksByObject])

  // Re-run layout in place when the user adjusts spacing -- smooth, animated,
  // no rebuild of the underlying graph or loss of the current selection.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.layout(buildGraphLayout(SPACING_STEPS[spacingIdx], true)).run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacingIdx])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes('[kind="record"]').toggleClass('labels-always', labelsAlways)
  }, [labelsAlways])

  const zoomBy = (factor: number) => {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)) }, { duration: 180 })
  }

  const downloadPng = () => {
    const cy = cyRef.current
    if (!cy) return
    const uri = cy.png({ full: true, scale: 2, bg: cssVar('--surface-0', '#ffffff') })
    const a = document.createElement('a')
    a.href = uri
    a.download = 'curriculum-connections-graph.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.graphHint}</p>
      <div className="graph-host" style={{ height: 560, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div ref={containerRef} className="graph-canvas" />

        <div className="row" style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, gap: 6 }}>
          <button className="btn btn-mini" aria-label={t.controlSpacingLess} title={t.controlSpacingLess}
            disabled={spacingIdx === 0} onClick={() => setSpacingIdx((i) => Math.max(0, i - 1))}>
            <Minus size={12} />
          </button>
          <button className="btn btn-mini" aria-label={t.controlSpacingMore} title={t.controlSpacingMore}
            disabled={spacingIdx === SPACING_STEPS.length - 1} onClick={() => setSpacingIdx((i) => Math.min(SPACING_STEPS.length - 1, i + 1))}>
            <Plus size={12} />
          </button>
          <button className="btn btn-mini" aria-label={t.controlZoomOut} title={t.controlZoomOut} onClick={() => zoomBy(0.8)}>
            <ZoomOut size={12} />
          </button>
          <button className="btn btn-mini" aria-label={t.controlZoomIn} title={t.controlZoomIn} onClick={() => zoomBy(1.25)}>
            <ZoomIn size={12} />
          </button>
          <button className="btn btn-mini" aria-label={t.controlFit} title={t.controlFit}
            onClick={() => { if (cyRef.current) fitWithReadableFloor(cyRef.current) }}>
            <Maximize2 size={12} />
          </button>
          <button
            className={`btn btn-mini${labelsAlways ? ' active' : ''}`}
            aria-label={labelsAlways ? t.controlLabelsHover : t.controlLabelsAlways}
            title={labelsAlways ? t.controlLabelsHover : t.controlLabelsAlways}
            onClick={() => setLabelsAlways((v) => !v)}
          >
            <Grid3x3 size={12} />
          </button>
          <button className="btn btn-mini" aria-label={t.controlDownload} title={t.controlDownload} onClick={downloadPng}>
            <Download size={12} />
          </button>
        </div>

        <div className="legend">
          <span><span className="dept-sw" style={{ background: 'var(--series-a)' }} />{t.legendTopic}</span>
          <span><span className="dept-sw" style={{ background: '#3fae70' }} />{t.legendRecord}</span>
        </div>
      </div>
      {selected && (
        <div className="card" style={{ marginTop: 8, padding: '8px 12px' }}>
          <strong style={{ fontSize: 13 }}>{selected.label}</strong>
          {selected.detail && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{selected.detail}</span>}
        </div>
      )}
    </div>
  )
}

function ConnectionRow({
  link,
  canEdit,
  supabase,
  onSaved,
  t,
}: {
  link: DataObjectLinkWithRecord
  canEdit: boolean
  supabase: ProjectOutletContext['supabase']
  onSaved: () => void
  t: ConnectionsStrings
}) {
  const [editing, setEditing] = useState(false)
  const [rationale, setRationale] = useState(link.rationale ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await updateContentLinkRationale(supabase, link.id, rationale)
    setBusy(false)
    setEditing(false)
    onSaved()
  }

  return (
    <div className="card" style={{ marginBottom: 6, padding: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 5 }}>
          <RecordKindIcon type={link.record.record_type} size={13} />
          <strong style={{ fontSize: 13 }}>{link.record.title}</strong>
        </span>
        <span className="muted" style={{ fontSize: 11 }}>{RECORD_TYPE_LABEL[link.record.record_type]}</span>
      </div>
      {editing ? (
        <div style={{ marginTop: 6 }}>
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} style={{ width: '100%' }} />
          <div className="row" style={{ marginTop: 4, gap: 6 }}>
            <button className="btn btn-mini btn-primary" disabled={busy} onClick={save}><Save size={11} />{t.save}</button>
            <button className="btn-linklike" onClick={() => { setEditing(false); setRationale(link.rationale ?? '') }}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{link.rationale || '—'}</p>
          {canEdit && (
            <button className="btn-linklike" onClick={() => setEditing(true)}><Pencil size={11} /></button>
          )}
        </div>
      )}
    </div>
  )
}

function AddConnectionForm({
  t,
  supabase,
  projectId,
  dataObjectId,
  candidates,
  onDone,
  onCancel,
}: {
  t: ConnectionsStrings
  supabase: ProjectOutletContext['supabase']
  projectId: string
  dataObjectId: string
  candidates: RepositoryRecordRow[]
  onDone: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<RepositoryRecordRow | null>(null)
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return candidates.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 10)
  }, [query, candidates])

  const submit = async () => {
    if (!picked) return
    setBusy(true); setError(null)
    const { error: err } = await createContentLink(supabase, {
      projectId,
      dataObjectId,
      repositoryRecordId: picked.id,
      rationale: rationale.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err); return }
    onDone()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{t.addConnection}</strong>
        <button className="btn-linklike" onClick={onCancel}><X size={12} /></button>
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
      {picked ? (
        <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
          <span className="row" style={{ gap: 5, fontSize: 13 }}><RecordKindIcon type={picked.record_type} size={12} />{picked.title}</span>
          <button className="btn-linklike" onClick={() => setPicked(null)}>{t.cancel}</button>
        </div>
      ) : (
        <div className="field">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} />
          {results.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="row" style={{ gap: 5, fontSize: 13 }}><RecordKindIcon type={r.record_type} size={12} />{r.title}</span>
              <button className="btn btn-mini" onClick={() => setPicked(r)}>{t.connect}</button>
            </div>
          ))}
          {query.trim().length >= 2 && results.length === 0 && <p className="muted" style={{ fontSize: 12 }}>{t.noMatches}</p>}
        </div>
      )}
      <div className="field">
        <label>{t.rationaleLabel}</label>
        <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={t.rationalePlaceholder} />
      </div>
      <button className="btn btn-primary" disabled={!picked || busy} onClick={submit}>{busy ? t.connecting : t.connect}</button>
    </div>
  )
}

// ---------------------------------------------------------------- Comparison

function ComparisonTab({
  t, language, profile, compareProfile, compareName, ownName, comparativeLinks,
}: {
  t: ConnectionsStrings
  language: 'de' | 'en'
  profile: ProjectComparisonProfile | null
  compareProfile: ProjectComparisonProfile | null
  compareName: string
  ownName: string
  comparativeLinks: ComparativeLinkWithTitles[] | null
}) {
  if (!profile || !compareProfile) return <p className="muted" style={{ marginTop: 10 }}>…</p>

  return (
    <div style={{ marginTop: 10 }}>
      <p className="muted row" style={{ gap: 5, marginBottom: 10 }}>
        <GitCompare size={13} /> {t.comparingAgainst(compareName)}
      </p>
      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <LpmComparisonProfileCard profile={profile} label={ownName} language={language} />
        <LpmComparisonProfileCard profile={compareProfile} label={compareName} language={language} />
      </div>
      <div className="card">
        <strong style={{ fontSize: 13 }}>{t.comparisonNotes}</strong>
        {comparativeLinks === null ? (
          <p className="muted">…</p>
        ) : comparativeLinks.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>{t.noComparisonNotes}</p>
        ) : (
          comparativeLinks.map((l) => (
            <div key={l.id} className="card" style={{ marginTop: 8, padding: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{l.from_title} <span className="muted">↔</span> {l.to_title}</span>
                <span className="muted" style={{ fontSize: 11 }}>{l.relation_type.replace(/_/g, ' ')}</span>
              </div>
              {l.divergence_label && <p className="muted" style={{ fontSize: 11, margin: '2px 0' }}>{t.illustrates}: {l.divergence_label}</p>}
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>{l.commentary}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
