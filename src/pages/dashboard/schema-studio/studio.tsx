import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDownUp, BookOpen, Camera, GitCompareArrows, Grid3x3, HelpCircle, ListFilter, Map as MapIcon, MessageSquarePlus, RefreshCw, Search, Sparkles, Table2, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildModel, parseQuery, type Finding, type Model, type Target } from '@/lib/schema-studio/model'
import { GLOSSARY } from '@/lib/schema-studio/meanings'
import type { Lens, StudioView } from '@/lib/schema-studio/types'
import {
  addComment, addSuggestion, listSuggestions, loadSnapshot, loadSnapshotById, markExported, readBasket, setSuggestionStatus, toggleAgree, writeBasket,
  type DraftSuggestion, type LoadedSnapshot, type Suggestion,
} from '@/lib/schema-studio/data'
import { StudioContext, agoText, parseSelection, selectionKey, type Selection, type StudioCtx } from './context'
import MapView, { type RepoSort, type TypeSort } from './map-view'
import ExploreView from './explore-view'
import { ChangesView, ConnectionsView, HealthView, ValuesView } from './views'
import BoardView from './board'
import Drawer from './drawer'
import SuggestDialog, { type SuggestRequest } from './suggest'
import './schema-studio.css'

const VIEWS: { key: StudioView; label: string; icon: typeof MapIcon; help: string }[] = [
  { key: 'map', label: 'Map', icon: MapIcon, help: 'The whole system on one page' },
  { key: 'explore', label: 'Explore', icon: Table2, help: 'Sortable, filterable tables of fields, record types and repositories' },
  { key: 'connections', label: 'Connections', icon: Grid3x3, help: 'Which repository points at which' },
  { key: 'values', label: 'Fixed values', icon: ListFilter, help: 'Every list of allowed answers' },
  { key: 'health', label: 'Health', icon: AlertTriangle, help: 'Places worth a second look' },
  { key: 'changes', label: 'Changes', icon: GitCompareArrows, help: 'What moved between snapshots' },
  { key: 'board', label: 'Suggestions', icon: MessageSquarePlus, help: 'Basket and shared board' },
]
const LENSES: { key: Lens; label: string; help: string }[] = [
  { key: 'structure', label: 'Structure', help: 'Record types and their main fields' },
  { key: 'meaning', label: 'Meaning', help: 'Plain-language explanation under each name' },
  { key: 'links', label: 'Links', help: 'Fade everything except the fields that link to other records' },
  { key: 'data', label: 'Data', help: 'How many records each type holds' },
  { key: 'health', label: 'Health', help: 'Findings for each record type' },
  { key: 'shared', label: 'Shared names', help: 'Highlight field names used again and again' },
  { key: 'naming', label: 'Spelling', help: 'camelCase against snake_case' },
]
const isView = (v: string | null): v is StudioView => !!v && VIEWS.some((x) => x.key === v)
const isLens = (v: string | null): v is Lens => !!v && LENSES.some((x) => x.key === v)

export interface StudioProps {
  supabase: SupabaseClient<any>
  userId: string | null
  userEmail?: string | null
  /** Used by the development page, which has no sign-in. */
  standalone?: boolean
}

export default function SchemaStudio({ supabase, userId, userEmail, standalone }: StudioProps) {
  const [params, setParams] = useSearchParams()
  const [loaded, setLoaded] = useState<LoadedSnapshot | { error: string } | null>(null)
  const [fresh, setFresh] = useState<{ hash: string } | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [boardOn, setBoardOn] = useState(false)
  const [basket, setBasket] = useState<DraftSuggestion[]>([])
  const [request, setRequest] = useState<SuggestRequest | null>(null)
  const [guide, setGuide] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [repoSort, setRepoSort] = useState<RepoSort>('template')
  const [typeSort, setTypeSort] = useState<TypeSort>('schema')
  const [desc, setDesc] = useState(false)
  const [busyPng, setBusyPng] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const mapShot = useRef<HTMLDivElement>(null)

  const view: StudioView = isView(params.get('sv')) ? (params.get('sv') as StudioView) : 'map'
  const lens: Lens = isLens(params.get('lens')) ? (params.get('lens') as Lens) : 'structure'
  const query = params.get('q') ?? ''
  const selection: Selection = useMemo(() => parseSelection(params.get('sel')), [params])
  const parsed = useMemo(() => parseQuery(query), [query])

  const patch = useCallback((kv: Record<string, string | null>) => {
    setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(kv)) { if (v) n.set(k, v); else n.delete(k) } return n }, { replace: true })
  }, [setParams])

  // Load the snapshot, and check for a newer one every few minutes and when the tab comes back into view.
  const reload = useCallback(async () => { const l = await loadSnapshot(supabase); setLoaded(l); setFresh(null); setNow(Date.now()) }, [supabase])
  useEffect(() => { reload() }, [reload])
  const currentHash = loaded && 'info' in loaded ? loaded.info.contentHash : null
  useEffect(() => {
    if (!currentHash || (loaded && 'source' in loaded && loaded.source !== 'live')) return
    const check = async () => {
      const { data } = await (supabase as any).from('schema_studio_snapshot').select('content_hash').order('id', { ascending: false }).limit(1)
      const h = data?.[0]?.content_hash
      if (h && h !== currentHash) setFresh({ hash: h })
      setNow(Date.now())
    }
    const t = window.setInterval(check, 5 * 60 * 1000)
    const vis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', vis)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [currentHash, loaded, supabase])

  const model: Model | null = useMemo(() => (loaded && 'snapshot' in loaded ? buildModel(loaded.snapshot) : null), [loaded])

  const reloadSuggestions = useCallback(async () => {
    const r = await listSuggestions(supabase, userId)
    setSuggestions(r.items); setBoardOn(r.available)
  }, [supabase, userId])
  useEffect(() => { reloadSuggestions() }, [reloadSuggestions])
  useEffect(() => { if (userId) setBasket(readBasket(userId)) }, [userId])
  const saveBasket = (items: DraftSuggestion[]) => { setBasket(items); if (userId) writeBasket(userId, items) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape' && tag !== 'INPUT' && tag !== 'TEXTAREA') patch({ sel: null })
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [patch])

  // When a record type is selected on the map, bring its tile into view.
  const selKey = selectionKey(selection)
  useEffect(() => {
    if (view !== 'map' || !model || !selection) return
    const typeId = selection.kind === 'type' ? selection.typeId : selection.kind === 'field' ? model.fieldById.get(selection.fieldId)?.typeId : null
    if (typeId) document.getElementById(`ss-tile-${typeId.replace(/\W/g, '_')}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, view])

  const match = (s: Suggestion | DraftSuggestion, t: Target) => s.target_repo === t.repo && (!t.type || s.target_type === t.type) && (!t.field || s.target_field === t.field)
  const ctx: StudioCtx | null = model ? {
    model, selection, select: (s) => patch({ sel: s ? selectionKey(s) : null }), view, setView: (v) => patch({ sv: v === 'map' ? null : v }), lens, query, parsed,
    setQuery: (q) => patch({ q: q || null }), openSuggest: (target, kind, prefill) => setRequest({ target, kind, prefill }),
    suggestions, basket, suggestionsFor: (t) => suggestions.filter((s) => s.status !== 'declined' && s.status !== 'applied' && match(s, t)), basketFor: (t) => basket.filter((s) => match(s, t)),
    openFinding: (f: Finding) => setRequest({ target: f.targets[0] ?? { repo: f.repos[0] ?? 'system' }, kind: 'other', prefill: { summary: f.title.slice(0, 200), current_value: f.plain, rationale: f.why } }),
    now, history: loaded && 'history' in loaded ? loaded.history : [],
  } : null

  const actions = useMemo(() => ({
    available: boardOn, me: userEmail ?? null,
    sendDraft: async (d: DraftSuggestion) => (userId ? addSuggestion(supabase, userId, d) : 'You need to be signed in.'),
    removeDraft: (id: string) => saveBasket(basket.filter((b) => b.localId !== id)),
    setStatus: async (id: string, status: Suggestion['status'], note?: string) => setSuggestionStatus(supabase, id, status, note, userId ?? undefined),
    agree: async (id: string, on: boolean) => (userId ? toggleAgree(supabase, userId, id, on) : null),
    comment: async (id: string, body: string) => (userId ? addComment(supabase, userId, id, body) : null),
    markExported: async (ids: string[], batch: string) => markExported(supabase, ids, batch),
    reload: reloadSuggestions,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [boardOn, userId, userEmail, supabase, basket, reloadSuggestions])

  const savePng = async () => {
    if (!mapShot.current) return
    setBusyPng(true)
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const canvas = await html2canvas(mapShot.current, { backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff', scale: 2, useCORS: true })
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `openevo-base-repositories-${new Date().toISOString().slice(0, 10)}.png`; a.click()
    } finally { setBusyPng(false) }
  }

  if (!loaded) return <div className="ss-studio"><p className="ss-hint">Loading the structure...</p></div>
  if ('error' in loaded || !model || !ctx) {
    return (
      <div className="ss-studio"><div className="ss-empty-state">
        <h3>No snapshot of the structure yet</h3>
        <p>The Schema Studio reads a snapshot of every base repository's schema files from the database. {'error' in loaded ? `(${loaded.error})` : ''}</p>
        <p>An administrator creates the first one with <code>node scripts/sync_schema_studio_snapshot.mjs --yes</code> after migration 253 is applied. After that the scheduled sync keeps it current.</p>
      </div></div>
    )
  }

  const info = loaded.info
  const sourceNote = loaded.source === 'local-file' ? 'Local development file (not yet in the database)' : 'From the database'
  const basketCount = basket.length
  const openFindings = model.findings.filter((f) => f.severity === 'attention').length

  return (
    <StudioContext.Provider value={ctx}>
      <div className="ss-studio">
        <header className="ss-top">
          <div className="ss-title">
            <h2><Sparkles size={17} /> Base Repo Schema Studio</h2>
            <p>The structure of every base repository and how the pieces connect. Pick anything to see what it means in plain words, and suggest improvements.</p>
          </div>
          <div className="ss-fresh" title={`Content hash ${info.contentHash.slice(0, 12)}. ${sourceNote}. The structure refreshes about once a day and straight away when a repository reports a schema change.`}>
            <span className={`ss-dot ${loaded.source === 'live' ? 'live' : 'local'}`} />Structure as of <b>{agoText(info.generatedAt, now)}</b>
            <span className="ss-dim"> · {model.stats.repos} repositories · {model.stats.types} record types · {model.stats.fields} fields · {model.stats.crossLinks} links between repositories</span>
          </div>
        </header>

        {fresh && (
          <div className="ss-banner" role="status"><RefreshCw size={14} /> The structure has changed since you opened this page.
            <button type="button" className="btn btn-mini btn-primary" onClick={reload}>Update the view</button></div>
        )}
        {loaded.source === 'local-file' && !standalone && <div className="ss-banner warn" role="status">Showing a local development snapshot. In production the snapshot comes from the database (migration 253 and the sync script).</div>}

        <div className="ss-bar">
          <div className="ss-tabs" role="tablist" aria-label="Views">
            {VIEWS.map((v) => {
              const Icon = v.icon
              const badge = v.key === 'health' ? openFindings : v.key === 'board' ? suggestions.filter((s) => s.status === 'open').length + basketCount : 0
              return <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''} title={v.help} onClick={() => ctx.setView(v.key)}><Icon size={14} />{v.label}{badge > 0 && <i>{badge}</i>}</button>
            })}
          </div>
          <label className="ss-search">
            <Search size={14} />
            <input ref={searchRef} value={query} onChange={(e) => ctx.setQuery(e.target.value)} placeholder='Search names, meanings and values. Try  repo:theory  links:literature  is:required   (press /)' aria-label="Search" />
            {query && <button type="button" aria-label="Clear search" onClick={() => ctx.setQuery('')}><X size={13} /></button>}
          </label>
          <button type="button" className={`btn btn-mini${guide ? ' btn-primary' : ''}`} onClick={() => setGuide((g) => !g)}><HelpCircle size={13} /> How to read this</button>
        </div>

        {view === 'map' && (
          <div className="ss-controls">
            <div className="ss-lenses" role="radiogroup" aria-label="Lens"><span className="ss-dim">Show</span>
              {LENSES.map((l) => <button key={l.key} role="radio" aria-checked={lens === l.key} className={lens === l.key ? 'on' : ''} title={l.help} onClick={() => patch({ lens: l.key === 'structure' ? null : l.key })}>{l.label}</button>)}
            </div>
            <div className="ss-sorts"><ArrowDownUp size={13} />
              <label>Repositories <select value={repoSort} onChange={(e) => setRepoSort(e.target.value as RepoSort)}><option value="template">Diagram order</option><option value="name">Name</option><option value="types">Record types</option><option value="fields">Fields</option><option value="records">Records</option><option value="links">Links out</option><option value="changed">Last schema change</option><option value="findings">Findings</option></select></label>
              <label>Record types <select value={typeSort} onChange={(e) => setTypeSort(e.target.value as TypeSort)}><option value="schema">Schema order</option><option value="name">Name</option><option value="fields">Fields</option><option value="records">Records</option><option value="links">Links</option><option value="findings">Findings</option><option value="documented">Described</option></select></label>
              <button type="button" className={`btn btn-mini${desc ? ' btn-primary' : ''}`} onClick={() => setDesc((d) => !d)} title="Reverse the order (largest first for numbers, Z-A for names)">{desc ? 'Reversed' : 'Reverse'}</button>
            </div>
            <button type="button" className="btn btn-mini" onClick={savePng} disabled={busyPng}><Camera size={13} /> {busyPng ? 'Saving...' : 'Save as image'}</button>
          </div>
        )}

        {guide && <Guide onClose={() => setGuide(false)} />}

        {!parsed.empty && <p className="ss-hint ss-filterline">Filtering by <b>{query}</b>. <button type="button" className="ss-link-btn" onClick={() => ctx.setQuery('')}>Clear</button></p>}

        <div className={`ss-main${selection ? ' with-drawer' : ''}`}>
          <div className="ss-content" ref={mapShot}>
            {view === 'map' && <MapView repoSort={repoSort} typeSort={typeSort} desc={desc} />}
            {view === 'explore' && <ExploreView />}
            {view === 'connections' && <ConnectionsView />}
            {view === 'values' && <ValuesView />}
            {view === 'health' && <HealthView />}
            {view === 'changes' && <ChangesView loadOther={(id) => loadSnapshotById(supabase, id)} />}
            {view === 'board' && <BoardView actions={actions} />}
          </div>
          <Drawer />
        </div>

        {request && (
          <SuggestDialog req={request} model={model} canSend={boardOn && !!userId} onClose={() => setRequest(null)}
            onBasket={(d) => saveBasket([d, ...basket])}
            onSend={async (d) => { const e = userId ? await addSuggestion(supabase, userId, d) : 'You need to be signed in.'; if (!e) reloadSuggestions(); return e }} />
        )}
      </div>
    </StudioContext.Provider>
  )
}

function Guide({ onClose }: { onClose: () => void }) {
  return (
    <section className="ss-guide" aria-label="How to read the Studio">
      <button type="button" className="ss-iconbtn ss-guide-x" aria-label="Close" onClick={onClose}><X size={15} /></button>
      <div className="ss-guide-cols">
        <div>
          <h4><BookOpen size={14} /> Reading the map</h4>
          <ul>
            <li><b>Left box</b> is a repository. <b>Right panel</b> holds its record types, one card each. <b>Dark column</b> on the right is the shared kernel every repository builds on.</li>
            <li><b>Curved lines</b> in the left margin join repositories that point at each other. The line is thicker when more fields link. A dashed line goes to a retired repository.</li>
            <li><span className="ss-key pk">PK</span> the permanent id. <span className="ss-key fk">FK</span> a field that holds the id of a record somewhere else, with a coloured tag for the repository it points into. <span className="ss-req">●</span> required. <b>#</b> a fixed list of values. A list icon marks a list.</li>
            <li>Click a repository, a record type or a field. The panel on the right explains it in plain words and lists everything around it.</li>
          </ul>
        </div>
        <div>
          <h4><Search size={14} /> Searching and sorting</h4>
          <ul>
            <li>Type words to search names, descriptions and allowed values. Add operators: <code>repo:theory</code> <code>type:proposition</code> <code>field:related</code> <code>links:literature</code> <code>has:enum</code> <code>is:required</code> <code>undocumented</code>.</li>
            <li>On the Explore tab click any column heading to sort. Shift-click adds a second sort. Use Columns to show more, and CSV to download what you see.</li>
            <li>On the Map, the Show buttons change what each card emphasises, and the sort menus reorder repositories and record types.</li>
            <li>Every view has its own web address. Copy it from the link button in the panel to share exactly what you are looking at.</li>
          </ul>
        </div>
        <div>
          <h4><MessageSquarePlus size={14} /> Suggesting changes</h4>
          <ul>
            <li>Press <b>Suggest a change</b> in any panel. Say what kind of change, what it says now, what it should say, and why.</li>
            <li>Add it to your <b>basket</b> to collect several, or send it to the shared <b>board</b>, where others can agree, comment and decide.</li>
            <li>Accepted suggestions can be exported as Markdown and taken into the repository through a normal pull request.</li>
          </ul>
          <h4 style={{ marginTop: 10 }}>Words used here</h4>
          <dl className="ss-gloss">{GLOSSARY.slice(0, 6).map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.plain}</dd></div>)}</dl>
        </div>
      </div>
    </section>
  )
}
