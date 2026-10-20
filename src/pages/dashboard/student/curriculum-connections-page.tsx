import { useMemo, useState } from 'react'
import { Link2, Pencil, Plus, Save, X } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS, type ConnectionsStrings } from './curriculum-connections-strings'
import {
  RECORD_TYPE_LABEL,
  createContentLink,
  updateContentLinkRationale,
  type DataObjectLinkWithRecord,
  type RepositoryRecordRow,
} from '@/lib/supabase/curriculum-repository'
import { RecordKindIcon } from '@/lib/record-type-display'

// The "Overview" / "Übersicht" page -- the project's own root page for all
// 4 2026-10-20 German/US custom views (replaces reusing the plain
// researcher LearningGoalsPage there, which wasn't template-language-aware).
// Redesigned 2026-10-20 from a single flat page into this page plus 3
// siblings (Network, Comparison, Report), each its own real sidebar nav
// item, per that day's feedback: "much more strategic use of custom side
// bar menus."
const GRADE_BANDS = ['K-2', '3-5', '6-8', '9-12']

export default function CurriculumConnectionsPage() {
  const data = useCurriculumConnectionsData()
  const { project, supabase, config, canEdit, topics, linksByObject, regionRecords, profile, comparativeLinks, coverage, refresh } = data
  const t = STRINGS[config?.language ?? 'en']

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const selectedTopic = useMemo(() => topics?.find((tp) => tp.id === selectedId) ?? null, [topics, selectedId])
  const effectiveSelectedId = selectedId ?? (topics && topics.length > 0 ? topics[0].id : null)
  const effectiveSelectedTopic = selectedTopic ?? (topics?.find((tp) => tp.id === effectiveSelectedId) ?? null)
  const selectedLinks = effectiveSelectedId ? linksByObject[effectiveSelectedId] ?? [] : []

  if (!config) return <p className="muted">Unknown view configuration.</p>

  const bandCoverage = GRADE_BANDS.map((b) => (topics ?? []).some((tp) => tp.grade_band === b))

  return (
    <div>
      <h1 className="row"><Link2 size={18} style={{ color: 'var(--text-muted)' }} />{t.overviewTitle}</h1>
      <p className="muted" style={{ marginBottom: 4, maxWidth: 640 }}>{t.overviewIntro(config.regionLabel)}</p>
      <p className="muted" style={{ fontSize: 12, marginBottom: 14, maxWidth: 640 }}>{t.overviewHelp}</p>

      {profile && (
        <>
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            {[
              { label: t.overviewStrands, value: profile.strand_count },
              { label: t.overviewGradeBands, value: profile.grade_bands_covered },
              { label: t.overviewTheories, value: profile.theory_count },
              { label: t.overviewLiterature, value: profile.literature_count },
              { label: t.overviewRealWorld, value: profile.curriculum_repository_link_count },
              { label: t.overviewComparisons, value: comparativeLinks?.length ?? 0 },
            ].map((tile) => (
              <div key={tile.label} className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--series-a)' }}>{tile.value}</div>
                <div className="muted" style={{ fontSize: 12 }}>{tile.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <strong style={{ fontSize: 13 }}>{t.overviewCoverage}</strong>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              {GRADE_BANDS.map((band, i) => (
                <div key={band} style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: bandCoverage[i] ? 'var(--series-a)' : 'var(--surface-1)',
                      color: bandCoverage[i] ? '#fff' : 'var(--text-muted)',
                      border: bandCoverage[i] ? 'none' : '1px dashed var(--border)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {band}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {coverage.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 13 }}>{t.overviewDivergences}</strong>
              <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                {coverage.length} · {coverage.filter((c) => c.is_stale).length > 0 ? `${coverage.filter((c) => c.is_stale).length} stale` : '0 stale'}
              </p>
            </div>
          )}
        </>
      )}

      <div className="grid grid-2" style={{ alignItems: 'flex-start', marginTop: 16 }}>
        <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <strong style={{ fontSize: 12 }}>{t.topics}</strong>
          {topics === null ? (
            <p className="muted">…</p>
          ) : (
            topics.map((tp) => (
              <button
                key={tp.id}
                className="btn-linklike"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: tp.id === effectiveSelectedId ? 600 : 400 }}
                onClick={() => { setSelectedId(tp.id); setShowAdd(false) }}
              >
                {tp.title}
                {linksByObject[tp.id]?.length ? <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>({linksByObject[tp.id].length})</span> : null}
              </button>
            ))
          )}
        </div>

        <div>
          {!effectiveSelectedTopic ? (
            <p className="muted">{t.selectTopic}</p>
          ) : (
            <div className="card">
              <strong>{effectiveSelectedTopic.title}</strong>
              <div style={{ marginTop: 10 }}>
                {selectedLinks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t.noConnections}</p>}
                {selectedLinks.map((link) => (
                  <ConnectionRow key={link.id} link={link} canEdit={canEdit} supabase={supabase} onSaved={refresh} t={t} />
                ))}
              </div>
              {canEdit && !showAdd && (
                <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>
                  <Plus size={12} />{t.addConnection}
                </button>
              )}
              {canEdit && showAdd && (
                <AddConnectionForm
                  t={t}
                  supabase={supabase}
                  projectId={project.id}
                  dataObjectId={effectiveSelectedTopic.id}
                  candidates={regionRecords}
                  onDone={() => { setShowAdd(false); refresh() }}
                  onCancel={() => setShowAdd(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConnectionRow({
  link,
  canEdit,
  supabase,
  onSaved,
  t,
}: {
  link: DataObjectLinkWithRecord
  canEdit: boolean
  supabase: ProjectOutletContext['supabase']
  onSaved: () => void
  t: ConnectionsStrings
}) {
  const [editing, setEditing] = useState(false)
  const [rationale, setRationale] = useState(link.rationale ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await updateContentLinkRationale(supabase, link.id, rationale)
    setBusy(false)
    setEditing(false)
    onSaved()
  }

  return (
    <div className="card" style={{ marginBottom: 6, padding: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 5 }}>
          <RecordKindIcon type={link.record.record_type} size={13} />
          <strong style={{ fontSize: 13 }}>{link.record.title}</strong>
        </span>
        <span className="muted" style={{ fontSize: 11 }}>{RECORD_TYPE_LABEL[link.record.record_type]}</span>
      </div>
      {editing ? (
        <div style={{ marginTop: 6 }}>
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} style={{ width: '100%' }} />
          <div className="row" style={{ marginTop: 4, gap: 6 }}>
            <button className="btn btn-mini btn-primary" disabled={busy} onClick={save}><Save size={11} />{t.save}</button>
            <button className="btn-linklike" onClick={() => { setEditing(false); setRationale(link.rationale ?? '') }}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{link.rationale || '—'}</p>
          {canEdit && (
            <button className="btn-linklike" onClick={() => setEditing(true)}><Pencil size={11} /></button>
          )}
        </div>
      )}
    </div>
  )
}

export function AddConnectionForm({
  t,
  supabase,
  projectId,
  dataObjectId,
  candidates,
  onDone,
  onCancel,
}: {
  t: ConnectionsStrings
  supabase: ProjectOutletContext['supabase']
  projectId: string
  dataObjectId: string
  candidates: RepositoryRecordRow[]
  onDone: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<RepositoryRecordRow | null>(null)
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return candidates.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 10)
  }, [query, candidates])

  const submit = async () => {
    if (!picked) return
    setBusy(true); setError(null)
    const { error: err } = await createContentLink(supabase, {
      projectId,
      dataObjectId,
      repositoryRecordId: picked.id,
      rationale: rationale.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err); return }
    onDone()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{t.addConnection}</strong>
        <button className="btn-linklike" onClick={onCancel}><X size={12} /></button>
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
      {picked ? (
        <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
          <span className="row" style={{ gap: 5, fontSize: 13 }}><RecordKindIcon type={picked.record_type} size={12} />{picked.title}</span>
          <button className="btn-linklike" onClick={() => setPicked(null)}>{t.cancel}</button>
        </div>
      ) : (
        <div className="field">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} />
          {results.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="row" style={{ gap: 5, fontSize: 13 }}><RecordKindIcon type={r.record_type} size={12} />{r.title}</span>
              <button className="btn btn-mini" onClick={() => setPicked(r)}>{t.connect}</button>
            </div>
          ))}
          {query.trim().length >= 2 && results.length === 0 && <p className="muted" style={{ fontSize: 12 }}>{t.noMatches}</p>}
        </div>
      )}
      <div className="field">
        <label>{t.rationaleLabel}</label>
        <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={t.rationalePlaceholder} />
      </div>
      <button className="btn btn-primary" disabled={!picked || busy} onClick={submit}>{busy ? t.connecting : t.connect}</button>
    </div>
  )
}
