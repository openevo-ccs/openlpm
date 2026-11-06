import { useMemo, useState } from 'react'
import { Columns2 } from 'lucide-react'
import { countMatrix, jaccard, jensenShannon, permutationJsd, total, unitHex, type DimKey } from '@/lib/comparison'
import { RecordKindIcon } from '@/lib/record-type-display'
import { useComparison } from './context'
import { LinkDrawer } from './drawer'
import { Explain, LoadGate, PageHeader, ScopeBar, formatNumber, formatPct } from './ui'

export default function SideBySidePage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, units, measures: m, grid, objects, recordsById, pair, setPair, activeUnitIds } = c
  const [open, setOpen] = useState<{ key: DimKey; unitId: string } | null>(null)
  const [showAll, setShowAll] = useState(false)

  const defaults = useMemo(() => {
    const ranked = [...m.units].sort((x, y) => y.n - x.n).map((u) => u.unitId)
    return [ranked[0] ?? units[0]?.id, ranked[1] ?? units[1]?.id] as [string, string]
  }, [m.units, units])
  const valid = (id: string | undefined) => !!id && units.some((u) => u.id === id)
  const a = pair && valid(pair[0]) ? pair[0] : defaults[0]
  const b = pair && valid(pair[1]) ? pair[1] : defaults[1]
  const ua = units.find((u) => u.id === a)
  const ub = units.find((u) => u.id === b)

  const calc = useMemo(() => {
    if (!ua || !ub) return null
    const counts = countMatrix(grid, m.keys, [ua.id, ub.id])
    const ca = counts.map((r) => r[0])
    const cb = counts.map((r) => r[1])
    const na = total(ca)
    const nb = total(cb)
    const jsd = jensenShannon(ca, cb)
    const perm = jsd === null ? null : permutationJsd(ca, cb, 400)
    const rowsA = new Set(m.keys.filter((_, i) => ca[i] > 0).map((k) => k.id))
    const rowsB = new Set(m.keys.filter((_, i) => cb[i] > 0).map((k) => k.id))
    const recA = new Set<string>()
    const recB = new Set<string>()
    for (const o of objects) {
      for (const l of grid.linksBy.get(`${o.id}|${ua.id}`) ?? []) recA.add(l.recordId)
      for (const l of grid.linksBy.get(`${o.id}|${ub.id}`) ?? []) recB.add(l.recordId)
    }
    const both = Array.from(recA).filter((r) => recB.has(r))
    // Row with the biggest gap in share of each place's own links.
    let best = { i: -1, gap: 0 }
    m.keys.forEach((_, i) => { const g = (na ? ca[i] / na : 0) - (nb ? cb[i] / nb : 0); if (Math.abs(g) > Math.abs(best.gap)) best = { i, gap: g } })
    return { ca, cb, na, nb, jsd, perm, rowsA, rowsB, recA, recB, both, best, rowsJaccard: jaccard(rowsA, rowsB) }
  }, [ua, ub, grid, m.keys, objects])

  if (!ua || !ub || !calc) return <><PageHeader icon={Columns2} title={t('sbsTitle')} help={t('sbsHelp')} /><p className="muted">{t('emptyNoRecords')}</p></>

  const sentence: string[] = []
  sentence.push(t('sbsTotals', { a: ua.label, na: calc.na, b: ub.label, nb: calc.nb }))
  const onlyA = m.keys.filter((k) => calc.rowsA.has(k.id) && !calc.rowsB.has(k.id)).length
  const onlyB = m.keys.filter((k) => calc.rowsB.has(k.id) && !calc.rowsA.has(k.id)).length
  const bothRows = m.keys.filter((k) => calc.rowsA.has(k.id) && calc.rowsB.has(k.id)).length
  sentence.push(t('sbsRows', { both: bothRows, a: ua.label, oa: onlyA, b: ub.label, ob: onlyB }))
  if (calc.best.i >= 0 && Math.abs(calc.best.gap) >= 0.15) {
    const k = m.keys[calc.best.i]
    sentence.push(t('sbsBiggest', { row: k.label, p1: formatPct(calc.na ? calc.ca[calc.best.i] / calc.na : 0), a: ua.label, p2: formatPct(calc.nb ? calc.cb[calc.best.i] / calc.nb : 0), b: ub.label }))
  }
  if (calc.both.length) sentence.push(t('sbsShared', { n: calc.both.length }))
  const small = calc.na < 6 || calc.nb < 6
  const rows = m.keys.map((k, i) => ({ k, i, a: calc.ca[i], b: calc.cb[i] })).filter((r) => showAll || r.a + r.b > 0)
  const share = (n: number, tot: number) => (tot ? n / tot : 0)
  const maxShare = Math.max(0.01, ...rows.map((r) => Math.max(share(r.a, calc.na), share(r.b, calc.nb))))
  const recordsOf = (ids: Set<string>, others: Set<string>) => Array.from(ids).filter((r) => !others.has(r)).map((r) => recordsById.get(r)).filter(Boolean)
  const hueA = unitHex(ua, units)
  const hueB = unitHex(ub, units)

  return (
    <div>
      <PageHeader icon={Columns2} title={t('sbsTitle')} help={t('sbsHelp')} />
      <ScopeBar show={{ dim: true, proposed: true }} />

      <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="cmp-scope-group">
          <span className="cmp-dot" style={{ background: hueA }} />
          <select value={ua.id} onChange={(e) => setPair([e.target.value, ub.id])} aria-label={t('sbsPlaceA')}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}{activeUnitIds.includes(u.id) ? '' : ` (${t('unitNoLinks')})`}</option>)}
          </select>
          <span className="muted">{t('sbsVersus')}</span>
          <span className="cmp-dot" style={{ background: hueB }} />
          <select value={ub.id} onChange={(e) => setPair([ua.id, e.target.value])} aria-label={t('sbsPlaceB')}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}{activeUnitIds.includes(u.id) ? '' : ` (${t('unitNoLinks')})`}</option>)}
          </select>
          <button type="button" className="btn btn-mini" onClick={() => setPair([ub.id, ua.id])}>⇄</button>
        </div>
        <label className="cmp-check cmp-scope-group"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />{t('sbsShowAll')}</label>
      </div>

      <div className="cmp-stats">
        <div className="cmp-stat"><div className="cmp-stat-value" style={{ color: hueA }}>{calc.na}</div><div className="cmp-stat-label">{ua.label}</div><div className="cmp-stat-sub">{t('unitLinksN', { n: calc.na })}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value" style={{ color: hueB }}>{calc.nb}</div><div className="cmp-stat-label">{ub.label}</div><div className="cmp-stat-sub">{t('unitLinksN', { n: calc.nb })}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{calc.jsd === null ? '–' : formatNumber(Math.sqrt(calc.jsd))}</div><div className="cmp-stat-label">{t('sbsDistance')}</div><div className="cmp-stat-sub">{calc.perm ? t('sbsChance', { c: formatNumber(Math.sqrt(calc.perm.nullMean)), p: formatNumber(calc.perm.p) }) : ''}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{formatPct(calc.rowsJaccard)}</div><div className="cmp-stat-label">{t('sbsRowOverlap')}</div><div className="cmp-stat-sub">{t('sbsRowOverlapSub')}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{calc.both.length}</div><div className="cmp-stat-label">{t('sbsSharedRecords')}</div></div>
      </div>
      {small && <p className="cmp-reliability small">{t('sbsSmall')}</p>}

      <div className="cmp-panel">
        <h2>{t('sbsSummary')}</h2>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.55, fontSize: 13 }}>{sentence.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <div className="cmp-panel">
        <h2>{t('sbsButterfly')}</h2>
        <Explain what={t('sbsButterflyWhat')} how={t('sbsButterflyHow')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) minmax(150px, 260px) minmax(80px, 1fr)', gap: '4px 10px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', fontWeight: 700, color: hueA, fontSize: 12 }}>{ua.label}</div><div />
          <div style={{ fontWeight: 700, color: hueB, fontSize: 12 }}>{ub.label}</div>
          {rows.map((r) => (
            <div key={r.k.id} style={{ display: 'contents' }}>
              <button type="button" className="btn-linklike" style={{ display: 'flex', justifyContent: 'flex-end', textDecoration: 'none', height: 20 }} onClick={() => setOpen({ key: r.k, unitId: ua.id })} title={`${r.a} ${t('links')}`}>
                <span style={{ width: `${(share(r.a, calc.na) / maxShare) * 100}%`, minWidth: r.a ? 3 : 0, background: hueA, borderRadius: 3, display: 'inline-block' }} />
                <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>{r.a || ''}</span>
              </button>
              <div style={{ fontSize: 12, textAlign: 'center', overflowWrap: 'anywhere' }}>{r.k.label}</div>
              <button type="button" className="btn-linklike" style={{ display: 'flex', textDecoration: 'none', height: 20 }} onClick={() => setOpen({ key: r.k, unitId: ub.id })} title={`${r.b} ${t('links')}`}>
                <span className="muted" style={{ marginRight: 6, fontSize: 11 }}>{r.b || ''}</span>
                <span style={{ width: `${(share(r.b, calc.nb) / maxShare) * 100}%`, minWidth: r.b ? 3 : 0, background: hueB, borderRadius: 3, display: 'inline-block' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="cmp-two">
        {([[ua, calc.recA, calc.recB, hueA], [ub, calc.recB, calc.recA, hueB]] as const).map(([u, mine, other, hue]) => (
          <div key={u.id} className="cmp-panel">
            <h2><span className="cmp-dot" style={{ background: hue, marginRight: 6 }} />{t('sbsOnly', { place: u.label })}</h2>
            {recordsOf(mine, other).length === 0 ? <p className="muted">{t('none')}</p> : recordsOf(mine, other).slice(0, 12).map((r) => r && (
              <div key={r.id} className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start', marginBottom: 5, fontSize: 12.5 }}>
                <RecordKindIcon type={r.type as never} size={13} /><span style={{ overflowWrap: 'anywhere' }}>{r.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {open && units.find((u) => u.id === open.unitId) && <LinkDrawer dimKey={open.key} unit={units.find((u) => u.id === open.unitId)!} onClose={() => setOpen(null)} />}
    </div>
  )
}
