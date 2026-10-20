import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Link2, Pencil, Plus, Save, X } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import {
  RECORD_TYPE_LABEL,
  createContentLink,
  listContentLinksForDataObjects,
  listRepositoryRecordsForRegionSlugs,
  updateContentLinkRationale,
  type DataObjectLinkWithRecord,
  type RepositoryRecordRow,
} from '@/lib/supabase/curriculum-repository'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { RecordKindIcon } from '@/lib/record-type-display'

// Shared by all 4 of the 2026-10-20 German/US custom views (Bio-Core and
// Interdisciplinary LPM, each paired with a Sachsen/Thüringen view and a
// New York/California view) -- one page, config-driven by templateId
// (CURRICULUM_CONNECTIONS_VIEWS), rather than four forked copies. Pairs
// with the researcher Learning Goals page (same listTopics helper) as this
// view's other tab: this page is specifically for the "how does this
// strand/substrand connect to a real curriculum document" workspace
// migration 066's curriculum_repository_links table was built for, which
// had no editing UI anywhere in the app before this.
interface ConnectionsStrings {
  title: string
  intro: (region: string) => string
  topics: string
  noConnections: string
  addConnection: string
  search: string
  rationaleLabel: string
  rationalePlaceholder: string
  save: string
  cancel: string
  edit: string
  connect: string
  connecting: string
  noMatches: string
  selectTopic: string
}

const STRINGS: Record<'de' | 'en', ConnectionsStrings> = {
  de: {
    title: 'Verbindungen zum Lehrplan',
    intro: (region: string) =>
      `Verbinde die Lernziele dieses LPM mit echten Lehrplan-Dokumenten aus ${region}, mit einer kurzen Begründung je Verbindung.`,
    topics: 'Lernziele',
    noConnections: 'Noch keine Verbindung.',
    addConnection: 'Verbindung hinzufügen',
    search: 'Lehrplan-Dokument suchen…',
    rationaleLabel: 'Begründung (optional)',
    rationalePlaceholder: 'z. B. dieser Lehrplan-Beschluss ist der reale Hintergrund für dieses Lernziel',
    save: 'Speichern',
    cancel: 'Abbrechen',
    edit: 'Bearbeiten',
    connect: 'Verbinden',
    connecting: 'Verbinde…',
    noMatches: 'Keine Treffer.',
    selectTopic: 'Wähle links ein Lernziel.',
  },
  en: {
    title: 'Curriculum Connections',
    intro: (region: string) =>
      `Connect this LPM's learning goals to real curriculum documents from ${region}, with a short rationale per connection.`,
    topics: 'Learning Goals',
    noConnections: 'No connection yet.',
    addConnection: 'Add connection',
    search: 'Search curriculum documents…',
    rationaleLabel: 'Rationale (optional)',
    rationalePlaceholder: 'e.g. this policy mandate is the real-world background for this learning goal',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    connect: 'Connect',
    connecting: 'Connecting…',
    noMatches: 'No matches.',
    selectTopic: 'Select a learning goal on the left.',
  },
} as const

export default function CurriculumConnectionsPage() {
  const { project, defaultBranchId, role, supabase, templateId } = useOutletContext<ProjectOutletContext>()
  const config = getCurriculumConnectionsViewConfig(templateId)
  const t = STRINGS[config?.language ?? 'en']
  const canEdit = role !== 'viewer' && role !== 'reviewer'

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linksByObject, setLinksByObject] = useState<Record<string, DataObjectLinkWithRecord[]>>({})
  const [regionRecords, setRegionRecords] = useState<RepositoryRecordRow[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then((items) => {
      setTopics(items)
      if (!selectedId && items.length > 0) setSelectedId(items[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  useEffect(() => {
    if (!config) return
    listRepositoryRecordsForRegionSlugs(supabase, config.regionSlugs).then(setRegionRecords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, templateId])

  useEffect(() => {
    if (!topics || topics.length === 0) return
    listContentLinksForDataObjects(supabase, topics.map((tp) => tp.id)).then(setLinksByObject)
  }, [supabase, topics, refreshToken])

  const selectedTopic = useMemo(() => topics?.find((tp) => tp.id === selectedId) ?? null, [topics, selectedId])
  const selectedLinks = selectedId ? linksByObject[selectedId] ?? [] : []

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><Link2 size={18} style={{ color: 'var(--text-muted)' }} />{t.title}</h1>
      <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>{t.intro(config.regionLabel)}</p>

      <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <strong style={{ fontSize: 12 }}>{t.topics}</strong>
          {topics === null ? (
            <p className="muted">…</p>
          ) : (
            topics.map((tp) => (
              <button
                key={tp.id}
                className="btn-linklike"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: tp.id === selectedId ? 600 : 400 }}
                onClick={() => { setSelectedId(tp.id); setShowAdd(false) }}
              >
                {tp.title}
                {linksByObject[tp.id]?.length ? <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>({linksByObject[tp.id].length})</span> : null}
              </button>
            ))
          )}
        </div>

        <div>
          {!selectedTopic ? (
            <p className="muted">{t.selectTopic}</p>
          ) : (
            <div className="card">
              <strong>{selectedTopic.title}</strong>
              <div style={{ marginTop: 10 }}>
                {selectedLinks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t.noConnections}</p>}
                {selectedLinks.map((link) => (
                  <ConnectionRow key={link.id} link={link} canEdit={canEdit} supabase={supabase} onSaved={() => setRefreshToken((x) => x + 1)} />
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
                  dataObjectId={selectedTopic.id}
                  candidates={regionRecords}
                  onDone={() => { setShowAdd(false); setRefreshToken((x) => x + 1) }}
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

function ConnectionRow({
  link,
  canEdit,
  supabase,
  onSaved,
}: {
  link: DataObjectLinkWithRecord
  canEdit: boolean
  supabase: ProjectOutletContext['supabase']
  onSaved: () => void
}) {
  const t = STRINGS.en // edit/save/cancel chrome stays consistent regardless of content language; the label strings below are passed in by the parent where it matters
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

function AddConnectionForm({
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
