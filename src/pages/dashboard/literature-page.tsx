import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, Plus, Search } from 'lucide-react'
import { searchOpenAlex, type SearchResult } from '@/lib/api/openalex'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { logActivity } from '@/lib/supabase/activity'

type LiteratureRow = Database['public']['Tables']['literature_references']['Row']

export default function LiteraturePage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [items, setItems] = useState<LiteratureRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

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

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setNotice(null)
    const { results: found } = await searchOpenAlex(query.trim())
    setResults(found)
    setSearching(false)
  }

  const alreadySaved = (r: SearchResult) => (items ?? []).some((it) => it.openalex_id === r.openAlexId || (r.doi && it.doi === r.doi))

  const addToProject = async (r: SearchResult) => {
    setSavingId(r.openAlexId)
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
        openalex_id: r.openAlexId,
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

  return (
    <div>
      <h1>Literature</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        The evidence this project&apos;s content is grounded in. Search OpenAlex to find and add
        real papers — everything below is already part of {project.name}&apos;s own collection.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>{notice.text}</div>
      )}

      <div className="card">
        <h3>Search OpenAlex</h3>
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
                <div key={r.openAlexId} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''} — {r.venue ?? 'unknown venue'} ({r.year || 'n.d.'})
                    </div>
                  </div>
                  {alreadySaved(r) ? (
                    <span className="chip chip-good">Already added</span>
                  ) : (
                    <button className="btn btn-mini" onClick={() => addToProject(r)} disabled={savingId === r.openAlexId}>
                      <Plus size={11} />
                      {savingId === r.openAlexId ? 'Adding…' : 'Add'}
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
            <div key={it.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ marginBottom: 2 }}>{it.title}</h3>
                <Chip status={it.status} />
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {(Array.isArray(it.authors) ? it.authors : []).slice(0, 3).join(', ')} — {it.venue ?? 'unknown venue'} ({it.year ?? 'n.d.'})
              </span>
              {it.doi && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>DOI: {it.doi}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
