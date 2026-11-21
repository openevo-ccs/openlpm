import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, ExternalLink, Link2, MessageSquarePlus, X } from 'lucide-react'
import type { FlatField, TypeNode } from '@/lib/schema-studio/model'
import { CORE_MEANING, REPO_MEANING, explainField, explainType, friendlyType, ontologyFor } from '@/lib/schema-studio/meanings'
import { agoText, selectionKey, useStudio } from './context'
import { Section, TargetChip, gvars, groupOfRepo, KeyBadge } from './parts'

const ghFile = (github: string, file: string) => `https://github.com/${github}/blob/main/${file}`

function SuggestBtn({ target, label = 'Suggest a change', kind }: { target: { repo: string; type?: string; field?: string }; label?: string; kind?: string }) {
  const { openSuggest } = useStudio()
  return <button type="button" className="btn btn-mini btn-primary" onClick={() => openSuggest(target, kind)}><MessageSquarePlus size={13} /> {label}</button>
}

function Crumbs() {
  const { model, selection, select } = useStudio()
  if (!selection) return null
  const parts: ReactNode[] = []
  if (selection.kind === 'repo') parts.push(<b key="r">{model.repoByKey.get(selection.repo)?.name}</b>)
  if (selection.kind === 'type') { const t = model.typeById.get(selection.typeId)!; parts.push(<button key="r" type="button" onClick={() => select({ kind: 'repo', repo: t.repo.key })}>{t.repo.name}</button>, <b key="t">{t.title}</b>) }
  if (selection.kind === 'field') { const f = model.fieldById.get(selection.fieldId)!; const t = model.typeById.get(f.typeId)!; parts.push(<button key="r" type="button" onClick={() => select({ kind: 'repo', repo: t.repo.key })}>{t.repo.name}</button>, <button key="t" type="button" onClick={() => select({ kind: 'type', typeId: t.id })}>{t.title}</button>, <b key="f">{f.path}</b>) }
  if (selection.kind === 'core') parts.push(<b key="c">openevo-core</b>)
  return <nav className="ss-crumbs" aria-label="Where you are">{parts.map((p, i) => <span key={i}>{i > 0 && <span className="sep"> ›</span>} {p}</span>)}</nav>
}

export default function Drawer() {
  const { model, selection, select, now } = useStudio()
  if (!selection) return null
  const key = selectionKey(selection)
  let body: ReactNode = null
  let style = gvars(groupOfRepo(model, null))
  if (selection.kind === 'repo') { style = gvars(groupOfRepo(model, selection.repo)); body = <RepoPanel key={key} repoKey={selection.repo} /> }
  if (selection.kind === 'type') { const t = model.typeById.get(selection.typeId); if (t) { style = gvars(groupOfRepo(model, t.repo.key)); body = <TypePanel key={key} t={t} /> } }
  if (selection.kind === 'field') { const f = model.fieldById.get(selection.fieldId); if (f) { style = gvars(groupOfRepo(model, f.repo)); body = <FieldPanel key={key} f={f} /> } }
  if (selection.kind === 'core') body = <CorePanel key={key} />
  if (!body) return null
  return (
    <aside className="ss-drawer" style={style} aria-label="Details">
      <div className="ss-drawer-bar">
        <Crumbs />
        <button type="button" className="ss-iconbtn" title="Copy a link to this view" onClick={() => { navigator.clipboard?.writeText(window.location.href) }}><Link2 size={15} /></button>
        <button type="button" className="ss-iconbtn" title="Close" aria-label="Close" onClick={() => select(null)}><X size={16} /></button>
      </div>
      <div className="ss-drawer-body">{body}<p className="ss-hint ss-stamp">Structure as of {agoText(model.snap.generatedAt, now)}.</p></div>
    </aside>
  )
}

function Suggestions({ target }: { target: { repo: string; type?: string; field?: string } }) {
  const { suggestionsFor, basketFor, setView, model } = useStudio()
  const live = suggestionsFor(target), local = basketFor(target)
  if (!live.length && !local.length) return null
  return (
    <Section title={`Suggestions here (${live.length + local.length})`} aside={<button type="button" className="ss-link-btn" onClick={() => setView('board')}>Open the board</button>}>
      <ul className="ss-minilist">
        {live.slice(0, 5).map((s) => <li key={s.id}><span className={`ss-pill st-${s.status}`}>{s.status}</span> {s.summary}</li>)}
        {local.slice(0, 5).map((s) => <li key={s.localId}><span className="ss-pill">in my basket</span> {s.summary}</li>)}
      </ul>
    </Section>
  )
}

function RepoPanel({ repoKey }: { repoKey: string }) {
  const { model, select, setQuery, setView, now } = useStudio()
  const r = model.repoByKey.get(repoKey)
  if (!r) return null
  const mean = REPO_MEANING[repoKey]
  const types = model.types.filter((t) => t.repo.key === repoKey)
  const row = model.matrix.get(repoKey)
  const inbound = [...model.matrix.entries()].filter(([a, rr]) => a !== repoKey && rr.has(repoKey)).map(([a, rr]) => ({ a, n: rr.get(repoKey)!.length }))
  const records = types.reduce((a, t) => a + (t.def.recordCount ?? 0), 0)
  const finds = model.findings.filter((f) => f.repos.includes(repoKey))
  return (
    <>
      <header className="ss-drawer-title"><span className="ss-groupline">{groupOfRepo(model, repoKey).label}{r.retiredOn ? ` · retired ${r.retiredOn}` : ''}</span><h3>{r.name}</h3><SuggestBtn target={{ repo: repoKey }} /></header>
      <Section title="What it is for"><p className="ss-big">{mean?.what ?? r.intro}</p>{mean && <><p><b>Who uses it.</b> {mean.forWhom}</p><p><b>A question it helps answer.</b> {mean.question}</p></>}</Section>
      <Section title="At a glance">
        <dl className="ss-facts">
          <div><dt>Record types</dt><dd>{types.length}</dd></div><div><dt>Fields</dt><dd>{types.reduce((a, t) => a + t.fieldCount, 0)}</dd></div>
          <div><dt>Records (about)</dt><dd>{records ? records.toLocaleString() : 'none counted'}</dd></div><div><dt>Schema last changed</dt><dd>{agoText(r.git?.lastSchemaChange?.date, now)}</dd></div>
        </dl>
        <p className="ss-hint">{r.git?.lastSchemaChange ? `Last schema commit ${r.git.lastSchemaChange.sha}: ${r.git.lastSchemaChange.subject}` : null}</p>
        <p className="ss-links"><a href={`https://github.com/${r.github}`} target="_blank" rel="noreferrer">Repository <ExternalLink size={11} /></a>{r.governance && <a href={`https://github.com/${r.github}/blob/main/GOVERNANCE.md`} target="_blank" rel="noreferrer">How it is governed <ExternalLink size={11} /></a>}{r.visibility === 'private' && <span className="ss-dim">private repository (sign in to GitHub)</span>}</p>
      </Section>
      <Section title="Record types">
        <ul className="ss-typelist">{types.map((t) => <li key={t.id}><button type="button" onClick={() => select({ kind: 'type', typeId: t.id })}><b>{t.title}</b><span>{explainType(t, model).one}</span></button></li>)}</ul>
      </Section>
      <Section title="Connections">
        <p className="ss-hint">Points at</p>
        <div className="ss-chiprow">{row ? [...row.entries()].map(([b, es]) => <button key={b} type="button" className="ss-linkchip" style={gvars(groupOfRepo(model, b))} onClick={() => { setQuery(`repo:${repoKey} links:${b === 'humanbase' ? 'person' : b}`); setView('explore') }}><TargetChip model={model} repo={b} /> {es.length} field{es.length > 1 ? 's' : ''}</button>) : <span className="ss-dim">nothing outside this repository</span>}</div>
        <p className="ss-hint">Pointed at by</p>
        <div className="ss-chiprow">{inbound.length ? inbound.map(({ a, n }) => <button key={a} type="button" className="ss-linkchip" style={gvars(groupOfRepo(model, a))} onClick={() => select({ kind: 'repo', repo: a })}><TargetChip model={model} repo={a} /> {n}</button>) : <span className="ss-dim">no other repository</span>}</div>
      </Section>
      {r.sharedDefs.length > 0 && <Section title="Shared definitions"><p className="ss-hint">Building blocks reused across this repository's record types.</p><ul className="ss-minilist">{r.sharedDefs.slice(0, 20).map((d) => <li key={d.name}><code>{d.name}</code> {d.description || <span className="ss-dim">{friendlyType({ type: d.type } as any)}</span>}</li>)}</ul></Section>}
      {r.vocabularies.length > 0 && <Section title="Vocabularies"><div className="ss-chiprow">{r.vocabularies.map((v) => <span key={v.file} className="ss-pill">{v.name}{v.version ? ` ${v.version}` : ''}</span>)}</div></Section>}
      {finds.length > 0 && <Section title={`Findings (${finds.length})`}><ul className="ss-minilist">{finds.slice(0, 8).map((f) => <li key={f.id}><AlertTriangle size={12} className={f.severity === 'attention' ? 'ss-warn' : 'ss-dim'} /> {f.title}</li>)}</ul></Section>}
      <Suggestions target={{ repo: repoKey }} />
    </>
  )
}

function TypePanel({ t }: { t: TypeNode }) {
  const { model, select, setQuery, setView } = useStudio()
  const mt = explainType(t, model)
  const onto = ontologyFor(t, model)
  const finds = model.findingsByType.get(t.id) ?? []
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const fields = model.fields.filter((f) => f.typeId === t.id && f.depth === 0 && (!filter || f.search.includes(filter.toLowerCase())))
  const outBy = useMemo(() => { const m = new Map<string, number>(); for (const e of t.out) m.set(e.to.repo ?? '?', (m.get(e.to.repo ?? '?') ?? 0) + 1); return m }, [t])
  const inboundTypes = [...new Map(t.in.map((e) => [e.from.type, e])).values()]
  return (
    <>
      <header className="ss-drawer-title"><span className="ss-groupline">{t.repo.name} · record type</span><h3>{t.title}</h3><SuggestBtn target={{ repo: t.repo.key, type: t.id }} /></header>
      <Section title="In plain words"><p className="ss-big">{mt.one}</p>{mt.example && <p><b>For example.</b> {mt.example}</p>}{onto && <p className="ss-onto"><b>In the shared vocabulary ({onto.iri}).</b> {onto.definition.slice(0, 420)}{onto.definition.length > 420 ? '...' : ''}</p>}</Section>
      <Section title="At a glance">
        <dl className="ss-facts"><div><dt>Fields</dt><dd>{t.fieldCount}</dd></div><div><dt>Required</dt><dd>{t.def.required.length}</dd></div><div><dt>Records (about)</dt><dd>{t.def.recordCount?.toLocaleString() ?? 'none counted'}</dd></div><div><dt>Described fields</dt><dd>{t.fieldCount ? Math.round((100 * t.documented) / t.fieldCount) : 0}%</dd></div></dl>
        {t.def.idPattern && <p><b>An id looks like</b> <code>{t.def.idPattern.replace(/^\^|\$$/g, '')}</code></p>}
        <p className="ss-links"><a href={ghFile(t.repo.github, t.def.file)} target="_blank" rel="noreferrer">Schema file <ExternalLink size={11} /></a>{t.def.closed && <span className="ss-dim">only the listed fields are allowed</span>}</p>
      </Section>
      <Section title="Connections">
        <p className="ss-hint">Points at</p>
        <div className="ss-chiprow">{outBy.size ? [...outBy.entries()].map(([r, n]) => <button key={r} type="button" className="ss-linkchip" style={gvars(groupOfRepo(model, r))} onClick={() => { setQuery(`type:${t.def.name} links:${r === 'humanbase' ? 'person' : r}`); setView('explore') }}><TargetChip model={model} repo={r} /> {n}</button>) : <span className="ss-dim">no links out</span>}</div>
        <p className="ss-hint">Pointed at by</p>
        <ul className="ss-minilist">{inboundTypes.length ? inboundTypes.slice(0, 10).map((e) => { const ft = model.typeById.get(e.from.type); return <li key={e.from.type}><button type="button" className="ss-link-btn" onClick={() => ft && select({ kind: 'type', typeId: ft.id })}>{ft?.title}</button> <span className="ss-dim">via {e.from.field}</span></li> }) : <li className="ss-dim">nothing points here</li>}</ul>
      </Section>
      <Section title={`Fields (${t.fieldCount})`} aside={<input className="ss-mini-input" placeholder="Filter fields" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
        <ul className="ss-fieldlist">
          {fields.map((f) => <FieldItem key={f.id} f={f} open={open.has(f.id)} toggle={() => setOpen((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })} />)}
        </ul>
      </Section>
      {finds.length > 0 && <Section title={`Findings (${finds.length})`}><ul className="ss-minilist">{finds.map((f) => <li key={f.id}><AlertTriangle size={12} className={f.severity === 'attention' ? 'ss-warn' : 'ss-dim'} /> <b>{f.title}</b> {f.plain}</li>)}</ul></Section>}
      <Suggestions target={{ repo: t.repo.key, type: t.id }} />
    </>
  )
}

function FieldItem({ f, open, toggle }: { f: FlatField; open: boolean; toggle: () => void }) {
  const { model, select } = useStudio()
  const ex = explainField(f, model)
  return (
    <li className={open ? 'open' : ''}>
      <div className="ss-fi-head">
        <button type="button" className="ss-fi-main" onClick={toggle} aria-expanded={open}>
          <KeyBadge f={f} model={model} /><code>{f.path}</code>{f.field.required && <span className="ss-req" title="Required">●</span>}
          <span className="ss-fi-type">{friendlyType(f.field)}</span>
          <span className="ss-field-targets">{[...new Set(f.links.map((e) => e.to.repo))].map((r) => <TargetChip key={r ?? 'x'} model={model} repo={r} />)}</span>
        </button>
        <button type="button" className="ss-iconbtn" title="Open this field" onClick={() => select({ kind: 'field', fieldId: f.id })}><ArrowRight size={14} /></button>
      </div>
      <p className="ss-fi-plain">{ex.plain}</p>
      {open && <FieldDetail f={f} compact />}
    </li>
  )
}

function FieldDetail({ f, compact }: { f: FlatField; compact?: boolean }) {
  const { model, select } = useStudio()
  const ex = explainField(f, model)
  const shared = model.sharedNames.find((s) => s.key === f.key)
  return (
    <div className="ss-fdetail">
      {ex.source !== 'schema' && f.field.description && <p><b>From the schema file.</b> {f.field.description}</p>}
      {f.field.pattern && <p><b>Accepted shape</b> <code>{f.field.pattern}</code></p>}
      {f.field.enum && <p><b>Allowed values</b> <span className="ss-vvals">{f.field.enum.map((v) => <span key={v} className="ss-val">{v}</span>)}</span></p>}
      {f.field.enumTruncated && <p className="ss-dim">A list of {f.field.enumTruncated} values (too long to show).</p>}
      {f.links.length > 0 && <p><b>Links to</b> {f.links.map((e, i) => { const to = e.to.type ? model.typeById.get(e.to.type) : null; return <span key={i} className="ss-linkto"><TargetChip model={model} repo={e.to.repo} />{to ? <button type="button" className="ss-link-btn" onClick={() => select({ kind: 'type', typeId: to.id })}>{to.title}</button> : <span> {e.to.repo ? model.repoByKey.get(e.to.repo)?.name ?? 'HumanBase (retired)' : `unknown (${e.to.token})`}</span>}{e.legacy ? <span className="ss-pill">older id style</span> : null}</span> })}</p>}
      {f.field.children && f.field.children.length > 0 && <div><b>Sub-fields</b><ul className="ss-minilist">{f.field.children.map((c) => <li key={c.name}><code>{c.name}</code>{c.required ? <span className="ss-req"> ●</span> : null} <span className="ss-dim">{friendlyType(c)}</span>{c.description ? <> {c.description.slice(0, 120)}</> : null}</li>)}</ul></div>}
      {!compact && shared && shared.fields.length > 1 && (
        <div><b>The same name in other record types</b>
          <ul className="ss-minilist">{shared.fields.filter((x) => x.id !== f.id).slice(0, 14).map((x) => <li key={x.id}><button type="button" className="ss-link-btn" onClick={() => select({ kind: 'field', fieldId: x.id })}>{model.repoByKey.get(x.repo)?.name} › {x.typeName}</button> <span className="ss-dim">{friendlyType(x.field)}{x.field.required ? ', required' : ''}{x.path !== f.path ? `, spelled ${x.path}` : ''}</span></li>)}</ul>
        </div>
      )}
    </div>
  )
}

function FieldPanel({ f }: { f: FlatField }) {
  const { model } = useStudio()
  const t = model.typeById.get(f.typeId)!
  const ex = explainField(f, model)
  const finds = (model.findingsByType.get(t.id) ?? []).filter((x) => x.targets.some((tg) => tg.field === f.path))
  return (
    <>
      <header className="ss-drawer-title"><span className="ss-groupline">{t.repo.name} › {t.title} · field</span><h3><code>{f.path}</code></h3><SuggestBtn target={{ repo: f.repo, type: f.typeId, field: f.path }} /></header>
      <Section title="In plain words"><p className="ss-big">{ex.plain}</p>
        <dl className="ss-facts"><div><dt>Holds</dt><dd>{friendlyType(f.field)}</dd></div><div><dt>Required</dt><dd>{f.field.required ? 'yes' : 'no'}</dd></div><div><dt>Spelling</dt><dd>{f.style === 'camel' ? 'camelCase' : f.style === 'snake' ? 'snake_case' : 'one word'}</dd></div></dl>
      </Section>
      <Section title="Details"><FieldDetail f={f} /></Section>
      {finds.length > 0 && <Section title="Findings"><ul className="ss-minilist">{finds.map((x) => <li key={x.id}><AlertTriangle size={12} className="ss-warn" /> {x.title}</li>)}</ul></Section>}
      <Suggestions target={{ repo: f.repo, type: f.typeId, field: f.path }} />
    </>
  )
}

function CorePanel() {
  const { model } = useStudio()
  const [q, setQ] = useState('')
  const onto = model.snap.core?.ontology
  const classes = (onto?.classes ?? []).filter((c) => !q || `${c.label} ${c.definition}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <header className="ss-drawer-title"><span className="ss-groupline">Shared kernel</span><h3>openevo-core</h3><SuggestBtn target={{ repo: 'core' }} /></header>
      <Section title="What it is for"><p className="ss-big">{CORE_MEANING.what}</p><p><b>Who uses it.</b> {CORE_MEANING.forWhom}</p></Section>
      <Section title={`Shared vocabulary (${onto?.classes.length ?? 0} classes)`} aside={<input className="ss-mini-input" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <ul className="ss-fieldlist">{classes.map((c) => <li key={c.iri}><div className="ss-fi-head"><span className="ss-fi-main"><code>{c.iri}</code><span className="ss-fi-type">{c.status}</span></span></div><p className="ss-fi-plain"><b>{c.label}.</b> {c.definition.slice(0, 340)}{c.definition.length > 340 ? '...' : ''}</p></li>)}</ul>
      </Section>
      <Section title={`Shared properties (${onto?.properties.length ?? 0})`}><ul className="ss-fieldlist">{(onto?.properties ?? []).map((p) => <li key={p.iri}><div className="ss-fi-head"><span className="ss-fi-main"><code>{p.iri}</code></span></div><p className="ss-fi-plain">{p.definition.slice(0, 260)}{p.definition.length > 260 ? '...' : ''}</p></li>)}</ul></Section>
      <Suggestions target={{ repo: 'core' }} />
    </>
  )
}
