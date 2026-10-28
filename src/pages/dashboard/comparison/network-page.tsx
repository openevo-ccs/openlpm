import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Network as NetworkIcon } from 'lucide-react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { lineOpacity, lineWidth, pickVisibleLabels, truncateLabel, type LabelCandidate } from '@/lib/graph-standards'
import { bandHex, bandRank, cssVar, dimensionKeys, placeHex, topStrandOf, unitHex, cellKey } from '@/lib/comparison'
import { useComparison } from './context'
import { Explain, LoadGate, PageHeader, ReliabilityNote, ScopeBar, formatNumber } from './ui'

type Mode = 'grid' | 'ties' | 'places'

const COL_W = 190
const ROW_H = 120
const MIN_ZOOM = 0.45
const MAX_FIT = 1.1

function fit(cy: Core) {
  cy.fit(undefined, 30)
  if (cy.zoom() < MIN_ZOOM) { cy.zoom(MIN_ZOOM); cy.center() } else if (cy.zoom() > MAX_FIT) { cy.zoom(MAX_FIT); cy.center() }
}

export default function NetworkPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, lang, objects, objectsById, units, grid, links, network, measures, recordsById, activeUnitIds } = c
  const [mode, setMode] = useState<Mode>('grid')
  const [selected, setSelected] = useState<{ title: string; lines: string[] } | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('comparison-network', { edges: 'all', labels: 'few', layout: 'fixed', lineStrength: 60, spacing: 50 })
  const [spacing, setSpacing] = useState(gs.spacing)
  useEffect(() => { const h = window.setTimeout(() => setSpacing(gs.spacing), 250); return () => window.clearTimeout(h) }, [gs.spacing])
  const hostRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const stats = useMemo(() => {
    const byStrand = dimensionKeys(objects, 'strand')
    const strandIndex = new Map<string, number>()
    byStrand.forEach((k, i) => k.objectIds.forEach((id) => strandIndex.set(id, i)))
    const perItemUnit = new Map<string, number>()
    for (const [k, arr] of grid.linksBy) perItemUnit.set(k, arr.length)
    const itemTotal = new Map<string, number>()
    for (const o of objects) itemTotal.set(o.id, links.filter((l) => l.objectId === o.id).length)
    return { strandIndex, perItemUnit, itemTotal, strandCount: byStrand.length }
  }, [objects, grid, links])

  useEffect(() => {
    if (!hostRef.current) return
    const text = cssVar('--text-primary', '#111')
    const surface = cssVar('--surface-0', '#fff')
    const slate = cssVar('--place-other', '#6f7d8c')
    const elements: ElementDefinition[] = []
    const labelInfo: LabelCandidate[] = []

    const itemPos = (o: (typeof objects)[number]) => {
      const row = stats.strandIndex.get(o.id) ?? 0
      const isStrand = !o.parentId
      const bi = bandRank(o.gradeBand)
      const x = isStrand ? 0 : 150 + Math.min(bi, 3) * COL_W
      return { x, y: 100 + row * ROW_H }
    }
    const gridWidth = 150 + 3 * COL_W
    const gridHeight = 100 + Math.max(0, stats.strandCount - 1) * ROW_H

    if (mode === 'grid' || mode === 'ties') {
      for (const o of objects) {
        const total = stats.itemTotal.get(o.id) ?? 0
        const isStrand = !o.parentId
        const size = (isStrand ? 30 : 20) + Math.min(22, Math.sqrt(total) * 7)
        const bt = network.keyItems.find((k) => k.id === o.id)?.betweenness ?? 0
        const sz = mode === 'ties' ? (isStrand ? 28 : 18) + Math.min(34, bt * 160) : size
        const pos = itemPos(o)
        elements.push({
          data: { id: `o:${o.id}`, fullLabel: o.title, label: '', kind: 'item', size: sz, color: isStrand ? slate : bandHex(o.gradeBand), total, isStrand },
          position: pos,
        })
        labelInfo.push({ id: `o:${o.id}`, label: o.title, x: pos.x, y: pos.y, size: sz, priority: isStrand ? 1000 : total + 1, alwaysShow: isStrand, fontPx: 11, maxWidthPx: 130, labelSide: 'below' })
      }
    }
    if (mode === 'grid') {
      const active = units
      const gap = active.length <= 4 ? 90 : 46
      const top = Math.max(60, gridHeight / 2 - ((active.length - 1) * gap) / 2)
      active.forEach((u, i) => {
        const x = gridWidth + 170
        const y = top + i * gap
        const total = objects.reduce((n, o) => n + (stats.perItemUnit.get(cellKey(o.id, u.id)) ?? 0), 0)
        const hasLinks = activeUnitIds.includes(u.id)
        elements.push({ data: { id: `u:${u.id}`, fullLabel: u.label, label: u.label, kind: 'unit', size: 22 + Math.min(26, Math.sqrt(total) * 8), color: unitHex(u, units), total, hasLinks: hasLinks ? 1 : 0 }, position: { x, y } })
        labelInfo.push({ id: `u:${u.id}`, label: u.label, x, y, size: 24, priority: 900, alwaysShow: true, fontPx: 11, maxWidthPx: 150, labelSide: 'below' })
      })
      for (const o of objects) for (const u of units) {
        const w = stats.perItemUnit.get(cellKey(o.id, u.id)) ?? 0
        if (w > 0) elements.push({ data: { id: `e:${o.id}|${u.id}`, source: `o:${o.id}`, target: `u:${u.id}`, w, color: unitHex(u, units) } })
      }
    } else if (mode === 'ties') {
      for (const e of network.itemGraph.edges) elements.push({ data: { id: `t:${e.a}|${e.b}`, source: `o:${e.a}`, target: `o:${e.b}`, w: e.w ?? 1, color: slate } })
    } else {
      const ids = activeUnitIds
      const R = Math.max(150, ids.length * 34)
      ids.forEach((id, i) => {
        const u = units.find((x) => x.id === id)!
        const k = measures.unitIds.indexOf(id)
        const st = measures.units[k]
        const ang = (2 * Math.PI * i) / Math.max(1, ids.length) - Math.PI / 2
        const x = R + R * Math.cos(ang)
        const y = R + R * Math.sin(ang)
        elements.push({ data: { id: `u:${id}`, fullLabel: u.label, label: u.label, kind: 'unit', size: 22 + Math.min(34, Math.sqrt(st?.n ?? 0) * 8), color: unitHex(u, units), total: st?.n ?? 0, hasLinks: 1 }, position: { x, y } })
        labelInfo.push({ id: `u:${id}`, label: u.label, x, y, size: 30, priority: 900, alwaysShow: true, fontPx: 11, maxWidthPx: 140, labelSide: 'below' })
      })
      for (const p of measures.pairs) {
        if (p.jsd === null) continue
        const sim = 1 - Math.sqrt(p.jsd)
        elements.push({ data: { id: `s:${p.a}|${p.b}`, source: `u:${p.a}`, target: `u:${p.b}`, w: Math.round(sim * 100) / 100, sim, color: slate } })
      }
    }

    const cy = cytoscape({
      container: hostRef.current,
      elements,
      layout: { name: 'preset' },
      minZoom: 0.15, maxZoom: 3, wheelSensitivity: 0.25, boxSelectionEnabled: false,
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)' as never, width: 'data(size)', height: 'data(size)', 'border-width': 2, 'border-color': surface as never, label: 'data(label)', 'font-size': 11, 'font-weight': 600, color: text as never, 'text-wrap': 'wrap', 'text-max-width': '130px', 'text-valign': 'bottom', 'text-margin-y': 5, 'text-background-color': surface as never, 'text-background-opacity': 0.85, 'text-background-padding': '2px' as never } },
        { selector: 'node[kind="unit"]', style: { 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 10, 'text-margin-y': 0, 'font-size': 12 } as never },
        { selector: 'node[kind="unit"][hasLinks = 0]', style: { opacity: 0.45, 'border-style': 'dashed' as never, 'border-color': slate as never } },
        { selector: 'node[?isStrand]', style: { shape: 'round-rectangle' as never } },
        { selector: 'node.hover-label', style: { label: 'data(fullLabel)' as never, 'z-index': 999, 'text-background-opacity': 1, 'text-border-width': 1, 'text-border-color': cssVar('--border', '#ccc') as never } as never },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': text as never } },
        { selector: 'edge', style: { width: 'data(lw)' as never, 'line-color': 'data(color)' as never, opacity: 'data(op)' as never, 'curve-style': 'bezier', label: 'data(wl)' as never, 'font-size': 9, color: text as never, 'text-background-color': surface as never, 'text-background-opacity': 0.8, 'text-background-padding': '1px' as never } },
        { selector: 'edge.highlight', style: { opacity: 1 } },
        { selector: '.dim', style: { opacity: 0.1 } },
      ],
    })

    const maxW = Math.max(1, ...cy.edges().map((e) => Number(e.data('w'))))
    cy.edges().forEach((e) => {
      const w = Number(e.data('w'))
      const rel = mode === 'places' ? Number(e.data('sim')) * 3 : (w / maxW) * 3
      e.data('lw', mode === 'places' ? 0.8 + rel * 1.6 : lineWidth(rel) + (w > 1 ? Math.min(5, w * 0.8) : 0))
      e.data('op', lineOpacity(rel, gs.lineStrength))
      e.data('wl', mode !== 'places' && w >= 2 ? String(w) : '')
    })

    if (gs.layout === 'physics') {
      cy.layout({ name: 'cose', animate: false, fit: false, randomize: false, nodeRepulsion: () => 3000 + spacing * 70, idealEdgeLength: () => 40 + spacing, numIter: 800, gravity: 0.8 } as never).run()
    }
    const visible = gs.labels === 'few' ? pickVisibleLabels(cy.nodes().map((n) => ({ ...(labelInfo.find((l) => l.id === n.id()) ?? { id: n.id(), label: '', x: 0, y: 0, size: 10, priority: 0, fontPx: 11, maxWidthPx: 120 }), x: n.position('x'), y: n.position('y') }))) : null
    cy.nodes().forEach((n) => {
      const full = String(n.data('fullLabel'))
      n.data('label', visible && !visible.has(n.id()) ? '' : truncateLabel(full, n.data('kind') === 'unit' ? 40 : 30))
    })

    cy.on('mouseover', 'node', (evt) => evt.target.addClass('hover-label'))
    cy.on('mouseout', 'node', (evt) => evt.target.removeClass('hover-label'))
    cy.on('tap', 'node', (evt) => {
      const n = evt.target
      cy.elements().removeClass('dim highlight')
      const hood = n.closedNeighborhood()
      cy.elements().difference(hood).addClass('dim')
      hood.edges().addClass('highlight')
      const lines: string[] = []
      if (n.data('kind') === 'unit') lines.push(`${t('unitLinksN', { n: n.data('total') })}`)
      else {
        const o = objectsById.get(String(n.id()).slice(2))
        if (o) {
          lines.push(`${o.gradeBand ?? ''} · ${topStrandOf(o, objectsById).title}`)
          lines.push(t('unitLinksN', { n: n.data('total') }))
        }
      }
      setSelected({ title: String(n.data('fullLabel')), lines })
    })
    cy.on('tap', (evt) => { if (evt.target === cy) { cy.elements().removeClass('dim highlight'); setSelected(null) } })
    fit(cy)
    cyRef.current = cy
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, objects, units, grid, links, network, measures, gs.layout, gs.labels, spacing, stats, activeUnitIds])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const maxW = Math.max(1, ...cy.edges().map((e) => Number(e.data('w'))))
    cy.edges().forEach((e) => {
      const w = Number(e.data('w'))
      const rel = mode === 'places' ? Number(e.data('sim')) * 3 : (w / maxW) * 3
      e.data('op', lineOpacity(rel, gs.lineStrength))
    })
  }, [gs.lineStrength, mode])

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  const png = () => {
    const cy = cyRef.current
    if (!cy) return
    const a = document.createElement('a')
    a.href = cy.png({ full: true, scale: 2, bg: cssVar('--surface-0', '#fff') })
    a.download = `comparison-network-${mode}.png`
    document.body.appendChild(a); a.click(); a.remove()
  }

  const modeHelp = mode === 'grid' ? t('netGridHelp') : mode === 'ties' ? t('netTiesHelp') : t('netPlacesHelp')
  const title = (id: string) => recordsById.get(id)?.title ?? id

  return (
    <div>
      <PageHeader icon={NetworkIcon} title={t('networkTitle')} help={t('networkHelp')} />
      <ScopeBar show={{ dim: false }} />
      <ReliabilityNote />
      <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('netMode')}</span>
          <div className="cmp-seg">
            {(['grid', 'ties', 'places'] as const).map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => { setMode(m); setSelected(null) }}>
                {t(m === 'grid' ? 'netModeGrid' : m === 'ties' ? 'netModeTies' : 'netModePlaces')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="muted" style={{ margin: '0 0 8px', maxWidth: 760 }}>{modeHelp}</p>

      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang={lang} showConnections={false} showLayout
        wording={{ fixed: { label: t('netFixed'), hint: t('netFixedHint') } }}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current && fit(cyRef.current)}
      />
      <div className="cmp-graph graph-host" style={{ height: 620 }}>
        <div ref={hostRef} className="graph-canvas" />
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <button type="button" className="btn btn-mini" onClick={png} title={t('downloadPng')} aria-label={t('downloadPng')}><Download size={12} /></button>
        </div>
        <div className="legend">
          {mode === 'places'
            ? <span>{t('netLegendPlaces')}</span>
            : (<>
                {['K-2', '3-5', '6-8', '9-12'].map((b) => <span key={b}><span className="dept-sw" style={{ background: bandHex(b) }} />{b}</span>)}
                <span><span className="dept-sw" style={{ background: cssVar('--place-other', '#6f7d8c') }} />{t('netLegendStrand')}</span>
                {mode === 'grid' && <span><span className="dept-sw" style={{ background: placeHex('US') }} />{t('netLegendPlace')}</span>}
              </>)}
        </div>
      </div>
      {selected && (
        <div className="cmp-panel" style={{ marginTop: 8, padding: '8px 12px' }}>
          <strong style={{ fontSize: 13 }}>{selected.title}</strong>
          {selected.lines.map((l, i) => <div key={i} className="muted" style={{ fontSize: 12 }}>{l}</div>)}
        </div>
      )}

      <div className="cmp-two" style={{ marginTop: 14 }}>
        <div className="cmp-panel">
          <h2>{t('netStructure')}</h2>
          <Explain what={t('netStructureWhat')} how={t('netStructureHow')} />
          <table className="cmp-table">
            <tbody>
              <tr><td>{t('netParts')}</td><td className="num">{objects.length}</td></tr>
              <tr><td>{t('netComponents')}</td><td className="num">{network.componentsCount}</td></tr>
              <tr><td>{t('netIsolated')}</td><td className="num">{network.isolated.length}</td></tr>
              <tr><td>{t('netDensity')}</td><td className="num">{formatNumber(network.density, 2)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="cmp-panel">
          <h2>{t('netBridges')}</h2>
          <Explain what={t('netBridgesWhat')} />
          {network.bridges.length === 0 ? <p className="muted">{t('netNoBridges')}</p> : (
            <table className="cmp-table">
              <thead><tr><th>{t('netRecord')}</th><th className="num">{t('netSpans')}</th></tr></thead>
              <tbody>
                {network.bridges.slice(0, 8).map((b) => (
                  <tr key={b.recordId}>
                    <td style={{ overflowWrap: 'anywhere' }}>{title(b.recordId)}</td>
                    <td className="num">{t('netSpansValue', { o: b.objects, s: b.strands })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
