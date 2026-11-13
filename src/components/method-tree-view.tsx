import { rowLabel, type SnapshotRow } from '@/lib/supabase/base-repo-explorer'
import { methodClassesReading } from '@/lib/method-text'

// The Hierarchy view of the MethodsBase tab (Dustin, 2026-11-13: "the method space needs hierarchical modeling"). Methods are listed from general
// to specific by their `broaderMethods` links, for example models as a teaching method, then computer simulation, then agent-based modeling.
// A method can sit under more than one broader method; it then shows under each of them. Methods that are not placed yet are listed
// separately, so the view says honestly how much of the collection is in the hierarchy so far.

interface TreeNode {
  repoKey: string
  row: SnapshotRow
}

const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })

export function MethodTreeView<N extends TreeNode>({ rows, onSelect, lang }: { rows: N[]; onSelect: (n: N) => void; lang: string }) {
  const methods = rows.filter((n) => n.repoKey === 'methodsbase')
  const byId = new Map(methods.map((n) => [n.row.id, n]))
  const label = (n: N) => rowLabel(n.row, lang)
  const parentsOf = (n: N): string[] => {
    const raw = (n.row.data as any)?.broaderMethods
    return Array.isArray(raw) ? (raw as unknown[]).map(String).filter((id) => byId.has(id) && id !== n.row.id) : []
  }
  const children = new Map<string, N[]>()
  for (const n of methods) for (const p of parentsOf(n)) children.set(p, [...(children.get(p) ?? []), n])
  for (const list of children.values()) list.sort((a, b) => compare(label(a), label(b)))

  const roots = methods.filter((n) => parentsOf(n).length === 0)
  const placedRoots = roots.filter((n) => children.has(n.row.id)).sort((a, b) => compare(label(a), label(b)))
  const notPlaced = roots.filter((n) => !children.has(n.row.id)).sort((a, b) => compare(label(a), label(b)))
  const placedCount = methods.length - notPlaced.length

  const line = (n: N) => {
    const classes = methodClassesReading((n.row.data as any)?.methodClass, lang)
    const kids = children.get(n.row.id)?.length ?? 0
    return (
      <>
        <button type="button" className="btn-linklike" style={{ fontSize: 13, fontWeight: kids > 0 ? 600 : 400 }} onClick={() => onSelect(n)}>{label(n)}</button>
        {classes && <span className="chip muted" style={{ fontSize: 10, marginLeft: 6 }}>{classes}</span>}
        {kids > 0 && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{kids} more specific</span>}
      </>
    )
  }

  const node = (n: N, path: string[]): JSX.Element => {
    const kids = (children.get(n.row.id) ?? []).filter((k) => !path.includes(k.row.id))
    if (kids.length === 0) return <li key={n.row.id} style={{ margin: '4px 0' }}>{line(n)}</li>
    return (
      <li key={n.row.id} style={{ margin: '4px 0' }}>
        <details open>
          <summary style={{ cursor: 'pointer' }}>{line(n)}</summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 22, listStyle: 'none', borderLeft: '1px solid var(--border)' }}>
            {kids.map((k) => node(k, [...path, n.row.id]))}
          </ul>
        </details>
      </li>
    )
  }

  return (
    <div data-testid="method-tree">
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        {placedCount} of {methods.length} methods are placed in the hierarchy so far. A method sits under the more general method it is a special case of.
        Open a method and press Edit to choose its more general method.
      </p>
      {placedRoots.length === 0 ? (
        <p className="muted">No method names a more general method yet.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{placedRoots.map((n) => node(n, []))}</ul>
      )}
      <details style={{ marginTop: 14 }}>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Not placed yet ({notPlaced.length})</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 0, listStyle: 'none', columns: '260px 3', columnGap: 18 }}>
          {notPlaced.map((n) => <li key={n.row.id} style={{ margin: '2px 0', breakInside: 'avoid' }}>{line(n)}</li>)}
        </ul>
      </details>
    </div>
  )
}
