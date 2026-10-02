import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import type { PortfolioEdge } from '@/lib/supabase/portfolios'
import type { GroupGraphNode } from '@/lib/supabase/groups'

function token(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// A read-only merged view of every Notebook a group's members have shared
// with it -- same visual language as the editable Notebook graph
// (portfolio-explorer.tsx), minus every mutation affordance (add/edit/link/
// review), since editing someone else's notebook content from inside a
// group synthesis view would be a different, much bigger feature nobody
// asked for. Nodes carry whose notebook they came from, shown on select,
// since "who contributed what" is the actual point of a merged view.
export function GroupNotebookGraph({ nodes, edges }: { nodes: GroupGraphNode[]; edges: PortfolioEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const selected = selectedId ? nodesById[selectedId] : null

  useEffect(() => {
    if (!containerRef.current) return
    const elements: ElementDefinition[] = [
      ...nodes.map((n) => ({ data: { id: n.id, label: n.label, kind: n.kind, owner: n.ownerName } })),
      ...edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label ?? '' } })),
    ]
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'cose', animate: false },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)', 'font-size': 10, 'text-wrap': 'wrap', 'text-max-width': '80px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: token('--text-primary', '#0b0b0b'),
            width: 32, height: 32,
          },
        },
        { selector: 'node[kind = "canonical"]', style: { 'background-color': token('--series-a', '#006c66'), shape: 'ellipse' } },
        { selector: 'node[kind = "private"]', style: { 'background-color': token('--text-muted', '#898781'), shape: 'round-rectangle' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': token('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.5, 'line-color': token('--baseline', '#c3c2b7'), 'target-arrow-color': token('--baseline', '#c3c2b7'),
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 9,
            color: token('--text-secondary', '#52514e'),
          },
        },
        { selector: 'edge:selected', style: { 'line-color': token('--series-a', '#006c66'), width: 2.5 } },
      ],
    })
    cy.on('tap', 'node', (evt) => setSelectedId(evt.target.id()))
    cy.on('tap', (evt) => { if (evt.target === cy) setSelectedId(null) })
    cyRef.current = cy
    return () => { cy.destroy() }
  }, [nodes, edges])

  return (
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
  )
}
