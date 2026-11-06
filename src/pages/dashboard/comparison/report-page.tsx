import { useMemo, useState } from 'react'
import { Check, Copy, Download, FileText } from 'lucide-react'
import { RECORD_TYPE_LABEL } from '@/lib/supabase/curriculum-repository'
import { recordUnitIds, yearOf, type CmpLink } from '@/lib/comparison'
import { useComparison } from './context'
import { FAMILY_KEY, LoadGate, PageHeader, ScopeBar, csvEscape, downloadText, formatNumber } from './ui'

// A written report of what the view currently shows, as Markdown (to read, paste
// or hand on) and as a table of every link (for a spreadsheet). Deterministic:
// the same selection always gives the same text. A keyword narrows the links.

export default function ReportPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, project, units, measures: m, links, objectsById, recordsById, level, countries, config } = c
  const [keyword, setKeyword] = useState('')
  const [copied, setCopied] = useState(false)
  const needle = keyword.trim().toLowerCase()
  const countrySet = useMemo(() => new Set(countries), [countries])
  const unitLabel = (id: string) => units.find((u) => u.id === id)?.label ?? id

  const rows = useMemo(() => {
    const out: { l: CmpLink; unitIds: string[] }[] = []
    for (const l of links) {
      const rec = recordsById.get(l.recordId)
      const obj = objectsById.get(l.objectId)
      if (!rec || !obj) continue
      if (needle && ![rec.title, rec.summary, l.rationale ?? '', obj.title].some((x) => x.toLowerCase().includes(needle))) continue
      out.push({ l, unitIds: recordUnitIds(rec, level, countrySet) })
    }
    return out.sort((a, b) => (objectsById.get(a.l.objectId)?.order ?? 0) - (objectsById.get(b.l.objectId)?.order ?? 0))
  }, [links, recordsById, objectsById, needle, level, countrySet])

  const markdown = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10)
    const L: string[] = []
    L.push(`# ${project.name}: ${config.regionLabel}`)
    L.push('')
    L.push(`${t('repGenerated', { date })} ${t('draftBadge')}.`)
    if (needle) L.push(`${t('repKeyword')}: "${keyword.trim()}"`)
    L.push('')
    L.push(`## ${t('repNumbers')}`)
    L.push(`- ${t('repLinks', { n: rows.length, total: links.length })}`)
    L.push(`- ${t('repPlaces', { n: m.unitIds.length })}`)
    if (c.proposedShare > 0) L.push(`- ${t('proposedNote', { p: Math.round(c.proposedShare * 100) })}`)
    L.push('')
    L.push(`## ${t('repPlacesTable')}`)
    L.push(`| ${t('places')} | ${t('links')} | ${t('msRowsCovered')} | ${t('msEvenness')} |`)
    L.push('|---|---:|---:|---:|')
    for (const s of m.units) L.push(`| ${unitLabel(s.unitId)} | ${s.n} | ${s.rowsCovered}/${s.rowsTotal} | ${s.evenness && s.n >= 6 ? formatNumber(s.evenness.value) : '–'} |`)
    const pairs = m.pairs.filter((p) => p.jsd !== null).sort((a, b) => (b.jsd ?? 0) - (a.jsd ?? 0)).slice(0, 8)
    if (pairs.length) {
      L.push('')
      L.push(`## ${t('repDifferences')}`)
      L.push(`| ${t('repPair')} | ${t('sbsDistance')} | ${t('repChance')} | p |`)
      L.push('|---|---:|---:|---:|')
      for (const p of pairs) L.push(`| ${unitLabel(p.a)} / ${unitLabel(p.b)} | ${formatNumber(Math.sqrt(p.jsd ?? 0))} | ${formatNumber(Math.sqrt(p.chance ?? 0))} | ${formatNumber(p.p)} |`)
      L.push('')
      L.push(t('relSmall', { n: m.nLinks, u: m.unitIds.length }))
    }
    L.push('')
    L.push(`## ${t('repLinksSection')}`)
    let lastObj = ''
    for (const { l, unitIds } of rows) {
      const obj = objectsById.get(l.objectId)!
      if (obj.id !== lastObj) { L.push(''); L.push(`### ${obj.title}${obj.gradeBand ? ` (${obj.gradeBand})` : ''}`); lastObj = obj.id }
      const rec = recordsById.get(l.recordId)!
      const y = yearOf(rec.date)
      L.push(`- **${rec.title}** (${unitIds.map(unitLabel).join(', ')}${y !== null ? `, ${Math.floor(y)}` : ''}; ${RECORD_TYPE_LABEL[rec.type as keyof typeof RECORD_TYPE_LABEL] ?? rec.type})${l.proposed ? ` [${t('issueProposed')}]` : ''}`)
      if (l.rationale) L.push(`  - ${l.rationale}`)
    }
    return L.join('\n')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, m, project.name, needle, keyword, t, links.length])

  const csv = () => {
    const head = ['part', 'grade_band', 'place', 'record', 'record_kind', 'record_year', 'relation', 'reason', 'ai_drafted']
    const lines = [head.join(',')]
    for (const { l, unitIds } of rows) {
      const rec = recordsById.get(l.recordId)!
      const obj = objectsById.get(l.objectId)!
      const y = yearOf(rec.date)
      lines.push([obj.title, obj.gradeBand ?? '', unitIds.map(unitLabel).join('; '), rec.title, t(FAMILY_KEY[rec.family]), y !== null ? Math.floor(y) : '', l.relationType, l.rationale ?? '', l.proposed ? 'yes' : 'no'].map(csvEscape).join(','))
    }
    downloadText(`${project.slug}-links.csv`, lines.join('\n'), 'text/csv;charset=utf-8')
  }
  const md = () => downloadText(`${project.slug}-comparison${needle ? `-${keyword.trim().replace(/\s+/g, '-')}` : ''}.md`, markdown, 'text/markdown;charset=utf-8')
  const copy = async () => {
    try { await navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the download is the fallback */ }
  }

  return (
    <div>
      <PageHeader icon={FileText} title={t('reportTitle')} help={t('reportHelp')} />
      <ScopeBar show={{ dim: false }} />
      <div className="cmp-panel">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t('repKeyword')}</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('repKeywordPlaceholder')} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-primary" onClick={md}><Download size={13} />{t('repDownloadMd')}</button>
          <button type="button" className="btn" onClick={csv}><Download size={13} />{t('downloadCsv')}</button>
          <button type="button" className="btn" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? t('copied') : t('copy')}</button>
        </div>
      </div>
      {needle && rows.length === 0 ? <p className="muted">{t('repNoMatches')}</p> : (
        <div className="cmp-panel">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, margin: 0, maxHeight: 560, overflowY: 'auto' }}>{markdown}</pre>
        </div>
      )}
    </div>
  )
}
