import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { listGeoPlaces, type GeoPlaceRow } from '@/lib/supabase/context-items'
import {
  ASSET_TYPE_LABEL,
  createRegionalAsset,
  deleteRegionalAsset,
  listCoveredRepositories,
  listRegionalAssets,
  markRegionalAssetChecked,
  updateRegionalAsset,
  type RegionalAssetRow,
} from '@/lib/supabase/regional-assets'

interface Draft {
  projectId: string
  assetType: string
  name: string
  town: string
  placeCode: string
  url: string
  description: string
  topics: string
}

// Places near a repository's region that a teacher could use for learning outside the classroom: zoos, museums, research
// institutes. Migration 242. A state repository shows its own places. The Germany page shows all of its states together.
// Same access rules as the News & Debates page: members read, owners and maintainers add, change and delete.
export default function RegionalAssetsPage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const canManage = role === 'owner' || role === 'maintainer'
  const repoProjectId =
    (project as any).project_kind === 'curriculum-repository-custom-view' ? ((project as any).parent_project_id ?? project.id) : project.id

  const [repos, setRepos] = useState<{ id: string; name: string }[]>([])
  const [rows, setRows] = useState<RegionalAssetRow[] | null>(null)
  const [places, setPlaces] = useState<GeoPlaceRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async (ids: string[]) => {
    const res = await listRegionalAssets(supabase, ids)
    setRows(res.rows)
    setLoadError(res.error)
  }

  useEffect(() => {
    setRows(null)
    listCoveredRepositories(supabase, repoProjectId).then((r) => { setRepos(r); reload(r.map((x) => x.id)) })
    listGeoPlaces(supabase).then(setPlaces)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, repoProjectId])

  const repoName = (id: string) => repos.find((r) => r.id === id)?.name ?? ''
  const placeLabel = (code: string | null) => (code ? places.find((p) => p.place_code === code)?.display_name ?? code : null)
  const ids = useMemo(() => repos.map((r) => r.id), [repos])
  const typesPresent = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.asset_type))).sort(), [rows])
  const shown = (rows ?? []).filter((r) => !typeFilter || r.asset_type === typeFilter)
  const showRepoName = repos.length > 1

  const save = async (draft: Draft, id: string | null) => {
    const common = {
      assetType: draft.assetType,
      name: draft.name.trim(),
      town: draft.town.trim() || null,
      placeCode: draft.placeCode || null,
      url: draft.url.trim() || null,
      description: draft.description.trim() || null,
      topics: draft.topics.trim() || null,
    }
    const { error } = id ? await updateRegionalAsset(supabase, id, common) : await createRegionalAsset(supabase, { projectId: draft.projectId, ...common })
    if (error) { setNotice({ kind: 'bad', text: error }); return false }
    setNotice({ kind: 'ok', text: id ? 'Saved.' : `Added "${common.name}".` })
    setShowCreate(false)
    setEditingId(null)
    await reload(ids)
    return true
  }

  const checked = async (row: RegionalAssetRow) => {
    const { error } = await markRegionalAssetChecked(supabase, row.id)
    if (error) { setNotice({ kind: 'bad', text: error }); return }
    await reload(ids)
  }

  const remove = async (row: RegionalAssetRow) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    const { error } = await deleteRegionalAsset(supabase, row.id)
    if (error) { setNotice({ kind: 'bad', text: error }); return }
    await reload(ids)
  }

  const blank = (): Draft => ({ projectId: repoProjectId, assetType: 'museum', name: '', town: '', placeCode: '', url: '', description: '', topics: '' })

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="row"><Landmark size={18} style={{ color: 'var(--text-muted)' }} />Regional assets</h1>
          <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
            Places in this region where students can learn outside the classroom: zoos, museums, research institutes and similar.
          </p>
        </div>
        {canManage && !showCreate && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} />Add a place</button>}
      </div>

      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}
      {loadError && <div className="notice notice-bad">This list could not be loaded yet: {loadError}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <AssetForm initial={blank()} repos={repos} places={places} canChooseRepo submitLabel="Add" onSubmit={(d) => save(d, null)} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {typesPresent.length > 1 && (
        <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={`btn btn-mini${typeFilter === '' ? ' btn-primary' : ''}`} onClick={() => setTypeFilter('')}>All</button>
          {typesPresent.map((t) => (
            <button key={t} className={`btn btn-mini${typeFilter === t ? ' btn-primary' : ''}`} onClick={() => setTypeFilter(t)}>{ASSET_TYPE_LABEL[t] ?? t}</button>
          ))}
        </div>
      )}

      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card empty">
          <Landmark size={32} />
          <p>No places listed yet.</p>
          {canManage && <p className="muted">Add the first zoo, museum or research institute above.</p>}
        </div>
      ) : (
        <div className="grid grid-2">
          {shown.map((row) => (
            <div key={row.id} className="card">
              {editingId === row.id ? (
                <AssetForm
                  initial={{ projectId: row.project_id, assetType: row.asset_type, name: row.name, town: row.town ?? '', placeCode: row.place_code ?? '', url: row.url ?? '', description: row.description ?? '', topics: row.topics ?? '' }}
                  repos={repos} places={places} canChooseRepo={false} submitLabel="Save" onSubmit={(d) => save(d, row.id)} onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="chip" style={{ fontSize: 10 }}>{ASSET_TYPE_LABEL[row.asset_type] ?? row.asset_type}</span>
                      {row.review_status === 'claude-draft-unreviewed' && (
                        <span className="chip muted" style={{ fontSize: 10, marginLeft: 6 }} title="Claude drafted this entry. No expert has checked it yet.">Claude draft, unchecked</span>
                      )}
                      <h3 style={{ margin: '4px 0 2px' }}>{row.url ? <a href={row.url} target="_blank" rel="noreferrer">{row.name}</a> : row.name}</h3>
                    </div>
                    {canManage && (
                      <div className="row" style={{ gap: 6 }}>
                        {row.review_status === 'claude-draft-unreviewed' && (
                          <button className="btn-linklike" aria-label="Mark as checked" title="Mark as checked" style={{ padding: 0, display: 'inline-flex' }} onClick={() => checked(row)}><CheckCircle2 size={13} /></button>
                        )}
                        <button className="btn-linklike" aria-label="Edit" title="Edit" style={{ padding: 0, display: 'inline-flex' }} onClick={() => setEditingId(row.id)}><Pencil size={13} /></button>
                        <button className="btn-linklike" aria-label="Delete" title="Delete" style={{ padding: 0, display: 'inline-flex', color: 'var(--critical)' }} onClick={() => remove(row)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {[row.town, placeLabel(row.place_code), showRepoName ? repoName(row.project_id) : null].filter(Boolean).join(' · ')}
                  </div>
                  {row.description && <p style={{ fontSize: 13, marginTop: 6 }}>{row.description}</p>}
                  {row.topics && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Fits: {row.topics}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetForm({
  initial, repos, places, canChooseRepo, submitLabel, onSubmit, onCancel,
}: {
  initial: Draft
  repos: { id: string; name: string }[]
  places: GeoPlaceRow[]
  canChooseRepo: boolean
  submitLabel: string
  onSubmit: (d: Draft) => Promise<boolean>
  onCancel: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) { setError('A name is required.'); return }
    setBusy(true); setError(null)
    const ok = await onSubmit(d)
    setBusy(false)
    if (!ok) setError('Could not save.')
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-bad">{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Kind of place</label>
          <select value={d.assetType} onChange={(e) => set({ assetType: e.target.value })}>
            {Object.entries(ASSET_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {canChooseRepo && repos.length > 1 && (
          <div className="field" style={{ flex: 1 }}>
            <label>File under</label>
            <select value={d.projectId} onChange={(e) => set({ projectId: e.target.value })}>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="field"><label>Name</label><input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Zoo Leipzig" /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}><label>Town</label><input value={d.town} onChange={(e) => set({ town: e.target.value })} placeholder="e.g. Leipzig" /></div>
        <div className="field" style={{ flex: 1 }}>
          <label>State or country</label>
          <select value={d.placeCode} onChange={(e) => set({ placeCode: e.target.value })}>
            <option value="">Not set</option>
            {places.map((p) => <option key={p.place_code} value={p.place_code}>{p.display_name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Website</label><input value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></div>
      <div className="field"><label>What it is</label><textarea rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
      <div className="field"><label>Topics it fits</label><input value={d.topics} onChange={(e) => set({ topics: e.target.value })} placeholder="e.g. Primate behaviour; human evolution" /></div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button type="submit" className="btn btn-mini btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn btn-mini" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
