import { useMemo, useState } from 'react'
import { GitCompare } from 'lucide-react'
import { GROUPS, fieldMatches, typeMatches, type FlatField, type TypeNode } from '@/lib/schema-studio/model'
import { REPO_MEANING, explainField, explainType, friendlyType } from '@/lib/schema-studio/meanings'
import type { RepoDef } from '@/lib/schema-studio/types'
import { agoText, useStudio } from './context'
import { Hi, TargetChip, gvars, groupOfRepo } from './parts'
import { DataTable, useSort, type Col } from './table'

type Sub = 'fields' | 'types' | 'repos'

export default function ExploreView() {
  const { model, parsed, select, selection, openSuggest, now } = useStudio()
  const [sub, setSub] = useState<Sub>('fields')
  const [repoFilter, setRepoFilter] = useState<Set<string>>(new Set())
  const [only, setOnly] = useState<{ required: boolean; link: boolean; values: boolean; undocumented: boolean; list: boolean }>({ required: false, link: false, values: false, undocumented: false, list: false })
  const [nested, setNested] = useState(false)
  const [showExt, setShowExt] = useState(false)
  const [compare, setCompare] = useState<string[]>([])
  const fieldSort = useSort([{ id: 'repo', dir: 'asc' }, { id: 'type', dir: 'asc' }])
  const typeSort = useSort([{ id: 'repo', dir: 'asc' }, { id: 'fields', dir: 'desc' }])
  const repoSort = useSort([{ id: 'name', dir: 'asc' }])
  const words = parsed.words

  const toggleRepo = (k: string) => setRepoFilter((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const repoOk = (k: string) => (repoFilter.size ? repoFilter.has(k) : showExt || model.repoByKey.get(k)?.tier !== 'extension')

  const fieldRows = useMemo(() => model.fields.filter((f) =>
    (nested || f.depth === 0) && repoOk(f.repo) && fieldMatches(f, parsed, model) &&
    (!only.required || f.field.required) && (!only.link || f.links.length) && (!only.values || f.field.enum?.length) && (!only.undocumented || !f.field.description) && (!only.list || f.field.list)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [model, parsed, repoFilter, only, nested, showExt])
  const typeRows = useMemo(() => model.types.filter((t) => repoOk(t.repo.key) && typeMatches(t, parsed, model)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [model, parsed, repoFilter, showExt])
  const repoRows = useMemo(() => model.repos.filter((r) => repoOk(r.key) && (parsed.empty || r.name.toLowerCase().includes(parsed.words.join(' ')) || model.types.some((t) => t.repo.key === r.key && typeMatches(t, parsed, model)))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [model, parsed, repoFilter, showExt])

  const sharedCount = useMemo(() => new Map(model.sharedNames.map((s) => [s.key, s.fields.length])), [model])

  const fieldCols: Col<FlatField>[] = [
    { id: 'repo', header: 'Repository', get: (f) => model.repoByKey.get(f.repo)?.name ?? f.repo, render: (f) => <span className="ss-repocell" style={gvars(groupOfRepo(model, f.repo))}>{model.repoByKey.get(f.repo)?.name}</span> },
    { id: 'type', header: 'Record type', get: (f) => f.typeName },
    { id: 'field', header: 'Field', get: (f) => f.path, render: (f) => <code className="ss-code"><Hi text={f.path} words={words} /></code> },
    { id: 'plain', header: 'In plain words', get: (f) => explainField(f, model).plain, render: (f) => <span className="ss-plain"><Hi text={explainField(f, model).plain} words={words} /></span>, width: '34%' },
    { id: 'kind', header: 'Holds', get: (f) => friendlyType(f.field) },
    { id: 'req', header: 'Required', get: (f) => (f.field.required ? 'yes' : 'no'), firstDir: 'desc', render: (f) => (f.field.required ? <span className="ss-req">●</span> : <span className="ss-dim">optional</span>) },
    { id: 'links', header: 'Links to', get: (f) => [...new Set(f.links.map((e) => e.to.repo ?? '?'))].join(' '), render: (f) => <span className="ss-field-targets">{[...new Set(f.links.map((e) => e.to.repo))].map((r) => <TargetChip key={r ?? 'x'} model={model} repo={r} />)}</span> },
    { id: 'values', header: 'Fixed values', get: (f) => f.field.enum?.length ?? 0, firstDir: 'desc', render: (f) => (f.field.enum?.length ? <span title={f.field.enum.join(', ')}>{f.field.enum.length}</span> : <span className="ss-dim">·</span>) },
    { id: 'shared', header: 'Same name in', get: (f) => sharedCount.get(f.key) ?? 1, firstDir: 'desc', render: (f) => <span>{sharedCount.get(f.key) ?? 1} type{(sharedCount.get(f.key) ?? 1) === 1 ? '' : 's'}</span>, hidden: true },
    { id: 'style', header: 'Spelling', get: (f) => f.style, hidden: true },
    { id: 'documented', header: 'Described', get: (f) => (f.field.description ? 1 : 0), hidden: true, render: (f) => (f.field.description ? 'yes' : <span className="ss-warn">no</span>) },
  ]

  const typeCols: Col<TypeNode>[] = [
    { id: 'repo', header: 'Repository', get: (t) => t.repo.name, render: (t) => <span className="ss-repocell" style={gvars(groupOfRepo(model, t.repo.key))}>{t.repo.name}</span> },
    { id: 'type', header: 'Record type', get: (t) => t.title, render: (t) => <strong>{t.title}</strong> },
    { id: 'plain', header: 'In plain words', get: (t) => explainType(t, model).one, width: '38%', render: (t) => <span className="ss-plain">{explainType(t, model).one}</span> },
    { id: 'fields', header: 'Fields', get: (t) => t.fieldCount, firstDir: 'desc' },
    { id: 'required', header: 'Required', get: (t) => t.def.required.length, firstDir: 'desc' },
    { id: 'out', header: 'Links out', get: (t) => t.out.length, firstDir: 'desc' },
    { id: 'in', header: 'Links in', get: (t) => t.in.length, firstDir: 'desc' },
    { id: 'records', header: 'Records', get: (t) => t.def.recordCount ?? 0, firstDir: 'desc', render: (t) => (t.def.recordCount ? t.def.recordCount.toLocaleString() : <span className="ss-dim">·</span>) },
    { id: 'doc', header: 'Described', get: (t) => (t.fieldCount ? Math.round((100 * t.documented) / t.fieldCount) : 0), firstDir: 'desc', render: (t) => `${t.fieldCount ? Math.round((100 * t.documented) / t.fieldCount) : 0}%` },
    { id: 'findings', header: 'Findings', get: (t) => model.findingsByType.get(t.id)?.length ?? 0, firstDir: 'desc' },
    { id: 'cmp', header: 'Compare', get: () => '', render: (t) => <input type="checkbox" aria-label={`Compare ${t.title}`} checked={compare.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => setCompare((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id].slice(-2)))} /> },
  ]

  const repoCols: Col<RepoDef>[] = [
    { id: 'name', header: 'Repository', get: (r) => r.name, render: (r) => <span className="ss-repocell" style={gvars(groupOfRepo(model, r.key))}><strong>{r.name}</strong></span> },
    { id: 'group', header: 'Role', get: (r) => GROUPS[r.group]?.label ?? r.group },
    { id: 'plain', header: 'What it is for', get: (r) => REPO_MEANING[r.key]?.what ?? r.intro, width: '40%', render: (r) => <span className="ss-plain">{(REPO_MEANING[r.key]?.what ?? r.intro).split('. ')[0]}.</span> },
    { id: 'types', header: 'Record types', get: (r) => r.types.length, firstDir: 'desc' },
    { id: 'fields', header: 'Fields', get: (r) => r.types.reduce((a, t) => a + t.fields.length, 0), firstDir: 'desc' },
    { id: 'records', header: 'Records', get: (r) => r.types.reduce((a, t) => a + (t.recordCount ?? 0), 0), firstDir: 'desc', render: (r) => r.types.reduce((a, t) => a + (t.recordCount ?? 0), 0).toLocaleString() },
    { id: 'out', header: 'Links out', get: (r) => model.edges.filter((e) => e.from.repo === r.key && e.kind !== 'intra').length, firstDir: 'desc' },
    { id: 'in', header: 'Links in', get: (r) => model.edges.filter((e) => e.to.repo === r.key && e.from.repo !== r.key).length, firstDir: 'desc' },
    { id: 'changed', header: 'Schema changed', get: (r) => r.git?.lastSchemaChange?.date ?? '', firstDir: 'desc', render: (r) => agoText(r.git?.lastSchemaChange?.date, now) },
    { id: 'findings', header: 'Findings', get: (r) => model.findings.filter((f) => f.repos.includes(r.key)).length, firstDir: 'desc' },
  ]

  const cmpTypes = compare.map((id) => model.typeById.get(id)).filter(Boolean) as TypeNode[]
  const Toggle = ({ k, label }: { k: keyof typeof only; label: string }) => <label className={`ss-toggle${only[k] ? ' on' : ''}`}><input type="checkbox" checked={only[k]} onChange={() => setOnly((o) => ({ ...o, [k]: !o[k] }))} />{label}</label>

  return (
    <div className="ss-explore">
      <div className="ss-subtabs" role="tablist">
        {([['fields', 'Fields'], ['types', 'Record types'], ['repos', 'Repositories']] as [Sub, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}
        <span className="ss-spacer" />
        <div className="ss-facets">
          {model.repos.filter((r) => r.tier === 'base').map((r) => (
            <button key={r.key} type="button" className={`ss-facet${repoFilter.has(r.key) ? ' on' : ''}`} style={gvars(groupOfRepo(model, r.key))} onClick={() => toggleRepo(r.key)}>{r.name}</button>
          ))}
          <label className={`ss-toggle${showExt ? ' on' : ''}`}><input type="checkbox" checked={showExt} onChange={() => setShowExt((v) => !v)} />Graph and project layers</label>
        </div>
      </div>
      {sub === 'fields' && (
        <div className="ss-filters">
          <Toggle k="required" label="Required only" /><Toggle k="link" label="Links only" /><Toggle k="values" label="Fixed values only" /><Toggle k="list" label="Lists only" /><Toggle k="undocumented" label="No description" />
          <label className={`ss-toggle${nested ? ' on' : ''}`}><input type="checkbox" checked={nested} onChange={() => setNested((v) => !v)} />Include sub-fields</label>
        </div>
      )}
      {sub === 'fields' && <DataTable rows={fieldRows} cols={fieldCols} sort={fieldSort.sort} onSort={fieldSort.click} rowKey={(f) => f.id} selectedKey={selection?.kind === 'field' ? selection.fieldId : null} onRow={(f) => select({ kind: 'field', fieldId: f.id })} csvName="schema-fields.csv" empty="No field matches. Try fewer words, or clear the filters." />}
      {sub === 'types' && (
        <>
          <DataTable rows={typeRows} cols={typeCols} sort={typeSort.sort} onSort={typeSort.click} rowKey={(t) => t.id} selectedKey={selection?.kind === 'type' ? selection.typeId : null} onRow={(t) => select({ kind: 'type', typeId: t.id })} csvName="schema-record-types.csv"
            extraHead={<span className="ss-hint"><GitCompare size={12} /> Tick two record types to compare them.</span>} />
          {cmpTypes.length === 2 && <CompareTypes a={cmpTypes[0]} b={cmpTypes[1]} onPick={(id) => select({ kind: 'type', typeId: id })} />}
        </>
      )}
      {sub === 'repos' && <DataTable rows={repoRows} cols={repoCols} sort={repoSort.sort} onSort={repoSort.click} rowKey={(r) => r.key} selectedKey={selection?.kind === 'repo' ? selection.repo : null} onRow={(r) => select({ kind: 'repo', repo: r.key })} csvName="schema-repositories.csv" />}
      <p className="ss-hint ss-search-help">Search tips: <code>repo:theory</code> <code>type:proposition</code> <code>field:related</code> <code>links:literature</code> <code>has:enum</code> <code>is:required</code> <code>undocumented</code>. Words match names, descriptions and fixed values. <button type="button" className="ss-link-btn" onClick={() => openSuggest({ repo: 'system' }, 'other')}>Suggest something about the whole system</button></p>
    </div>
  )
}

function CompareTypes({ a, b, onPick }: { a: TypeNode; b: TypeNode; onPick: (id: string) => void }) {
  const { model } = useStudio()
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')
  const fa = new Map(a.def.fields.map((f) => [key(f.name), f])); const fb = new Map(b.def.fields.map((f) => [key(f.name), f]))
  const shared = [...fa.keys()].filter((k) => fb.has(k)); const onlyA = [...fa.keys()].filter((k) => !fb.has(k)); const onlyB = [...fb.keys()].filter((k) => !fa.has(k))
  const col = (t: TypeNode, keys: string[], map: Map<string, any>) => <ul>{keys.map((k) => <li key={k}><code>{map.get(k).name}</code> <span className="ss-dim">{friendlyType(map.get(k))}</span></li>)}</ul>
  return (
    <section className="ss-compare">
      <h4>Comparing <button type="button" className="ss-link-btn" onClick={() => onPick(a.id)}>{a.title}</button> ({a.repo.name}) with <button type="button" className="ss-link-btn" onClick={() => onPick(b.id)}>{b.title}</button> ({b.repo.name})</h4>
      <p className="ss-hint">{shared.length} field names appear in both ({Math.round((100 * shared.length) / Math.max(1, Math.min(fa.size, fb.size)))}% of the smaller type). Spelling style is ignored: relatedLiterature and related_literature count as the same.</p>
      <div className="ss-compare-grid">
        <div><h5>Only in {a.title}</h5>{col(a, onlyA, fa)}</div>
        <div><h5>In both</h5>{col(a, shared, fa)}</div>
        <div><h5>Only in {b.title}</h5>{col(b, onlyB, fb)}</div>
      </div>
    </section>
  )
}
