import { useEffect, useRef, useState } from 'react'
import { GitCompare } from 'lucide-react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import { Download } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'
import { RECORD_TYPE_LABEL, type DataObjectLinkWithRecord } from '@/lib/supabase/curriculum-repository'
import type { TopicListItem } from '@/lib/supabase/curriculum'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { layoutTier } from '@/lib/graph-layout'
import { lineOpacity, pickVisibleLabels, truncateLabel, type LabelCandidate } from '@/lib/graph-standards'

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
// A graph with only a few linked goals would otherwise be blown up to fill the
// whole frame, with oversized labels. Never start larger than this.
const MAX_FIT_ZOOM = 1.1
function fitWithReadableFloor(cy: Core) {
  cy.fit(undefined, 32)
  if (cy.zoom() < MIN_READABLE_ZOOM) { cy.zoom(MIN_READABLE_ZOOM); cy.center() }
  else if (cy.zoom() > MAX_FIT_ZOOM) { cy.zoom(MAX_FIT_ZOOM); cy.center() }
}

// A record is not a concept group, so it does not take one of the six
// concept colors (they mean "which top-level concept", see the graph
// standards note). Learning goals use the brand teal; curriculum documents a
// neutral slate that keeps 3:1 contrast against the page.
const RECORD_COLOR = '#6f7d8c'

// The graph standards, applied to the Curriculum network (tracker row 3 in
// lab_manager/docs/design-notes/openlpm-graph-visualization-standards-
// proposal-2026-10-25.md). Roles here: item = a learning goal or a curriculum
// document; every link is a plain goal-to-document link, so there are no
// groups, main versus other links or arcs, and the connection choice is left
// off. What applies: a fixed layout by default (two rows, ordered to keep
// the lines apart), labels that never overlap, line strength, optional
// physics, and the shared control panel. Before 2026-10-25 this graph
// started a physics simulation from random positions every time it loaded.
const GRADE_ORDER = ['K-2', '3-5', '6-8', '9-12']
const gradeRank = (g: string | null) => {
  const i = GRADE_ORDER.indexOf(g ?? '')
  return i >= 0 ? i : GRADE_ORDER.length
}

const LAYOUT_WIDTH = 1000
const TOPIC_SPACING = 170
const RECORD_SPACING = 64

/** One centered row if it fits the width, otherwise the shared staggered grid. */
function placeRow(ids: string[], y: number, spacing: number): { positions: Map<string, { x: number; y: number }>; height: number } {
  const positions = new Map<string, { x: number; y: number }>()
  if (ids.length * spacing <= LAYOUT_WIDTH) {
    const start = LAYOUT_WIDTH / 2 - ((ids.length - 1) * spacing) / 2
    ids.forEach((id, i) => positions.set(id, { x: start + i * spacing, y }))
    return { positions, height: ids.length ? 1 : 0 }
  }
  const { positions: grid, rows } = layoutTier(ids.map((id) => ({ id })), LAYOUT_WIDTH / 2, y, LAYOUT_WIDTH, 56, spacing)
  for (const [id, p] of grid) positions.set(id, p)
  return { positions, height: rows }
}

// Spacing 0 to 100 maps to a multiplier on cose-bilkent's own tuned
// idealEdgeLength and nodeRepulsion (50 = the values this graph always used).
const spacingMultiplier = (spacing: number) => 0.4 + spacing * 0.012

function physicsLayout(spacing: number) {
  const m = spacingMultiplier(spacing)
  return {
    name: 'cose-bilkent',
    quality: 'proof',
    nodeRepulsion: 5500 * m,
    idealEdgeLength: 110 * m,
    edgeElasticity: 0.4,
    nestingFactor: 0.1,
    gravity: 0.25,
    gravityRange: 3.8,
    numIter: 3000,
    tile: true,
    tilingPaddingVertical: 20,
    tilingPaddingHorizontal: 20,
    animate: false,
    // Starts from the fixed layout's positions, so the same data gives the same picture.
    randomize: false,
    fit: false,
    nodeDimensionsIncludeLabels: true,
  } as any
}

// The "Network" / "Netzwerk" page -- promoted out of curriculum-connections-page.tsx
// into its own sidebar nav item on 2026-10-20 so it gets real room (a 480px
// panel inside a 3-tab page vs. a full page here) and its own URL.
export default function CurriculumNetworkPage() {
  const { config, topics, linksByObject } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']
  const lang = config?.language === 'de' ? 'de' : 'en'

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [selected, setSelected] = useState<{ label: string; detail: string } | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('curriculum-network')
  // The spacing slider fires on every pixel of a drag; physics recomputes once it holds still.
  const [physicsSpacing, setPhysicsSpacing] = useState(gs.spacing)
  useEffect(() => {
    const timer = window.setTimeout(() => setPhysicsSpacing(gs.spacing), 250)
    return () => window.clearTimeout(timer)
  }, [gs.spacing])

  useEffect(() => {
    if (!containerRef.current || !topics) return
    const connectedTopics = topics
      .filter((tp) => (linksByObject[tp.id]?.length ?? 0) > 0)
      .sort((a, b) => gradeRank(a.grade_band) - gradeRank(b.grade_band) || a.title.localeCompare(b.title))
    const recordById = new Map<string, DataObjectLinkWithRecord['record']>()
    for (const tp of connectedTopics) for (const link of linksByObject[tp.id]) recordById.set(link.record.id, link.record)

    // ---- Fixed layout: learning goals in a row, documents in the row below ----
    const topicRow = placeRow(connectedTopics.map((tp) => `topic:${tp.id}`), 0, TOPIC_SPACING)
    const topicX = new Map(connectedTopics.map((tp) => [tp.id, topicRow.positions.get(`topic:${tp.id}`)!.x]))
    // A document sits near the goals it links to, which keeps the lines short and apart.
    const centerOf = (recordId: string) => {
      const xs = connectedTopics.filter((tp) => linksByObject[tp.id].some((l) => l.record.id === recordId)).map((tp) => topicX.get(tp.id)!)
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : LAYOUT_WIDTH / 2
    }
    const recordsSorted = Array.from(recordById.values()).sort((a, b) => centerOf(a.id) - centerOf(b.id) || a.title.localeCompare(b.title))
    const recordsY = (topicRow.height > 1 ? topicRow.height * 56 : 0) + 260
    const recordRow = placeRow(recordsSorted.map((r) => `record:${r.id}`), recordsY, RECORD_SPACING)

    const linkCount = new Map<string, number>()
    for (const tp of connectedTopics) for (const link of linksByObject[tp.id]) linkCount.set(link.record.id, (linkCount.get(link.record.id) ?? 0) + 1)

    const elements: ElementDefinition[] = [
      ...connectedTopics.map((tp: TopicListItem) => ({
        data: {
          id: `topic:${tp.id}`, label: '', fullLabel: tp.title, kind: 'topic',
          size: 24 + Math.min(16, (linksByObject[tp.id]?.length ?? 0) * 3),
        },
        position: topicRow.positions.get(`topic:${tp.id}`),
      })),
      ...recordsSorted.map((r) => ({
        data: { id: `record:${r.id}`, label: '', fullLabel: r.title, kind: 'record', recordType: RECORD_TYPE_LABEL[r.record_type], links: linkCount.get(r.id) ?? 1 },
        position: recordRow.positions.get(`record:${r.id}`),
      })),
      ...connectedTopics.flatMap((tp) =>
        (linksByObject[tp.id] ?? []).map((link) => ({ data: { id: `e-${link.id}`, source: `topic:${tp.id}`, target: `record:${link.record.id}` } }))
      ),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
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
          selector: 'node[kind="record"]',
          style: {
            'background-color': RECORD_COLOR, 'border-width': 1.5, 'border-color': cssVar('--surface-0', '#fff') as any,
            width: 13, height: 13,
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '100px', 'text-valign': 'bottom', 'text-margin-y': 4,
            color: cssVar('--text-primary', '#0b0b0b') as any,
            'transition-property': 'opacity, border-width' as any, 'transition-duration': 150 as any,
          },
        },
        {
          selector: 'node.hover-label',
          style: {
            label: 'data(fullLabel)', 'font-size': 10, 'font-weight': 600, 'z-index': 999,
            'text-wrap': 'wrap', 'text-max-width': '160px', 'text-valign': 'bottom', 'text-margin-y': 4,
            color: cssVar('--text-primary', '#0b0b0b') as any,
            'text-background-color': cssVar('--surface-0', '#fff') as any, 'text-background-opacity': 1,
            'text-background-padding': '3px' as any, 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc') as any,
          } as any,
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--text-primary', '#0b0b0b') as any } },
        {
          selector: 'edge',
          style: {
            width: 1.3, 'line-color': '#8896a5' as any, 'curve-style': 'bezier',
            'target-arrow-shape': 'none', opacity: 'data(op)' as any,
            'transition-property': 'opacity, width' as any, 'transition-duration': 150 as any,
          },
        },
        { selector: 'edge.highlight', style: { opacity: 1, width: 2.2, 'line-color': cssVar('--series-a', '#006c66') as any } },
        { selector: '.dim', style: { opacity: 0.12 } },
      ],
    })

    if (gs.layout === 'physics') cy.layout(physicsLayout(physicsSpacing)).run()

    // ---- Labels: none overlap. Learning goals always keep theirs. ----
    {
      const candidates: LabelCandidate[] = cy.nodes().map((n) => {
        const isTopic = n.data('kind') === 'topic'
        return {
          id: n.id(), label: n.data('fullLabel'), x: n.position('x'), y: n.position('y'), size: isTopic ? n.data('size') : 13,
          priority: isTopic ? 1000 : n.data('links') ?? 1, alwaysShow: isTopic, fontPx: isTopic ? 11 : 9, maxWidthPx: isTopic ? 120 : 100, labelSide: 'below',
        }
      })
      const visible = gs.labels === 'few' ? pickVisibleLabels(candidates) : null
      cy.nodes().forEach((n) => {
        const full = String(n.data('fullLabel'))
        const isTopic = n.data('kind') === 'topic'
        if (visible && !visible.has(n.id())) n.data('label', '')
        else n.data('label', isTopic ? truncateLabel(full, 60) : truncateLabel(full, 28))
      })
    }
    cy.edges().forEach((e) => { e.data('op', lineOpacity(2, gs.lineStrength)) })

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
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, linksByObject, gs.layout, gs.labels, physicsSpacing])

  // Line strength restyles the existing lines in place, keeping zoom and pan.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.edges().forEach((e) => { e.data('op', lineOpacity(2, gs.lineStrength)) })
  }, [gs.lineStrength, topics, linksByObject])

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

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><GitCompare size={18} style={{ color: 'var(--text-muted)' }} />{t.networkTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.networkHelp}</p>

      <GraphControls
        settings={gs}
        onChange={updateGs}
        onReset={resetGs}
        lang={lang}
        showConnections={false}
        wording={{ fixed: { label: lang === 'de' ? 'Zwei Reihen' : 'Two rows', hint: lang === 'de' ? 'Lernziele oben, Lehrplan-Dokumente darunter, immer gleich angeordnet.' : 'Learning goals on top, curriculum documents below, always arranged the same way.' } }}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={() => { if (cyRef.current) fitWithReadableFloor(cyRef.current) }}
      />

      <div className="graph-host" style={{ height: 640, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div ref={containerRef} className="graph-canvas" />

        <div className="row" style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, gap: 6 }}>
          <button className="btn btn-mini" aria-label={t.controlDownload} title={t.controlDownload} onClick={downloadPng}>
            <Download size={12} />
          </button>
        </div>

        <div className="legend">
          <span><span className="dept-sw" style={{ background: 'var(--series-a)' }} />{t.legendTopic}</span>
          <span><span className="dept-sw" style={{ background: RECORD_COLOR }} />{t.legendRecord}</span>
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
