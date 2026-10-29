import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarRange, Info } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { listTimelineItems, sortLanes, type TimelineItem } from '@/lib/supabase/timeline'
import { RecordKindIcon, RecordKindLine } from '@/lib/record-type-display'
import { TimelineChart, type TimelineChartItem, type TimelineChartLane } from '@/components/timeline-chart'
import { distinctLinkedProjects, listContentLinksForRecord, type RepositoryRecordRow } from '@/lib/supabase/curriculum-repository'

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRange(item: TimelineItem): string {
  if (item.isPoint) return fmtDate(item.start)
  if (item.openStart) return `through ${fmtDate(item.end as Date)}`
  if (item.openEnded) return `${fmtDate(item.start)} – ongoing`
  return `${fmtDate(item.start)} – ${item.end ? fmtDate(item.end) : fmtDate(item.start)}`
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
  const [undatedCount, setUndatedCount] = useState(0)
  const [kind, setKind] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [selected, setSelected] = useState<TimelineItem | null>(null)
  // A curriculum-repository-custom-view (migration 095) holds no records of
  // its own -- it's a view of its parent Curriculum Repository's content --
  // so this resolves to the PARENT's id, same as curriculum-repository-page.tsx.
  const repoProjectId =
    (project as any).project_kind === 'curriculum-repository-custom-view'
      ? ((project as any).parent_project_id ?? project.id)
      : project.id

  useEffect(() => {
    setItems(null)
    setSelected(null)
    listTimelineItems(supabase, repoProjectId).then(({ items: result, undatedRecordCount }) => {
      setItems(result)
      setUndatedCount(undatedRecordCount)
    })
  }, [supabase, repoProjectId])

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

  // Items and lanes in the shape the shared timeline chart takes. One color
  // per kind of source, the same on every timeline: teal for repository
  // records, green for standards document versions.
  const chartLanes: TimelineChartLane[] = useMemo(
    () => lanes.map((l) => ({
      key: l.laneKey,
      label: l.laneLabel,
      icon: l.source === 'repository-record' ? <RecordKindIcon type={l.laneKey as RepositoryRecordRow['record_type']} /> : undefined,
    })),
    [lanes]
  )
  const chartItems: TimelineChartItem[] = useMemo(
    () => filtered.map((i) => ({
      id: i.id,
      laneKey: i.laneKey,
      title: i.title,
      start: i.start,
      end: i.end,
      isPoint: i.isPoint,
      openEnded: i.openEnded,
      openStart: i.openStart,
      color: i.source === 'repository-record' ? 'var(--series-a)' : 'var(--series-b)',
      tooltip: `${i.title} — ${formatRange(i)}`,
    })),
    [filtered]
  )

  return (
    <div>
      <h1 className="row"><CalendarRange size={18} style={{ color: 'var(--text-muted)' }} />Timeline</h1>
      <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
        Every dated item in this Curriculum Repository, plotted chronologically — institutional
        actors, mandates, timeline events, and more, alongside each standards document&apos;s own
        version history. A span is something in force over a period; a marker is a single
        point-in-time event.
      </p>
      {undatedCount > 0 && (
        <div className="notice" style={{ marginBottom: 12, maxWidth: 640 }}>
          <Info size={14} />
          {undatedCount} more record{undatedCount === 1 ? '' : 's'} {undatedCount === 1 ? "isn't" : "aren't"} shown here
          — {undatedCount === 1 ? 'it has' : 'they have'} no real-world date (an analytical finding or a proposed
          redesign, for example, isn&apos;t something that &ldquo;happened&rdquo; on a day). See the Curriculum
          Repository list for the full set.
        </div>
      )}

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
          <div style={{ flex: '3 1 520px', minWidth: 0 }}>
            <TimelineChart
              lanes={chartLanes}
              items={chartItems}
              selectedId={selected?.id ?? null}
              onSelect={(id) => setSelected(id ? filtered.find((i) => i.id === id) ?? null : null)}
            />
          </div>

          <div className="card" style={{ flex: '1 1 280px', minHeight: 200 }}>
            {selected ? <TimelineDetail item={selected} slug={slug} supabase={supabase} /> : <p className="muted">Click a marker or span to see its details.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineDetail({ item, slug, supabase }: { item: TimelineItem; slug: string; supabase: ProjectOutletContext['supabase'] }) {
  // Real feedback ea3a4c01: "always enable ways to show which standards
  // from which times are used in which OpenLPM projects" -- the data
  // already existed (curriculum_repository_links, surfaced on the record
  // page's own "Connected to your own work" section) but was a click-through
  // away rather than visible right where you're looking at something's date.
  const [usedBy, setUsedBy] = useState<{ id: string; name: string; slug: string }[] | null>(null)

  useEffect(() => {
    setUsedBy(null)
    if (!item.recordId) return
    listContentLinksForRecord(supabase, item.recordId).then((links) => setUsedBy(distinctLinkedProjects(links)))
  }, [item.recordId, supabase])

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>{item.title}</h3>
      {item.source === 'repository-record' && (
        <div style={{ marginBottom: 4 }}><RecordKindLine type={item.laneKey as RepositoryRecordRow['record_type']} withBlurb /></div>
      )}
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
      {item.recordId && usedBy !== null && (
        <div style={{ margin: '8px 0' }}>
          <strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Used in</strong>
          {usedBy.length === 0 ? (
            <span className="muted" style={{ fontSize: 13 }}>Not yet connected to any OpenLPM project.</span>
          ) : (
            <span style={{ fontSize: 13 }}>{usedBy.map((p) => p.name).join(', ')}</span>
          )}
        </div>
      )}
      {item.recordId && (
        <p style={{ marginTop: 12 }}>
          <Link to={`/dashboard/${slug}/curriculum-repository/${item.recordId}`}>View full record →</Link>
        </p>
      )}
    </div>
  )
}
