import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { bandVar, bandRank, describe, dimensionKeys, type PairStat, type Unit } from '@/lib/comparison'
import { useComparison } from './context'
import { CoverageMatrix } from './matrix'
import { buildRows } from './rows'
import { Explain, LoadGate, PageHeader, ReliabilityNote, ScopeBar, Stat } from './ui'

export default function OverviewPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, objects, links, units, activeUnitIds, measures, network, recordsById, scopeRecords, objectsById } = c
  const { project: slug } = useParams()
  const base = `/dashboard/${slug}`

  const linkedObjects = useMemo(() => new Set(links.map((l) => l.objectId)), [links])
  const strandKeys = useMemo(() => dimensionKeys(objects, 'strand'), [objects])
  const unlinkedStrands = strandKeys.filter((k) => !k.objectIds.some((id) => linkedObjects.has(id)))
  const subParts = objects.filter((o) => !!o.parentId)
  const linkedSubParts = subParts.filter((o) => linkedObjects.has(o.id))
  const unlinkedItems = objects.filter((o) => !linkedObjects.has(o.id))
  const perItem = useMemo(() => describe(objects.map((o) => links.filter((l) => l.objectId === o.id).length)), [objects, links])
  const emptyUnits = units.filter((u) => !activeUnitIds.includes(u.id) && (c.recordCountByUnit.get(u.id) ?? 0) > 0)
  const strandRows = useMemo(() => buildRows(c, 'structure').filter((r) => r.header), [c.objects, c.objectsById, c.concepts, c.topConceptOf, c.topConcepts, c.source]) // eslint-disable-line react-hooks/exhaustive-deps

  const bandCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of links) { const b = objectsById.get(l.objectId)?.gradeBand ?? 'n/a'; m.set(b, (m.get(b) ?? 0) + 1) }
    return Array.from(m.entries()).sort((a, b) => bandRank(a[0]) - bandRank(b[0]))
  }, [links, objectsById])
  const maxBand = Math.max(1, ...bandCounts.map((b) => b[1]))

  const unitLabel = (id: string) => units.find((u) => u.id === id)?.label ?? id

  // What stands out, in plain words. Each line states a number and where to look next.
  const findings: { text: string; to?: string; toLabel?: string }[] = []
  const stats = measures.units.filter((u) => u.n > 0)
  if (stats.length > 0) {
    const top = [...stats].sort((a, b) => b.n - a.n)[0]
    findings.push({ text: t('findTop', { place: unitLabel(top.unitId), n: top.n, a: top.rowsCovered, b: top.rowsTotal }), to: `${base}/coverage`, toLabel: t('navCoverage') })
  }
  if (emptyUnits.length > 0) {
    findings.push({ text: t('findEmptyPlaces', { n: emptyUnits.length, list: emptyUnits.slice(0, 4).map((u) => u.label).join(', ') + (emptyUnits.length > 4 ? ', …' : '') }), to: `${base}/curate`, toLabel: t('navCurate') })
  }
  if (unlinkedStrands.length > 0) {
    findings.push({ text: t('findStrandGaps', { n: unlinkedStrands.length, total: strandKeys.length, list: unlinkedStrands.slice(0, 3).map((k) => k.label).join('; ') + (unlinkedStrands.length > 3 ? '; …' : '') }), to: `${base}/curate`, toLabel: t('navCurate') })
  }
  if (links.length > 0 && subParts.length > 0 && linkedSubParts.length === 0) {
    findings.push({ text: t('findStrandLevelOnly', { n: subParts.length }), to: `${base}/curate`, toLabel: t('navCurate') })
  } else if (subParts.length > 0 && linkedSubParts.length < subParts.length) {
    findings.push({ text: t('findGaps', { n: subParts.length - linkedSubParts.length, total: subParts.length, list: subParts.filter((o) => !linkedObjects.has(o.id)).slice(0, 3).map((o) => o.title).join('; ') + (subParts.length - linkedSubParts.length > 3 ? '; …' : '') }), to: `${base}/curate`, toLabel: t('navCurate') })
  }
  const pairs = measures.pairs.filter((p) => p.jsd !== null)
  if (pairs.length > 0) {
    const sorted = [...pairs].sort((a: PairStat, b: PairStat) => (b.jsd ?? 0) - (a.jsd ?? 0))
    const top = sorted[0]
    const beyond = top.p !== null && top.p < 0.1 && measures.reliability !== 'small'
    findings.push({
      text: beyond
        ? t('findDistinct', { a: unitLabel(top.a), b: unitLabel(top.b), d: Math.sqrt(top.jsd ?? 0).toFixed(2) })
        : t('findNoneDistinct', { n: top.n1 + top.n2 }),
      to: `${base}/measures`, toLabel: t('navMeasures'),
    })
  }
  if (network.bridges.length > 0) {
    const b = network.bridges[0]
    const rec = recordsById.get(b.recordId)
    if (rec) findings.push({ text: t('findBridge', { title: rec.title.length > 90 ? `${rec.title.slice(0, 89)}…` : rec.title, n: b.strands, o: b.objects }), to: `${base}/network`, toLabel: t('navNetwork') })
  }
  // Count grade-band parts only, the same denominator as the tile above (strands are not parts).
  const subPartIds = new Set(subParts.map((o) => o.id))
  const isolatedParts = network.isolated.filter((id) => subPartIds.has(id))
  if (isolatedParts.length > 0 && links.length > 0) {
    findings.push({ text: t('findIsolated', { n: isolatedParts.length, total: subParts.length }), to: `${base}/network`, toLabel: t('navNetwork') })
  }

  return (
    <div>
      <PageHeader icon={ClipboardList} title={t('overviewTitle')} help={t('overviewHelp')} />
      <ScopeBar show={{ dim: false }} />
      <ReliabilityNote />

      <div className="cmp-stats">
        <Stat value={subParts.length} label={t('statItems')} sub={t('statItemsSub', { n: strandRows.length })} />
        <Stat value={`${units.length - emptyUnits.length}/${units.length}`} label={t('statPlaces')} sub={t('statPlacesSub')} />
        <Stat value={scopeRecords.length} label={t('statRecords')} />
        <Stat value={links.length} label={t('statLinks')} sub={c.proposedShare > 0 ? t('statLinksSub', { p: Math.round(c.proposedShare * 100) }) : undefined} />
        <Stat value={`${strandKeys.length - unlinkedStrands.length}/${strandKeys.length}`} label={t('statStrandsLinked')} sub={t('statGroundedSub')} />
        <Stat value={`${linkedSubParts.length}/${subParts.length}`} label={t('statSubLinked')} sub={t('statGroundedSub')} />
        <Stat value={Number.isFinite(perItem.median) ? perItem.median : 0} label={t('statMedian')} sub={`${perItem.min}–${perItem.max}`} />
      </div>

      <div className="cmp-two">
        <div className="cmp-panel">
          <h2>{t('overviewStands')}</h2>
          {findings.length === 0 ? <p className="muted">{t('emptyNoLinks')}</p> : (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.55, fontSize: 13 }}>
              {findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {f.text}{' '}
                  {f.to && <Link to={f.to} className="row" style={{ display: 'inline-flex', gap: 2, fontSize: 12 }}>{f.toLabel}<ArrowRight size={11} /></Link>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cmp-panel">
          <h2>{t('overviewBands')}</h2>
          <p className="muted" style={{ margin: '0 0 8px' }}>{t('overviewBandsHelp')}</p>
          {bandCounts.map(([band, n]) => (
            <div key={band} className="row" style={{ gap: 8, flexWrap: 'nowrap', marginBottom: 5 }}>
              <span style={{ width: 44, fontSize: 12 }}>{band}</span>
              <span className="cmp-bar" style={{ width: `${Math.max(2, (n / maxBand) * 100)}%`, maxWidth: 'calc(100% - 90px)', background: bandVar(band) }} />
              <span className="muted" style={{ fontSize: 12 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cmp-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('overviewMap')}</h2>
          <Link to={`${base}/coverage`} className="row" style={{ fontSize: 12, gap: 2 }}>{t('navCoverage')}<ArrowRight size={11} /></Link>
        </div>
        {strandRows.length === 0 || units.length === 0 ? <p className="muted">{t('emptyNoRecords')}</p> : (
          <CoverageMatrix rows={strandRows} units={units as Unit[]} compact showTotals={false} />
        )}
      </div>

      <Explain what={t('overviewExplain')} />
    </div>
  )
}
