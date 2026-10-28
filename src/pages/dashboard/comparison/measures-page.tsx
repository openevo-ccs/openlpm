import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { RECORD_FAMILIES, modularity, placeVar, topStrandOf, unitHex, type PairStat, type Unit } from '@/lib/comparison'
import { useComparison } from './context'
import { Explain, FAMILY_KEY, LoadGate, PageHeader, ReliabilityNote, ScopeBar, Sparkbars, formatNumber, formatPct } from './ui'

const MIN_LINKS = 6

export default function MeasuresPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, measures: m, units, objects, objectsById, network, setPair } = c
  const { project: slug } = useParams()
  const navigate = useNavigate()
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const U = (id: string): Unit => unitById.get(id)!
  const order = m.order.length === m.unitIds.length ? m.order : m.unitIds.map((_, i) => i)
  const pairOf = (a: string, b: string): PairStat | undefined => m.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))

  const closest = useMemo(() => {
    const ok = m.pairs.filter((p) => p.jsd !== null && p.n1 >= MIN_LINKS && p.n2 >= MIN_LINKS)
    if (!ok.length) return null
    return { near: [...ok].sort((a, b) => (a.jsd ?? 1) - (b.jsd ?? 1))[0], far: [...ok].sort((a, b) => (b.jsd ?? 0) - (a.jsd ?? 0))[0] }
  }, [m.pairs])

  const strandPartition = useMemo(() => new Map(objects.map((o) => [o.id, topStrandOf(o, objectsById).id])), [objects, objectsById])
  const bandPartition = useMemo(() => new Map(objects.map((o) => [o.id, o.gradeBand ?? 'n/a'])), [objects])
  const qStrand = network.itemGraph.edges.length ? modularity(network.itemGraph, strandPartition) : null
  const qBand = network.itemGraph.edges.length ? modularity(network.itemGraph, bandPartition) : null
  const maxEdge = Math.max(0.0001, ...m.pairs.map((p) => Math.sqrt(p.jsd ?? 0)))
  const residualMax = Math.max(2.5, ...m.residuals.flat().map((v) => Math.abs(v)))

  return (
    <div>
      <PageHeader icon={BarChart3} title={t('measuresTitle')} help={t('measuresHelp')} />
      <ScopeBar show={{ dim: true }} />
      <ReliabilityNote />

      {m.unitIds.length === 0 ? <p className="muted">{t('relNone')}</p> : (
        <>
          {/* ---- A. each place at a glance ---- */}
          <div className="cmp-panel">
            <h2>{t('msGlance')}</h2>
            <Explain what={t('msGlanceWhat')} how={t('msGlanceHow')} />
            <div style={{ overflowX: 'auto' }}>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>{t('places')}</th><th className="num">{t('links')}</th><th className="num">{t('msRecordsLinked')}</th><th className="num">{t('msRowsCovered')}</th>
                    <th className="num">{t('msMedian')}</th><th>{t('msProfile')}</th><th className="num">{t('msReasoned')}</th><th className="num">{t('msYears')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.map((i) => {
                    const s = m.units[i]
                    const u = U(s.unitId)
                    const col = m.counts.map((r) => r[i])
                    return (
                      <tr key={s.unitId}>
                        <td><span className="cmp-dot" style={{ background: unitHex(u, units), marginRight: 6 }} />{u.label}</td>
                        <td className="num">{s.n}</td>
                        <td className="num">{s.distinctRecords}</td>
                        <td className="num">{s.rowsCovered}/{s.rowsTotal}</td>
                        <td className="num">{formatNumber(s.perRow.median, 1)} <span className="muted">({formatNumber(s.perRow.q1, 1)}–{formatNumber(s.perRow.q3, 1)})</span></td>
                        <td><Sparkbars values={col} color={unitHex(u, units)} width={Math.max(60, Math.min(160, col.length * 14))} /></td>
                        <td className="num">{s.n ? formatPct(s.withRationale / Math.max(1, s.n)) : '–'}</td>
                        <td className="num">{s.firstYear !== null ? `${Math.floor(s.firstYear)}–${Math.floor(s.lastYear ?? s.firstYear)}` : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- B. evenness ---- */}
          <div className="cmp-panel">
            <h2>{t('msEven')}</h2>
            <Explain what={t('msEvenWhat')} how={t('msEvenHow')} />
            <table className="cmp-table">
              <thead><tr><th>{t('places')}</th><th>{t('msEvenness')}</th><th className="num">{t('msConcentration')}</th></tr></thead>
              <tbody>
                {order.map((i) => {
                  const s = m.units[i]
                  const u = U(s.unitId)
                  const e = s.evenness
                  return (
                    <tr key={s.unitId}>
                      <td><span className="cmp-dot" style={{ background: unitHex(u, units), marginRight: 6 }} />{u.label}</td>
                      <td>
                        {e && s.n >= MIN_LINKS ? (
                          <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <span className="cmp-ci" title={`${formatNumber(e.lo)} – ${formatNumber(e.hi)}`}>
                              <i style={{ left: `${e.lo * 100}%`, width: `${Math.max(2, (e.hi - e.lo) * 100)}%`, background: unitHex(u, units) }} />
                              <b style={{ left: `calc(${e.value * 100}% - 1px)`, background: unitHex(u, units) }} />
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(e.value)}</span>
                            <span className="muted">({formatNumber(e.lo)}–{formatNumber(e.hi)})</span>
                          </span>
                        ) : <span className="muted">{t('msTooFew', { n: s.n })}</span>}
                      </td>
                      <td className="num">{s.n >= MIN_LINKS ? formatNumber(s.gini) : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ---- C. difference between places ---- */}
          <div className="cmp-panel">
            <h2>{t('msDiff')}</h2>
            <Explain what={t('msDiffWhat')} how={t('msDiffHow')} />
            {m.unitIds.length < 2 ? <p className="muted">{t('msNeedTwo')}</p> : (
              <>
                {closest && (
                  <p style={{ fontSize: 13, margin: '0 0 8px' }}>
                    {closest.near === closest.far
                      ? t('msOnlyPair', { a: U(closest.near.a).label, b: U(closest.near.b).label, d: formatNumber(Math.sqrt(closest.near.jsd ?? 0)) })
                      : <>
                          {t('msClosest', { a: U(closest.near.a).label, b: U(closest.near.b).label, d: formatNumber(Math.sqrt(closest.near.jsd ?? 0)) })}{' '}
                          {t('msFarthest', { a: U(closest.far.a).label, b: U(closest.far.b).label, d: formatNumber(Math.sqrt(closest.far.jsd ?? 0)) })}
                        </>}
                  </p>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table className="cmp-heat">
                    <thead>
                      <tr><th />{order.map((j) => <th key={j} className="top"><span style={{ color: unitHex(U(m.unitIds[j]), units) }}>{U(m.unitIds[j]).label}</span></th>)}</tr>
                    </thead>
                    <tbody>
                      {order.map((i) => (
                        <tr key={i}>
                          <th className="lbl">{U(m.unitIds[i]).label}</th>
                          {order.map((j) => {
                            if (i === j) return <td key={j} style={{ background: 'var(--surface-1)', borderRadius: 4 }}>–</td>
                            const p = pairOf(m.unitIds[i], m.unitIds[j])
                            const small = !p || p.n1 < MIN_LINKS || p.n2 < MIN_LINKS
                            const d = p?.jsd === null || !p ? null : Math.sqrt(p.jsd ?? 0)
                            const sig = !small && p?.p !== null && (p?.p ?? 1) < 0.05
                            return (
                              <td key={j} className="v" title={p ? t('msCell', { a: U(p.a).label, b: U(p.b).label, d: formatNumber(d), c: formatNumber(Math.sqrt(p.chance ?? 0)), p: formatNumber(p.p), n1: p.n1, n2: p.n2 }) : ''}
                                style={{ background: d === null ? 'transparent' : `color-mix(in srgb, var(--series-a) ${Math.round(10 + 75 * (d / maxEdge))}%, var(--surface-0))`, opacity: small ? 0.55 : 1, outline: sig ? '2px solid var(--text-primary)' : undefined, outlineOffset: -2 }}
                                onClick={() => { setPair([m.unitIds[i], m.unitIds[j]]); navigate(`/dashboard/${slug}/side-by-side`) }}>
                                {d === null ? '' : formatNumber(d)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ marginTop: 6 }}>{t('msDiffLegend')}</p>
              </>
            )}
          </div>

          {/* ---- D. where each place puts its weight ---- */}
          <div className="cmp-panel">
            <h2>{t('msEmph')}</h2>
            <Explain what={t('msEmphWhat')} how={t('msEmphHow')} />
            <p style={{ fontSize: 13, margin: '0 0 8px' }}>
              {m.mi.nmi === null ? t('msMiNone') : t('msMiSummary', { v: formatPct(m.mi.nmi), c: formatPct(m.miTest.nullMean / Math.max(0.0001, Math.min(m.mi.hRows, m.mi.hCols))), p: formatNumber(m.miTest.p) })}
              {' '}{m.mi.nmi !== null && (m.miTest.p < 0.05 ? t('msMiBeyond') : t('msMiWithin'))}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="cmp-heat">
                <thead>
                  <tr><th />{order.map((j) => <th key={j} className="top"><span style={{ color: unitHex(U(m.unitIds[j]), units) }}>{U(m.unitIds[j]).label}</span></th>)}</tr>
                </thead>
                <tbody>
                  {m.keys.map((k, r) => (
                    <tr key={k.id}>
                      <th className="lbl" title={k.label}>{k.label.length > 34 ? `${k.label.slice(0, 33)}…` : k.label}</th>
                      {order.map((j) => {
                        const z = m.residuals[r][j]
                        const n = m.counts[r][j]
                        const strong = Math.abs(z) >= 2
                        const hue = z > 0 ? unitHex(U(m.unitIds[j]), units) : 'var(--text-muted)'
                        return (
                          <td key={j} className="v" title={`${k.label} · ${U(m.unitIds[j]).label}: ${n} ${t('links')}, z = ${formatNumber(z, 1)}`}
                            style={{ background: strong ? `color-mix(in srgb, ${hue} ${Math.round(22 + 55 * Math.min(1, Math.abs(z) / residualMax))}%, var(--surface-0))` : 'transparent', fontWeight: strong ? 700 : 400, color: strong ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'default' }}>
                            {n}{strong ? (z > 0 ? ' ▲' : ' ▼') : ''}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>{t('msEmphLegend')}</p>
          </div>

          {/* ---- E. structure ---- */}
          <div className="cmp-panel">
            <h2>{t('msStruct')}</h2>
            <Explain what={t('msStructWhat')} how={t('msStructHow')} />
            <table className="cmp-table">
              <tbody>
                <tr><td>{t('netComponents')}</td><td className="num">{network.componentsCount}</td></tr>
                <tr><td>{t('netIsolated')}</td><td className="num">{network.isolated.length} / {objects.length}</td></tr>
                <tr><td>{t('netDensity')}</td><td className="num">{formatNumber(network.density)}</td></tr>
                <tr><td>{t('msModStrand')}</td><td className="num">{qStrand === null ? '–' : formatNumber(qStrand)}</td></tr>
                <tr><td>{t('msModBand')}</td><td className="num">{qBand === null ? '–' : formatNumber(qBand)}</td></tr>
                <tr><td>{t('msBridging')}</td><td className="num">{network.bridges.length}</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 6 }}><Link to={`/dashboard/${slug}/network`}>{t('navNetwork')}</Link></p>
          </div>

          {/* ---- F. record mix ---- */}
          <div className="cmp-panel">
            <h2>{t('msMix')}</h2>
            <Explain what={t('msMixWhat')} />
            {order.map((i) => {
              const s = m.units[i]
              const u = U(s.unitId)
              const total = Math.max(1, RECORD_FAMILIES.reduce((n, f) => n + s.familyMix[f], 0))
              return (
                <div key={s.unitId} className="row" style={{ gap: 10, flexWrap: 'nowrap', marginBottom: 6 }}>
                  <span style={{ width: 160, fontSize: 12.5 }}><span className="cmp-dot" style={{ background: unitHex(u, units), marginRight: 6 }} />{u.label}</span>
                  <div style={{ display: 'flex', flex: 1, height: 14, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-1)' }}>
                    {RECORD_FAMILIES.filter((f) => s.familyMix[f] > 0).map((f, k) => (
                      <div key={f} title={`${t(FAMILY_KEY[f])}: ${s.familyMix[f]}`} style={{ width: `${(s.familyMix[f] / total) * 100}%`, background: placeVar(u.country), opacity: 1 - k * 0.14, borderRight: '1px solid var(--surface-2)' }} />
                    ))}
                  </div>
                  <span className="muted" style={{ width: 280, fontSize: 11.5 }}>
                    {RECORD_FAMILIES.filter((f) => s.familyMix[f] > 0).map((f) => `${t(FAMILY_KEY[f])} ${s.familyMix[f]}`).join(' · ')}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
