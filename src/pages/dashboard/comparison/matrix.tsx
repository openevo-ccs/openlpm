import { useMemo } from 'react'
import { cellLinks, countryName, heatFill, placeVar, bandVar, unitHex, type CmpLink, type DimKey, type Unit } from '@/lib/comparison'
import { useComparison } from './context'

export interface MatrixRow {
  key: DimKey
  /** 0 = a group header (a strand, a band, a concept), 1 = an item under it. */
  depth: 0 | 1
  /** Grade band of an item row, for the colored marker. */
  band?: string | null
  /** Group headers show rolled-up totals. */
  header?: boolean
  /** Extra id so one item can appear under several groups. */
  uid: string
}

export interface CellRef { row: MatrixRow; unit: Unit }

/**
 * The coverage heat map: one row per part of the progression, one column per
 * place, a number in each cell for how many links tie that part to records of
 * that place. Hatched cells mark a gap: the place has records, other places
 * have links for this row, this place has none.
 */
export function CoverageMatrix({ rows, units, selected, onSelect, matches, compact = false, showTotals = true }: {
  rows: MatrixRow[]
  units: Unit[]
  selected?: CellRef | null
  onSelect?: (ref: CellRef) => void
  /** When set, cells whose records match are outlined and the rest fade. */
  matches?: (links: CmpLink[]) => boolean
  compact?: boolean
  showTotals?: boolean
}) {
  const { grid, t, lang, checkedKeys, scopeRecordCountByUnit } = useMatrixContext()
  const data = useMemo(() => {
    const cells = rows.map((r) => units.map((u) => cellLinks(grid, r.key, u.id)))
    const max = Math.max(1, ...cells.flat().map((l) => l.length))
    const colTotals = units.map((_, j) => new Set(cells.flatMap((rowCells) => rowCells[j].map((l) => l.id))).size)
    const rowHasLinksElsewhere = cells.map((rowCells) => rowCells.filter((l) => l.length > 0).length)
    return { cells, max, colTotals, rowHasLinksElsewhere }
  }, [rows, units, grid])

  const countryGroups: { code: string; span: number }[] = []
  for (const u of units) {
    const last = countryGroups[countryGroups.length - 1]
    if (last && last.code === u.country) last.span++
    else countryGroups.push({ code: u.country, span: 1 })
  }
  const anyMatch = !!matches

  return (
    <div className="cmp-matrix-wrap">
      <table className="cmp-matrix">
        <thead>
          {countryGroups.length > 1 && (
            <tr>
              <th className="rowhead" />
              {countryGroups.map((g, i) => (
                <th key={i} colSpan={g.span} className="countryhead" style={{ background: placeVar(g.code) }}>{countryName(g.code, lang)}</th>
              ))}
            </tr>
          )}
          <tr>
            <th className="rowhead" />
            {units.map((u) => (
              <th key={u.id} className="colhead" title={`${u.label} · ${scopeRecordCountByUnit.get(u.id) ?? 0} ${t('records')}`}>
                <span className="vlabel" style={{ color: `color-mix(in srgb, ${unitHex(u, units)} 55%, var(--text-primary))` }}>{u.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.uid} className={r.header ? 'strandrow' : ''}>
              <th className="rowhead" scope="row" style={{ paddingLeft: r.depth === 1 ? 22 : 10 }}>
                {r.depth === 1 && <span className="cmp-band-chip" style={{ background: bandVar(r.band ?? null) }} title={r.band ?? ''} />}
                {r.key.label}
              </th>
              {units.map((u, j) => {
                const links = data.cells[i][j]
                const n = links.length
                const isSel = selected?.row.uid === r.uid && selected.unit.id === u.id
                const gap = n === 0 && !r.header && (scopeRecordCountByUnit.get(u.id) ?? 0) > 0 && data.rowHasLinksElsewhere[i] > 0 && !checkedKeys.has(`${r.key.id}|${u.id}`)
                const hit = anyMatch && n > 0 && matches!(links)
                const dim = anyMatch && !hit
                return (
                  <td key={u.id}>
                    <button
                      type="button"
                      className={`cmp-cell${n === 0 ? ' zero' : ''}${isSel ? ' sel' : ''}${gap ? ' gap' : ''}${hit ? ' hit' : ''}${dim ? ' dim' : ''}`}
                      style={{ background: n > 0 ? heatFill(n, data.max, placeVar(u.country)) : undefined }}
                      title={`${r.key.label} · ${u.label}: ${n} ${t('links')}${gap ? ` · ${t('matrixGap')}` : ''}`}
                      onClick={() => onSelect?.({ row: r, unit: u })}
                    >
                      {n > 0 ? n : checkedKeys.has(`${r.key.id}|${u.id}`) ? '✓' : '·'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {showTotals && (
          <tfoot>
            <tr>
              <th className="rowhead" scope="row">{t('matrixTotal')}</th>
              {units.map((u, j) => <td key={u.id} style={{ fontSize: 12, padding: '4px 0' }}>{data.colTotals[j]}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// Small adapter so the matrix reads what it needs without every caller passing it down.
function useMatrixContext() {
  const c = useComparison()
  const checkedKeys = c.source?.checkedNoMatch ?? EMPTY_SET
  return { grid: c.grid, t: c.t, lang: c.lang, checkedKeys, scopeRecordCountByUnit: c.recordCountByUnit }
}
const EMPTY_SET = new Set<string>()
