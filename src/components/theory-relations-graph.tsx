import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { layoutTier } from '@/lib/graph-layout'
import type { TheoryRow, TheoryRelationRow } from '@/lib/supabase/theories'

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * A picture of how a project's theories relate to its curriculum --
 * feedback 35924e8a's "data visualization" ask, applied to the same
 * relation data theories-page.tsx already lets a researcher type in one
 * row at a time. Deterministic tiered layout (layoutTier), not 'cose' --
 * Dustin's own explicit, twice-given feedback (2026-09-30) already
 * rejected a physics layout for this exact shape of graph (a handful of
 * theories, each fanning out to several targets, few-to-no edges between
 * theories themselves).
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
  const [selected, setSelected] = useState<{ kind: 'theory' | 'target'; id: string; label: string; relationLabel?: string } | null>(null)

  const relationsByTheory = useMemo(() => {
    const m = new Map<string, TheoryRelationRow[]>()
    for (const r of relations) m.set(r.theory_id, [...(m.get(r.theory_id) ?? []), r])
    return m
  }, [relations])

  useEffect(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth || 700
    const ROW_GAP = 90
    const SPACING = 100

    const { positions: theoryPositions } = layoutTier(theories.map((t) => ({ id: t.id })), width / 2, 40, width, ROW_GAP, SPACING)

    const targetPositions = new Map<string, { x: number; y: number }>()
    theories.forEach((t) => {
      const targets = relationsByTheory.get(t.id) ?? []
      const anchor = theoryPositions.get(t.id) ?? { x: width / 2, y: 40 }
      const { positions } = layoutTier(targets.map((r) => ({ id: r.id })), anchor.x, anchor.y + ROW_GAP, Math.max(SPACING, SPACING * Math.ceil(Math.sqrt(Math.max(1, targets.length)))), ROW_GAP * 0.6, SPACING * 0.8)
      for (const [id, pos] of positions) targetPositions.set(id, pos)
    })

    const elements: ElementDefinition[] = [
      ...theories.map((t) => ({
        data: { id: t.id, label: t.label, kind: 'theory' },
        position: theoryPositions.get(t.id) ?? { x: width / 2, y: 40 },
      })),
      ...relations.map((r) => ({
        data: {
          id: r.id,
          label: targetLabels.get(r.target_id) ?? '(unresolved)',
          kind: 'target',
          targetType: r.target_type,
          relationLabel: r.relation_label,
        },
        position: targetPositions.get(r.id) ?? { x: width / 2, y: 200 },
      })),
      ...relations.map((r) => ({ data: { id: `e-${r.id}`, source: r.theory_id, target: r.id, label: r.relation_label } })),
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
          selector: 'node[kind = "theory"]',
          style: {
            'background-color': cssVar('--text-primary', '#0b0b0b'), shape: 'diamond', width: 30, height: 30,
            label: 'data(label)', 'font-size': 11, 'font-weight': 700, 'text-wrap': 'wrap', 'text-max-width': '110px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: cssVar('--text-primary', '#0b0b0b'),
          },
        },
        {
          selector: 'node[kind = "target"]',
          style: {
            'background-color': cssVar('--series-b', '#8a6d3b'), width: 18, height: 18,
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '80px',
            'text-valign': 'bottom', 'text-margin-y': 4, color: cssVar('--text-secondary', '#52514e'),
          },
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': cssVar('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.5, 'line-color': cssVar('--baseline', '#c3c2b7'), 'target-arrow-color': cssVar('--baseline', '#c3c2b7'),
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 8.5,
            color: cssVar('--text-muted', '#898781'),
          },
        },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const d = evt.target.data()
      if (d.kind === 'theory') setSelected({ kind: 'theory', id: d.id, label: d.label })
      else setSelected({ kind: 'target', id: d.id, label: d.label, relationLabel: d.relationLabel })
    })
    cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
    cyRef.current = cy
    return () => { cy.destroy() }
  }, [theories, relations, targetLabels, relationsByTheory])

  if (theories.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>No theories yet -- add one to see it here.</p>
  }

  return (
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
  )
}
