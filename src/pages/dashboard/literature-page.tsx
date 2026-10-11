import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { BookOpen, CheckCircle2, Info, Pencil, Plus, Search, Send, Tag } from 'lucide-react'
import { searchOpenAlex, type SearchResult as OpenAlexResult } from '@/lib/api/openalex'
import { searchSemanticScholar, type SearchResult as SemanticScholarResult } from '@/lib/api/semantic-scholar'
import { searchCrossRef, type CrossRefSearchResult } from '@/lib/api/crossref'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { logActivity } from '@/lib/supabase/activity'
import {
  createLiteratureContribution,
  findLiteraturebaseMatchesByDoi,
  getLiteraturebaseLink,
  getLiteraturebaseSnapshotByIds,
  listLiteratureContributions,
  searchLiteraturebaseSnapshot,
  setLiteraturebaseLink,
  type LiteraturebaseSnapshotRow,
  type LiteratureContributionRow,
  type ProjectBaseLinkRow,
} from '@/lib/supabase/literature'
import { buildLiteratureBaseDraftYaml } from '@/lib/literaturebase-export'

type LiteratureRow = Database['public']['Tables']['literature_references']['Row']
type Engine = 'openalex' | 'semantic_scholar' | 'crossref' | 'literaturebase'

// Real feedback c327878b (Dustin Eirdosh, 2026-10-02): "expand the search
// options with radio-selectors for OpenAlex, cross-ref, semantic scholar."
// Each engine's own client (src/lib/api/*) returns a differently-shaped
// result -- normalized here to one local shape so the rest of this page
// doesn't need to care which engine a result came from.
//
// Extended 2026-10-09 per feedback 36f3fe54 ("integrate with OpenEvo's
// LiteratureBase and validate across OpenAlex, Semantic Scholar, CrossRef")
// + f580e9a1 ("annotate and tag additions"): a fourth engine searches
// OpenEvo's own curated library directly, and every result -- regardless
// of which engine found it -- gets cross-checked by DOI against that same
// library so a "this is already a trusted source" badge shows either way.
const ENGINE_LABEL: Record<Engine, string> = { openalex: 'OpenAlex', semantic_scholar: 'Semantic Scholar', crossref: 'Crossref', literaturebase: 'OpenEvo LiteratureBase' }
const STATUS_OPTIONS: LiteratureRow['status'][] = ['draft', 'submitted', 'under_review', 'accepted', 'rejected']

interface LitResult {
  key: string
  doi: string | null
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  type: string
  openalexId: string | null
  semanticScholarId: string | null
  literaturebaseId: string | null
}

const fromOpenAlex = (r: OpenAlexResult): LitResult => ({
  key: r.openAlexId, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: r.type,
  openalexId: r.openAlexId, semanticScholarId: null, literaturebaseId: null,
})
const fromSemanticScholar = (r: SemanticScholarResult): LitResult => ({
  key: r.semanticScholarId, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: 'article',
  openalexId: null, semanticScholarId: r.semanticScholarId, literaturebaseId: null,
})
const fromCrossRef = (r: CrossRefSearchResult): LitResult => ({
  key: r.doi ?? r.title, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: r.type,
  openalexId: null, semanticScholarId: null, literaturebaseId: null,
})
const fromLiteraturebase = (r: LiteraturebaseSnapshotRow): LitResult => ({
  key: r.id, doi: r.doi, title: r.title, authors: r.authors ?? [], year: r.year, venue: r.venue, type: r.type ?? 'article',
  openalexId: null, semanticScholarId: null, literaturebaseId: r.id,
})

interface EditDraft {
  title: string
  authorsText: string
  venue: string
  year: string
  status: LiteratureRow['status']
  notes: string
  tagsText: string
}

export default function LiteraturePage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const canEdit = role !== 'viewer'
  const canManageBaseLink = role === 'owner' || role === 'maintainer'
  const [searchParams] = useSearchParams()
  const refParam = searchParams.get('ref')
  const highlightRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [items, setItems] = useState<LiteratureRow[] | null>(null)
  const [engine, setEngine] = useState<Engine>('openalex')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LitResult[] | null>(null)
  const [resultMatches, setResultMatches] = useState<Map<string, LiteraturebaseSnapshotRow>>(new Map())
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [annotatingKey, setAnnotatingKey] = useState<string | null>(null)
  const [addTags, setAddTags] = useState('')
  const [addNote, setAddNote] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [baseLink, setBaseLink] = useState<ProjectBaseLinkRow | null | undefined>(undefined)
  const [savedMatches, setSavedMatches] = useState<Map<string, LiteraturebaseSnapshotRow>>(new Map())

  const linked = !!baseLink

  const reload = async () => {
    const { data } = await supabase
      .from('literature_references')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    const ids = (data ?? []).map((it) => (it as any).literaturebase_id).filter(Boolean)
    setSavedMatches(await getLiteraturebaseSnapshotByIds(supabase, ids))
  }

  useEffect(() => {
    reload()
    getLiteraturebaseLink(supabase, project.id).then(setBaseLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const toggleBaseLink = async () => {
    await setLiteraturebaseLink(supabase, project.id, !linked)
    setBaseLink(await getLiteraturebaseLink(supabase, project.id))
  }

  // A search-bar hit for a reference in this project's own collection --
  // jump to and briefly highlight the matching card, since this page has no
  // separate detail view for one reference to link straight to.
  useEffect(() => {
    if (!refParam || !items) return
    const el = highlightRefs.current.get(refParam)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [refParam, items])

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setNotice(null)
    let found: LitResult[]
    if (engine === 'openalex') {
      found = (await searchOpenAlex(query.trim())).results.map(fromOpenAlex)
    } else if (engine === 'semantic_scholar') {
      found = (await searchSemanticScholar(query.trim())).results.map(fromSemanticScholar)
    } else if (engine === 'literaturebase') {
      found = (await searchLiteraturebaseSnapshot(supabase, query.trim())).map(fromLiteraturebase)
    } else {
      found = (await searchCrossRef(query.trim())).results.map(fromCrossRef)
    }
    setResults(found)
    // Cross-check every result's DOI against the real LiteratureBase corpus,
    // regardless of which engine found it (feedback 36f3fe54) -- only once
    // this project is actually linked (same explicit-opt-in convention as
    // TheoryBase), and skipped when the engine already *is* literaturebase,
    // since every one of those results is already a confirmed match by
    // construction.
    if (!linked || engine === 'literaturebase') {
      setResultMatches(new Map())
    } else {
      setResultMatches(await findLiteraturebaseMatchesByDoi(supabase, found.map((r) => r.doi).filter((d): d is string => !!d)))
    }
    setSearching(false)
  }

  const alreadySaved = (r: LitResult) =>
    (items ?? []).some(
      (it) => (r.doi && it.doi === r.doi) || (r.openalexId && it.openalex_id === r.openalexId) || (r.semanticScholarId && it.semantic_scholar_id === r.semanticScholarId)
    )

  // Either this result came straight from searching LiteratureBase itself
  // (a confirmed match by construction), or its DOI matched one of the
  // real records cross-checked for every other engine's results.
  const literaturebaseIdFor = (r: LitResult): string | null =>
    r.literaturebaseId ?? (r.doi ? resultMatches.get(r.doi)?.id ?? null : null)

  const addToProject = async (r: LitResult, tagsText: string, note: string) => {
    setSavingId(r.key)
    const litbaseId = literaturebaseIdFor(r)
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    const { data, error } = await (supabase as any)
      .from('literature_references')
      .insert({
        project_id: project.id,
        doi: r.doi,
        title: r.title,
        authors: r.authors,
        year: r.year || null,
        venue: r.venue,
        type: r.type === 'article' || r.type === 'book' || r.type === 'chapter' || r.type === 'report' || r.type === 'thesis' ? r.type : 'article',
        openalex_id: r.openalexId,
        semantic_scholar_id: r.semanticScholarId,
        literaturebase_id: litbaseId,
        tags,
        notes: note || null,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) {
      setNotice({ kind: 'bad', text: error.message })
    } else {
      setNotice({ kind: 'ok', text: `Added "${r.title}" to ${project.name}.` })
      await logActivity(supabase, { projectId: project.id, actionType: 'literature_added', targetType: 'literature_reference', targetId: data.id, details: { title: r.title } })
      setAnnotatingKey(null)
      setAddTags('')
      setAddNote('')
      await reload()
    }
    setSavingId(null)
  }

  const startEdit = (it: LiteratureRow) => {
    setEditingId(it.id)
    setDraft({
      title: it.title,
      authorsText: (Array.isArray(it.authors) ? it.authors : []).join(', '),
      venue: it.venue ?? '',
      year: it.year?.toString() ?? '',
      status: it.status,
      notes: (it as any).notes ?? '',
      tagsText: ((it as any).tags ?? []).join(', '),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }

  const saveEdit = async (id: string) => {
    if (!draft) return
    setSavingEdit(true)
    const { error } = await (supabase as any)
      .from('literature_references')
      .update({
        title: draft.title,
        authors: draft.authorsText.split(',').map((a) => a.trim()).filter(Boolean),
        venue: draft.venue || null,
        year: draft.year ? Number(draft.year) : null,
        status: draft.status,
        notes: draft.notes || null,
        tags: draft.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      })
      .eq('id', id)
    setSavingEdit(false)
    if (error) {
      setNotice({ kind: 'bad', text: error.message })
    } else {
      setNotice({ kind: 'ok', text: 'Saved.' })
      setEditingId(null)
      setDraft(null)
      await reload()
    }
  }

  return (
    <div>
      <h1>Literature</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        The evidence this project&apos;s content is grounded in. Search to find and add real
        papers — everything below is already part of {project.name}&apos;s own collection.
      </p>

      {baseLink === undefined ? null : !linked ? (
        <div className="notice" style={{ marginBottom: 16 }}>
          <Info size={14} />
          This project isn&apos;t linked to LiteratureBase yet — checking whether a paper is
          already one of OpenEvo&apos;s vetted sources, and proposing a paper you find back into
          that shared library, both need that link first.
          {canManageBaseLink && (
            <button className="btn btn-mini" style={{ marginLeft: 10 }} onClick={toggleBaseLink}>Link this project to LiteratureBase</button>
          )}
        </div>
      ) : (
        <div className="notice" style={{ marginBottom: 16 }}>
          <Info size={14} />
          Linked to LiteratureBase. Every search result below is checked against a
          periodically-refreshed copy of the real library (not a live connection), and any
          reference without a match can be proposed back to it.
          {canManageBaseLink && (
            <button className="btn-linklike" style={{ marginLeft: 10, fontSize: 12 }} onClick={toggleBaseLink}>Unlink</button>
          )}
        </div>
      )}

      {notice && (
        <div className={`notice notice-${notice.kind}`}>{notice.text}</div>
      )}

      <div className="card">
        <h3>Search for literature</h3>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {(Object.keys(ENGINE_LABEL) as Engine[]).filter((e) => e !== 'literaturebase' || linked).map((e) => (
            <button
              key={e}
              type="button"
              className={`chip-btn${engine === e ? ' active' : ''}`}
              onClick={() => { setEngine(e); setResults(null) }}
            >
              {ENGINE_LABEL[e]}
            </button>
          ))}
        </div>
        <form onSubmit={runSearch} className="row">
          <input
            type="search"
            placeholder="Search for papers by title, author, or topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-1)' }}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            <Search size={14} />
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results !== null && (
          <div style={{ marginTop: 14 }}>
            {results.length === 0 ? (
              <p className="muted">No results.</p>
            ) : (
              results.map((r) => {
                const litbaseMatch = literaturebaseIdFor(r)
                return (
                  <div key={r.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{r.title}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''} — {r.venue ?? 'unknown venue'} ({r.year || 'n.d.'})
                        </div>
                        {linked && (
                          litbaseMatch ? (
                            <span className="chip chip-good" style={{ fontSize: 10, marginTop: 4, display: 'inline-flex' }}>
                              <CheckCircle2 size={10} style={{ marginRight: 3 }} />Already in LiteratureBase
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>Not yet in LiteratureBase</span>
                          )
                        )}
                      </div>
                      {alreadySaved(r) ? (
                        <span className="chip chip-good">Already added</span>
                      ) : (
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn btn-mini" onClick={() => setAnnotatingKey(annotatingKey === r.key ? null : r.key)} title="Add with tags/notes">
                            <Tag size={11} />
                          </button>
                          <button className="btn btn-mini" onClick={() => addToProject(r, '', '')} disabled={savingId === r.key}>
                            <Plus size={11} />
                            {savingId === r.key ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      )}
                    </div>
                    {annotatingKey === r.key && (
                      <div className="card" style={{ marginTop: 6, background: 'var(--surface-1)' }}>
                        <div className="field">
                          <label>Tags (comma-separated)</label>
                          <input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="e.g. restructuration, agent-based-modeling" />
                        </div>
                        <div className="field">
                          <label>Note — why this reference matters</label>
                          <textarea rows={2} value={addNote} onChange={(e) => setAddNote(e.target.value)} />
                        </div>
                        <button className="btn btn-mini btn-primary" disabled={savingId === r.key} onClick={() => addToProject(r, addTags, addNote)}>
                          {savingId === r.key ? 'Adding…' : 'Add to project'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      <h2 style={{ marginTop: 20 }}>{project.name}&apos;s collection</h2>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          <BookOpen size={32} />
          <p>No literature added yet.</p>
          <p className="muted">Search above to add the first reference.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {items.map((it) => {
            const litbaseId = (it as any).literaturebase_id as string | null
            const tags = ((it as any).tags ?? []) as string[]
            return (
            <div
              key={it.id}
              ref={(el) => { if (el) highlightRefs.current.set(it.id, el); else highlightRefs.current.delete(it.id) }}
              className="card"
              style={it.id === refParam ? { outline: '2px solid var(--series-a)' } : undefined}
            >
              {editingId === it.id && draft ? (
                <div>
                  <div className="field">
                    <label>Title</label>
                    <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Authors (comma-separated)</label>
                    <input value={draft.authorsText} onChange={(e) => setDraft({ ...draft, authorsText: e.target.value })} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Venue</label>
                      <input value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
                    </div>
                    <div className="field" style={{ width: 90 }}>
                      <label>Year</label>
                      <input value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as LiteratureRow['status'] })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Tags (comma-separated)</label>
                    <input value={draft.tagsText} onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })} placeholder="e.g. restructuration, agent-based-modeling" />
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <button className="btn btn-mini btn-primary" disabled={savingEdit} onClick={() => saveEdit(it.id)}>
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-mini" disabled={savingEdit} onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ marginBottom: 2 }}>{it.title}</h3>
                    <div className="row" style={{ gap: 6 }}>
                      <Chip status={it.status} />
                      {canEdit && (
                        <button className="btn-linklike" aria-label="Edit" title="Edit" style={{ padding: 0, display: 'inline-flex' }} onClick={() => startEdit(it)}>
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {(Array.isArray(it.authors) ? it.authors : []).slice(0, 3).join(', ')} — {it.venue ?? 'unknown venue'} ({it.year ?? 'n.d.'})
                  </span>
                  {it.doi && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>DOI: {it.doi}</div>}
                  {litbaseId && (
                    <a
                      href={`https://github.com/openevo-ccs/literaturebase/blob/main/records/${litbaseId.replace(/^OE-LITERATURE-/, '')}.yaml`}
                      target="_blank" rel="noreferrer"
                      className="chip chip-good"
                      style={{ fontSize: 10, marginTop: 4, display: 'inline-flex', width: 'fit-content' }}
                    >
                      <CheckCircle2 size={10} style={{ marginRight: 3 }} />In LiteratureBase
                    </a>
                  )}
                  {tags.length > 0 && (
                    <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {tags.map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
                    </div>
                  )}
                  {(it as any).notes && (
                    <div style={{ fontSize: 12, marginTop: 6, padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 6 }}>
                      {(it as any).notes}
                    </div>
                  )}
                  {linked && canEdit && !litbaseId && (
                    <ProposeToLiteratureBase reference={it} projectId={project.id} supabase={supabase} />
                  )}
                </>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Propose to LiteratureBase -- the "sending back out" half of feedback
// 36f3fe54. Shown only for a reference not already linked to a real
// LiteratureBase record -- proposing something that's already a tracked
// match would be proposing LiteratureBase's own content back at itself.
// Mirrors theories-page.tsx's ProposeToTheoryBase.
// ============================================================================

function ProposeToLiteratureBase({
  reference,
  projectId,
  supabase,
}: {
  reference: LiteratureRow
  projectId: string
  supabase: ProjectOutletContext['supabase']
}) {
  const [contributions, setContributions] = useState<LiteratureContributionRow[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) listLiteratureContributions(supabase, reference.id).then(setContributions)
  }, [open, supabase, reference.id])

  const buildPreview = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setPreview(buildLiteratureBaseDraftYaml({ ...reference, notes: (reference as any).notes }, user?.email ?? 'an OpenLPM researcher'))
  }

  const submit = async () => {
    if (!preview) return
    setBusy(true); setError(null)
    try {
      await createLiteratureContribution(supabase, reference.id, projectId, preview)
      setPreview(null)
      setContributions(await listLiteratureContributions(supabase, reference.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this proposal.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-linklike" style={{ fontSize: 11, marginTop: 6 }} onClick={() => setOpen(true)}>
        <Send size={11} style={{ marginRight: 3 }} />Propose to LiteratureBase
      </button>
    )
  }

  return (
    <section style={{ marginTop: 8 }}>
      <p className="muted" style={{ fontSize: 11.5 }}>
        Package this reference in LiteratureBase&apos;s own record format and flag it for a human
        to actually commit to the real repo on a new branch, as a real reviewed contribution — not
        a silent copy. This doesn&apos;t touch the real LiteratureBase repo by itself.
      </p>
      {contributions.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {contributions.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
              <span>Proposed {new Date(c.created_at ?? '').toLocaleDateString()}</span>
              <span className="chip" style={{ fontSize: 10 }}>{c.status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
      {error && <div className="notice notice-bad">{error}</div>}
      {!preview ? (
        <button className="btn btn-mini" onClick={buildPreview}>Draft a proposal</button>
      ) : (
        <div className="card" style={{ marginTop: 6 }}>
          <strong style={{ fontSize: 12 }}>Draft record (review before sending)</strong>
          <pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: 'var(--surface-1)', padding: 8, borderRadius: 6 }}>{preview}</pre>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Recording…' : 'Record this proposal'}</button>
            <button className="btn-linklike" onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}
