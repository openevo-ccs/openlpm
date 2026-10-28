import { useMemo, useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import { recordUnitIds, unitHex, yearOf, type CmpRecord, type RecordFamily, type Unit } from '@/lib/comparison'
import { useComparison } from './context'
import { RecordBlock } from './drawer'
import { Explain, FAMILY_KEY, LoadGate, PageHeader, ScopeBar, Sparkbars } from './ui'

// Policy rhythm by place: when each place adopted, revised or contested
// something, with the records the progression is already tied to drawn solid
// and the rest drawn as outlines. Registered with the platform design notes as
// the second time chart in OpenLPM (the first is the year strip on the Time page).

const LABEL_W = 170
const PLOT_W = 900
const SLOT_H = 15

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

  const span = useMemo(() => {
    const ys = dated.map((d) => d.y0)
    if (ys.length === 0) return { min: 2000, max: 2030 }
    return { min: Math.floor(Math.min(...ys)), max: Math.max(Math.ceil(Math.max(...ys, nowYear)), Math.ceil(Math.max(...dated.map((d) => d.y1 ?? 0))) ) }
  }, [dated, nowYear])
  const [range, setRange] = useState<[number, number] | null>(null)
  const [from, to] = range ?? [Math.max(span.min, Math.min(span.max - 10, 1995)), span.max]
  const x = (y: number) => LABEL_W + ((Math.min(Math.max(y, from), to) - from) / Math.max(1, to - from)) * PLOT_W

  const CAP = 9
  const lanes = useMemo(() => {
    const byUnit = new Map<string, typeof dated>()
    for (const d of dated) {
      if (d.y0 < from || d.y0 > to + 0.99) continue
      if (onlyLinked && !(linksByRecord.get(d.rec.id)?.length)) continue
      const a = byUnit.get(d.unit.id)
      if (a) a.push(d); else byUnit.set(d.unit.id, [d])
    }
    return units.filter((u) => byUnit.has(u.id)).map((u) => {
      const items = byUnit.get(u.id)!.sort((a, b) => a.y0 - b.y0)
      // One column per calendar year, dots stacked upward, linked records first.
      const buckets = new Map<number, typeof items>()
      for (const d of items) { const yr = Math.floor(d.y0); const a = buckets.get(yr); if (a) a.push(d); else buckets.set(yr, [d]) }
      let slots = 1
      const stacks = Array.from(buckets.entries()).map(([yr, arr]) => {
        arr.sort((a, b) => (linksByRecord.get(b.rec.id)?.length ?? 0) - (linksByRecord.get(a.rec.id)?.length ?? 0) || a.rec.title.localeCompare(b.rec.title))
        const shown = arr.slice(0, CAP)
        const extra = arr.length - shown.length
        slots = Math.max(slots, shown.length + (extra > 0 ? 1 : 0))
        return { yr, px: x(yr + 0.5), shown, extra, all: arr }
      })
      return { unit: u, items, stacks, slots }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dated, from, to, onlyLinked, units, linksByRecord])

  const height = lanes.reduce((n, l) => n + 14 + l.slots * SLOT_H, 0) + 34
  const ticks: number[] = []
  const step = to - from > 40 ? 10 : to - from > 18 ? 5 : 2
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y)
  const bins = (items: typeof dated) => {
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
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('timelineYears')}</span>
          <input type="number" min={span.min} max={to - 1} value={from} onChange={(e) => setRange([Number(e.target.value), to])} style={{ width: 70 }} aria-label={t('timelineFrom')} />
          <span>–</span>
          <input type="number" min={from + 1} max={span.max + 10} value={to} onChange={(e) => setRange([from, Number(e.target.value)])} style={{ width: 70 }} aria-label={t('timelineTo')} />
          <button type="button" className="btn btn-mini" onClick={() => setRange([span.min, span.max])}>{t('timelineAll')}</button>
          <button type="button" className="btn btn-mini" onClick={() => setRange([2015, Math.max(span.max, 2030)])}>{t('timelineSince2015')}</button>
        </div>
        <label className="cmp-check cmp-scope-group"><input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} />{t('timelineOnlyLinked')}</label>
      </div>

      {lanes.length === 0 ? <p className="muted">{t('timelineEmpty')}</p> : (
        <div className="cmp-timeline">
          <svg width={LABEL_W + PLOT_W + 30} height={height} role="img" aria-label={t('timelineTitle')} style={{ display: 'block' }}>
            {ticks.map((y) => (
              <g key={y}>
                <line x1={x(y)} x2={x(y)} y1={22} y2={height} stroke="var(--border)" strokeWidth={1} />
                <text x={x(y)} y={14} fontSize={10.5} textAnchor="middle" fill="var(--text-muted)">{y}</text>
              </g>
            ))}
            {nowYear >= from && nowYear <= to && <line x1={x(nowYear)} x2={x(nowYear)} y1={22} y2={height} stroke="var(--series-a)" strokeWidth={1.5} strokeDasharray="4 3" />}
            {(() => {
              let y = 28
              return lanes.map((lane) => {
                const top = y
                const h = 14 + lane.slots * SLOT_H
                y += h
                const hue = unitHex(lane.unit, units)
                return (
                  <g key={lane.unit.id}>
                    <rect x={0} y={top} width={LABEL_W + PLOT_W + 30} height={h} fill={lanes.indexOf(lane) % 2 ? 'transparent' : 'var(--surface-1)'} opacity={0.6} />
                    <circle cx={10} cy={top + h / 2} r={4.5} fill={hue} />
                    <text x={22} y={top + h / 2 + 4} fontSize={12} fontWeight={600} fill="var(--text-primary)">{lane.unit.label.length > 22 ? `${lane.unit.label.slice(0, 21)}…` : lane.unit.label}</text>
                    {lane.stacks.map((st) => (
                      <g key={st.yr}>
                        {st.shown.map((d, i) => {
                          const cy = top + h - 9 - i * SLOT_H
                          const nLinks = linksByRecord.get(d.rec.id)?.length ?? 0
                          const pxEnd = d.y1 ? x(d.y1) : null
                          return (
                            <g key={`${d.rec.id}-${i}`} style={{ cursor: 'pointer' }} onClick={() => setOpenList([d.rec])}>
                              {pxEnd !== null && pxEnd > st.px + 4 && <line x1={st.px} x2={pxEnd} y1={cy} y2={cy} stroke={hue} strokeWidth={3} opacity={0.3} strokeLinecap="round" />}
                              <Marker family={d.rec.family} x={st.px} y={cy} color={hue} filled={nLinks > 0} />
                              <title>{`${d.rec.title} (${Math.floor(d.y0)})${nLinks ? ` · ${t('unitLinksN', { n: nLinks })}` : ''}`}</title>
                            </g>
                          )
                        })}
                        {st.extra > 0 && (
                          <text x={st.px} y={top + h - 9 - st.shown.length * SLOT_H + 4} fontSize={10} fontWeight={700} textAnchor="middle" fill={hue} style={{ cursor: 'pointer' }} onClick={() => setOpenList(st.all.map((d) => d.rec))}>
                            +{st.extra}
                            <title>{t('timelineMore', { n: st.extra, y: st.yr })}</title>
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                )
              })
            })()}
          </svg>
        </div>
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
