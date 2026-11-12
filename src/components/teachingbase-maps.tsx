import { useEffect, useMemo, useRef } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { GraphControls, useGraphSettings } from '@/components/graph-controls'
import { applyGraphSettings, attachHover, cssVar, hoverStyles, type NodeLabelInfo } from '@/lib/graph-cytoscape'
import { DEFAULT_GRAPH_SETTINGS } from '@/lib/graph-standards'
import { isJudged, mapLessons, type Latest, type ReviewLesson } from '@/lib/teachingbase-review-mode'
import { readableTarget } from '@/lib/supabase/teaching-lessons-review'
import { RM, type Lang } from '@/lib/teachingbase-review-strings'

// Two small pictures of the graph space being checked, built on the shared graph kit (graph-standards.ts, graph-cytoscape.ts,
// graph-controls.tsx and the --map-1..6 colors). Both use a fixed layout, calm colors and labels that never overlap.
//   TeachingCueMap: the lesson in focus in the middle, its suggested links around it, grouped by kind (color and shape), checked ones filled,
//                   open ones outlined, the current one large.
//   ReviewMap:      every lesson that has something to check, as a dot in its collection's cluster. Bigger means more left to check, filled
//                   means finished, a dark outline means it holds suggestions a computer check found less trustworthy than most.
// Neither shows a score. Held-back links carry no machine order, so they never add urgency here.

/** Link kinds share the six palette colors by family. Shape tells the kinds inside a family apart, so color is never the only cue. */
const FAMILY: Record<string, { color: string; shape: string }> = {
  concept: { color: '--map-1', shape: 'ellipse' },
  competency: { color: '--map-3', shape: 'round-rectangle' },
  method: { color: '--map-5', shape: 'triangle' },
  theory: { color: '--map-4', shape: 'diamond' },
  question: { color: '--map-4', shape: 'star' },
  literature: { color: '--map-6', shape: 'hexagon' },
  quote: { color: '--map-6', shape: 'octagon' },
  species: { color: '--map-2', shape: 'pentagon' },
  feature: { color: '--map-2', shape: 'ellipse' },
}
const FALLBACK_COLORS = ['#719f87', '#c94856', '#275c8d', '#755323', '#c68724', '#a96fc1']

const colorOf = (token: string, index: number) => cssVar(token, FALLBACK_COLORS[index % 6])

export function TeachingCueMap({ lesson, currentKey, latest, lang }: { lesson: ReviewLesson; currentKey: string; latest: Latest; lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null)
  const links = lesson.data.links ?? []

  useEffect(() => {
    if (!ref.current) return
    const text = cssVar('--text-primary', '#0b0b0b')
    const surface = cssVar('--page-plane', '#f9f9f7')
    const info = new Map<string, NodeLabelInfo>()
    const n = links.length
    const rings = n > 14 ? 2 : 1
    const elements: ElementDefinition[] = [{ data: { id: 'lesson', kind: 'lesson', size: 26 }, position: { x: 0, y: 0 } }]
    info.set('lesson', { full: lesson.label, priority: 1000, alwaysShow: true, fontPx: 11, maxWidthPx: 130, labelSide: 'below' })
    links.forEach((l, i) => {
      const ring = i % rings
      const idx = Math.floor(i / rings)
      const angle = (idx / Math.max(1, Math.ceil(n / rings))) * Math.PI * 2 - Math.PI / 2
      const r = 90 + ring * 45
      const fam = FAMILY[l.type] ?? { color: '--place-other', shape: 'ellipse' }
      const isCurrent = l.item_key === currentKey
      const judged = isJudged(latest, lesson.id, l)
      info.set(l.item_key, { full: l.label || readableTarget(l.to), priority: isCurrent ? 900 : 1, fontPx: 10, maxWidthPx: 90, labelSide: 'below' })
      elements.push({
        data: { id: l.item_key, kind: 'link', size: isCurrent ? 24 : 15, color: colorOf(fam.color, 0), shape: fam.shape, judged: judged ? 1 : 0, current: isCurrent ? 1 : 0, urgent: !judged && l.check_first ? 1 : 0 },
        position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
      })
      elements.push({ data: { id: `e-${l.item_key}`, source: 'lesson', target: l.item_key, name: '', op: 0.25 } })
    })
    const cy = cytoscape({
      container: ref.current,
      elements,
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
      layout: { name: 'preset' },
      style: [
        { selector: 'node', style: { width: 'data(size)', height: 'data(size)', label: 'data(label)', 'font-size': 10, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': '90px', 'text-valign': 'bottom', 'text-margin-y': 4, color: text } },
        { selector: 'node[kind = "lesson"]', style: { 'background-color': text, shape: 'round-rectangle', 'font-size': 11, 'font-weight': 700 } },
        { selector: 'node[kind = "link"]', style: { shape: 'data(shape)' as never, 'background-color': 'data(color)', 'border-color': 'data(color)', 'border-width': 2.5 } },
        { selector: 'node[kind = "link"][judged = 0]', style: { 'background-color': surface } },
        { selector: 'node[kind = "link"][urgent = 1]', style: { 'border-color': text, 'border-width': 3.5 } },
        { selector: 'node[kind = "link"][current = 1]', style: { 'border-color': text, 'border-width': 4, 'z-index': 50 } },
        { selector: 'edge', style: { width: 1, 'line-color': cssVar('--border', '#ccc'), opacity: 'data(op)', 'curve-style': 'straight' } },
        ...hoverStyles(),
      ] as never,
    })
    applyGraphSettings(cy, { ...DEFAULT_GRAPH_SETTINGS, labels: 'few' }, { name: 'preset' }, info)
    attachHover(cy)
    cy.fit(undefined, 28)
    return () => cy.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, currentKey, latest, lang])

  return <div ref={ref} className="tb-cue-canvas" data-testid="cue-map" role="img" aria-label={RM[lang].cueTitle} />
}

// ---------------------------------------------------------------------------------------------------------------------------------------

export function ReviewMap({ lessons, latest, lang, onPick }: { lessons: ReviewLesson[]; latest: Latest; lang: Lang; onPick: (lessonId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [gs, updateGs, resetGs] = useGraphSettings('teachingbase-review-map')
  const { items, withoutLinks } = useMemo(() => mapLessons(lessons, latest), [lessons, latest])
  const t = RM[lang]

  useEffect(() => {
    if (!ref.current) return
    const width = ref.current.clientWidth || 900
    const text = cssVar('--text-primary', '#0b0b0b')
    const surface = cssVar('--page-plane', '#f9f9f7')
    const slate = cssVar('--place-other', '#6f7d8c')
    // Collections, biggest first. The six biggest get a palette color; the rest share a neutral slate (kit rule: color only while the groups fit).
    const sizes = new Map<string, number>()
    for (const i of items) sizes.set(i.collection, (sizes.get(i.collection) ?? 0) + 1)
    const order = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
    const colorFor = (c: string) => { const i = order.indexOf(c); return i < 6 ? cssVar(`--map-${i + 1}`, FALLBACK_COLORS[i]) : slate }

    const CELL = 54
    const GAP = 70
    const info = new Map<string, NodeLabelInfo>()
    const elements: ElementDefinition[] = []
    let x0 = 0
    let y0 = 60
    let rowH = 0
    for (const c of order) {
      const members = items.filter((i) => i.collection === c)
      const cols = Math.max(2, Math.ceil(Math.sqrt(members.length)))
      const rows = Math.ceil(members.length / cols)
      const w = cols * CELL
      const h = rows * CELL
      if (x0 > 0 && x0 + w > Math.max(width - 40, 520)) { x0 = 0; y0 += rowH + GAP; rowH = 0 }
      const gid = `g:${c}`
      info.set(gid, { full: c.replace(/-/g, ' '), priority: 1000, alwaysShow: true, fontPx: 12, maxWidthPx: Math.max(120, w), labelSide: 'above' })
      elements.push({ data: { id: gid, kind: 'group', size: 12, color: colorFor(c) }, position: { x: x0 + w / 2, y: y0 - 34 } })
      members.forEach((m, i) => {
        const done = m.status.remaining === 0
        const size = done ? 12 : 12 + Math.min(18, Math.sqrt(m.status.remaining) * 6)
        info.set(m.id, { full: m.label, priority: m.tier * 20 + (m.status.urgent ? 5 : 1), fontPx: 10, maxWidthPx: 90, labelSide: 'below' })
        elements.push({
          data: { id: m.id, kind: 'lesson', size, color: colorFor(c), done: done ? 1 : 0, tier: done ? 0 : m.tier },
          position: { x: x0 + (i % cols) * CELL + CELL / 2, y: y0 + Math.floor(i / cols) * CELL + CELL / 2 },
        })
      })
      rowH = Math.max(rowH, h)
      x0 += w + GAP
    }
    if (elements.length === 0) return

    const cy = cytoscape({
      container: ref.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      minZoom: 0.2,
      maxZoom: 3,
      style: [
        { selector: 'node', style: { width: 'data(size)', height: 'data(size)', label: 'data(label)', 'font-size': 10, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': '90px', 'text-valign': 'bottom', 'text-margin-y': 4, color: text } },
        { selector: 'node[kind = "group"]', style: { shape: 'diamond', 'background-color': 'data(color)', 'font-size': 12, 'font-weight': 700, 'text-valign': 'top', 'text-margin-y': -6, 'text-max-width': '200px' } },
        { selector: 'node[kind = "lesson"]', style: { shape: 'ellipse', 'background-color': surface, 'border-color': 'data(color)', 'border-width': 2.5 } },
        { selector: 'node[kind = "lesson"][done = 1]', style: { 'background-color': 'data(color)', 'background-opacity': 0.55 } },
        { selector: 'node[kind = "lesson"][tier = 1]', style: { 'border-width': 3.5 } },
        { selector: 'node[kind = "lesson"][tier = 2]', style: { 'border-color': text, 'border-width': 6 } },
        ...hoverStyles(),
      ] as never,
    })
    applyGraphSettings(cy, gs, { name: 'preset' }, info)
    attachHover(cy)
    cy.on('tap', 'node[kind = "lesson"]', (evt) => onPick(evt.target.id()))
    cy.on('mouseover', 'node[kind = "lesson"]', () => { if (ref.current) ref.current.style.cursor = 'pointer' })
    cy.on('mouseout', 'node', () => { if (ref.current) ref.current.style.cursor = 'default' })
    cyRef.current = cy
    ;(ref.current as unknown as { _cy?: Core })._cy = cy // read by the browser check only
    return () => { cy.destroy(); if (cyRef.current === cy) cyRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, gs.labels, lang])

  const zoomBy = (f: number) => { const cy = cyRef.current; if (cy) cy.animate({ zoom: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * f)) }, { duration: 160 }) }
  const open = items.filter((i) => i.status.remaining > 0).length

  return (
    <div data-testid="review-map">
      <p style={{ fontSize: 16, lineHeight: 1.5, margin: '0 0 10px' }}>{t.mapIntro}</p>
      <div className="tb-legend" style={{ marginBottom: 10 }}>
        <span><i style={{ border: '2.5px solid var(--map-1)', background: 'var(--page-plane)' }} />{t.mapLegendOpen}</span>
        <span><i style={{ border: '2.5px solid var(--map-1)', background: 'var(--map-1)', opacity: 0.55 }} />{t.mapLegendDone}</span>
        <span><i style={{ border: '5px solid var(--text-primary)', background: 'var(--page-plane)' }} />{t.mapLegendFirst}</span>
      </div>
      <GraphControls
        settings={gs} onChange={updateGs} onReset={resetGs} lang={lang} showConnections={false} showLayout={false}
        onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onFit={() => cyRef.current?.fit(undefined, 40)}
      />
      <div className="tb-map-wrap"><div ref={ref} className="tb-map-canvas" role="img" aria-label={t.mapTitle} /></div>
      <p className="muted" style={{ fontSize: 14, margin: '8px 0 0' }}>
        {open} {lang === 'de' ? 'Materialien mit offenen Vorschlägen.' : 'lessons with suggestions still open.'} {withoutLinks} {t.mapNoLinks}
      </p>
    </div>
  )
}
