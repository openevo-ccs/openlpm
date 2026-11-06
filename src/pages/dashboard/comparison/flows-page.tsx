import { useMemo, useState } from 'react'
import { Download, Waypoints } from 'lucide-react'
import { RECORD_FAMILIES, bandHex, bandRank, cssVar, conceptHex, unitHex } from '@/lib/comparison'
import { useComparison } from './context'
import { Sankey, type SankeyLink, type SankeyNode } from './sankey'
import { Explain, FAMILY_KEY, LoadGate, PageHeader, ReliabilityNote, ScopeBar, csvEscape, downloadText } from './ui'

type From = 'strand' | 'band' | 'concept'

export default function FlowsPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, objects, objectsById, links, units, recordsById, topConcepts, topConceptOf, level, countries } = c
  const [from, setFrom] = useState<From>('strand')
  const [reverse, setReverse] = useState(false)

  const model = useMemo(() => {
    const countrySet = new Set(countries)
    const unitById = new Map(units.map((u) => [u.id, u]))
    // Left-hand groups for each part of the progression.
    const groupsOf = (oid: string): { id: string; label: string; color: string; order: number }[] => {
      const o = objectsById.get(oid)
      if (!o) return []
      if (from === 'band') return [{ id: `b:${o.gradeBand ?? 'n/a'}`, label: o.gradeBand ?? 'n/a', color: bandHex(o.gradeBand), order: bandRank(o.gradeBand) }]
      if (from === 'concept') {
        const tops = Array.from(new Set(o.conceptIds.map((cid) => topConceptOf.get(cid)).filter(Boolean) as string[]))
        return tops.map((tid) => {
          const idx = topConcepts.findIndex((x) => x.id === tid)
          return { id: `c:${tid}`, label: topConcepts[idx]?.label ?? tid, color: conceptHex(Math.max(0, idx)), order: idx }
        })
      }
      let cur = o
      const guard = new Set<string>()
      while (cur.parentId && objectsById.has(cur.parentId) && !guard.has(cur.id)) { guard.add(cur.id); cur = objectsById.get(cur.parentId)! }
      return [{ id: `s:${cur.id}`, label: cur.title, color: cssVar('--series-a', '#0f8a7a'), order: cur.order }]
    }
    const ribbon = new Map<string, number>()
    const nodes = new Map<string, SankeyNode>()
    const addNode = (n: SankeyNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n) }
    const add = (a: string, b: string, v: number) => { const k = `${a}\u0000${b}`; ribbon.set(k, (ribbon.get(k) ?? 0) + v) }
    let paths = 0
    for (const l of links) {
      const rec = recordsById.get(l.recordId)
      if (!rec) continue
      const uids = new Set<string>()
      for (const j of rec.jurisdictions) {
        const cc = j.split('-')[0]
        if (!countrySet.has(cc)) continue
        uids.add(level === 'country' ? cc : j)
      }
      const groups = groupsOf(l.objectId)
      for (const g of groups) {
        addNode({ id: g.id, label: g.label, column: 0, color: g.color, order: g.order })
        const share = 1 / Math.max(1, groups.length)
        for (const uid of uids) {
          const u = unitById.get(uid)
          if (!u) continue
          const fam = rec.family
          const famId = `f:${fam}`
          addNode({ id: famId, label: t(FAMILY_KEY[fam]), column: 1, color: cssVar('--place-other', '#6f7d8c'), order: RECORD_FAMILIES.indexOf(fam) })
          addNode({ id: `u:${uid}`, label: u.label, column: 2, color: unitHex(u, units), order: units.indexOf(u) })
          add(g.id, famId, share)
          add(famId, `u:${uid}`, share)
          paths += share
        }
      }
    }
    const sLinks: SankeyLink[] = []
    for (const [k, v] of ribbon) {
      const [a, b] = k.split('\u0000')
      const target = nodes.get(b)
      sLinks.push({ source: a, target: b, value: v, color: a.startsWith('f:') ? target?.color : undefined })
    }
    return { nodes: Array.from(nodes.values()), links: sLinks, paths }
  }, [links, from, objectsById, recordsById, units, topConcepts, topConceptOf, level, countries, t])

  const shown = useMemo(() => {
    if (!reverse) return { nodes: model.nodes, links: model.links, labels: [t(from === 'strand' ? 'dimStrand' : from === 'band' ? 'dimBand' : 'groupConcept'), t('flowsKinds'), t('flowsPlaces')] }
    return {
      nodes: model.nodes.map((n) => ({ ...n, column: 2 - n.column })),
      links: model.links.map((l) => ({ ...l, source: l.target, target: l.source })),
      labels: [t('flowsPlaces'), t('flowsKinds'), t(from === 'strand' ? 'dimStrand' : from === 'band' ? 'dimBand' : 'groupConcept')],
    }
  }, [model, reverse, from, t])

  const exportCsv = () => {
    const nodeLabel = new Map(model.nodes.map((n) => [n.id, n.label]))
    const lines = [['from', 'to', 'links'].map(csvEscape).join(',')]
    for (const l of model.links) lines.push([nodeLabel.get(l.source), nodeLabel.get(l.target), Math.round(l.value * 100) / 100].map(csvEscape).join(','))
    downloadText('flows.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <div>
      <PageHeader icon={Waypoints} title={t('flowsTitle')} help={t('flowsHelp')} />
      <ScopeBar />
      <ReliabilityNote />
      <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('flowsStart')}</span>
          <div className="cmp-seg">
            {(['strand', 'band', 'concept'] as const).map((f) => (
              <button key={f} type="button" className={from === f ? 'on' : ''} aria-pressed={from === f} onClick={() => setFrom(f)}>{t(f === 'strand' ? 'dimStrand' : f === 'band' ? 'dimBand' : 'groupConcept')}</button>
            ))}
          </div>
        </div>
        <label className="cmp-check cmp-scope-group"><input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />{t('flowsReverse')}</label>
        <button type="button" className="btn btn-mini" style={{ marginLeft: 'auto' }} onClick={exportCsv}><Download size={11} />{t('downloadCsv')}</button>
      </div>
      <div className="cmp-panel">
        <Sankey nodes={shown.nodes} links={shown.links} columnLabels={shown.labels} emptyLabel={t('emptyNoLinks')} unit={` ${t('links')}`} />
      </div>
      <Explain what={t('flowsExplain')} how={t('flowsHow')} />
    </div>
  )
}

