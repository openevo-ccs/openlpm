import { useEffect, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { applyGraphSettings, applyLineLooks, attachHover, cssVar, hoverStyles, type NodeLabelInfo } from '@/lib/graph-cytoscape'
import type { RelationGraph } from '@/lib/literature-analytics'

// Relation types carry their own meaning (a paper that contradicts another is
// not a neutral link), so they keep two fixed hues outside the six concept
// colors: red for disagreement, green for support. Everything else is slate.
const DISAGREE = '#b4432e'
const SUPPORT = '#2e7d4f'
const RELATION_COLOR: Record<string, string> = {
  contradicts: DISAGREE,
  criticises: DISAGREE,
  supports: SUPPORT,
  extends: SUPPORT,
  replicates: SUPPORT,
}
// Strong claims between papers weigh more than a plain "related".
const edgeWeight = (d: Record<string, unknown>) => (d.color === 'neutral' ? 1 : 2)

/**
 * A picture of how a collection's papers relate to each other, built from
 * each record's own `related[]` field. Every line is a recorded relation and
 * nothing is simulated. Follows the shared graph standards (feedback 2a3c04e3): a fixed
 * concentric layout by degree (the best-connected papers in the middle) as
 * the default, physics as an option, labels that never overlap, the name of
 * a link on hover, and the same control panel as every other graph. This is
 * Dustin's standing rejection of a physics-first layout for this
 * ecosystem's relation graphs, applied to a mesh-shaped citation network.
 */
export function LiteratureRelationsGraph({ graph, onOpenPaper }: { graph: RelationGraph; onOpenPaper: (literaturebaseId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('literature-relations')
  const [selected, setSelected] = useState<{ id: string; label: string; external: boolean } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const slate = cssVar('--place-other', '#6f7d8c')
    const text = cssVar('--text-primary', '#0b0b0b')

    const info = new Map<string, NodeLabelInfo>()
    const elements: ElementDefinition[] = [
      ...graph.papers.map((p) => {
        info.set(p.id, { full: p.title, priority: 50, fontPx: 10, maxWidthPx: 110, maxChars: 34 })
        return { data: { id: p.id, kind: 'paper', size: 20 } }
      }),
      ...[...graph.externalTitles.entries()].map(([id, label]) => {
        info.set(id, { full: label, priority: 1, fontPx: 9, maxWidthPx: 90, maxChars: 30 })
        return { data: { id, kind: 'external', size: 12 } }
      }),
      ...graph.edges.map((e) => ({ data: { id: e.id, source: e.from, target: e.to, name: e.relation, color: RELATION_COLOR[e.relation] ?? 'neutral' } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      minZoom: 0.3,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            width: 'data(size)', height: 'data(size)', label: 'data(label)', 'font-size': 10, 'font-weight': 600,
            'text-wrap': 'wrap', 'text-max-width': '110px', 'text-valign': 'bottom', 'text-margin-y': 5, color: text,
            'border-width': 2, 'border-color': cssVar('--surface-0', '#fff'),
          },
        },
        { selector: 'node[kind = "paper"]', style: { 'background-color': text } },
        {
          selector: 'node[kind = "external"]',
          style: { 'background-color': slate, 'border-style': 'dashed', 'border-color': slate, 'font-weight': 400, 'font-size': 9, color: cssVar('--text-muted', '#898781') },
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.6, 'line-color': slate, 'target-arrow-color': slate, 'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 'data(op)', 'font-size': 9, color: text,
          },
        },
        { selector: 'edge[color != "neutral"]', style: { 'line-color': 'data(color)', 'target-arrow-color': 'data(color)' } },
        ...hoverStyles(),
      ] as never,
    })

    // Best-connected papers get a label first, then the rest where there is room.
    cy.nodes().forEach((n) => { const i = info.get(n.id()); if (i) i.priority += n.degree(false) * 10 })
    applyGraphSettings(cy, gs, { name: 'concentric', concentric: (n: cytoscape.NodeSingular) => n.degree(false), levelWidth: () => 1, minNodeSpacing: 46 } as never, info)
    applyLineLooks(cy, gs.lineStrength, edgeWeight)
    attachHover(cy)
    cy.on('tap', 'node', (evt) => {
      const d = evt.target.data()
      setSelected({ id: d.id, label: d.fullLabel, external: d.kind === 'external' })
    })
    cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
    cyRef.current = cy
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // gs.lineStrength is applied by the effect below, so dragging the slider does not rebuild the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, gs.layout, gs.labels, gs.spacing])

  useEffect(() => {
    if (cyRef.current) applyLineLooks(cyRef.current, gs.lineStrength, edgeWeight)
  }, [gs.lineStrength])

  if (graph.papers.length === 0) {
    return <p className="muted" style={{ fontSize: 12 }}>No papers to map.</p>
  }
  if (graph.edges.length === 0) {
    return <p className="muted" style={{ fontSize: 12 }}>None of these papers have a recorded relation to each other yet.</p>
  }

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  return (
    <div>
      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang="en" showConnections={false} showLayout
        wording={{ fixed: { label: 'Rings', hint: 'The best-connected papers in the middle. Always the same.' } }}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current?.fit(undefined, 30)}
      />
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 320, border: '1px solid var(--border)', borderRadius: 8 }} />
        {selected && (
          <div className="card" style={{ position: 'absolute', top: 8, right: 8, maxWidth: 200 }}>
            <strong style={{ fontSize: 12 }}>{selected.label}</strong>
            {selected.external && <p className="muted" style={{ fontSize: 10.5, margin: '2px 0 0' }}>Outside this collection</p>}
            {!selected.external && (
              <button className="btn btn-mini" style={{ marginTop: 6 }} onClick={() => onOpenPaper(selected.id)}>Open</button>
            )}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 14, fontSize: 11, margin: '6px 0 0', flexWrap: 'wrap' }}>
        <span><span className="dept-sw" style={{ background: SUPPORT }} />supports, extends, replicates</span>
        <span><span className="dept-sw" style={{ background: DISAGREE }} />contradicts, criticises</span>
        <span className="muted">Point at a paper to see its full title and what each link is called.</span>
      </div>
    </div>
  )
}
