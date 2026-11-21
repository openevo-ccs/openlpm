import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Hash, List, MessageSquarePlus, Rows3 } from 'lucide-react'
import { GROUPS, fieldMatches, type Edge, type FlatField, type Model, type TypeNode } from '@/lib/schema-studio/model'
import type { RepoDef } from '@/lib/schema-studio/types'
import { REPO_MEANING, explainField, explainType } from '@/lib/schema-studio/meanings'
import { agoText, useStudio } from './context'
import { Hi, KeyBadge, REPO_CODE, TargetChip, gvars, groupOfRepo } from './parts'

export type RepoSort = 'template' | 'name' | 'types' | 'fields' | 'records' | 'changed' | 'findings' | 'links'
export type TypeSort = 'schema' | 'name' | 'fields' | 'records' | 'links' | 'findings' | 'documented'

const FIELDS_SHOWN = 6

function visibleFields(t: TypeNode, all: FlatField[], expanded: boolean, matched: Set<string> | null): { shown: FlatField[]; hidden: number } {
  const top = all.filter((f) => f.depth === 0)
  if (expanded) return { shown: top, hidden: 0 }
  const rank = (f: FlatField) => (matched?.has(f.id) ? 0 : f.path === 'id' ? 1 : f.links.length ? 2 : f.field.required ? 3 : 4)
  const picked = [...top].sort((a, b) => rank(a) - rank(b) || top.indexOf(a) - top.indexOf(b)).slice(0, FIELDS_SHOWN)
  const shown = top.filter((f) => picked.includes(f))
  return { shown, hidden: top.length - shown.length }
}

export function sortRepos(model: Model, by: RepoSort, desc: boolean, findingsByRepo: Map<string, number>): RepoDef[] {
  const base = [...model.repos]
  const key = (r: RepoDef): number | string => {
    switch (by) {
      case 'name': return r.name.toLowerCase()
      case 'types': return r.types.length
      case 'fields': return r.types.reduce((a, t) => a + t.fields.length, 0)
      case 'records': return r.types.reduce((a, t) => a + (t.recordCount ?? 0), 0)
      case 'changed': return r.git?.lastSchemaChange?.date ?? ''
      case 'findings': return findingsByRepo.get(r.key) ?? 0
      case 'links': return model.edges.filter((e) => e.from.repo === r.key && e.kind !== 'intra').length
      default: return 0
    }
  }
  if (by === 'template') return base.sort((a, b) => (GROUPS[a.group]?.order ?? 9) - (GROUPS[b.group]?.order ?? 9) || (a.tier === b.tier ? 0 : a.tier === 'base' ? -1 : 1))
  return base.sort((a, b) => {
    const ka = key(a), kb = key(b)
    const c = typeof ka === 'string' ? ka.localeCompare(String(kb)) : Number(ka) - Number(kb)
    return desc ? -c : c
  })
}

export function sortTypes(model: Model, types: TypeNode[], by: TypeSort, desc: boolean): TypeNode[] {
  if (by === 'schema') return types
  const key = (t: TypeNode): number | string => {
    switch (by) {
      case 'name': return t.title.toLowerCase()
      case 'fields': return t.fieldCount
      case 'records': return t.def.recordCount ?? -1
      case 'links': return t.out.length + t.in.length
      case 'findings': return model.findingsByType.get(t.id)?.length ?? 0
      case 'documented': return t.fieldCount ? t.documented / t.fieldCount : 0
      default: return 0
    }
  }
  return [...types].sort((a, b) => {
    const ka = key(a), kb = key(b)
    const c = typeof ka === 'string' ? ka.localeCompare(String(kb)) : Number(ka) - Number(kb)
    return desc ? -c : c
  })
}

interface Props { repoSort: RepoSort; typeSort: TypeSort; desc: boolean }

export default function MapView({ repoSort, typeSort, desc }: Props) {
  const { model, selection, select, lens, parsed, query, setQuery, setView, suggestionsFor, basketFor, now } = useStudio()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showExtension, setShowExtension] = useState(false)
  const [hoverPair, setHoverPair] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boxRefs = useRef(new Map<string, HTMLElement>())
  const [geo, setGeo] = useState<{ w: number; h: number; ys: Map<string, { y: number; h: number }> }>({ w: 0, h: 0, ys: new Map() })

  const findingsByRepo = useMemo(() => {
    const m = new Map<string, number>(); for (const f of model.findings) for (const r of new Set(f.repos)) m.set(r, (m.get(r) ?? 0) + 1); return m
  }, [model])
  const sharedHeat = useMemo(() => new Map(model.sharedNames.map((s) => [s.key, s.fields.length])), [model])

  const repos = useMemo(() => sortRepos(model, repoSort, desc, findingsByRepo).filter((r) => showExtension || r.tier === 'base'), [model, repoSort, desc, findingsByRepo, showExtension])
  const selRepo = selection?.kind === 'repo' ? selection.repo : selection?.kind === 'type' ? model.typeById.get(selection.typeId)?.repo.key : selection?.kind === 'field' ? model.fieldById.get(selection.fieldId)?.repo : null
  const selType = selection?.kind === 'type' ? selection.typeId : selection?.kind === 'field' ? model.fieldById.get(selection.fieldId)?.typeId : null

  // Repository-to-repository connections, drawn as arcs in the left margin.
  const pairs = useMemo(() => {
    const out: { a: string; b: string; n: number; edges: Edge[] }[] = []
    for (const [a, row] of model.matrix) for (const [b, es] of row) out.push({ a, b, n: es.length, edges: es })
    return out.filter((p) => showExtension || (model.repoByKey.get(p.a)?.tier === 'base' && (p.b === 'humanbase' || model.repoByKey.get(p.b)?.tier === 'base')))
  }, [model, showExtension])
  const hasRetiredTarget = pairs.some((p) => p.b === 'humanbase')

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const base = el.getBoundingClientRect()
      const ys = new Map<string, { y: number; h: number }>()
      boxRefs.current.forEach((box, key) => { const r = box.getBoundingClientRect(); ys.set(key, { y: r.top - base.top, h: r.height }) })
      setGeo({ w: base.width, h: base.height, ys })
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [repos, expanded, query, lens, selection, showExtension, repoSort, typeSort, desc])

  const arcs = useMemo(() => {
    if (!geo.ys.size) return []
    const ports = new Map<string, { id: string; other: string }[]>()
    pairs.forEach((p, i) => {
      ports.set(p.a, [...(ports.get(p.a) ?? []), { id: `${i}s`, other: p.b }]); ports.set(p.b, [...(ports.get(p.b) ?? []), { id: `${i}t`, other: p.a }])
    })
    const py = new Map<string, number>()
    for (const [k, list] of ports) {
      const g = geo.ys.get(k); if (!g) continue
      list.sort((x, y) => (geo.ys.get(x.other)?.y ?? 0) - (geo.ys.get(y.other)?.y ?? 0))
      list.forEach((p, j) => py.set(p.id, g.y + 14 + ((j + 0.5) * Math.max(0, g.h - 28)) / list.length))
    }
    return pairs.map((p, i) => {
      const y1 = py.get(`${i}s`), y2 = py.get(`${i}t`)
      if (y1 === undefined || y2 === undefined) return null
      return { ...p, i, y1, y2 }
    }).filter(Boolean) as (typeof pairs[number] & { i: number; y1: number; y2: number })[]
  }, [pairs, geo])

  const matchedByType = useMemo(() => {
    if (parsed.empty) return null
    const m = new Map<string, Set<string>>()
    for (const f of model.fields) if (f.depth === 0 && fieldMatches(f, parsed, model)) { const s = m.get(f.typeId) ?? new Set<string>(); s.add(f.id); m.set(f.typeId, s) }
    return m
  }, [model, parsed])

  const toggle = (k: string) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const kernelProv = useMemo(() => {
    // The provenance block that most record types share: pick the most common set of sub-field names.
    const sigs = new Map<string, { n: number; names: string[] }>()
    for (const t of model.types) {
      const f = t.def.fields.find((x) => x.name === 'provenance' && x.children?.length)
      if (!f) continue
      const names = f.children!.map((c) => c.name)
      const k = [...names].sort().join('|'); const cur = sigs.get(k) ?? { n: 0, names }; cur.n++; sigs.set(k, cur)
    }
    return [...sigs.values()].sort((a, b) => b.n - a.n)[0]?.names.map((name) => ({ name })) ?? []
  }, [model])
  const statusVals = model.vocab.find((v) => v.fieldKey === 'status')?.lists[0]?.values ?? []
  const ARC_W = 168

  return (
    <div className="ss-map-wrap">
      <div className="ss-map-flags">
        <label className="ss-check"><input type="checkbox" checked={showExtension} onChange={(e) => setShowExtension(e.target.checked)} /> Also show the graph and project layers (ccs-graph, deutsche_lp)</label>
        <button type="button" className="ss-link-btn" onClick={() => setExpanded(expanded.size ? new Set() : new Set(repos.map((r) => r.key)))}>{expanded.size ? 'Fold all fields' : 'Unfold all fields'}</button>
      </div>
      <div className="ss-map" ref={containerRef} style={{ ['--arc-w' as string]: `${ARC_W}px` }}>
        <svg className="ss-arcs" width={ARC_W} height={geo.h} aria-hidden="true">
          <defs>
            {arcs.map((a) => (
              <linearGradient key={a.i} id={`ssg${a.i}`} gradientUnits="userSpaceOnUse" x1="0" y1={a.y1} x2="0" y2={a.y2}>
                <stop offset="0" stopColor={groupOfRepo(model, a.a).mid} /><stop offset="1" stopColor={groupOfRepo(model, a.b).mid} />
              </linearGradient>
            ))}
          </defs>
          {arcs.map((a) => {
            const span = Math.abs(a.y2 - a.y1)
            const d = Math.min(ARC_W - 34, 26 + span * 0.1 + (a.i % 6) * 7)
            const x = ARC_W - 2
            const sel = selRepo && (selRepo === a.a || selRepo === a.b)
            const faded = (selRepo && !sel) || (hoverPair && hoverPair !== `${a.i}`)
            const dash = a.b === 'humanbase' ? '8 6' : undefined
            const w = 1.8 + Math.min(5, a.n * 0.32)
            return (
              <g key={a.i} className={`ss-arc${faded ? ' faded' : ''}`} onMouseEnter={() => setHoverPair(`${a.i}`)} onMouseLeave={() => setHoverPair(null)}
                onClick={() => { setQuery(`repo:${a.a} links:${a.b === 'humanbase' ? 'person' : a.b}`); setView('explore') }}>
                <title>{`${model.repoByKey.get(a.a)?.name} → ${a.b === 'humanbase' ? 'HumanBase (retired)' : model.repoByKey.get(a.b)?.name}: ${a.n} field${a.n > 1 ? 's' : ''}. Click to list them.`}</title>
                <path d={`M ${x},${a.y1} C ${x - d},${a.y1} ${x - d},${a.y2} ${x - 8},${a.y2}`} fill="none" stroke="transparent" strokeWidth={14} />
                <path d={`M ${x},${a.y1} C ${x - d},${a.y1} ${x - d},${a.y2} ${x - 8},${a.y2}`} fill="none" stroke={`url(#ssg${a.i})`} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
                <circle cx={x} cy={a.y1} r={4.5} fill={groupOfRepo(model, a.a).mid} stroke="#fff" strokeWidth={1.4} />
                <path d={`M ${x - 1},${a.y2} l -11,-6 l 0,12 z`} fill={groupOfRepo(model, a.b).mid} />
              </g>
            )
          })}
        </svg>

        <div className="ss-rows">
          {repos.map((r) => {
            const g = GROUPS[r.group] ?? GROUPS.graph
            const types = sortTypes(model, r.types.map((t) => model.typeById.get(t.id)!).filter(Boolean), typeSort, desc)
            const open = expanded.has(r.key) || selRepo === r.key
            const dimRepo = matchedByType ? !types.some((t) => matchedByType.has(t.id)) : false
            const fields = r.types.reduce((a, t) => a + t.fields.length, 0)
            const records = r.types.reduce((a, t) => a + (t.recordCount ?? 0), 0)
            const fc = findingsByRepo.get(r.key) ?? 0
            const sug = suggestionsFor({ repo: r.key }).length + basketFor({ repo: r.key }).length
            const mean = REPO_MEANING[r.key]
            return (
              <div key={r.key} className={`ss-row${selRepo === r.key ? ' selected' : ''}${dimRepo ? ' dim' : ''}`} style={gvars(g)}>
                <div className="ss-repo" ref={(el) => { if (el) boxRefs.current.set(r.key, el); else boxRefs.current.delete(r.key) }} onClick={() => select({ kind: 'repo', repo: r.key })} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') select({ kind: 'repo', repo: r.key }) }}>
                  <div className="ss-repo-group">{g.label}{r.retiredOn ? ' · retired' : ''}</div>
                  <div className="ss-repo-name">{r.name}</div>
                  <div className="ss-repo-slug">{r.github}</div>
                  {lens === 'meaning' && mean ? <p className="ss-repo-mean">{mean.what.split('. ')[0]}.</p> : <div className="ss-repo-classes">{r.types.length} record type{r.types.length === 1 ? '' : 's'} · {fields} fields{records ? ` · about ${records.toLocaleString()} records` : ''}</div>}
                  <div className="ss-repo-foot">
                    <span title="Last change to a schema file in this repository">schema changed {agoText(r.git?.lastSchemaChange?.date, now)}</span>
                    {fc > 0 && <span className="ss-badge" title="Findings about this repository"><AlertTriangle size={11} /> {fc}</span>}
                    {sug > 0 && <span className="ss-badge" title="Suggestions"><MessageSquarePlus size={11} /> {sug}</span>}
                  </div>
                </div>
                <div className="ss-conn" aria-hidden="true" />
                <div className="ss-panel">
                  <div className="ss-panel-head">
                    <span className="ss-panel-file">{r.types[0]?.file.split('/').slice(0, -1).join('/') || 'schema'}/</span>
                    <button type="button" className="ss-link-btn" onClick={() => toggle(r.key)}>{open ? <><ChevronUp size={13} /> Fewer fields</> : <><ChevronDown size={13} /> All fields</>}</button>
                  </div>
                  <div className="ss-tiles">
                    {types.map((t) => {
                      const matched = matchedByType?.get(t.id) ?? null
                      const dim = matchedByType ? !matched : false
                      const { shown, hidden } = visibleFields(t, model.fields.filter((f) => f.typeId === t.id), open, matched)
                      const fcount = model.findingsByType.get(t.id) ?? []
                      const attention = fcount.some((f) => f.severity === 'attention')
                      const sugN = suggestionsFor({ repo: r.key, type: t.id }).length + basketFor({ repo: r.key, type: t.id }).length
                      const out = new Map<string, number>()
                      for (const e of t.out) if (e.kind !== 'intra' && e.to.repo) out.set(e.to.repo, (out.get(e.to.repo) ?? 0) + 1)
                      const mt = explainType(t, model)
                      const maxRec = Math.max(1, ...model.types.map((x) => x.def.recordCount ?? 0))
                      return (
                        <article key={t.id} className={`ss-tile${selType === t.id ? ' selected' : ''}${dim ? ' dim' : ''}`} id={`ss-tile-${t.id.replace(/\W/g, '_')}`}>
                          <header onClick={() => select({ kind: 'type', typeId: t.id })} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') select({ kind: 'type', typeId: t.id }) }}>
                            <span className="ss-tile-title"><Hi text={t.title} words={parsed.words} /></span>
                            <span className="ss-tile-meta">
                              {attention && <AlertTriangle size={12} className="ss-warn" aria-label="Needs attention" />}
                              {t.def.recordCount ? <span className="ss-pill" title="Records of this type (approximate)">{t.def.recordCount.toLocaleString()}</span> : null}
                            </span>
                          </header>
                          {lens === 'data' && t.def.recordCount ? <div className="ss-databar" title={`${t.def.recordCount} records`}><i style={{ width: `${Math.max(3, (Math.log10(t.def.recordCount + 1) / Math.log10(maxRec + 1)) * 100)}%` }} /></div> : null}
                          {(lens === 'meaning' || lens === 'health') && (
                            <p className="ss-tile-mean">{lens === 'meaning' ? mt.one : fcount.length ? `${fcount.length} finding${fcount.length > 1 ? 's' : ''}: ${fcount.slice(0, 2).map((f) => f.title).join('; ')}` : 'No findings.'}</p>
                          )}
                          <ul className="ss-fields">
                            {shown.map((f) => {
                              const heat = sharedHeat.get(f.key) ?? 1
                              const cls = ['ss-field', f.field.required ? 'req' : '', lens === 'links' && !f.links.length && f.path !== 'id' ? 'faded' : '', lens === 'shared' && heat >= 3 ? `heat${heat >= 8 ? 3 : heat >= 5 ? 2 : 1}` : '', lens === 'naming' ? `style-${f.style}` : '', matched?.has(f.id) ? 'hit' : '', selection?.kind === 'field' && selection.fieldId === f.id ? 'sel' : ''].filter(Boolean).join(' ')
                              const targets = [...new Set(f.links.map((e) => e.to.repo))]
                              return (
                                <li key={f.id}>
                                  <button type="button" className={cls} onClick={() => select({ kind: 'field', fieldId: f.id })} title={f.field.description || undefined}>
                                    <KeyBadge f={f} model={model} />
                                    <span className="ss-fname"><Hi text={f.path} words={parsed.words} /></span>
                                    {f.field.required && <span className="ss-req" title="Required">●</span>}
                                    {f.field.list && <List size={11} className="ss-ico" aria-label="List" />}
                                    {f.field.enum?.length ? <Hash size={11} className="ss-ico" aria-label="Fixed values" /> : null}
                                    {lens === 'shared' && heat >= 2 ? <span className="ss-heat">{heat}×</span> : null}
                                    <span className="ss-field-targets">{targets.map((tr) => <TargetChip key={tr ?? 'x'} model={model} repo={tr} />)}</span>
                                  </button>
                                  {lens === 'meaning' && <div className="ss-field-mean">{explainField(f, model).plain}</div>}
                                </li>
                              )
                            })}
                          </ul>
                          {hidden > 0 && <button type="button" className="ss-more" onClick={() => select({ kind: 'type', typeId: t.id })}><Rows3 size={12} /> {hidden} more field{hidden > 1 ? 's' : ''}</button>}
                          <footer>
                            {[...out.entries()].slice(0, 6).map(([repo, n]) => <span key={repo} className="ss-out"><TargetChip model={model} repo={repo} onClick={() => { setQuery(`type:${t.def.name} links:${repo === 'humanbase' ? 'person' : repo}`); setView('explore') }} />{n > 1 ? <i>{n}</i> : null}</span>)}
                            {sugN > 0 && <span className="ss-badge" title="Suggestions"><MessageSquarePlus size={11} /> {sugN}</span>}
                          </footer>
                        </article>
                      )
                    })}
                  </div>
                </div>
                <div className="ss-conn right" aria-hidden="true" />
              </div>
            )
          })}
          {hasRetiredTarget && (
            <div className="ss-row retired" style={gvars(GROUPS.retired)}>
              <div className="ss-repo ghost" ref={(el) => { if (el) boxRefs.current.set('humanbase', el); else boxRefs.current.delete('humanbase') }}>
                <div className="ss-repo-group">Retired</div><div className="ss-repo-name">HumanBase</div>
                <div className="ss-repo-classes">Retired 2026-11-12. People and groups. Fields that still point here are listed as findings.</div>
              </div>
            </div>
          )}
        </div>

        <aside className="ss-kernel" aria-label="Shared kernel">
          <button type="button" className="ss-kernel-head" onClick={() => select({ kind: 'core' })}>
            <b>openevo-core</b><span>The foundation under every repository. It holds no records, only shared rules.</span>
          </button>
          <div className="ss-kbox"><h5>Shared vocabulary</h5><p>{model.snap.core?.ontology?.classes.length ?? 0} classes, {model.snap.core?.ontology?.properties.length ?? 0} shared properties{model.snap.core?.ontology?.version ? `, version ${model.snap.core.ontology.version}` : ''}.</p><button type="button" className="ss-link-btn light" onClick={() => select({ kind: 'core' })}>See every class and its meaning</button></div>
          <div className="ss-kbox"><h5>Identifier scheme</h5><p><code>OE-TYPE-slug</code> is the permanent id of a record. The prefix names the kind of record and tells which repository owns it.</p></div>
          <div className="ss-kbox"><h5>Status lifecycle</h5><p>{statusVals.length ? statusVals.join(' → ') : 'proposed → accepted → stable → deprecated'}</p></div>
          <div className="ss-kbox"><h5>Provenance block</h5><p>Who wrote a record, when, how and how far it was reviewed.</p>{kernelProv.length ? <div className="ss-kchips">{kernelProv.map((c) => <code key={c.name}>{c.name}</code>)}</div> : null}</div>
          <div className="ss-kbox"><h5>Names used again and again</h5><ul className="ss-kshared">{model.sharedNames.slice(0, 7).map((s) => <li key={s.key}><button type="button" onClick={() => { setQuery(`field:${s.names[0]}`); setView('explore') }}><code>{s.names[0]}</code><i>{s.fields.length} types</i></button></li>)}</ul></div>
        </aside>
      </div>
    </div>
  )
}
