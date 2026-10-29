import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { PortfolioEdge } from '@/lib/supabase/portfolios'
import type { GroupGraphNode } from '@/lib/supabase/groups'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { applyGraphSettings, applyLineLooks, attachHover, cssVar, hoverStyles, type NodeLabelInfo } from '@/lib/graph-cytoscape'

// A read-only merged view of every Notebook a group's members have shared
// with it -- same visual language as the editable Notebook graph
// (portfolio-explorer.tsx), minus every mutation affordance (add/edit/link/
// review), since editing someone else's notebook content from inside a
// group synthesis view would be a different, much bigger feature nobody
// asked for. Nodes carry whose notebook they came from, shown on select,
// since "who contributed what" is the actual point of a merged view.
//
// Follows the shared graph standards (feedback 2a3c04e3): a fixed layout by
// default with physics as an option, labels that never overlap, link names
// on hover, the same control panel as every other graph. Color shows whose
// notebook a note came from, using the six soft palette colors, when the
// group has six members or fewer. With more owners every note is slate and
// the detail card names the owner. Shape still separates canonical notes
// (circle) from private ones (rounded square).
const edgeWeight = () => 2

export function GroupNotebookGraph({ nodes, edges }: { nodes: GroupGraphNode[]; edges: PortfolioEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('group-notebook')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const selected = selectedId ? nodesById[selectedId] : null
  const owners = useMemo(() => Array.from(new Set(nodes.map((n) => n.ownerName))).sort(), [nodes])
  const colorByOwner = owners.length <= 6

  useEffect(() => {
    if (!containerRef.current) return
    const slate = cssVar('--place-other', '#6f7d8c')
    const text = cssVar('--text-primary', '#0b0b0b')
    const info = new Map<string, NodeLabelInfo>()
    const elements: ElementDefinition[] = [
      ...nodes.map((n) => {
        info.set(n.id, { full: n.label, priority: 10, fontPx: 10, maxWidthPx: 100, maxChars: 28 })
        const color = colorByOwner ? cssVar(`--map-${owners.indexOf(n.ownerName) + 1}`, slate) : slate
        return { data: { id: n.id, kind: n.kind, size: 28, color } }
      }),
      ...edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, name: e.label ?? '' } })),
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
            width: 'data(size)', height: 'data(size)', 'background-color': 'data(color)', label: 'data(label)', 'font-size': 10, 'font-weight': 600,
            'text-wrap': 'wrap', 'text-max-width': '100px', 'text-valign': 'bottom', 'text-margin-y': 5, color: text,
            'border-width': 2, 'border-color': cssVar('--surface-0', '#fff'),
          },
        },
        { selector: 'node[kind = "canonical"]', style: { shape: 'ellipse' } },
        { selector: 'node[kind = "private"]', style: { shape: 'round-rectangle' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': text } },
        {
          selector: 'edge',
          style: {
            width: 1.6, 'line-color': slate, 'target-arrow-color': slate, 'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 'data(op)', 'font-size': 9, color: text,
          },
        },
        { selector: 'edge:selected', style: { 'line-color': cssVar('--series-a', '#006c66'), width: 2.5, opacity: 1 } },
        ...hoverStyles(),
      ] as never,
    })
    // Notes with more links get a label first when space is short.
    cy.nodes().forEach((n) => { const i = info.get(n.id()); if (i) i.priority += n.degree(false) * 10 })
    applyGraphSettings(cy, gs, { name: 'concentric', concentric: (n: cytoscape.NodeSingular) => n.degree(false), levelWidth: () => 1, minNodeSpacing: 46 } as never, info)
    applyLineLooks(cy, gs.lineStrength, edgeWeight)
    attachHover(cy)
    cy.on('tap', 'node', (evt) => setSelectedId(evt.target.id()))
    cy.on('tap', (evt) => { if (evt.target === cy) setSelectedId(null) })
    cyRef.current = cy
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // gs.lineStrength is applied by the effect below, so dragging the slider does not rebuild the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, owners, colorByOwner, gs.layout, gs.labels, gs.spacing])

  useEffect(() => {
    if (cyRef.current) applyLineLooks(cyRef.current, gs.lineStrength, edgeWeight)
  }, [gs.lineStrength])

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang="en" showConnections={false} showLayout
        wording={{ fixed: { label: 'Rings', hint: 'The notes with most links in the middle. Always the same.' } }}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current?.fit(undefined, 30)}
      />
      <div style={{ position: 'relative', flex: 1, minHeight: 420 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 420, border: '1px solid var(--border)', borderRadius: 8 }} />
        {selected && (
          <div className="card" style={{ position: 'absolute', top: 10, right: 10, maxWidth: 240 }}>
            <strong>{selected.label}</strong>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              From {selected.ownerName}&apos;s &ldquo;{selected.portfolioName}&rdquo;
            </p>
            {selected.annotation && <p style={{ fontSize: 12.5, marginTop: 6 }}>{selected.annotation}</p>}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 14, fontSize: 11, margin: '6px 0 0', flexWrap: 'wrap' }}>
        {colorByOwner && owners.map((o, i) => <span key={o}><span className="dept-sw" style={{ background: `var(--map-${i + 1})` }} />{o}</span>)}
        <span className="muted">Circle = shared canonical note, square = private note. Point at a note to see its full title.</span>
      </div>
    </div>
  )
}
