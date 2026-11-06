import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus, Maximize2, Crosshair } from 'lucide-react'
import {
  DAY_MS,
  buildAxis,
  clampWindow,
  isFullWindow,
  packRows,
  panWindow,
  zoomWindow,
  type TimeWindow,
} from '@/lib/timeline-standards'

// The one timeline every OpenLPM calendar view uses (feedback 4c10c072; rules
// in lib/timeline-standards.ts, decisions in lab_manager/docs/design-notes/
// openlpm-timeline-standards-2026-10-29.md). A screen hands it lanes and
// dated items. The chart shows the whole range first, with no sideways page
// scroll, and the person moves a window over it: buttons, Ctrl or Cmd plus the
// wheel, a pinch, a double click, dragging, the keyboard, or the overview strip.

export interface TimelineChartLane {
  key: string
  label: string
  icon?: ReactNode
}

export interface TimelineChartItem {
  id: string
  laneKey: string
  title: string
  start: Date
  end: Date | null
  isPoint: boolean
  /** In force since `start`, drawn up to today. */
  openEnded: boolean
  /** Known end, unknown start: drawn from the beginning of the range. */
  openStart: boolean
  /** A CSS color, normally one of the --series tokens. */
  color: string
  /** Shape of a single-date mark. Default is a diamond. */
  shape?: 'diamond' | 'square' | 'triangle' | 'circle'
  /** Drawn as an outline with a light fill, for items that are not yet connected to anything. */
  hollow?: boolean
  /** Shown on hover. */
  tooltip: string
}

type Lang = 'de' | 'en'

const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Show everything',
    toSelection: 'Zoom to selected',
    hint: 'Drag to move. Ctrl or Cmd plus the wheel, a pinch or a double click zooms. The strip below shows where you are.',
    full: 'Showing the full range',
    today: 'Today',
    overview: 'Overview: drag the window to move it, drag its edges to resize it',
    window: 'Visible window',
    noLabel: 'Untitled',
  },
  de: {
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    fit: 'Alles anzeigen',
    toSelection: 'Auf Auswahl zoomen',
    hint: 'Ziehen verschiebt. Strg oder Cmd plus Mausrad, Pinch oder Doppelklick zoomt. Der Streifen darunter zeigt, wo du bist.',
    full: 'Der gesamte Zeitraum',
    today: 'Heute',
    overview: 'Übersicht: Fenster ziehen zum Verschieben, Ränder ziehen zum Ändern der Größe',
    window: 'Sichtbarer Ausschnitt',
    noLabel: 'Ohne Titel',
  },
}

const LABEL_W = 176
const AXIS_H = 44
const ROW_H = 24
const LANE_PAD = 8
const MARK_H = 16
const POINT = 14
const OVERVIEW_H = 52

function rangeOf(items: TimelineChartItem[], nowMs: number): TimeWindow {
  let min = Infinity
  let max = -Infinity
  for (const i of items) {
    min = Math.min(min, i.start.getTime())
    max = Math.max(max, i.end ? i.end.getTime() : i.openEnded ? nowMs : i.start.getTime())
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const y = new Date().getFullYear()
    return { start: new Date(y, 0, 1).getTime(), end: new Date(y, 11, 31).getTime() }
  }
  const span = Math.max(max - min, DAY_MS)
  const pad = Math.max(span * 0.03, 14 * DAY_MS)
  return { start: min - pad, end: max + pad }
}

// A hollow mark keeps its color as an outline over a light tint of the same color.
function markPaint(i: TimelineChartItem): React.CSSProperties {
  if (!i.hollow) return { background: i.color }
  return { background: `color-mix(in srgb, ${i.color} 22%, var(--surface-1))`, boxShadow: `inset 0 0 0 2px ${i.color}`, color: 'var(--text-primary)' }
}

function describeWindow(w: TimeWindow, locale: string): string {
  const span = w.end - w.start
  const a = new Date(w.start)
  const b = new Date(w.end)
  if (span > 3 * 365 * DAY_MS) return `${a.getFullYear()} – ${b.getFullYear()}`
  const f = (d: Date) => d.toLocaleDateString(locale, span > 120 * DAY_MS ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return `${f(a)} – ${f(b)}`
}

export function TimelineChart({
  lanes,
  items,
  selectedId,
  onSelect,
  lang = 'en',
  maxRows = 6,
}: {
  lanes: TimelineChartLane[]
  items: TimelineChartItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  lang?: Lang
  /** Most rows one lane may grow to when items overlap. */
  maxRows?: number
}) {
  const t = TEXT[lang]
  const locale = lang === 'de' ? 'de-DE' : undefined
  const nowMs = useMemo(() => Date.now(), [])
  const full = useMemo(() => rangeOf(items, nowMs), [items, nowMs])
  const [win, setWin] = useState<TimeWindow>(full)
  const plotRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  // A new set of items (a filter change) starts from the whole range again.
  useEffect(() => { setWin(full) }, [full])

  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => setWidth(Math.max(200, el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const span = win.end - win.start
  const x = useCallback((ms: number) => ((ms - win.start) / span) * width, [win.start, span, width])
  const endMs = (i: TimelineChartItem) => (i.end ? i.end.getTime() : i.openEnded ? nowMs : i.start.getTime())

  // Rule 4: pack every item (also the ones off screen) so the lane heights stay
  // put while the person pans, and change only when they zoom.
  const layout = useMemo(() => {
    return lanes.map((lane) => {
      const laneItems = items.filter((i) => i.laneKey === lane.key)
      const boxes = laneItems.map((i) => {
        if (i.isPoint) { const c = x(i.start.getTime()); return { id: i.id, x0: c - POINT / 2, x1: c + POINT / 2 } }
        const x0 = i.openStart ? x(full.start) : x(i.start.getTime())
        const x1 = Math.max(x0 + 6, x(endMs(i)))
        return { id: i.id, x0, x1 }
      })
      const { rowOf, rows } = packRows(boxes, 3, maxRows)
      return { lane, laneItems, rowOf, rows, height: rows * ROW_H + LANE_PAD * 2 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, items, x, full.start, nowMs, maxRows])

  const axis = useMemo(() => buildAxis(win, width, locale), [win, width, locale])
  const totalH = layout.reduce((n, l) => n + l.height, 0)
  const isFull = isFullWindow(win, full)
  const selected = selectedId ? items.find((i) => i.id === selectedId) : null

  const apply = (next: TimeWindow) => setWin(clampWindow(next, full))
  const zoomBy = (factor: number, anchor = 0.5) => setWin((w) => zoomWindow(w, full, factor, anchor))
  const zoomToSelected = () => {
    if (!selected) return
    const a = selected.start.getTime()
    const b = Math.max(endMs(selected), a)
    const pad = Math.max((b - a) * 0.5, 120 * DAY_MS)
    apply({ start: a - pad, end: b + pad })
  }

  // ---- wheel, pinch ---------------------------------------------------------
  // React attaches wheel listeners as passive, which cannot stop the page from
  // scrolling, so this one is added by hand.
  const winRef = useRef(win)
  winRef.current = win
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        setWin((w) => zoomWindow(w, full, Math.exp(-e.deltaY * 0.004), frac))
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        setWin((w) => panWindow(w, full, (e.deltaX / rect.width) * (w.end - w.start)))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [full])

  // ---- drag to pan ----------------------------------------------------------
  const drag = useRef<{ x: number; start: TimeWindow; moved: boolean; id: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, start: win, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 4) return
    if (!d.moved) { d.moved = true; try { plotRef.current?.setPointerCapture(d.id) } catch { /* ignore */ } }
    const rect = plotRef.current!.getBoundingClientRect()
    setWin(panWindow(d.start, full, (-dx / rect.width) * (d.start.end - d.start.start)))
  }
  const onPointerUp = () => { drag.current = null }
  // A click that ended a drag must not also select what it finished on.
  const swallowClick = (e: React.MouseEvent) => { if (drag.current?.moved) e.stopPropagation() }

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tl-mark')) return
    const rect = plotRef.current!.getBoundingClientRect()
    zoomBy(2, (e.clientX - rect.left) / rect.width)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.6) }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.6) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setWin((w) => panWindow(w, full, -(w.end - w.start) * 0.2)) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setWin((w) => panWindow(w, full, (w.end - w.start) * 0.2)) }
    else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); setWin(full) }
  }

  const todayX = x(nowMs)
  const showToday = nowMs >= win.start && nowMs <= win.end

  return (
    <div className="tl" data-testid="timeline-chart">
      <div className="tl-toolbar">
        <span className="tl-range" aria-live="polite">{isFull ? t.full : describeWindow(win, locale ?? 'en')}</span>
        <span className="tl-toolbar-gap" />
        <button type="button" className="btn btn-mini" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoomBy(1 / 1.6)} disabled={isFull}><Minus size={13} /></button>
        <button type="button" className="btn btn-mini" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoomBy(1.6)}><Plus size={13} /></button>
        <button type="button" className="btn btn-mini" onClick={() => setWin(full)} disabled={isFull} title={t.fit}><Maximize2 size={12} /> {t.fit}</button>
        <button type="button" className="btn btn-mini" onClick={zoomToSelected} disabled={!selected} title={t.toSelection}><Crosshair size={12} /> {t.toSelection}</button>
      </div>

      <div className="tl-body">
        <div className="tl-labels" style={{ width: LABEL_W }}>
          <div style={{ height: AXIS_H }} />
          {layout.map((l) => (
            <div key={l.lane.key} className="tl-lane-label" style={{ height: l.height }} title={l.lane.label}>
              {l.lane.icon}
              <span>{l.lane.label}</span>
            </div>
          ))}
        </div>

        <div
          className="tl-plot"
          ref={plotRef}
          tabIndex={0}
          role="group"
          aria-label={t.hint}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={swallowClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
        >
          <div className="tl-axis" style={{ height: AXIS_H }}>
            {axis.context.length > 0 && (
              <div className="tl-axis-context">
                {axis.context.map((c, i) => {
                  const cx = x(c.time)
                  if (!(cx > -200 && cx < width)) return null
                  // A label pinned to the left edge gives way when the next one is close.
                  const next = axis.context[i + 1]
                  const left = Math.max(0, cx) + 4
                  if (next && x(next.time) - left < 14 + c.label.length * 7) return null
                  return <span key={c.time} className="tl-context-label" style={{ left }}>{c.label}</span>
                })}
              </div>
            )}
            <div className="tl-axis-minor" style={{ top: axis.context.length > 0 ? 22 : 12 }}>
              {axis.minor.map((tk) => {
                const tx = x(tk.time)
                return tx >= -4 && tx <= width ? <span key={tk.time} className={`tl-tick-label${tk.major ? ' major' : ''}`} style={{ left: tx + 4 }}>{tk.label}</span> : null
              })}
            </div>
          </div>

          {layout.map((l) => (
            <div key={l.lane.key} className="tl-lane" style={{ height: l.height }}>
              {axis.context.map((c) => { const gx = x(c.time); return gx >= 0 && gx <= width ? <div key={`c${c.time}`} className="tl-grid major" style={{ left: gx }} /> : null })}
              {axis.minor.map((tk) => { const gx = x(tk.time); return gx >= 0 && gx <= width ? <div key={tk.time} className={`tl-grid${tk.major ? ' major' : ''}`} style={{ left: gx }} /> : null })}
              {l.laneItems.map((i) => {
                const row = l.rowOf.get(i.id) ?? 0
                const top = LANE_PAD + row * ROW_H + (ROW_H - MARK_H) / 2
                const sel = i.id === selectedId
                if (i.isPoint) {
                  const cx = x(i.start.getTime())
                  if (cx < -POINT || cx > width + POINT) return null
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={`tl-mark tl-point s-${i.shape ?? 'diamond'}${i.hollow ? ' hollow' : ''}${sel ? ' selected' : ''}`}
                      style={{ left: cx - POINT / 2, top: top + (MARK_H - POINT) / 2, width: POINT, height: POINT, ...markPaint(i) }}
                      title={i.tooltip}
                      aria-label={i.tooltip}
                      aria-pressed={sel}
                      onClick={() => onSelect(sel ? null : i.id)}
                    />
                  )
                }
                const x0 = i.openStart ? x(full.start) : x(i.start.getTime())
                const x1 = Math.max(x0 + 6, x(endMs(i)))
                if (x1 < 0 || x0 > width) return null
                const left = Math.max(-2, x0)
                const w = Math.min(width + 2, x1) - left
                return (
                  <button
                    key={i.id}
                    type="button"
                    className={`tl-mark tl-bar${i.hollow ? ' hollow' : ''}${sel ? ' selected' : ''}`}
                    style={{ left, top, width: Math.max(6, w), height: MARK_H, ...markPaint(i) }}
                    title={i.tooltip}
                    aria-label={i.tooltip}
                    aria-pressed={sel}
                    onClick={() => onSelect(sel ? null : i.id)}
                  >
                    {w > 90 && <span>{i.title || t.noLabel}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {showToday && <div className="tl-today" style={{ left: todayX, top: 0, height: AXIS_H + totalH }} title={t.today}><span style={todayX > width - 56 ? { left: 'auto', right: 6 } : undefined}>{t.today}</span></div>}
        </div>
      </div>

      <Overview
        lanes={lanes}
        layout={layout.map((l) => l.laneItems)}
        full={full}
        win={win}
        nowMs={nowMs}
        labelWidth={LABEL_W}
        onChange={apply}
        title={t.overview}
        windowLabel={t.window}
      />
      <p className="muted tl-hint">{t.hint}</p>
    </div>
  )
}

// The strip under the chart: the whole range in miniature with the visible
// window on it. Drag the window to move it, drag an edge to resize it, click
// the strip to jump there.
function Overview({
  lanes,
  layout,
  full,
  win,
  nowMs,
  labelWidth,
  onChange,
  title,
  windowLabel,
}: {
  lanes: TimelineChartLane[]
  layout: TimelineChartItem[][]
  full: TimeWindow
  win: TimeWindow
  nowMs: number
  labelWidth: number
  onChange: (w: TimeWindow) => void
  title: string
  windowLabel: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const fullSpan = full.end - full.start
  const pct = (ms: number) => ((ms - full.start) / fullSpan) * 100
  const gesture = useRef<{ mode: 'move' | 'left' | 'right'; startX: number; start: TimeWindow } | null>(null)
  const band = Math.max(3, Math.min(8, (OVERVIEW_H - 14) / Math.max(1, lanes.length)))

  const begin = (mode: 'move' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    gesture.current = { mode, startX: e.clientX, start: win }
  }
  const move = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const dMs = ((e.clientX - g.startX) / rect.width) * fullSpan
    if (g.mode === 'move') onChange({ start: g.start.start + dMs, end: g.start.end + dMs })
    else if (g.mode === 'left') onChange({ start: Math.min(g.start.start + dMs, g.start.end - 14 * DAY_MS), end: g.start.end })
    else onChange({ start: g.start.start, end: Math.max(g.start.end + dMs, g.start.start + 14 * DAY_MS) })
  }
  const end = () => { gesture.current = null }
  const jump = (e: React.MouseEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const center = full.start + ((e.clientX - rect.left) / rect.width) * fullSpan
    const half = (win.end - win.start) / 2
    onChange({ start: center - half, end: center + half })
  }
  const step = (dir: -1 | 1) => onChange({ start: win.start + dir * (win.end - win.start) * 0.2, end: win.end + dir * (win.end - win.start) * 0.2 })

  return (
    <div className="tl-overview-row">
      <div className="tl-overview-label muted" style={{ width: labelWidth }}>{windowLabel}</div>
      <div className="tl-overview" ref={trackRef} style={{ height: OVERVIEW_H }} onClick={jump} title={title}>
        {layout.map((laneItems, li) =>
          laneItems.map((i) => {
            const a = i.openStart ? full.start : i.start.getTime()
            const b = i.isPoint ? a : i.end ? i.end.getTime() : i.openEnded ? nowMs : a
            return (
              <span
                key={i.id}
                className="tl-ov-mark"
                style={{ left: `${pct(a)}%`, width: `max(2px, ${pct(b) - pct(a)}%)`, top: 6 + li * band, height: Math.max(2, band - 1), background: i.color }}
              />
            )
          })
        )}
        <div
          className="tl-ov-window"
          style={{ left: `${pct(win.start)}%`, width: `${pct(win.end) - pct(win.start)}%` }}
          role="slider"
          tabIndex={0}
          aria-label={windowLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct((win.start + win.end) / 2))}
          onPointerDown={begin('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
          }}
        >
          <span className="tl-ov-handle left" onPointerDown={begin('left')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          <span className="tl-ov-handle right" onPointerDown={begin('right')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
        </div>
      </div>
    </div>
  )
}
