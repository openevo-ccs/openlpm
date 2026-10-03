import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarRange } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { listTimelineItems, sortLanes, type TimelineItem } from '@/lib/supabase/timeline'

const DAY_MS = 24 * 60 * 60 * 1000
const LANE_HEIGHT = 40
const HEADER_HEIGHT = 28
// Below this span, ticks fall monthly rather than yearly -- chosen so a
// single mandate's multi-year effective range still gets a readable month
// grid, while a repository spanning decades of policy history stays
// legible instead of crowding in a tick for every one of ~300 months.
const MONTHLY_TICK_SPAN_DAYS = 450

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRange(item: TimelineItem): string {
  if (item.isPoint) return fmtDate(item.start)
  if (item.openStart) return `through ${fmtDate(item.end as Date)}`
  if (item.openEnded) return `${fmtDate(item.start)} – ongoing`
  return `${fmtDate(item.start)} – ${item.end ? fmtDate(item.end) : fmtDate(item.start)}`
}

function buildTicks(min: Date, max: Date): { date: Date; label: string }[] {
  const spanDays = (max.getTime() - min.getTime()) / DAY_MS
  const ticks: { date: Date; label: string }[] = []
  if (spanDays <= MONTHLY_TICK_SPAN_DAYS) {
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1)
    while (cursor <= max) {
      if (cursor >= min) ticks.push({ date: new Date(cursor), label: cursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else {
    const cursor = new Date(min.getFullYear(), 0, 1)
    while (cursor <= max) {
      if (cursor >= min) ticks.push({ date: new Date(cursor), label: String(cursor.getFullYear()) })
      cursor.setFullYear(cursor.getFullYear() + 1)
    }
  }
  return ticks
}

// Any `curriculum_repository_records` row with an `event_date` or an
// `effective_from`/`effective_until` range, across every record_type (not
// only policy-timeline-event), plus this project's own `standards_documents`
// version history, on one shared chronological timeline -- the design
// note's "Real dates on individual records too" section. A standing range
// (a mandate in force, a document version) draws as a bar; a point in time
// (an event, a finding, a document adopted with no tracked end) draws as a
// marker.
export default function TimelinePage() {
  const { project, supabase, slug } = useOutletContext<ProjectOutletContext>()
  const [items, setItems] = useState<TimelineItem[] | null>(null)
  const [kind, setKind] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [selected, setSelected] = useState<TimelineItem | null>(null)

  useEffect(() => {
    setItems(null)
    setSelected(null)
    listTimelineItems(supabase, project.id).then(setItems)
  }, [supabase, project.id])

  const lanesAll = useMemo(() => sortLanes(items ?? []), [items])
  const jurisdictions = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.jurisdiction).filter((j): j is string => !!j))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(
    () => (items ?? []).filter((i) => (!kind || i.laneKey === kind) && (!jurisdiction || i.jurisdiction === jurisdiction)),
    [items, kind, jurisdiction]
  )
  const lanes = useMemo(() => sortLanes(filtered), [filtered])

  const { minDate, maxDate } = useMemo(() => {
    const now = new Date()
    let min: Date | null = null
    let max: Date | null = null
    for (const i of filtered) {
      if (!min || i.start < min) min = i.start
      const end = i.end ?? (i.openEnded ? now : i.start)
      if (!max || end > max) max = end
    }
    if (!min || !max) return { minDate: new Date(now.getFullYear(), 0, 1), maxDate: new Date(now.getFullYear(), 11, 31) }
    const span = Math.max(max.getTime() - min.getTime(), DAY_MS)
    const pad = Math.max(span * 0.04, 14 * DAY_MS)
    return { minDate: new Date(min.getTime() - pad), maxDate: new Date(max.getTime() + pad) }
  }, [filtered])

  const totalDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS))
  const pxPerDay = Math.min(24, Math.max(0.6, 1400 / totalDays))
  const width = Math.round(totalDays * pxPerDay)
  const x = (d: Date) => Math.round(((d.getTime() - minDate.getTime()) / DAY_MS) * pxPerDay)

  const ticks = useMemo(() => buildTicks(minDate, maxDate), [minDate, maxDate])
  const today = new Date()
  const showToday = today >= minDate && today <= maxDate

  const itemsByLane = useMemo(() => {
    const m = new Map<string, TimelineItem[]>()
    for (const i of filtered) {
      const arr = m.get(i.laneKey) ?? []
      arr.push(i)
      m.set(i.laneKey, arr)
    }
    return m
  }, [filtered])

  return (
    <div>
      <h1 className="row"><CalendarRange size={18} style={{ color: 'var(--text-muted)' }} />Timeline</h1>
      <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
        Every dated item in this Curriculum Repository, plotted chronologically — institutional
        actors, mandates, timeline events, and more, alongside each standards document&apos;s own
        version history. A span is something in force over a period; a marker is a single
        point-in-time event.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid grid-3">
          <div className="field">
            <label>Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All kinds</option>
              {lanesAll.map((l) => <option key={l.laneKey} value={l.laneKey}>{l.laneLabel}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Jurisdiction</label>
            <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              <option value="">All jurisdictions</option>
              {jurisdictions.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="row" style={{ fontSize: 12, color: 'var(--text-secondary)', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--series-a)', display: 'inline-block' }} />
            Curriculum Repository records
          </span>
          <span className="row" style={{ fontSize: 12, color: 'var(--text-secondary)', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--series-b)', display: 'inline-block' }} />
            Standards document versions
          </span>
        </div>
      </div>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <CalendarRange size={32} />
          <p>No dated content yet.</p>
          <p className="muted">
            Records and documents show up here once they have a real-world date set — an event
            date, an adoption date, or an effective-from/until range.
          </p>
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div className="timeline-wrap" style={{ flex: '3 1 480px', minWidth: 0 }}>
            <div className="timeline-labels">
              <div style={{ height: HEADER_HEIGHT }} />
              {lanes.map((l) => (
                <div key={l.laneKey} className="timeline-lane-label" style={{ height: LANE_HEIGHT }} title={l.laneLabel}>
                  {l.laneLabel}
                </div>
              ))}
            </div>
            <div className="timeline-scroll">
              <div style={{ width, position: 'relative' }}>
                <div className="timeline-axis" style={{ height: HEADER_HEIGHT }}>
                  {ticks.map((t) => (
                    <div key={t.date.toISOString()} className="timeline-tick" style={{ left: x(t.date) }}>
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
                {lanes.map((l) => (
                  <div key={l.laneKey} className="timeline-lane-row" style={{ height: LANE_HEIGHT }}>
                    {ticks.map((t) => <div key={t.date.toISOString()} className="timeline-gridline" style={{ left: x(t.date) }} />)}
                    {(itemsByLane.get(l.laneKey) ?? []).map((item) => (
                      <TimelineMark key={item.id} item={item} x={x} laneWidth={width} selected={selected?.id === item.id} onSelect={() => setSelected(item)} />
                    ))}
                  </div>
                ))}
                {showToday && (
                  <div className="timeline-today" style={{ left: x(today), top: HEADER_HEIGHT, height: lanes.length * LANE_HEIGHT }} title="Today" />
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: '1 1 280px', minHeight: 200 }}>
            {selected ? <TimelineDetail item={selected} slug={slug} /> : <p className="muted">Click a marker or span to see its details.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineMark({
  item,
  x,
  laneWidth,
  selected,
  onSelect,
}: {
  item: TimelineItem
  x: (d: Date) => number
  laneWidth: number
  selected: boolean
  onSelect: () => void
}) {
  const color = item.source === 'repository-record' ? 'var(--series-a)' : 'var(--series-b)'
  const title = `${item.title} — ${formatRange(item)}`
  const outline = selected ? '2px solid var(--text-primary)' : 'none'

  if (item.isPoint) {
    return (
      <button
        type="button"
        className="timeline-mark timeline-mark-point"
        style={{ left: x(item.start), background: color, outline }}
        title={title}
        onClick={onSelect}
      />
    )
  }

  const startX = item.openStart ? 0 : x(item.start)
  const endX = item.openEnded ? laneWidth : x(item.end ?? item.start)
  return (
    <button
      type="button"
      className="timeline-mark timeline-mark-bar"
      style={{ left: startX, width: Math.max(4, endX - startX), background: color, outline }}
      title={title}
      onClick={onSelect}
    />
  )
}

function TimelineDetail({ item, slug }: { item: TimelineItem; slug: string }) {
  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>{item.title}</h3>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <span className="chip" style={{ fontSize: 10 }}>{item.laneLabel}</span>
        {item.jurisdiction && <span className="chip" style={{ fontSize: 10 }}>{item.jurisdiction}</span>}
      </div>
      <p style={{ fontSize: 13 }}>{formatRange(item)}</p>
      {item.detail.map((d) => (
        <div key={d.label} style={{ margin: '8px 0' }}>
          <strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{d.label}</strong>
          <span style={{ fontSize: 13 }}>{d.value}</span>
        </div>
      ))}
      {item.recordId && (
        <p style={{ marginTop: 12 }}>
          <Link to={`/dashboard/${slug}/curriculum-repository/${item.recordId}`}>View full record →</Link>
        </p>
      )}
    </div>
  )
}
