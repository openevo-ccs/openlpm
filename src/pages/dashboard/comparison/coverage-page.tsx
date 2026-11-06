import { useMemo, useState } from 'react'
import { Download, Grid3x3, Search } from 'lucide-react'
import { cellLinks, type CmpLink, type Unit } from '@/lib/comparison'
import { useComparison } from './context'
import { CoverageMatrix, type CellRef } from './matrix'
import { LinkDrawer } from './drawer'
import { buildRows, type GroupBy } from './rows'
import { Explain, LoadGate, PageHeader, ReliabilityNote, ScopeBar, csvEscape, downloadText } from './ui'
import { bandVar } from '@/lib/comparison'

type PlaceOrder = 'default' | 'similar' | 'links'

export default function CoveragePage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, units, grid, measures, activeUnitIds, recordsById, objects } = c
  const [groupBy, setGroupBy] = useState<GroupBy>('structure')
  const [order, setOrder] = useState<PlaceOrder>('default')
  const [onlyLinked, setOnlyLinked] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CellRef | null>(null)

  const rows = useMemo(() => buildRows(c, groupBy), [c.objects, c.objectsById, c.concepts, c.topConceptOf, c.topConcepts, c.source, groupBy]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownUnits: Unit[] = useMemo(() => {
    let list = units
    if (onlyLinked) list = list.filter((u) => activeUnitIds.includes(u.id))
    if (order === 'similar') {
      const active = measures.order.map((i) => measures.unitIds[i])
      const rest = list.filter((u) => !active.includes(u.id))
      const byId = new Map(list.map((u) => [u.id, u]))
      list = [...active.map((id) => byId.get(id)).filter(Boolean) as Unit[], ...rest]
    } else if (order === 'links') {
      const total = (u: Unit) => objects.reduce((n, o) => n + (grid.linksBy.get(`${o.id}|${u.id}`)?.length ?? 0), 0)
      list = [...list].sort((a, b) => total(b) - total(a))
    }
    return list
  }, [units, onlyLinked, order, activeUnitIds, measures.order, measures.unitIds, objects, grid])

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? (links: CmpLink[]) => links.some((l) => {
        const r = recordsById.get(l.recordId)
        return !!r && (r.title.toLowerCase().includes(needle) || r.summary.toLowerCase().includes(needle) || (l.rationale ?? '').toLowerCase().includes(needle))
      })
    : undefined

  const matchingRecords = useMemo(() => {
    if (!needle) return 0
    return c.scopeRecords.filter((r) => r.title.toLowerCase().includes(needle) || r.summary.toLowerCase().includes(needle)).length
  }, [needle, c.scopeRecords])

  const exportCsv = () => {
    const lines = [['row', 'place', 'links', 'record_titles'].map(csvEscape).join(',')]
    for (const r of rows) for (const u of shownUnits) {
      const links = cellLinks(grid, r.key, u.id)
      lines.push([r.key.label, u.label, links.length, links.map((l) => recordsById.get(l.recordId)?.title ?? '').join(' | ')].map(csvEscape).join(','))
    }
    downloadText('coverage-map.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <div>
      <PageHeader icon={Grid3x3} title={t('coverageTitle')} help={t('coverageHelp')} />
      <ScopeBar />
      <ReliabilityNote />

      <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('coverageGroupBy')}</span>
          <div className="cmp-seg">
            {(['structure', 'band', 'concept', 'thread'] as const).map((g) => (
              <button key={g} type="button" className={groupBy === g ? 'on' : ''} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>{t(g === 'structure' ? 'groupStructure' : g === 'band' ? 'groupBand' : g === 'concept' ? 'groupConcept' : 'groupThread')}</button>
            ))}
          </div>
        </div>
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('coverageOrder')}</span>
          <div className="cmp-seg">
            {(['default', 'similar', 'links'] as const).map((o) => (
              <button key={o} type="button" className={order === o ? 'on' : ''} aria-pressed={order === o} onClick={() => setOrder(o)}>{t(o === 'default' ? 'orderDefault' : o === 'similar' ? 'orderSimilar' : 'orderLinks')}</button>
            ))}
          </div>
        </div>
        <label className="cmp-check cmp-scope-group"><input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} />{t('coverageOnlyLinked')}</label>
        <div className="cmp-scope-group" style={{ marginLeft: 'auto' }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('coverageSearch')} aria-label={t('coverageSearch')} style={{ minWidth: 200 }} />
          <button type="button" className="btn btn-mini" onClick={exportCsv}><Download size={11} />{t('downloadCsv')}</button>
        </div>
      </div>
      {needle && <p className="muted" style={{ margin: '0 0 8px' }}>{t('coverageSearchResult', { n: matchingRecords })}</p>}

      {rows.length === 0 ? <p className="muted">{t('emptyNoLinks')}</p> : shownUnits.length === 0 ? <p className="muted">{t('emptyNoRecords')}</p> : (
        <CoverageMatrix rows={rows} units={shownUnits} selected={selected} onSelect={setSelected} matches={matches} compact={shownUnits.length > 8} />
      )}

      <div className="cmp-legend">
        <span><span className="cmp-dot" style={{ background: 'color-mix(in srgb, var(--place-us) 60%, var(--surface-0))' }} />{t('legendCount')}</span>
        <span><span style={{ width: 14, height: 10, display: 'inline-block', border: '1px solid var(--border)', backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 3px, rgb(var(--warning-rgb) / 0.4) 3px 4px)' }} />{t('legendGap')}</span>
        <span>✓ {t('legendChecked')}</span>
        {['K-2', '3-5', '6-8', '9-12'].map((b) => <span key={b}><span className="cmp-band-chip" style={{ background: bandVar(b) }} />{b}</span>)}
      </div>

      <Explain what={t('coverageExplain')} how={t('coverageHow')} />

      {selected && <LinkDrawer dimKey={selected.row.key} unit={selected.unit} onClose={() => setSelected(null)} />}
    </div>
  )
}
