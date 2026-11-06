import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Link2, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  ITEM_TYPE_LABEL,
  createContextItem,
  deleteContextItem,
  listContextItems,
  listGeoPlaces,
  updateContextItem,
  type ContextItemInput,
  type ContextItemRow,
  type GeoPlaceRow,
} from '@/lib/supabase/context-items'
import { listRepositoryRecords, type RepositoryRecordRow } from '@/lib/supabase/curriculum-repository'

function emptyDraft(): ContextItemInput {
  return {
    itemType: 'news-article',
    title: '',
    url: null,
    summary: null,
    sourceOutlet: null,
    publishedAt: null,
    placeCode: null,
    repositoryRecordId: null,
  }
}

// Real-world news articles, public debates, and standing "key issues"
// (schema foundation migration 094's context_items table) -- distinct from
// openevo-graph's academic dispute-graph, which models theoretical
// disagreements about how to teach a concept rather than a real-world
// policy controversy tied to a place and time. Browsable by any member;
// add/edit/delete gated to owners/maintainers, matching context_items' own
// RLS policies exactly (see migration 094) rather than a separate app-side
// rule that could drift from it.
export default function ContextItemsPage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const canManage = role === 'owner' || role === 'maintainer'

  // A curriculum-repository-custom-view (migration 095) holds no content of
  // its own -- same parent resolution curriculum-repository-page.tsx and
  // timeline-page.tsx already use.
  const repoProjectId =
    (project as any).project_kind === 'curriculum-repository-custom-view'
      ? ((project as any).parent_project_id ?? project.id)
      : project.id

  const [items, setItems] = useState<ContextItemRow[] | null>(null)
  const [places, setPlaces] = useState<GeoPlaceRow[]>([])
  const [records, setRecords] = useState<RepositoryRecordRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = () => listContextItems(supabase, repoProjectId).then(setItems)

  useEffect(() => {
    setItems(null)
    reload()
    listGeoPlaces(supabase).then(setPlaces)
    listRepositoryRecords(supabase, repoProjectId).then(setRecords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, repoProjectId])

  const placeLabel = (code: string | null) => (code ? places.find((p) => p.place_code === code)?.display_name ?? code : null)
  const recordTitle = (id: string | null) => (id ? records.find((r) => r.id === id)?.title ?? null : null)

  const submitCreate = async (input: ContextItemInput) => {
    const { error } = await createContextItem(supabase, repoProjectId, input)
    if (error) { setNotice({ kind: 'bad', text: error }); return false }
    setNotice({ kind: 'ok', text: `Added "${input.title}".` })
    setShowCreate(false)
    await reload()
    return true
  }

  const submitEdit = async (id: string, input: ContextItemInput) => {
    const { error } = await updateContextItem(supabase, id, input)
    if (error) { setNotice({ kind: 'bad', text: error }); return false }
    setNotice({ kind: 'ok', text: 'Saved.' })
    setEditingId(null)
    await reload()
    return true
  }

  const doDelete = async (item: ContextItemRow) => {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return
    const { error } = await deleteContextItem(supabase, item.id)
    if (error) { setNotice({ kind: 'bad', text: error }); return }
    await reload()
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="row"><Newspaper size={18} style={{ color: 'var(--text-muted)' }} />News, Debates &amp; Key Issues</h1>
          <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
            Real-world news articles, public debates, and standing issues relevant to this
            repository — optionally tied to a place, and to a specific record below.
          </p>
        </div>
        {canManage && !showCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} />Add context item</button>
        )}
      </div>

      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <ContextItemForm
            initial={emptyDraft()}
            places={places}
            records={records}
            submitLabel="Add"
            onSubmit={submitCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          <Newspaper size={32} />
          <p>No context items yet.</p>
          {canManage && <p className="muted">Add the first news article, debate, or key issue above.</p>}
        </div>
      ) : (
        <div className="grid grid-2">
          {items.map((item) => (
            <div key={item.id} className="card">
              {editingId === item.id ? (
                <ContextItemForm
                  initial={{
                    itemType: item.item_type,
                    title: item.title,
                    url: item.url,
                    summary: item.summary,
                    sourceOutlet: item.source_outlet,
                    publishedAt: item.published_at,
                    placeCode: item.place_code,
                    repositoryRecordId: item.repository_record_id,
                  }}
                  places={places}
                  records={records}
                  submitLabel="Save"
                  onSubmit={(input) => submitEdit(item.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="chip" style={{ fontSize: 10 }}>{ITEM_TYPE_LABEL[item.item_type] ?? item.item_type}</span>
                      <h3 style={{ margin: '4px 0 2px' }}>
                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> : item.title}
                      </h3>
                    </div>
                    {canManage && (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn-linklike" aria-label="Edit" title="Edit" style={{ padding: 0, display: 'inline-flex' }} onClick={() => setEditingId(item.id)}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn-linklike" aria-label="Delete" title="Delete" style={{ padding: 0, display: 'inline-flex', color: 'var(--critical)' }} onClick={() => doDelete(item)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {[item.source_outlet, item.published_at, placeLabel(item.place_code)].filter(Boolean).join(' · ')}
                  </div>
                  {item.summary && <p style={{ fontSize: 13, marginTop: 6 }}>{item.summary}</p>}
                  {item.repository_record_id && (
                    <div className="row" style={{ gap: 4, marginTop: 6 }}>
                      <Link2 size={12} style={{ color: 'var(--text-muted)' }} />
                      <span className="muted" style={{ fontSize: 12 }}>{recordTitle(item.repository_record_id) ?? 'Linked record'}</span>
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

// Shared by both the "Add context item" card and each item's inline edit --
// same title/URL/summary/source/date/place/record-link fields either way.
function ContextItemForm({
  initial,
  places,
  records,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ContextItemInput
  places: GeoPlaceRow[]
  records: RepositoryRecordRow[]
  submitLabel: string
  onSubmit: (input: ContextItemInput) => Promise<boolean>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ContextItemInput>(initial)
  const [recordQuery, setRecordQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkedRecord = draft.repositoryRecordId ? records.find((r) => r.id === draft.repositoryRecordId) ?? null : null
  const recordMatches =
    recordQuery.trim().length >= 2
      ? records.filter((r) => r.title.toLowerCase().includes(recordQuery.trim().toLowerCase())).slice(0, 8)
      : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) { setError('Title is required.'); return }
    setBusy(true)
    setError(null)
    const ok = await onSubmit({
      ...draft,
      title: draft.title.trim(),
      url: draft.url?.trim() || null,
      summary: draft.summary?.trim() || null,
      sourceOutlet: draft.sourceOutlet?.trim() || null,
    })
    setBusy(false)
    if (!ok) setError('Could not save.')
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-bad">{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Kind</label>
          <select value={draft.itemType} onChange={(e) => setDraft({ ...draft, itemType: e.target.value })}>
            {Object.entries(ITEM_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 160 }}>
          <label>Publication date</label>
          <input type="date" value={draft.publishedAt ?? ''} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value || null })} />
        </div>
      </div>
      <div className="field">
        <label>Title</label>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Thuringia legislature debates new civics standard" />
      </div>
      <div className="field">
        <label>URL</label>
        <input value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value || null })} placeholder="https://…" />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Source outlet</label>
          <input value={draft.sourceOutlet ?? ''} onChange={(e) => setDraft({ ...draft, sourceOutlet: e.target.value || null })} placeholder="e.g. MDR Thüringen" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Place (optional)</label>
          <select value={draft.placeCode ?? ''} onChange={(e) => setDraft({ ...draft, placeCode: e.target.value || null })}>
            <option value="">No place tag</option>
            {places.map((p) => <option key={p.place_code} value={p.place_code}>{p.display_name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Summary</label>
        <textarea rows={3} value={draft.summary ?? ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value || null })} />
      </div>
      <div className="field">
        <label>Relevant record (optional)</label>
        {linkedRecord ? (
          <div className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: 13 }}>{linkedRecord.title}</span>
            <button type="button" className="btn-linklike" onClick={() => setDraft({ ...draft, repositoryRecordId: null })}>Remove</button>
          </div>
        ) : (
          <>
            <input value={recordQuery} onChange={(e) => setRecordQuery(e.target.value)} placeholder="Search this repository's records by title…" />
            {recordMatches.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 13 }}>{r.title}</span>
                <button type="button" className="btn btn-mini" onClick={() => { setDraft({ ...draft, repositoryRecordId: r.id }); setRecordQuery('') }}>Link</button>
              </div>
            ))}
            {recordQuery.trim().length >= 2 && recordMatches.length === 0 && <p className="muted" style={{ fontSize: 12 }}>No matches.</p>}
          </>
        )}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button type="submit" className="btn btn-mini btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn btn-mini" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
