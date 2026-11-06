import { bandRank, dimensionKeys, type CmpObject } from '@/lib/comparison'
import type { ComparisonState } from './context'
import type { MatrixRow } from './matrix'

export type GroupBy = 'structure' | 'band' | 'concept' | 'thread'

const byBandThenOrder = (a: CmpObject, b: CmpObject) => bandRank(a.gradeBand) - bandRank(b.gradeBand) || a.order - b.order

function itemRow(o: CmpObject, groupId: string): MatrixRow {
  return { uid: `${groupId}:${o.id}`, depth: 1, band: o.gradeBand, key: { id: o.id, label: o.title, objectIds: [o.id] } }
}

/** Rows of the coverage map: a group header with rolled-up totals, then the items that belong to it. */
export function buildRows(c: Pick<ComparisonState, 'objects' | 'objectsById' | 'concepts' | 'topConceptOf' | 'topConcepts' | 'source'>, groupBy: GroupBy): MatrixRow[] {
  const { objects } = c
  const rows: MatrixRow[] = []
  if (groupBy === 'structure') {
    for (const k of dimensionKeys(objects, 'strand')) {
      rows.push({ uid: `g:${k.id}`, depth: 0, header: true, key: k })
      const members = k.objectIds.map((id) => c.objectsById.get(id)!).filter((o) => o.id !== k.id).sort(byBandThenOrder)
      for (const o of members) rows.push(itemRow(o, k.id))
    }
    return rows
  }
  if (groupBy === 'band') {
    for (const k of dimensionKeys(objects, 'band')) {
      rows.push({ uid: `g:${k.id}`, depth: 0, header: true, key: k })
      for (const id of k.objectIds) rows.push(itemRow(c.objectsById.get(id)!, k.id))
    }
    return rows
  }
  if (groupBy === 'concept') {
    for (const top of c.topConcepts) {
      const members = objects.filter((o) => o.conceptIds.some((cid) => c.topConceptOf.get(cid) === top.id)).sort(byBandThenOrder)
      if (members.length === 0) continue
      rows.push({ uid: `g:${top.id}`, depth: 0, header: true, key: { id: top.id, label: top.label, objectIds: members.map((o) => o.id) } })
      for (const o of members) rows.push(itemRow(o, top.id))
    }
    return rows
  }
  for (const th of c.source?.threads ?? []) {
    const members = Array.from(new Set(th.objectIds)).map((id) => c.objectsById.get(id)).filter(Boolean) as CmpObject[]
    if (members.length === 0) continue
    rows.push({ uid: `g:${th.id}`, depth: 0, header: true, key: { id: th.id, label: th.title, objectIds: members.map((o) => o.id) } })
    for (const o of members) rows.push(itemRow(o, th.id))
  }
  return rows
}
