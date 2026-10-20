import { useEffect, useRef, useState } from 'react'
import { GitCompare } from 'lucide-react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import { Download, Grid3x3, Maximize2, Minus, Plus, ZoomIn, ZoomOut } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'
import { RECORD_TYPE_LABEL, type DataObjectLinkWithRecord } from '@/lib/supabase/curriculum-repository'
import type { TopicListItem } from '@/lib/supabase/curriculum'

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

// The "Network" / "Netzwerk" page -- promoted out of curriculum-connections-page.tsx
// into its own sidebar nav item on 2026-10-20 so it gets real room (a 480px
// panel inside a 3-tab page vs. a full page here) and its own URL.
export default function CurriculumNetworkPage() {
  const { config, topics, linksByObject } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [selected, setSelected] = useState<{ label: string; detail: string } | null>(null)
  const [spacingIdx, setSpacingIdx] = useState(2)
  const [labelsAlways, setLabelsAlways] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !topics) return
    const connectedTopics = topics.filter((tp) => (linksByObject[tp.id]?.length ?? 0) > 0)
    const recordById = new Map<string, DataObjectLinkWithRecord['record']>()
    for (const tp of connectedTopics) for (const link of linksByObject[tp.id]) recordById.set(link.record.id, link.record)

    const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

    const elements: ElementDefinition[] = [
      ...connectedTopics.map((tp: TopicListItem) => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, linksByObject])

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

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><GitCompare size={18} style={{ color: 'var(--text-muted)' }} />{t.networkTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.networkHelp}</p>

      <div className="graph-host" style={{ height: 640, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
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
