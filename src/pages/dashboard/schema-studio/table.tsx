import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download } from 'lucide-react'

export interface Col<T> {
  id: string
  header: string
  get: (row: T) => string | number
  render?: (row: T) => ReactNode
  /** First click sorts this way. Numbers usually start high-to-low. */
  firstDir?: 'asc' | 'desc'
  hidden?: boolean
  width?: string
  title?: string
}

export interface SortKey { id: string; dir: 'asc' | 'desc' }

export function useSort(initial: SortKey[]) {
  const [sort, setSort] = useState<SortKey[]>(initial)
  const click = (id: string, firstDir: 'asc' | 'desc', additive: boolean) => setSort((cur) => {
    const i = cur.findIndex((s) => s.id === id)
    if (i >= 0) {
      const flipped = { id, dir: cur[i].dir === 'asc' ? 'desc' : 'asc' } as SortKey
      return additive ? cur.map((s, j) => (j === i ? flipped : s)) : [flipped]
    }
    const next = { id, dir: firstDir } as SortKey
    return additive ? [...cur, next] : [next]
  })
  return { sort, click, setSort }
}

export function sortRows<T>(rows: T[], cols: Col<T>[], sort: SortKey[]): T[] {
  const by = new Map(cols.map((c) => [c.id, c]))
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const c = by.get(s.id); if (!c) continue
      const x = c.get(a), y = c.get(b)
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })
      if (cmp) return s.dir === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

export function toCsv<T>(rows: T[], cols: Col<T>[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return [cols.map((c) => esc(c.header)).join(','), ...rows.map((r) => cols.map((c) => esc(c.get(r))).join(','))].join('\n')
}

export function downloadText(name: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export function DataTable<T>({ rows, cols, sort, onSort, rowKey, onRow, selectedKey, csvName, extraHead, empty }: {
  rows: T[]; cols: Col<T>[]; sort: SortKey[]; onSort: (id: string, firstDir: 'asc' | 'desc', additive: boolean) => void
  rowKey: (r: T) => string; onRow?: (r: T) => void; selectedKey?: string | null; csvName: string; extraHead?: ReactNode; empty?: string
}) {
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(cols.filter((c) => c.hidden).map((c) => c.id)))
  const [picker, setPicker] = useState(false)
  const visible = useMemo(() => cols.filter((c) => !hiddenCols.has(c.id)), [cols, hiddenCols])
  const sorted = useMemo(() => sortRows(rows, cols, sort), [rows, cols, sort])
  const shown = sorted.slice(0, 600)
  return (
    <div className="ss-table-wrap">
      <div className="ss-table-tools">
        <span className="ss-count"><b>{rows.length.toLocaleString()}</b> row{rows.length === 1 ? '' : 's'}{rows.length > shown.length ? ` (first ${shown.length} shown)` : ''}</span>
        {sort.length > 0 && <span className="ss-hint">Sorted by {sort.map((s) => `${cols.find((c) => c.id === s.id)?.header ?? s.id} ${s.dir === 'asc' ? '↑' : '↓'}`).join(', then ')}. Shift-click a heading to add a second sort.</span>}
        <span className="ss-spacer" />
        {extraHead}
        <div className="ss-popwrap">
          <button type="button" className="btn btn-mini" onClick={() => setPicker((v) => !v)}><Columns3 size={13} /> Columns</button>
          {picker && (
            <div className="ss-pop" role="menu">
              {cols.map((c) => (
                <label key={c.id} className="ss-check"><input type="checkbox" checked={!hiddenCols.has(c.id)} onChange={() => setHiddenCols((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} /> {c.header}</label>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-mini" onClick={() => downloadText(csvName, toCsv(sorted, visible))}><Download size={13} /> CSV</button>
      </div>
      <div className="ss-table-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              {visible.map((c) => {
                const s = sort.find((x) => x.id === c.id)
                return (
                  <th key={c.id} style={{ width: c.width }} title={c.title} aria-sort={s ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={(e) => onSort(c.id, c.firstDir ?? 'asc', e.shiftKey)}>
                      {c.header}{s ? (s.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="idle" />}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const k = rowKey(r)
              return (
                <tr key={k} className={selectedKey === k ? 'sel' : ''} onClick={() => onRow?.(r)}>
                  {visible.map((c) => <td key={c.id}>{c.render ? c.render(r) : String(c.get(r))}</td>)}
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={visible.length} className="ss-empty">{empty ?? 'Nothing matches.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
