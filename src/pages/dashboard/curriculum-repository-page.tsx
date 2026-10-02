import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Info, Library, Link2, Plus, Search, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  ACCESS_TIER_LABEL,
  RECORD_TYPE_LABEL,
  createContentLink,
  getRepositoryRecord,
  listContentLinksForRecord,
  listJurisdictions,
  listRepositoryRecords,
  splitContentFields,
  type RepositoryRecordRow,
} from '@/lib/supabase/curriculum-repository'

// "Browse + connect" -- real sourced national/regional curriculum-policy
// material (deutsche-lpm/nys-lpm today), invite-only, read-only here by
// design: a viewer can look at a record and link it to something in their
// OWN project with a short rationale, but never edit the repository's own
// content from this screen (that's an owner/maintainer-only action, not
// built in this pass). Every record is shown only as much as its own
// access_tier allows -- see splitContentFields.
export default function CurriculumRepositoryPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const { recordId } = useParams<{ recordId?: string }>()
  const navigate = useNavigate()

  const [records, setRecords] = useState<RepositoryRecordRow[] | null>(null)
  const [jurisdictions, setJurisdictions] = useState<string[]>([])
  const [recordType, setRecordType] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    listJurisdictions(supabase, project.id).then(setJurisdictions)
  }, [supabase, project.id])

  useEffect(() => {
    setRecords(null)
    const timer = setTimeout(() => {
      listRepositoryRecords(supabase, project.id, {
        recordType: recordType || undefined,
        jurisdiction: jurisdiction || undefined,
        search: search.trim() || undefined,
      }).then(setRecords)
    }, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [supabase, project.id, recordType, jurisdiction, search])

  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of records ?? []) m.set(r.record_type, (m.get(r.record_type) ?? 0) + 1)
    return m
  }, [records])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="row"><Library size={18} style={{ color: 'var(--text-muted)' }} />Curriculum Repository</h1>
          <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
            Real, sourced curriculum-policy material for this jurisdiction. Each item is shown only as
            much as its own source allows — some are full excerpts, most today are citation only (a
            pointer to the source rather than the text itself) until someone reviews them for more.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid grid-3">
          <div className="field">
            <label>Search by title</label>
            <div className="row" style={{ gap: 6 }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to search…" />
            </div>
          </div>
          <div className="field">
            <label>Kind</label>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
              <option value="">All kinds</option>
              {Object.entries(RECORD_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Jurisdiction</label>
            <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              <option value="">All jurisdictions</option>
              {jurisdictions.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>
      </div>

      {records === null ? (
        <p className="muted">Loading…</p>
      ) : records.length === 0 ? (
        <div className="card empty">
          <Library size={32} />
          <p>No records match.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="card" style={{ maxHeight: 640, overflowY: 'auto' }}>
            <p className="muted" style={{ fontSize: 11, marginTop: 0 }}>{records.length} record{records.length === 1 ? '' : 's'}</p>
            {records.map((r) => (
              <button
                key={r.id}
                className="btn-linklike"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: r.id === recordId ? 600 : 400 }}
                onClick={() => navigate(`/dashboard/${project.slug}/curriculum-repository/${r.id}`)}
              >
                {r.title}
                <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>{RECORD_TYPE_LABEL[r.record_type]}{r.jurisdiction ? ` · ${r.jurisdiction}` : ''}</span>
              </button>
            ))}
          </div>
          <div className="card" style={{ minHeight: 200 }}>
            {recordId ? (
              <RecordDetail recordId={recordId} supabase={supabase} currentProject={project} />
            ) : (
              <p className="muted">Pick a record on the left. ({Array.from(countsByType.entries()).map(([t, n]) => `${RECORD_TYPE_LABEL[t as RepositoryRecordRow['record_type']]}: ${n}`).join(', ')})</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RecordDetail({
  recordId,
  supabase,
  currentProject,
}: {
  recordId: string
  supabase: ProjectOutletContext['supabase']
  currentProject: ProjectOutletContext['project']
}) {
  const [record, setRecord] = useState<RepositoryRecordRow | null>(null)
  const [links, setLinks] = useState<Awaited<ReturnType<typeof listContentLinksForRecord>>>([])
  const [showConnect, setShowConnect] = useState(false)

  const reload = async () => {
    const [rec, l] = await Promise.all([getRepositoryRecord(supabase, recordId), listContentLinksForRecord(supabase, recordId)])
    setRecord(rec)
    setLinks(l)
  }

  useEffect(() => {
    setRecord(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, recordId])

  if (!record) return <p className="muted">Loading…</p>

  const { visible, gated } = splitContentFields(record)
  const sourceUrl = (record.content as Record<string, unknown> | null)?.sourceUrl ?? (record.content as Record<string, unknown> | null)?.url

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{record.title}</h3>
          <div className="row" style={{ gap: 6 }}>
            <span className="chip" style={{ fontSize: 10 }}>{RECORD_TYPE_LABEL[record.record_type]}</span>
            {record.jurisdiction && <span className="chip" style={{ fontSize: 10 }}>{record.jurisdiction}</span>}
            <span className="chip" style={{ fontSize: 10 }} title={record.license_or_rights_note ?? undefined}>{ACCESS_TIER_LABEL[record.access_tier]}</span>
          </div>
        </div>
      </div>

      {visible.length === 0 && gated.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>No further details recorded for this item yet.</p>
      )}

      {visible.map((f) => (
        <div key={f.key} style={{ margin: '10px 0' }}>
          <strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{f.label}</strong>
          <FieldValue value={f.value} />
        </div>
      ))}

      {gated.length > 0 && (
        <div className="notice" style={{ marginTop: 10 }}>
          <Info size={14} />
          {gated.length} more field{gated.length === 1 ? '' : 's'} on this record ({gated.map((f) => f.label).join(', ')}) aren&apos;t shown — this record is marked &ldquo;{ACCESS_TIER_LABEL[record.access_tier]}&rdquo;, so only the facts above are shown — the fuller wording stays hidden.
        </div>
      )}

      {typeof sourceUrl === 'string' && sourceUrl && (
        <p style={{ marginTop: 12 }}><a href={sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></p>
      )}

      <section style={{ marginTop: 16 }}>
        <h4 className="row"><Link2 size={13} />Connected to your own work</h4>
        {links.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Not yet connected to anything.</p>
        ) : (
          links.map((l) => (
            <div key={l.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>{l.data_object.title}</span>
              {l.rationale && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{l.rationale}</p>}
            </div>
          ))
        )}
        {!showConnect ? (
          <button className="btn btn-mini" onClick={() => setShowConnect(true)}><Plus size={12} />Connect to my project</button>
        ) : (
          <ConnectForm
            recordId={recordId}
            supabase={supabase}
            currentProjectId={currentProject.id}
            onDone={() => { setShowConnect(false); reload() }}
            onCancel={() => setShowConnect(false)}
          />
        )}
      </section>
    </div>
  )
}

// Real feedback 14a58a23 (Dustin, 2026-10-02): "text runs over the card
// box" -- a real, sourced record's own URL field (e.g.
// https://services.ebalbharati.in/copyright/pdfs/Revised_Policy_26_Oct_2020.pdf)
// is one long unbroken token with no spaces, so `white-space: pre-wrap`
// alone never had a place to break it -- it just overflowed the card's
// right edge instead of wrapping. `overflowWrap: 'anywhere'` lets a long
// token like a URL break wherever it needs to while leaving normal word
// wrapping alone everywhere else -- applied to every real render path here
// since any field (not just a URL) could contain one.
const LONG_VALUE_STYLE = { overflowWrap: 'anywhere' as const }

function FieldValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) {
      return <span style={{ fontSize: 13, ...LONG_VALUE_STYLE }}>{value.join(', ')}</span>
    }
    return (
      <div style={{ fontSize: 12, ...LONG_VALUE_STYLE }}>
        {value.map((v, i) => (
          <div key={i} style={{ padding: '3px 0 3px 8px', borderLeft: '2px solid var(--border)', marginBottom: 4 }}>
            {typeof v === 'object' && v !== null
              ? Object.entries(v as Record<string, unknown>).map(([k, vv]) => vv ? <div key={k}><em>{k}:</em> {String(vv)}</div> : null)
              : String(v)}
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <div style={{ fontSize: 12, ...LONG_VALUE_STYLE }}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => v ? <div key={k}><em>{k}:</em> {String(v)}</div> : null)}
      </div>
    )
  }
  return <span style={{ fontSize: 13, whiteSpace: 'pre-wrap', ...LONG_VALUE_STYLE }}>{String(value)}</span>
}

// Lets the viewer pick one of their OWN other projects (where they can
// actually write) and a piece of its content to connect this repository
// record to -- the "connect" half of browse + connect. Deliberately scoped
// to the CURRENT project's own content only for v1 (searching across every
// project the user belongs to is a reasonable next step, not built here;
// most real uses so far are a single researcher connecting a repository
// record to their own current project's content).
function ConnectForm({
  recordId,
  supabase,
  currentProjectId,
  onDone,
  onCancel,
}: {
  recordId: string
  supabase: ProjectOutletContext['supabase']
  currentProjectId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; title: string }[]>([])
  const [rationale, setRationale] = useState('')
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('lpm_data_objects').select('id, title').eq('project_id', currentProjectId).ilike('title', `%${query.trim()}%`).limit(8)
      setResults(data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [query, currentProjectId, supabase])

  const submit = async () => {
    if (!picked) return
    setBusy(true); setError(null)
    const { error: err } = await createContentLink(supabase, {
      projectId: currentProjectId,
      dataObjectId: picked.id,
      repositoryRecordId: recordId,
      rationale: rationale.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err); return }
    onDone()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Connect to my project</strong>
        <button className="btn-linklike" onClick={onCancel}><X size={12} /></button>
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
      {picked ? (
        <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
          <span style={{ fontSize: 13 }}>{picked.title}</span>
          <button className="btn-linklike" onClick={() => setPicked(null)}>Change</button>
        </div>
      ) : (
        <div className="field">
          <label>Search your project&apos;s content</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search…" />
          {results.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 13 }}>{r.title}</span>
              <button className="btn btn-mini" onClick={() => setPicked(r)}>Pick</button>
            </div>
          ))}
          {query.trim().length >= 2 && results.length === 0 && <p className="muted" style={{ fontSize: 12 }}>No matches in this project.</p>}
        </div>
      )}
      <div className="field">
        <label>Why connect these? (optional)</label>
        <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="e.g. this policy mandate is what this unit is designed to meet" />
      </div>
      <button className="btn btn-primary" disabled={!picked || busy} onClick={submit}>{busy ? 'Connecting…' : 'Connect'}</button>
    </div>
  )
}
