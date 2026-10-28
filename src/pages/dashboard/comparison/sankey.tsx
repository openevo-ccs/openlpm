import { useMemo, useState } from 'react'
import { cssVar } from '@/lib/comparison'

// A flow diagram with any number of columns. Hand-rolled SVG, as the earlier
// Sankey on the Comparison page was: the data here is small, strictly layered
// and needs exact control over order and color, which a general layout library
// would hide. Click a node to follow its flows; click again to release.

export interface SankeyNode {
  id: string
  label: string
  column: number
  /** Bar color. */
  color: string
  /** Sort position inside the column (lower first). */
  order: number
  /** Extra line under the label, for example a count. */
  sub?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
  /** Ribbon color; defaults to the source color. */
  color?: string
}

interface Placed extends SankeyNode { value: number; y0: number; y1: number; x: number }

export function Sankey({ nodes, links, width = 980, nodeWidth = 12, columnLabels, unit = '', minHeight = 260, emptyLabel }: {
  nodes: SankeyNode[]
  links: SankeyLink[]
  width?: number
  nodeWidth?: number
  columnLabels?: string[]
  unit?: string
  minHeight?: number
  emptyLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const [hoverLink, setHoverLink] = useState<number | null>(null)

  const layout = useMemo(() => {
    const columns = Math.max(0, ...nodes.map((n) => n.column)) + 1
    const flowIn = new Map<string, number>()
    const flowOut = new Map<string, number>()
    for (const l of links) {
      flowOut.set(l.source, (flowOut.get(l.source) ?? 0) + l.value)
      flowIn.set(l.target, (flowIn.get(l.target) ?? 0) + l.value)
    }
    const used = nodes.filter((n) => (flowIn.get(n.id) ?? 0) + (flowOut.get(n.id) ?? 0) > 0)
    const GAP = 10
    const colTotals = Array.from({ length: columns }, (_, c) => used.filter((n) => n.column === c).reduce((a, n) => a + Math.max(flowIn.get(n.id) ?? 0, flowOut.get(n.id) ?? 0), 0))
    const colCounts = Array.from({ length: columns }, (_, c) => used.filter((n) => n.column === c).length)
    const maxTotal = Math.max(1, ...colTotals)
    const unitH = Math.min(26, Math.max(6, (minHeight * 1.9) / maxTotal))
    const innerH = Math.max(minHeight, ...colTotals.map((t, c) => t * unitH + Math.max(0, colCounts[c] - 1) * GAP))
    const labelPad = 190
    const colX = (c: number) => labelPad + (c * (width - 2 * labelPad - nodeWidth)) / Math.max(1, columns - 1)
    const placed = new Map<string, Placed>()
    for (let c = 0; c < columns; c++) {
      const colNodes = used.filter((n) => n.column === c).sort((a, b) => a.order - b.order)
      const total = colTotals[c] * unitH + Math.max(0, colNodes.length - 1) * GAP
      let y = 28 + (innerH - total) / 2
      for (const n of colNodes) {
        const v = Math.max(flowIn.get(n.id) ?? 0, flowOut.get(n.id) ?? 0)
        const h = Math.max(4, v * unitH)
        placed.set(n.id, { ...n, value: v, y0: y, y1: y + h, x: colX(c) })
        y += h + GAP
      }
    }
    // Ribbons: stack at each node in the order of the node at the other end, which keeps crossings low.
    const sorted = links.map((l, i) => ({ ...l, i })).filter((l) => placed.has(l.source) && placed.has(l.target))
    const bySource = new Map<string, typeof sorted>()
    const byTarget = new Map<string, typeof sorted>()
    for (const l of sorted) {
      ;(bySource.get(l.source) ?? bySource.set(l.source, []).get(l.source)!).push(l)
      ;(byTarget.get(l.target) ?? byTarget.set(l.target, []).get(l.target)!).push(l)
    }
    const ribbons: { i: number; path: string; color: string; value: number; source: string; target: string; mid: { x: number; y: number } }[] = []
    const pos = new Map<number, { sy: number; ty: number; h: number }>()
    for (const [id, arr] of bySource) {
      arr.sort((a, b) => placed.get(a.target)!.y0 - placed.get(b.target)!.y0)
      let y = placed.get(id)!.y0
      for (const l of arr) { const h = l.value * unitH; pos.set(l.i, { sy: y, ty: 0, h }); y += h }
    }
    for (const [id, arr] of byTarget) {
      arr.sort((a, b) => placed.get(a.source)!.y0 - placed.get(b.source)!.y0)
      let y = placed.get(id)!.y0
      for (const l of arr) { const p = pos.get(l.i)!; p.ty = y; y += l.value * unitH }
    }
    for (const l of sorted) {
      const s = placed.get(l.source)!
      const t = placed.get(l.target)!
      const p = pos.get(l.i)!
      const x0 = s.x + nodeWidth
      const x1 = t.x
      const cx = (x0 + x1) / 2
      const path = `M${x0},${p.sy} C${cx},${p.sy} ${cx},${p.ty} ${x1},${p.ty} L${x1},${p.ty + p.h} C${cx},${p.ty + p.h} ${cx},${p.sy + p.h} ${x0},${p.sy + p.h} Z`
      ribbons.push({ i: l.i, path, color: l.color ?? s.color, value: l.value, source: l.source, target: l.target, mid: { x: cx, y: (p.sy + p.ty + p.h) / 2 } })
    }
    return { placed, ribbons, columns, height: innerH + 48 }
  }, [nodes, links, width, nodeWidth, minHeight])

  // Everything reachable from the active node, forward and back.
  const reach = useMemo(() => {
    if (!active) return null
    const nodesOn = new Set<string>([active])
    const linksOn = new Set<number>()
    const walk = (start: string, dir: 'out' | 'in') => {
      const stack = [start]
      while (stack.length) {
        const id = stack.pop()!
        for (const r of layout.ribbons) {
          const from = dir === 'out' ? r.source : r.target
          const to = dir === 'out' ? r.target : r.source
          if (from === id && !linksOn.has(r.i)) { linksOn.add(r.i); nodesOn.add(to); stack.push(to) }
        }
      }
    }
    walk(active, 'out'); walk(active, 'in')
    return { nodesOn, linksOn }
  }, [active, layout.ribbons])

  if (layout.placed.size === 0) return <p className="muted">{emptyLabel}</p>
  const text = cssVar('--text-primary', '#111')
  const muted = cssVar('--text-muted', '#777')
  const nodeList = Array.from(layout.placed.values())
  const lastCol = layout.columns - 1
  const halo = { stroke: cssVar('--surface-2', '#fff'), strokeWidth: 3, paintOrder: 'stroke' } as const

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={layout.height} role="img" style={{ fontFamily: 'inherit', display: 'block' }}>
        {columnLabels?.map((l, c) => {
          const x = nodeList.find((n) => n.column === c)?.x
          if (x === undefined) return null
          return <text key={c} x={c === lastCol ? x + nodeWidth : x} y={14} fontSize={10.5} fontWeight={700} fill={muted} textAnchor={c === lastCol ? 'end' : c === 0 ? 'start' : 'middle'} style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</text>
        })}
        {layout.ribbons.map((r) => {
          const on = !reach || reach.linksOn.has(r.i)
          const hot = hoverLink === r.i
          return (
            <path key={r.i} d={r.path} fill={r.color} opacity={hot ? 0.8 : on ? 0.45 : 0.06} style={{ transition: 'opacity 120ms', cursor: 'pointer' }}
              onMouseEnter={() => setHoverLink(r.i)} onMouseLeave={() => setHoverLink(null)}>
              <title>{`${layout.placed.get(r.source)?.label} → ${layout.placed.get(r.target)?.label}: ${r.value}${unit}`}</title>
            </path>
          )
        })}
        {nodeList.map((n) => {
          const on = !reach || reach.nodesOn.has(n.id)
          const right = n.column > 0
          const label = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label
          const cy = (n.y0 + n.y1) / 2
          return (
            <g key={n.id} style={{ cursor: 'pointer' }} opacity={on ? 1 : 0.25} onClick={() => setActive((a) => (a === n.id ? null : n.id))}>
              <rect x={n.x} y={n.y0} width={nodeWidth} height={n.y1 - n.y0} rx={2} fill={n.color} />
              <text x={right ? n.x + nodeWidth + 6 : n.x - 6} y={cy + (n.sub ? -2 : 4)} fontSize={11.5} fontWeight={active === n.id ? 700 : 500} fill={text} textAnchor={right ? 'start' : 'end'} {...halo}>
                {label}
                <title>{`${n.label}: ${n.value}${unit}`}</title>
              </text>
              {n.sub && <text x={right ? n.x + nodeWidth + 6 : n.x - 6} y={cy + 11} fontSize={10} fill={muted} textAnchor={right ? 'start' : 'end'} {...halo}>{n.sub}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
