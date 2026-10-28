import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { buildIndex, linkIssues, rank, recordUnitIds, cellKey, type DimKey, type Unit } from '@/lib/comparison'
import { RecordKindIcon } from '@/lib/record-type-display'
import { useComparison } from './context'
import { LinkDrawer } from './drawer'
import { Explain, LoadGate, PageHeader, ScopeBar, formatPct } from './ui'
import type { StringKey } from './strings'

type Tab = 'gaps' | 'records' | 'weak' | 'log'
const ISSUE_KEY: Record<string, StringKey> = {
  'no-rationale': 'issueNoRationale', 'short-rationale': 'issueShort', boilerplate: 'issueBoilerplate', proposed: 'issueProposed', questioned: 'issueQuestioned',
}
const VERDICT_KEY: Record<string, StringKey> = { supports: 'verdictSupports', questions: 'verdictQuestions', too_broad: 'verdictTooBroad', wrong_place: 'verdictWrongPlace' }

export default function CuratePage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, units, measures: m, grid, objects, objectsById, links, scopeRecords, recordsById, reviewsByLink, source, recordIndex, recordWeight, level, countries, canEdit, canCritique, activeUnitIds, concepts } = c
  const [tab, setTab] = useState<Tab>('gaps')
  const [limit, setLimit] = useState(25)
  const [open, setOpen] = useState<{ key: DimKey; unit: Unit } | null>(null)
  const checked = source?.checkedNoMatch ?? new Set<string>()
  const countrySet = useMemo(() => new Set(countries), [countries])

  // Text index of the progression's own parts, to match a record to the row it resembles.
  const objectIndex = useMemo(() => buildIndex(objects.map((o) => ({
    id: o.id, text: `${o.title} ${o.title} ${o.description} ${o.conceptIds.map((cid) => concepts.find((x) => x.id === cid)?.label ?? '').join(' ')}`,
  }))), [objects, concepts])

  const queryOf = (k: DimKey) => k.objectIds.map((id) => { const o = objectsById.get(id); return o ? `${o.title} ${o.title} ${o.description} ${o.conceptIds.map((cid) => concepts.find((x) => x.id === cid)?.label ?? '').join(' ')}` : '' }).join(' ')

  const unitRecordIds = useMemo(() => {
    const m2 = new Map<string, Set<string>>()
    for (const r of scopeRecords) for (const uid of recordUnitIds(r, level, countrySet)) { const s = m2.get(uid) ?? new Set<string>(); s.add(r.id); m2.set(uid, s) }
    return m2
  }, [scopeRecords, level, countrySet])

  // ---- gaps: a row with no link in a place that has records, ranked by how many other places have one
  const gaps = useMemo(() => {
    const out: { key: DimKey; unit: Unit; peers: number; best: { id: string; score: number; terms: string[] } | null; priority: number }[] = []
    const activeCount = Math.max(1, activeUnitIds.length)
    m.keys.forEach((k, r) => {
      const peers = m.unitIds.filter((_, j) => m.counts[r][j] > 0).length
      for (const u of units) {
        if ((unitRecordIds.get(u.id)?.size ?? 0) === 0) continue
        if (checked.has(`${k.id}|${u.id}`)) continue
        const here = k.objectIds.reduce((n, oid) => n + (grid.linksBy.get(cellKey(oid, u.id))?.length ?? 0), 0)
        if (here > 0) continue
        const linkedHere = new Set(links.filter((l) => k.objectIds.includes(l.objectId)).map((l) => l.recordId))
        const hit = rank(recordIndex, queryOf(k), { topK: 1, exclude: linkedHere, only: unitRecordIds.get(u.id), weight: recordWeight })[0] ?? null
        const priority = 0.5 * (peers / activeCount) + 0.5 * Math.min(1, (hit?.score ?? 0) * 2.5)
        out.push({ key: k, unit: u, peers, best: hit, priority })
      }
    })
    return out.sort((a, b) => b.priority - a.priority)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, units, unitRecordIds, checked, grid, links, recordIndex, activeUnitIds])

  // ---- records nobody links yet, with the row each most resembles
  const unlinked = useMemo(() => {
    const linkedIds = new Set(links.map((l) => l.recordId))
    const out: { rec: (typeof scopeRecords)[number]; row: DimKey | null; score: number; terms: string[]; unit: Unit | null }[] = []
    for (const rec of scopeRecords) {
      if (linkedIds.has(rec.id)) continue
      const hit = rank(objectIndex, `${rec.title} ${rec.title} ${rec.summary}`, { topK: 1 })[0]
      const key = hit ? m.keys.find((k) => k.objectIds.includes(hit.id)) ?? null : null
      const uid = recordUnitIds(rec, level, countrySet)[0]
      out.push({ rec, row: key, score: hit?.score ?? 0, terms: hit?.terms ?? [], unit: units.find((u) => u.id === uid) ?? null })
    }
    return out.sort((a, b) => b.score - a.score)
  }, [scopeRecords, links, objectIndex, m.keys, level, countrySet, units])
  const linkedShare = scopeRecords.length ? 1 - unlinked.length / scopeRecords.length : 0

  // ---- links worth a second look
  const weak = useMemo(() => links.map((l) => ({ l, issues: linkIssues(l, reviewsByLink.get(l.id) ?? []) })).filter((x) => x.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length || Number(b.l.proposed) - Number(a.l.proposed)), [links, reviewsByLink])

  const reviews = source?.reviews ?? []
  const verdictCounts = reviews.reduce<Record<string, number>>((acc, r) => { acc[r.verdict] = (acc[r.verdict] ?? 0) + 1; return acc }, {})

  const openCell = (key: DimKey, unit: Unit) => setOpen({ key, unit })
  const keyOfObject = (oid: string) => m.keys.find((k) => k.objectIds.includes(oid)) ?? null
  const unitOfLink = (rid: string): Unit | null => { const rec = recordsById.get(rid); const uid = rec ? recordUnitIds(rec, level, countrySet)[0] : undefined; return units.find((u) => u.id === uid) ?? null }

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'gaps', label: t('curGaps'), n: gaps.length },
    { id: 'records', label: t('curRecords'), n: unlinked.length },
    { id: 'weak', label: t('curWeak'), n: weak.length },
    { id: 'log', label: t('curLog'), n: reviews.length },
  ]

  return (
    <div>
      <PageHeader icon={ListChecks} title={t('curateTitle')} help={t('curateHelp')} />
      <p className="muted" style={{ margin: '0 0 10px' }}>{canEdit ? t('curRoleEdit') : canCritique ? t('curRoleCritic') : t('curRoleView')}</p>
      <ScopeBar show={{ dim: true }} />
      <div className="cmp-stats">
        <div className="cmp-stat"><div className="cmp-stat-value">{formatPct(linkedShare)}</div><div className="cmp-stat-label">{t('curRecordsLinked')}</div><div className="cmp-stat-sub">{scopeRecords.length - unlinked.length} {t('of')} {scopeRecords.length}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{gaps.length}</div><div className="cmp-stat-label">{t('curGaps')}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{weak.length}</div><div className="cmp-stat-label">{t('curWeak')}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{reviews.length}</div><div className="cmp-stat-label">{t('curLog')}</div></div>
      </div>

      <div className="cmp-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={`cmp-chip${tab === x.id ? ' on' : ''}`} onClick={() => { setTab(x.id); setLimit(25) }}>{x.label} <span className="cmp-count">{x.n}</span></button>
        ))}
      </div>

      {tab === 'gaps' && (
        <div className="cmp-panel">
          <Explain what={t('curGapsWhat')} how={t('curGapsHow')} />
          {gaps.length === 0 ? <p className="muted">{t('curNoGaps')}</p> : gaps.slice(0, limit).map((g, i) => {
            const rec = g.best ? recordsById.get(g.best.id) : null
            return (
              <div key={i} className="cmp-queue-item">
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{g.key.label}</strong> <span className="muted">· {g.unit.label}</span>
                  <div className="muted" style={{ fontSize: 11.5 }}>{t('curPeers', { n: g.peers, u: Math.max(1, activeUnitIds.length) })}</div>
                  {rec && (
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start', marginTop: 4, fontSize: 12.5 }}>
                      <RecordKindIcon type={rec.type as never} size={13} />
                      <span style={{ overflowWrap: 'anywhere' }}>{rec.title} <span className="muted">· {t('drawerSharedWords')}: {g.best!.terms.join(', ')}</span></span>
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-mini" onClick={() => openCell(g.key, g.unit)}>{canEdit ? t('curReview') : t('curOpen')}</button>
              </div>
            )
          })}
          {gaps.length > limit && <button type="button" className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setLimit((n) => n + 25)}>{t('curMore')}</button>}
        </div>
      )}

      {tab === 'records' && (
        <div className="cmp-panel">
          <Explain what={t('curRecordsWhat')} how={t('curRecordsHow')} />
          {unlinked.slice(0, limit).map((u) => (
            <div key={u.rec.id} className="cmp-queue-item">
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <RecordKindIcon type={u.rec.type as never} size={13} />
                  <strong style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{u.rec.title}</strong>
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {u.unit?.label}{u.row ? ` · ${t('curResembles')}: ${u.row.label} (${u.terms.join(', ')})` : ''}
                </div>
              </div>
              {u.row && u.unit && <button type="button" className="btn btn-mini" onClick={() => openCell(u.row!, u.unit!)}>{canEdit ? t('curReview') : t('curOpen')}</button>}
            </div>
          ))}
          {unlinked.length > limit && <button type="button" className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setLimit((n) => n + 25)}>{t('curMore')}</button>}
        </div>
      )}

      {tab === 'weak' && (
        <div className="cmp-panel">
          <Explain what={t('curWeakWhat')} />
          {weak.length === 0 ? <p className="muted">{t('curNoWeak')}</p> : weak.slice(0, limit).map(({ l, issues }) => {
            const rec = recordsById.get(l.recordId)
            const key = keyOfObject(l.objectId)
            const unit = unitOfLink(l.recordId)
            return (
              <div key={l.id} className="cmp-queue-item">
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 12.5 }}>{objectsById.get(l.objectId)?.title}</strong> <span className="muted">· {unit?.label}</span>
                  <div style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{rec?.title}</div>
                  <div className="cmp-issues">{issues.map((i) => <span key={i} className={`cmp-issue${i === 'proposed' || i === 'questioned' ? ' warn' : ''}`}>{t(ISSUE_KEY[i])}</span>)}</div>
                </div>
                {key && unit && <button type="button" className="btn btn-mini" onClick={() => openCell(key, unit)}>{canEdit ? t('curReview') : t('curOpen')}</button>}
              </div>
            )
          })}
          {weak.length > limit && <button type="button" className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setLimit((n) => n + 25)}>{t('curMore')}</button>}
        </div>
      )}

      {tab === 'log' && (
        <div className="cmp-panel">
          <Explain what={t('curLogWhat')} />
          {!(source?.reviewsAvailable) ? <p className="muted">{t('curLogUnavailable')}</p> : reviews.length === 0 ? <p className="muted">{t('curLogEmpty')}</p> : (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                {Object.entries(verdictCounts).map(([v, n]) => <span key={v} className="cmp-issue">{t(VERDICT_KEY[v] ?? 'verdictQuestions')}: {n}</span>)}
              </div>
              {reviews.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((r) => {
                const l = links.find((x) => x.id === r.linkId) ?? source?.links.find((x) => x.id === r.linkId)
                return (
                  <div key={r.id} className="cmp-queue-item">
                    <div>
                      <span className="cmp-issue warn">{t(VERDICT_KEY[r.verdict] ?? 'verdictQuestions')}</span>{' '}
                      <strong style={{ fontSize: 12.5 }}>{l ? objectsById.get(l.objectId)?.title : ''}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{l ? recordsById.get(l.recordId)?.title : ''}</div>
                      {r.comment && <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>{r.comment}</p>}
                      <div className="muted" style={{ fontSize: 11 }}>{r.createdAt.slice(0, 10)}</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {open && <LinkDrawer dimKey={open.key} unit={open.unit} onClose={() => setOpen(null)} />}
    </div>
  )
}
