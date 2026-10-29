import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { layoutTier } from '@/lib/graph-layout'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { applyGraphSettings, applyLineLooks, attachHover, cssVar, hoverStyles, type NodeLabelInfo } from '@/lib/graph-cytoscape'
import type { TheoryRow, TheoryRelationRow } from '@/lib/supabase/theories'

/**
 * A picture of how a project's theories relate to its curriculum --
 * feedback 35924e8a's "data visualization" ask, applied to the same
 * relation data theories-page.tsx already lets a researcher type in one
 * row at a time. Follows the shared graph standards (feedback 2a3c04e3):
 * theories are the groups (labels always shown, pinned when physics is on),
 * what they relate to are the items, each link's name appears on hover, and
 * the same control panel as every other graph. The start layout is the
 * deterministic tiered one (layoutTier), never random, since Dustin's own
 * explicit, twice-given feedback (2026-09-30) rejected a physics-first
 * layout for this exact shape of graph.
 */
export function TheoryRelationsGraph({
  theories,
  relations,
  targetLabels,
  onSelectTheory,
}: {
  theories: TheoryRow[]
  relations: TheoryRelationRow[]
  targetLabels: Map<string, string>
  onSelectTheory: (theoryId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('theory-relations')
  const [selected, setSelected] = useState<{ kind: 'theory' | 'target'; id: string; label: string; relationLabel?: string } | null>(null)

  const relationsByTheory = useMemo(() => {
    const m = new Map<string, TheoryRelationRow[]>()
    for (const r of relations) m.set(r.theory_id, [...(m.get(r.theory_id) ?? []), r])
    return m
  }, [relations])

  useEffect(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth || 700
    const ROW_GAP = 130
    const SPACING = 100

    const { positions: theoryPositions } = layoutTier(theories.map((t) => ({ id: t.id })), width / 2, 110, width, ROW_GAP, 190)

    const targetPositions = new Map<string, { x: number; y: number }>()
    theories.forEach((t) => {
      const targets = relationsByTheory.get(t.id) ?? []
      const anchor = theoryPositions.get(t.id) ?? { x: width / 2, y: 110 }
      const { positions } = layoutTier(targets.map((r) => ({ id: r.id })), anchor.x, anchor.y + ROW_GAP, Math.max(SPACING, SPACING * Math.ceil(Math.sqrt(Math.max(1, targets.length)))), ROW_GAP * 0.6, SPACING * 0.8)
      for (const [id, pos] of positions) targetPositions.set(id, pos)
    })

    const info = new Map<string, NodeLabelInfo>()
    const elements: ElementDefinition[] = [
      ...theories.map((t) => {
        info.set(t.id, { full: t.label, priority: 1000, alwaysShow: true, fontPx: 11, maxWidthPx: 150, labelSide: 'above' })
        return { data: { id: t.id, kind: 'theory', size: 30 }, position: theoryPositions.get(t.id) ?? { x: width / 2, y: 110 } }
      }),
      ...relations.map((r) => {
        info.set(r.id, { full: targetLabels.get(r.target_id) ?? '(unresolved)', priority: 10, fontPx: 9, maxWidthPx: 80 })
        return {
          data: { id: r.id, kind: 'target', size: 16, targetType: r.target_type, relationLabel: r.relation_label },
          position: targetPositions.get(r.id) ?? { x: width / 2, y: 200 },
        }
      }),
      ...relations.map((r) => ({ data: { id: `e-${r.id}`, source: r.theory_id, target: r.id, name: r.relation_label, w: 2 } })),
    ]

    const text = cssVar('--text-primary', '#0b0b0b')
    const slate = cssVar('--place-other', '#6f7d8c')
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
            width: 'data(size)', height: 'data(size)', label: 'data(label)', 'font-size': 10, 'font-weight': 600,
            'text-wrap': 'wrap', 'text-max-width': '100px', 'text-valign': 'bottom', 'text-margin-y': 5, color: text,
            'border-width': 2, 'border-color': cssVar('--surface-0', '#fff'),
          },
        },
        { selector: 'node[kind = "theory"]', style: { 'background-color': text, shape: 'diamond', 'font-size': 11, 'font-weight': 700, 'text-max-width': '150px', 'text-valign': 'top', 'text-margin-y': -6 } },
        { selector: 'node[kind = "target"]', style: { 'background-color': slate, 'font-weight': 400, 'font-size': 9, color: cssVar('--text-secondary', '#52514e') } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.6, 'line-color': slate, 'target-arrow-color': slate, 'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 'data(op)', 'font-size': 9, color: text,
          },
        },
        ...hoverStyles(),
      ] as never,
    })

    applyGraphSettings(cy, gs, { name: 'preset' }, info, (id) => cy.getElementById(id).data('kind') === 'theory')
    applyLineLooks(cy, gs.lineStrength, () => 2)
    attachHover(cy)
    cy.on('tap', 'node', (evt) => {
      const d = evt.target.data()
      if (d.kind === 'theory') setSelected({ kind: 'theory', id: d.id, label: d.fullLabel })
      else setSelected({ kind: 'target', id: d.id, label: d.fullLabel, relationLabel: d.relationLabel })
    })
    cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
    cyRef.current = cy
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // gs.lineStrength is applied by the effect below, so dragging the slider does not rebuild the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theories, relations, targetLabels, relationsByTheory, gs.layout, gs.labels, gs.spacing])

  useEffect(() => {
    if (cyRef.current) applyLineLooks(cyRef.current, gs.lineStrength, () => 2)
  }, [gs.lineStrength])

  if (theories.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>No theories yet -- add one to see it here.</p>
  }

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  return (
    <div>
      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang="en" showConnections={false} showLayout
        wording={{ fixed: { label: 'Tiers', hint: 'Theories on top, what they relate to below. Always the same.' } }}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current?.fit(undefined, 30)}
      />
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 360, border: '1px solid var(--border)', borderRadius: 8 }} />
        {selected && (
          <div className="card" style={{ position: 'absolute', top: 10, right: 10, maxWidth: 220 }}>
            <strong style={{ fontSize: 13 }}>{selected.label}</strong>
            {selected.relationLabel && <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>{selected.relationLabel}</p>}
            {selected.kind === 'theory' && (
              <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => onSelectTheory(selected.id)}>Open theory</button>
            )}
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>Point at a dot to see its full name and what the links are called.</p>
    </div>
  )
}
