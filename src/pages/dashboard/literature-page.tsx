import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { BookOpen, Pencil, Plus, Search } from 'lucide-react'
import { searchOpenAlex, type SearchResult as OpenAlexResult } from '@/lib/api/openalex'
import { searchSemanticScholar, type SearchResult as SemanticScholarResult } from '@/lib/api/semantic-scholar'
import { searchCrossRef, type CrossRefSearchResult } from '@/lib/api/crossref'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { logActivity } from '@/lib/supabase/activity'

type LiteratureRow = Database['public']['Tables']['literature_references']['Row']
type Engine = 'openalex' | 'semantic_scholar' | 'crossref'

// Real feedback c327878b (Dustin Eirdosh, 2026-10-02): "expand the search
// options with radio-selectors for OpenAlex, cross-ref, semantic scholar."
// Each engine's own client (src/lib/api/*) returns a differently-shaped
// result -- normalized here to one local shape so the rest of this page
// doesn't need to care which engine a result came from.
const ENGINE_LABEL: Record<Engine, string> = { openalex: 'OpenAlex', semantic_scholar: 'Semantic Scholar', crossref: 'Crossref' }
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
}

const fromOpenAlex = (r: OpenAlexResult): LitResult => ({
  key: r.openAlexId, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: r.type,
  openalexId: r.openAlexId, semanticScholarId: null,
})
const fromSemanticScholar = (r: SemanticScholarResult): LitResult => ({
  key: r.semanticScholarId, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: 'article',
  openalexId: null, semanticScholarId: r.semanticScholarId,
})
const fromCrossRef = (r: CrossRefSearchResult): LitResult => ({
  key: r.doi ?? r.title, doi: r.doi, title: r.title, authors: r.authors, year: r.year, venue: r.venue, type: r.type,
  openalexId: null, semanticScholarId: null,
})

interface EditDraft {
  title: string
  authorsText: string
  venue: string
  year: string
  status: LiteratureRow['status']
  notes: string
}

export default function LiteraturePage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const canEdit = role !== 'viewer'
  const [searchParams] = useSearchParams()
  const refParam = searchParams.get('ref')
  const highlightRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [items, setItems] = useState<LiteratureRow[] | null>(null)
  const [engine, setEngine] = useState<Engine>('openalex')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LitResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const reload = async () => {
    const { data } = await supabase
      .from('literature_references')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

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
    if (engine === 'openalex') {
      const { results: found } = await searchOpenAlex(query.trim())
      setResults(found.map(fromOpenAlex))
    } else if (engine === 'semantic_scholar') {
      const { results: found } = await searchSemanticScholar(query.trim())
      setResults(found.map(fromSemanticScholar))
    } else {
      const { results: found } = await searchCrossRef(query.trim())
      setResults(found.map(fromCrossRef))
    }
    setSearching(false)
  }

  const alreadySaved = (r: LitResult) =>
    (items ?? []).some(
      (it) => (r.doi && it.doi === r.doi) || (r.openalexId && it.openalex_id === r.openalexId) || (r.semanticScholarId && it.semantic_scholar_id === r.semanticScholarId)
    )

  const addToProject = async (r: LitResult) => {
    setSavingId(r.key)
    const { data, error } = await supabase
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
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) {
      setNotice({ kind: 'bad', text: error.message })
    } else {
      setNotice({ kind: 'ok', text: `Added "${r.title}" to ${project.name}.` })
      await logActivity(supabase, { projectId: project.id, actionType: 'literature_added', targetType: 'literature_reference', targetId: data.id, details: { title: r.title } })
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
      <p className="muted" style={{ marginBottom: 20 }}>
        The evidence this project&apos;s content is grounded in. Search to find and add real
        papers — everything below is already part of {project.name}&apos;s own collection.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>{notice.text}</div>
      )}

      <div className="card">
        <h3>Search for literature</h3>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {(Object.keys(ENGINE_LABEL) as Engine[]).map((e) => (
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
              results.map((r) => (
                <div key={r.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''} — {r.venue ?? 'unknown venue'} ({r.year || 'n.d.'})
                    </div>
                  </div>
                  {alreadySaved(r) ? (
                    <span className="chip chip-good">Already added</span>
                  ) : (
                    <button className="btn btn-mini" onClick={() => addToProject(r)} disabled={savingId === r.key}>
                      <Plus size={11} />
                      {savingId === r.key ? 'Adding…' : 'Add'}
                    </button>
                  )}
                </div>
              ))
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
          {items.map((it) => (
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
                  {(it as any).notes && (
                    <div style={{ fontSize: 12, marginTop: 6, padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 6 }}>
                      {(it as any).notes}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
