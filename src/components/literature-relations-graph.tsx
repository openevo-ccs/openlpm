import { useEffect, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { RelationGraph } from '@/lib/literature-analytics'

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const RELATION_COLOR: Record<string, string> = {
  contradicts: '#b4432e',
  criticises: '#b4432e',
  supports: '#2e7d4f',
  extends: '#2e7d4f',
  replicates: '#2e7d4f',
  related: cssVar('--baseline', '#c3c2b7'),
}

/**
 * A real picture of how a collection's papers relate to each other,
 * built from each record's own `related[]` field -- not a fabricated or
 * simulated network. Concentric layout (deterministic, degree-based), not
 * a physics simulation -- matching Dustin's own standing rejection of a
 * 'cose' layout for this ecosystem's other relation graphs
 * (theory-relations-graph.tsx), applied here to a mesh-shaped citation
 * network rather than that component's hub-and-spoke shape.
 */
export function LiteratureRelationsGraph({ graph, onOpenPaper }: { graph: RelationGraph; onOpenPaper: (literaturebaseId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [selected, setSelected] = useState<{ id: string; label: string; external: boolean } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const elements: ElementDefinition[] = [
      ...graph.papers.map((p) => ({ data: { id: p.id, label: p.title.length > 40 ? `${p.title.slice(0, 37)}…` : p.title, kind: 'paper' } })),
      ...[...graph.externalTitles.entries()].map(([id, label]) => ({ data: { id, label, kind: 'external' } })),
      ...graph.edges.map((e) => ({ data: { id: e.id, source: e.from, target: e.to, label: e.relation, color: RELATION_COLOR[e.relation] ?? RELATION_COLOR.related } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'concentric', concentric: (n: cytoscape.NodeSingular) => n.degree(false), levelWidth: () => 1, minNodeSpacing: 40, animate: false },
      minZoom: 0.3,
      maxZoom: 3,
      style: [
        {
          selector: 'node[kind = "paper"]',
          style: {
            'background-color': cssVar('--text-primary', '#0b0b0b'), shape: 'ellipse', width: 22, height: 22,
            label: 'data(label)', 'font-size': 9, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': '100px',
            'text-valign': 'bottom', 'text-margin-y': 5, color: cssVar('--text-primary', '#0b0b0b'),
          },
        },
        {
          selector: 'node[kind = "external"]',
          style: {
            'background-color': cssVar('--text-muted', '#898781'), shape: 'ellipse', width: 12, height: 12, 'border-width': 1, 'border-style': 'dashed', 'border-color': cssVar('--text-muted', '#898781'),
            label: 'data(label)', 'font-size': 8, 'text-wrap': 'wrap', 'text-max-width': '80px',
            'text-valign': 'bottom', 'text-margin-y': 4, color: cssVar('--text-muted', '#898781'),
          },
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.5, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 8,
            color: cssVar('--text-muted', '#898781'),
          },
        },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const d = evt.target.data()
      setSelected({ id: d.id, label: d.label, external: d.kind === 'external' })
    })
    cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
    cyRef.current = cy
    return () => { cy.destroy() }
  }, [graph])

  if (graph.papers.length === 0) {
    return <p className="muted" style={{ fontSize: 12 }}>No papers to map.</p>
  }
  if (graph.edges.length === 0) {
    return <p className="muted" style={{ fontSize: 12 }}>None of these papers have a recorded relation to each other yet.</p>
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 280, border: '1px solid var(--border)', borderRadius: 8 }} />
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
  )
}
