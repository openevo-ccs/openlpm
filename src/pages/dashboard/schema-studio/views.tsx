import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Info, Lightbulb, MessageSquarePlus } from 'lucide-react'
import { diffSnapshots, type Edge, type Finding, type SnapshotDiff } from '@/lib/schema-studio/model'
import type { Snapshot } from '@/lib/schema-studio/types'
import { useStudio } from './context'
import { Section, TargetChip, gvars, groupOfRepo } from './parts'

// ---------------------------------------------------------------------------------------------------------------------------------
// Connections: which repository points at which, and through which fields.
// ---------------------------------------------------------------------------------------------------------------------------------
export function ConnectionsView() {
  const { model, select, setQuery, setView } = useStudio()
  const [cell, setCell] = useState<{ a: string; b: string } | null>(null)
  const rows = model.repos.filter((r) => r.tier === 'base').map((r) => r.key)
  const cols = [...rows, 'humanbase']
  const max = Math.max(1, ...[...model.matrix.values()].flatMap((r) => [...r.values()].map((e) => e.length)))
  const nm = (k: string) => (k === 'humanbase' ? 'HumanBase (retired)' : model.repoByKey.get(k)?.name ?? k)
  const edges: Edge[] = cell ? model.matrix.get(cell.a)?.get(cell.b) ?? [] : []
  const ranked = useMemo(() => [...model.types].map((t) => ({ t, n: t.out.filter((e) => e.kind !== 'intra').length + t.in.filter((e) => e.from.repo !== t.repo.key).length, out: t.out.filter((e) => e.kind !== 'intra').length, inn: t.in.filter((e) => e.from.repo !== t.repo.key).length })).sort((a, b) => b.n - a.n).slice(0, 12), [model])
  const inbound = (k: string) => [...model.matrix.values()].reduce((s, row) => s + (row.get(k)?.length ?? 0), 0)

  return (
    <div className="ss-conns">
      <p className="ss-lead">Each number counts the fields in the <b>row</b> repository that hold ids from the <b>column</b> repository. Read a row as "this repository points at...". Click a number to see the fields.</p>
      <div className="ss-matrix-scroll">
        <table className="ss-matrix">
          <thead><tr><th />{cols.map((c) => <th key={c} style={gvars(groupOfRepo(model, c))}><span>{nm(c)}</span></th>)}<th className="tot">points at others</th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const row = model.matrix.get(a)
              const total = [...(row?.values() ?? [])].reduce((s, e) => s + e.length, 0)
              return (
                <tr key={a}>
                  <th style={gvars(groupOfRepo(model, a))}><button type="button" onClick={() => select({ kind: 'repo', repo: a })}>{nm(a)}</button></th>
                  {cols.map((b) => {
                    const n = row?.get(b)?.length ?? 0
                    const on = cell?.a === a && cell?.b === b
                    return <td key={b} className={a === b ? 'self' : ''}>{a === b ? <span className="ss-dim">·</span> : n ? <button type="button" className={`ss-mcell${on ? ' on' : ''}`} style={{ ...gvars(groupOfRepo(model, b)), ['--i' as string]: String(0.18 + (0.8 * n) / max) }} onClick={() => setCell({ a, b })}>{n}</button> : <span className="ss-dim">·</span>}</td>
                  })}
                  <td className="tot">{total}</td>
                </tr>
              )
            })}
            <tr className="foot"><th>pointed at by others</th>{cols.map((b) => <td key={b} className="tot">{inbound(b) || '·'}</td>)}<td /></tr>
          </tbody>
        </table>
      </div>
      {cell && (
        <Section title={`${nm(cell.a)} → ${nm(cell.b)}`} aside={<button type="button" className="ss-link-btn" onClick={() => { setQuery(`repo:${cell.a} links:${cell.b === 'humanbase' ? 'person' : cell.b}`); setView('explore') }}>Open as a table</button>}>
          <ul className="ss-edgelist">
            {edges.map((e, i) => {
              const f = model.fieldById.get(`${e.from.type}#${e.from.field}`)
              const t = model.typeById.get(e.from.type)
              const to = e.to.type ? model.typeById.get(e.to.type) : null
              return (
                <li key={i}>
                  <button type="button" onClick={() => f && select({ kind: 'field', fieldId: f.id })}><b>{t?.title}</b> <code>{e.from.field}</code></button>
                  <ArrowRight size={13} /><span>{to ? <button type="button" onClick={() => select({ kind: 'type', typeId: to.id })}>{to.title}</button> : `any ${nm(cell.b)} record`}</span>
                  {e.required && <span className="ss-pill warn" title="Required: every record must give this link">required</span>}
                  {e.legacy && <span className="ss-pill" title="Older id style">older id style</span>}
                </li>
              )
            })}
          </ul>
        </Section>
      )}
      <Section title="Most connected record types">
        <ul className="ss-rank">
          {ranked.map(({ t, n, out, inn }) => (
            <li key={t.id}>
              <button type="button" onClick={() => select({ kind: 'type', typeId: t.id })}>
                <span className="ss-rank-name" style={gvars(groupOfRepo(model, t.repo.key))}>{t.title} <i>{t.repo.name}</i></span>
                <span className="ss-rank-bar"><i style={{ width: `${(100 * n) / Math.max(1, ranked[0].n)}%`, background: 'var(--g-mid)', ...gvars(groupOfRepo(model, t.repo.key)) }} /></span>
                <span className="ss-rank-n">{out} out · {inn} in</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fixed values: every list of allowed answers, grouped by field name.
// ---------------------------------------------------------------------------------------------------------------------------------
export function ValuesView() {
  const { model, parsed, select } = useStudio()
  const [onlyDiffs, setOnlyDiffs] = useState(false)
  const groups = model.vocab.filter((g) => (!onlyDiffs || g.lists.length > 1) && (parsed.empty || g.fieldName.toLowerCase().includes(parsed.words.join(' ')) || g.lists.some((l) => l.values.some((v) => parsed.words.every((w) => v.toLowerCase().includes(w))))))
  return (
    <div className="ss-values">
      <p className="ss-lead">A <b>fixed list of values</b> is a field that only accepts certain answers. Here every list is grouped by the field name. When one name has several lists, the same word may mean different things in different places.</p>
      <label className={`ss-toggle${onlyDiffs ? ' on' : ''}`}><input type="checkbox" checked={onlyDiffs} onChange={() => setOnlyDiffs((v) => !v)} />Only names with more than one list</label>
      {groups.map((g) => (
        <section key={g.fieldKey} className="ss-vgroup">
          <h4><code>{g.fieldName}</code> <span className="ss-dim">{g.lists.length} list{g.lists.length > 1 ? 's' : ''}, used {g.lists.reduce((a, l) => a + l.uses.length, 0)} times</span>{g.lists.length > 1 && <span className="ss-pill warn">lists differ</span>}</h4>
          {g.lists.map((l, i) => (
            <div key={i} className="ss-vlist">
              <div className="ss-vvals">{l.values.map((v) => <span key={v} className="ss-val">{v}</span>)}</div>
              <div className="ss-vuses">{l.uses.slice(0, 14).map((u) => { const f = model.fieldById.get(`${u.type}#${u.field}`); const t = model.typeById.get(u.type); return <button key={`${u.type}${u.field}`} type="button" className="ss-use" style={gvars(groupOfRepo(model, u.repo))} onClick={() => f && select({ kind: 'field', fieldId: f.id })}>{t?.title}{u.field !== g.fieldName ? `.${u.field}` : ''}</button> })}{l.uses.length > 14 && <span className="ss-dim">+{l.uses.length - 14} more</span>}</div>
            </div>
          ))}
        </section>
      ))}
      {!groups.length && <p className="ss-empty">No fixed-value field matches.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Health: findings from rules over the whole structure.
// ---------------------------------------------------------------------------------------------------------------------------------
const SEV = { attention: { label: 'Needs attention', icon: AlertTriangle }, consider: { label: 'Worth a look', icon: Lightbulb }, info: { label: 'For information', icon: Info } } as const

export function HealthView() {
  const { model, parsed, select, openFinding } = useStudio()
  const [sev, setSev] = useState<Set<string>>(new Set(['attention', 'consider']))
  const [cat, setCat] = useState<string>('all')
  const cats = [...new Set(model.findings.map((f) => f.category))]
  const list = model.findings.filter((f) => sev.has(f.severity) && (cat === 'all' || f.category === cat) && (parsed.empty || [f.title, f.plain, f.category].join(' ').toLowerCase().includes(parsed.words.join(' '))))
  const counts = { attention: 0, consider: 0, info: 0 }
  for (const f of model.findings) counts[f.severity]++
  return (
    <div className="ss-health">
      <p className="ss-lead">These checks run over the whole structure each time the snapshot changes. They point at places worth a second look and never decide anything: a finding may be intended. Use <b>Suggest a change</b> to start a conversation about one.</p>
      <div className="ss-filters">
        {(['attention', 'consider', 'info'] as const).map((k) => <label key={k} className={`ss-toggle${sev.has(k) ? ' on' : ''} sev-${k}`}><input type="checkbox" checked={sev.has(k)} onChange={() => setSev((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })} />{SEV[k].label} ({counts[k]})</label>)}
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <ul className="ss-findings">
        {list.map((f) => {
          const Icon = SEV[f.severity].icon
          return (
            <li key={f.id} className={`sev-${f.severity}`}>
              <div className="ss-find-head"><Icon size={15} /><strong>{f.title}</strong><span className="ss-pill">{f.category}</span></div>
              <p>{f.plain}</p>
              <p className="ss-find-why"><b>Why it matters.</b> {f.why} <b>What could be done.</b> {f.action}</p>
              <div className="ss-find-foot">
                {f.repos.slice(0, 8).map((r) => <TargetChip key={r} model={model} repo={r} onClick={() => select({ kind: 'repo', repo: r })} />)}
                {f.targets.slice(0, 3).map((t, i) => t.type ? <button key={i} type="button" className="ss-link-btn" onClick={() => select(t.field && model.fieldById.has(`${t.type}#${t.field}`) ? { kind: 'field', fieldId: `${t.type}#${t.field}` } : { kind: 'type', typeId: t.type! })}>{model.typeById.get(t.type)?.title}{t.field ? ` ▸ ${t.field}` : ''}</button> : null)}
                {f.targets.length > 3 && <span className="ss-dim">+{f.targets.length - 3} more places</span>}
                <span className="ss-spacer" />
                <button type="button" className="btn btn-mini" onClick={() => { openFinding(f); }}><MessageSquarePlus size={13} /> Suggest a change</button>
              </div>
            </li>
          )
        })}
        {!list.length && <li className="ss-empty">Nothing to show with these filters.</li>}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Changes: what moved between two snapshots.
// ---------------------------------------------------------------------------------------------------------------------------------
export function ChangesView({ loadOther }: { loadOther: (id: number) => Promise<Snapshot | null> }) {
  const { model, history, select } = useStudio()
  const [pick, setPick] = useState<number | null>(null)
  const [other, setOther] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (pick === null && history.length > 1) setPick(history[1].id ?? null) }, [history, pick])
  useEffect(() => {
    if (pick === null) return
    let live = true; setBusy(true)
    loadOther(pick).then((s) => { if (live) { setOther(s); setBusy(false) } })
    return () => { live = false }
  }, [pick, loadOther])
  const diff: SnapshotDiff[] = other ? diffSnapshots(other, model.snap) : []
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div className="ss-changes">
      <p className="ss-lead">The Studio keeps a short history of the structure. Pick an earlier snapshot to see which record types and fields have been added, removed or changed since then.</p>
      {history.length < 2 ? <p className="ss-empty">Only one snapshot exists so far. Changes will appear here after the next schema change is picked up.</p> : (
        <>
          <label className="ss-inline">Compare the latest snapshot with{' '}
            <select value={pick ?? ''} onChange={(e) => setPick(Number(e.target.value))}>{history.slice(1).map((h) => <option key={h.id ?? 0} value={h.id ?? 0}>{when(h.generatedAt)}</option>)}</select>
          </label>
          {busy && <p className="ss-hint">Loading...</p>}
          {!busy && other && !diff.length && <p className="ss-empty">No difference between these two snapshots.</p>}
          {diff.map((d) => (
            <section key={d.repo} className="ss-diff" style={gvars(groupOfRepo(model, d.repo))}>
              <h4>{model.repoByKey.get(d.repo)?.name ?? d.repo}</h4>
              {d.addedTypes.map((t) => <div key={t} className="add"><b>+ new record type</b> <code>{t}</code></div>)}
              {d.removedTypes.map((t) => <div key={t} className="rem"><b>− record type removed</b> <code>{t}</code></div>)}
              {d.fields.map((f) => (
                <div key={f.type} className="chg"><button type="button" className="ss-link-btn" onClick={() => { const id = `${d.repo}/${f.type}`; if (model.typeById.has(id)) select({ kind: 'type', typeId: id }) }}>{f.type}</button>
                  {f.added.map((x) => <span key={x} className="add"><b>+</b> {x}</span>)}{f.removed.map((x) => <span key={x} className="rem"><b>−</b> {x}</span>)}{f.changed.map((x) => <span key={x} className="mod"><b>~</b> {x}</span>)}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}
