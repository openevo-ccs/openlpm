import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Grid3x3, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  createConnection,
  getCoOccurringConcepts,
  getGradeBandMatrix,
  listLiteratureReferences,
  listObjectsInGrade,
  markReviewedNoConnection,
  type ConceptCandidate,
  type GradeBandCell,
  type GradeBandMatrix,
  type GradeBandObject,
  type LiteratureReferenceRow,
} from '@/lib/supabase/coherence'

export default function CoherencePage() {
  const { project, defaultBranchId, role, supabase } = useOutletContext<ProjectOutletContext>()
  const [matrix, setMatrix] = useState<GradeBandMatrix | null>(null)
  const [selected, setSelected] = useState<GradeBandCell | null>(null)
  const canManage = role !== 'viewer'

  const reload = async () => {
    const m = await getGradeBandMatrix(supabase, project.id, defaultBranchId)
    setMatrix(m)
    if (selected) {
      const fresh = m.cells.find((c) => c.gradeA === selected.gradeA && c.gradeB === selected.gradeB)
      setSelected(fresh ?? null)
    }
  }

  useEffect(() => {
    setMatrix(null)
    setSelected(null)
    getGradeBandMatrix(supabase, project.id, defaultBranchId).then(setMatrix)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  const stats = useMemo(() => {
    if (!matrix) return null
    const total = matrix.cells.length
    const connected = matrix.cells.filter((c) => c.assertedCount > 0 || c.suggestedThreads.length > 0).length
    const pendingOnly = matrix.cells.filter((c) => c.assertedCount === 0 && c.suggestedThreads.length === 0 && c.pendingCount > 0).length
    const reviewed = matrix.cells.filter((c) => c.assertedCount === 0 && c.suggestedThreads.length === 0 && c.pendingCount === 0 && c.reviewedNoConnection).length
    const open = total - connected - pendingOnly - reviewed
    return { total, connected, pendingOnly, reviewed, open }
  }, [matrix])

  const cellFor = (a: string, b: string) => matrix?.cells.find((c) => c.gradeA === a && c.gradeB === b) ?? null

  return (
    <div>
      <h1 className="row"><Grid3x3 size={18} style={{ color: 'var(--text-muted)' }} />Vertical coherence</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Does each grade genuinely build on the one before it, not just superficially follow it in
        file order? Every cell below is measured from real connections and threads — never
        eyeballed. An empty cell is an open question, not a verdict: check it, and either record a
        real connection or explicitly note that none exists.
      </p>

      {!canManage && (
        <div className="notice">This is a curriculum-design view. You can see it, but only editors and above can record reviews or connections here.</div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <Link to={`/dashboard/${project.slug}/review`} className="row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
          <span className="row"><Clock size={14} />Review queue — proposed connections waiting to be checked before teachers see them</span>
          <span className="chip">Open queue →</span>
        </Link>
      </div>

      {matrix === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {stats && (
            <div className="grid grid-3" style={{ marginBottom: 16 }}>
              <div className="card">
                <span className="muted">Grade-pairs with a real connection</span>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.connected} / {stats.total}</div>
              </div>
              <div className="card">
                <span className="muted">Proposed, awaiting review</span>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.pendingOnly}</div>
              </div>
              <div className="card">
                <span className="muted">Reviewed — no real connection found</span>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.reviewed}</div>
              </div>
              <div className="card">
                <span className="muted">Still open</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: stats.open > 0 ? 'var(--warning)' : 'var(--good)' }}>{stats.open}</div>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {matrix.grades.map((g) => <th key={g}>Grade {g}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.grades.map((rowGrade, i) => (
                  <tr key={rowGrade}>
                    <th>Grade {rowGrade}</th>
                    {matrix.grades.map((colGrade, j) => {
                      if (j <= i) return <td key={colGrade}></td>
                      const cell = cellFor(rowGrade, colGrade)!
                      const hasConn = cell.assertedCount > 0 || cell.suggestedThreads.length > 0
                      const pendingOnly = !hasConn && cell.pendingCount > 0
                      const reviewed = !hasConn && !pendingOnly && cell.reviewedNoConnection
                      const color = hasConn ? 'var(--good)' : pendingOnly ? 'var(--series-a)' : reviewed ? 'var(--text-muted)' : 'var(--warning)'
                      return (
                        <td key={colGrade}>
                          <button
                            className="btn btn-mini"
                            style={{ width: '100%', borderColor: color, color }}
                            onClick={() => setSelected(cell)}
                          >
                            {hasConn ? <CheckCircle2 size={11} /> : pendingOnly ? <Clock size={11} /> : reviewed ? null : <AlertTriangle size={11} />}
                            {hasConn ? `${cell.assertedCount + cell.suggestedThreads.length}` : pendingOnly ? 'pending' : reviewed ? 'checked' : 'open'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matrix.orphanObjectIds.length > 0 && (
            <div className="notice" style={{ marginTop: 16 }}>
              {matrix.orphanObjectIds.length} of {matrix.totalObjects} topics have no recorded connection to anything else at all — worth a look independent of the grade-pair matrix above.
            </div>
          )}

          {selected && (
            <PairPanel
              cell={selected}
              projectId={project.id}
              branchId={defaultBranchId}
              canManage={canManage}
              supabase={supabase}
              onClose={() => setSelected(null)}
              onChanged={reload}
            />
          )}
        </>
      )}
    </div>
  )
}

function PairPanel({
  cell,
  projectId,
  branchId,
  canManage,
  supabase,
  onClose,
  onChanged,
}: {
  cell: GradeBandCell
  projectId: string
  branchId: string
  canManage: boolean
  supabase: ProjectOutletContext['supabase']
  onClose: () => void
  onChanged: () => void
}) {
  const [candidates, setCandidates] = useState<ConceptCandidate[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)

  useEffect(() => {
    setCandidates(null)
    setNote('')
    setNotice(null)
    setShowConnectForm(false)
    getCoOccurringConcepts(supabase, projectId, branchId, cell.gradeA, cell.gradeB).then(setCandidates)
  }, [supabase, projectId, branchId, cell.gradeA, cell.gradeB])

  const hasConn = cell.assertedCount > 0 || cell.suggestedThreads.length > 0

  const submitReview = async () => {
    if (!note.trim()) return
    setBusy(true)
    const { error } = await markReviewedNoConnection(supabase, { projectId, branchId, axis: 'grade_band', gradeA: cell.gradeA, gradeB: cell.gradeB, note: note.trim() })
    setBusy(false)
    if (error) setNotice(error.message)
    else { setNotice('Recorded — this pair will show as checked, not open.'); onChanged() }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Grade {cell.gradeA} ↔ Grade {cell.gradeB}</h3>
        <button className="btn btn-mini" onClick={onClose}><X size={11} /></button>
      </div>

      {hasConn ? (
        <div>
          {cell.assertedCount > 0 && <p>{cell.assertedCount} curriculum-required connection(s) already span this pair.</p>}
          {cell.suggestedThreads.length > 0 && (
            <p>Connected through {cell.suggestedThreads.length} coherence thread(s): {cell.suggestedThreads.map((t) => t.title).join('; ')}</p>
          )}
        </div>
      ) : cell.pendingCount > 0 ? (
        <div className="notice">{cell.pendingCount} connection(s) already proposed for this pair — awaiting review before teachers see them.</div>
      ) : cell.reviewedNoConnection ? (
        <div className="notice">Reviewed already: &ldquo;{cell.reviewedNoConnection.note}&rdquo;</div>
      ) : (
        <p className="muted">No connection recorded yet between these two grades.</p>
      )}

      <h3 style={{ marginTop: 14 }}>Shared concepts already tagged in both grades</h3>
      {candidates === null ? (
        <p className="muted">Checking…</p>
      ) : candidates.length === 0 ? (
        <p className="muted">No shared concept tags found — a real bridge may still exist, just not via a shared tag.</p>
      ) : (
        <ul style={{ marginTop: 0 }}>
          {candidates.map((c) => (
            <li key={c.schemaElementId}>{c.label} — {c.countA} topic(s) in grade {cell.gradeA}, {c.countB} in grade {cell.gradeB}. Worth checking for a real bridge, not evidence of one on its own.</li>
          ))}
        </ul>
      )}

      {canManage && !hasConn && (
        <>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Checked this pair and found no real connection?</label>
            <textarea placeholder="Why not — be specific, the way you'd want to be checked yourself." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn" disabled={busy || !note.trim()} onClick={submitReview}>Mark reviewed — no real connection</button>
          {' '}
          <button className="btn btn-primary" onClick={() => setShowConnectForm((v) => !v)}>Record a real connection instead</button>
          {notice && <div className="notice notice-ok" style={{ marginTop: 8 }}>{notice}</div>}
          {showConnectForm && (
            <ConnectForm
              cell={cell}
              projectId={projectId}
              branchId={branchId}
              supabase={supabase}
              onDone={() => { setShowConnectForm(false); onChanged() }}
            />
          )}
        </>
      )}
    </div>
  )
}

function ConnectForm({
  cell,
  projectId,
  branchId,
  supabase,
  onDone,
}: {
  cell: GradeBandCell
  projectId: string
  branchId: string
  supabase: ProjectOutletContext['supabase']
  onDone: () => void
}) {
  const [objectsA, setObjectsA] = useState<GradeBandObject[]>([])
  const [objectsB, setObjectsB] = useState<GradeBandObject[]>([])
  const [literature, setLiterature] = useState<LiteratureReferenceRow[]>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [kind, setKind] = useState<'asserted' | 'suggested'>('suggested')
  const [rationale, setRationale] = useState('')
  const [evidenceId, setEvidenceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listObjectsInGrade(supabase, projectId, branchId, cell.gradeA).then(setObjectsA)
    listObjectsInGrade(supabase, projectId, branchId, cell.gradeB).then(setObjectsB)
    listLiteratureReferences(supabase, projectId).then(setLiterature)
  }, [supabase, projectId, branchId, cell.gradeA, cell.gradeB])

  const submit = async () => {
    if (!fromId || !toId || !rationale.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await createConnection(supabase, {
      projectId, branchId, fromObjectId: fromId, toObjectId: toId, kind,
      relationType: kind === 'asserted' ? 'enables' : 'relates_to',
      rationale: rationale.trim(),
      evidenceReferenceId: evidenceId || undefined,
    })
    setBusy(false)
    if (err) setError(err.message)
    else onDone()
  }

  return (
    <div className="card" style={{ marginTop: 10, background: 'var(--surface-1)' }}>
      <div className="field">
        <label>From — grade {cell.gradeA}</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Choose a topic…</option>
          {objectsA.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label>To — grade {cell.gradeB}</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Choose a topic…</option>
          {objectsB.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Kind</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'asserted' | 'suggested')}>
          <option value="suggested">Suggested — a proposed connection, not required by the curriculum</option>
          <option value="asserted">Asserted — the curriculum itself requires this order</option>
        </select>
      </div>
      <div className="field">
        <label>Why — a real, checkable reason, not a vague gloss</label>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </div>
      <div className="field">
        <label>Cite a paper backing this, if there is one (optional, but stronger than your own reasoning alone)</label>
        <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
          <option value="">No citation</option>
          {literature.map((l) => <option key={l.id} value={l.id}>{l.title}{l.year ? ` (${l.year})` : ''}</option>)}
        </select>
        {literature.length === 0 && <p className="muted" style={{ marginTop: 4 }}>Nothing in this project&apos;s literature collection yet — add some from the Literature tab.</p>}
      </div>
      <div className="notice">This will be saved as <strong>proposed</strong> — it won&apos;t show to teachers until someone else reviews it.</div>
      {error && <div className="notice notice-bad">{error}</div>}
      <button className="btn btn-primary" disabled={busy || !fromId || !toId || !rationale.trim()} onClick={submit}>Save proposed connection</button>
    </div>
  )
}
