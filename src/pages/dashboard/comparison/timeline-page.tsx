import { useMemo, useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import { recordUnitIds, unitHex, yearOf, type CmpRecord, type RecordFamily, type Unit } from '@/lib/comparison'
import { TimelineChart, type TimelineChartItem, type TimelineChartLane } from '@/components/timeline-chart'
import { useComparison } from './context'
import { RecordBlock } from './drawer'
import { Explain, FAMILY_KEY, LoadGate, PageHeader, ScopeBar, Sparkbars } from './ui'

// Policy rhythm by place: when each place adopted, revised or contested
// something, with the records the progression is already tied to drawn solid
// and the rest drawn as outlines. Registered with the platform design notes as
// the second time chart in OpenLPM (the first is the year strip on the Time page).

// The chart itself is the shared timeline (components/timeline-chart.tsx), so
// it zooms, drags and has the overview strip like every other timeline. What
// stays specific to this page: one lane per place in that place's color, a
// shape per kind of record, and an outline for records not yet tied to a
// learning goal.
const SHAPE: Record<RecordFamily, NonNullable<TimelineChartItem['shape']>> = {
  mandate: 'diamond',
  principle: 'square',
  finding: 'square',
  controversy: 'triangle',
  actor: 'circle',
  event: 'circle',
  unit: 'square',
  other: 'circle',
}

// Dates arrive as a full date, a month or only a year.
function toDate(value: string | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), m[2] ? Number(m[2]) - 1 : 0, m[3] ? Number(m[3]) : 1)
}

function Marker({ family, x, y, color, filled }: { family: RecordFamily; x: number; y: number; color: string; filled: boolean }) {
  const common = { fill: filled ? color : 'var(--surface-2)', stroke: color, strokeWidth: filled ? 1 : 1.6, opacity: filled ? 0.95 : 0.8 }
  const r = 5
  switch (family) {
    case 'mandate': return <path d={`M${x},${y - r - 1} L${x + r + 1},${y} L${x},${y + r + 1} L${x - r - 1},${y} Z`} {...common} />
    case 'principle':
    case 'finding': return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.5} {...common} />
    case 'controversy': return <path d={`M${x},${y - r - 1} L${x + r + 1},${y + r} L${x - r - 1},${y + r} Z`} {...common} />
    case 'actor': return <circle cx={x} cy={y} r={r + 1} {...common} strokeDasharray={filled ? undefined : '2 2'} />
    default: return <circle cx={x} cy={y} r={r} {...common} />
  }
}

export default function TimelinePage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, lang, scopeRecords, units, level, countries, links, objectsById } = c
  const [openList, setOpenList] = useState<CmpRecord[] | null>(null)
  const [onlyLinked, setOnlyLinked] = useState(false)
  const nowYear = new Date().getFullYear() + new Date().getMonth() / 12

  const linksByRecord = useMemo(() => {
    const m = new Map<string, typeof links>()
    for (const l of links) { const a = m.get(l.recordId); if (a) a.push(l); else m.set(l.recordId, [l]) }
    return m
  }, [links])

  const dated = useMemo(() => {
    const countrySet = new Set(countries)
    const out: { rec: CmpRecord; unit: Unit; y0: number; y1: number | null }[] = []
    const byId = new Map(units.map((u) => [u.id, u]))
    for (const rec of scopeRecords) {
      const y0 = yearOf(rec.date)
      if (y0 === null) continue
      const y1 = yearOf(rec.dateEnd)
      for (const uid of recordUnitIds(rec, level, countrySet)) {
        const unit = byId.get(uid)
        if (unit) out.push({ rec, unit, y0, y1: y1 !== null && y1 > y0 ? y1 : null })
      }
    }
    return out
  }, [scopeRecords, units, level, countries])

  const lanes = useMemo(() => {
    const byUnit = new Map<string, typeof dated>()
    for (const d of dated) {
      if (onlyLinked && !(linksByRecord.get(d.rec.id)?.length)) continue
      const a = byUnit.get(d.unit.id)
      if (a) a.push(d); else byUnit.set(d.unit.id, [d])
    }
    return units.filter((u) => byUnit.has(u.id)).map((u) => ({ unit: u, items: byUnit.get(u.id)!.sort((a, b) => a.y0 - b.y0) }))
  }, [dated, onlyLinked, units, linksByRecord])

  const chartLanes: TimelineChartLane[] = useMemo(
    () => lanes.map((l) => ({
      key: l.unit.id,
      label: l.unit.label,
      icon: <span style={{ width: 9, height: 9, borderRadius: '50%', background: unitHex(l.unit, units), flexShrink: 0 }} />,
    })),
    [lanes, units]
  )
  const recordByItemId = useMemo(() => new Map<string, CmpRecord>(), [])
  const chartItems: TimelineChartItem[] = useMemo(() => {
    recordByItemId.clear()
    const out: TimelineChartItem[] = []
    for (const l of lanes) {
      const hue = unitHex(l.unit, units)
      for (const d of l.items) {
        const start = toDate(d.rec.date)
        if (!start) continue
        const end = d.y1 !== null ? toDate(d.rec.dateEnd) : null
        const nLinks = linksByRecord.get(d.rec.id)?.length ?? 0
        const id = `${l.unit.id}|${d.rec.id}`
        recordByItemId.set(id, d.rec)
        out.push({
          id,
          laneKey: l.unit.id,
          title: d.rec.title,
          start,
          end,
          isPoint: !end,
          openEnded: false,
          openStart: false,
          color: hue,
          shape: SHAPE[d.rec.family] ?? 'circle',
          hollow: nLinks === 0,
          tooltip: `${d.rec.title} (${Math.floor(d.y0)})${nLinks ? ` · ${t('unitLinksN', { n: nLinks })}` : ''}`,
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, units, linksByRecord])

  const bins = (items: typeof dated) => {
    const ys = items.map((d) => d.y0)
    const from = Math.floor(Math.min(...ys))
    const to = Math.ceil(Math.max(...ys, nowYear))
    const n = Math.max(1, Math.ceil((to - from) / 3))
    const arr = new Array<number>(n).fill(0)
    for (const d of items) arr[Math.min(n - 1, Math.max(0, Math.floor((d.y0 - from) / 3)))]++
    return arr
  }

  return (
    <div>
      <PageHeader icon={CalendarRange} title={t('timelineTitle')} help={t('timelineHelp')} />
      <ScopeBar show={{ dim: false, proposed: false }} />
      <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <label className="cmp-check cmp-scope-group"><input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} />{t('timelineOnlyLinked')}</label>
      </div>

      {lanes.length === 0 ? <p className="muted">{t('timelineEmpty')}</p> : (
        <TimelineChart
          lanes={chartLanes}
          items={chartItems}
          selectedId={null}
          onSelect={(id) => { const rec = id ? recordByItemId.get(id) : null; if (rec) setOpenList([rec]) }}
          lang={lang === 'de' ? 'de' : 'en'}
          maxRows={9}
        />
      )}

      <div className="cmp-legend">
        {(['event', 'mandate', 'principle', 'controversy', 'actor'] as RecordFamily[]).map((f) => (
          <span key={f}><svg width={14} height={14}><Marker family={f} x={7} y={7} color="var(--text-secondary)" filled /></svg>{t(FAMILY_KEY[f])}</span>
        ))}
        <span><svg width={14} height={14}><Marker family="event" x={7} y={7} color="var(--text-secondary)" filled={false} /></svg>{t('timelineUnlinked')}</span>
        <span>{t('timelineSolid')}</span>
      </div>

      {lanes.length > 0 && (
        <div className="cmp-panel">
          <h2>{t('timelineRhythm')}</h2>
          <table className="cmp-table">
            <thead><tr><th>{t('places')}</th><th className="num">{t('timelineDated')}</th><th className="num">{t('timelineFirst')}</th><th className="num">{t('timelineLatest')}</th><th className="num">{t('timelineLinkedN')}</th><th>{t('timelineByPeriod')}</th></tr></thead>
            <tbody>
              {lanes.map((l) => {
                const ys = l.items.map((d) => d.y0)
                const linked = l.items.filter((d) => (linksByRecord.get(d.rec.id)?.length ?? 0) > 0).length
                return (
                  <tr key={l.unit.id}>
                    <td>{l.unit.label}</td>
                    <td className="num">{l.items.length}</td>
                    <td className="num">{Math.floor(Math.min(...ys))}</td>
                    <td className="num">{Math.floor(Math.max(...ys))}</td>
                    <td className="num">{linked}</td>
                    <td><Sparkbars values={bins(l.items)} color={unitHex(l.unit, units)} width={120} height={20} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Explain what={t('timelineExplain')} how={t('timelineHow')} />

      {openList && (
        <>
          <div className="cmp-drawer-back" onClick={() => setOpenList(null)} />
          <aside className="cmp-drawer" role="dialog" aria-label={t('timelineRecord')}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <h2 style={{ fontSize: 14 }}>{t('timelineRecord')} ({openList.length})</h2>
              <button type="button" className="btn btn-mini" onClick={() => setOpenList(null)} aria-label={t('close')}><X size={13} /></button>
            </div>
            {openList.map((rec) => {
              const recLinks = linksByRecord.get(rec.id) ?? []
              return (
                <div key={rec.id} className="cmp-link-card">
                  <RecordBlock record={rec} lang={lang} />
                  <div style={{ marginTop: 6 }}>
                    <span className="muted" style={{ fontSize: 11 }}>{t('timelineLinkedTo')}: </span>
                    {recLinks.length === 0 ? <span className="muted" style={{ fontSize: 11 }}>{t('timelineNoLinks')}</span> : recLinks.map((l) => (
                      <div key={l.id} style={{ marginTop: 4 }}>
                        <strong style={{ fontSize: 12 }}>{objectsById.get(l.objectId)?.title}</strong>
                        <div className="muted" style={{ fontSize: 11.5 }}>{l.rationale || '–'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </aside>
        </>
      )}
    </div>
  )
}
