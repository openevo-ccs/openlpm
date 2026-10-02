import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Grid3x3, Layers, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TabPanels } from '@/components/tab-panels'
import {
  createConnection,
  getCoOccurringConcepts,
  getGradeBandMatrix,
  getSameGradeStrandMatrix,
  listGradesWithObjects,
  listLiteratureReferences,
  listObjectsInGrade,
  listObjectsInGradeAndStrand,
  markReviewedNoConnection,
  markStrandReviewedNoConnection,
  type ConceptCandidate,
  type GradeBandCell,
  type GradeBandMatrix,
  type GradeBandObject,
  type LiteratureReferenceRow,
  type StrandCell,
  type StrandMatrix,
} from '@/lib/supabase/coherence'

export default function CoherencePage() {
  return (
    <div>
      <h1 className="row"><Grid3x3 size={18} style={{ color: 'var(--text-muted)' }} />Coherence</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Checks whether this curriculum&apos;s content actually connects to itself, two different
        ways: vertically, across grades in the same strand; horizontally, across strands within
        the same grade.
      </p>
      <TabPanels
        tabs={[
          { label: 'Vertical', content: <VerticalCoherence /> },
          { label: 'Horizontal', content: <HorizontalCoherence /> },
          { label: 'Across curricula', content: <CrossCurriculumStub /> },
        ]}
      />
    </div>
  )
}

function VerticalCoherence() {
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
      <p className="muted" style={{ marginBottom: 16, marginTop: 10 }}>
        This checks whether each grade&apos;s content actually builds on the one before it, based on
        real connections traced between them. An empty cell just hasn&apos;t been checked yet —
        review it to record a connection, or note that none exists.
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
  const [objectsA, setObjectsA] = useState<GradeBandObject[]>([])
  const [objectsB, setObjectsB] = useState<GradeBandObject[]>([])
  const [literature, setLiterature] = useState<LiteratureReferenceRow[]>([])
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
    listObjectsInGrade(supabase, projectId, branchId, cell.gradeA).then(setObjectsA)
    listObjectsInGrade(supabase, projectId, branchId, cell.gradeB).then(setObjectsB)
    listLiteratureReferences(supabase, projectId).then(setLiterature)
  }, [supabase, projectId, branchId, cell.gradeA, cell.gradeB])

  const hasConn = cell.assertedCount > 0 || cell.suggestedThreads.length > 0

  const submitReview = async () => {
    if (!note.trim()) return
    setBusy(true)
    const { error } = await markReviewedNoConnection(supabase, { projectId, branchId, axis: 'grade_band', gradeA: cell.gradeA, gradeB: cell.gradeB, note: note.trim() })
    setBusy(false)
    if (error) setNotice(error.message)
    else { setNotice('Recorded — this pair now shows as checked instead of open.'); onChanged() }
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
            <li key={c.schemaElementId}>{c.label} — {c.countA} topic(s) in grade {cell.gradeA}, {c.countB} in grade {cell.gradeB}. Worth checking for a real bridge — on its own this isn&apos;t evidence of one.</li>
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
              labelA={`grade ${cell.gradeA}`}
              labelB={`grade ${cell.gradeB}`}
              objectsA={objectsA}
              objectsB={objectsB}
              literature={literature}
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

// Real feedback ae39e124 (Dustin Eirdosh, 2026-10-02): "vertical and
// horizontal coherence analytics... primarily same grade across subjects."
// This dataset is single-subject (Biologie) today -- there's no second
// school subject to compare against yet -- so the real, buildable-now
// version of "horizontal" is within-grade, across the strands this
// curriculum actually has: its root Basiskonzepte. The same mechanism
// generalizes to real cross-subject data the moment a project has it,
// without a rebuild -- "strand" here is already just "whatever this
// project's own top-level content groups are," not hardcoded to biology.
function HorizontalCoherence() {
  const { project, defaultBranchId, role, supabase } = useOutletContext<ProjectOutletContext>()
  const canManage = role !== 'viewer'
  const [grades, setGrades] = useState<string[]>([])
  const [grade, setGrade] = useState<string>('')
  const [matrix, setMatrix] = useState<StrandMatrix | null>(null)
  const [selected, setSelected] = useState<StrandCell | null>(null)

  useEffect(() => {
    listGradesWithObjects(supabase, project.id, defaultBranchId).then((gs) => {
      setGrades(gs)
      setGrade((current) => current || gs[0] || '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  const reload = async () => {
    if (!grade) return
    const m = await getSameGradeStrandMatrix(supabase, project, defaultBranchId, grade)
    setMatrix(m)
    if (selected) {
      const fresh = m.cells.find((c) => c.rootA === selected.rootA && c.rootB === selected.rootB)
      setSelected(fresh ?? null)
    }
  }

  useEffect(() => {
    setMatrix(null)
    setSelected(null)
    if (grade) getSameGradeStrandMatrix(supabase, project, defaultBranchId, grade).then(setMatrix)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project, defaultBranchId, grade])

  const cellFor = (a: string, b: string) => matrix?.cells.find((c) => c.rootA === a && c.rootB === b) ?? null

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16, marginTop: 10 }}>
        Within one grade, does this curriculum&apos;s content actually connect across its different
        strands, or does each one stand alone? Pick a grade to check.
      </p>

      {!canManage && (
        <div className="notice">This is a curriculum-design view. You can see it, but only editors and above can record reviews or connections here.</div>
      )}

      <div className="field" style={{ maxWidth: 200, marginBottom: 16 }}>
        <label>Grade</label>
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>

      {grade === '' ? (
        <p className="muted">No graded content yet.</p>
      ) : matrix === null ? (
        <p className="muted">Loading…</p>
      ) : matrix.roots.length < 2 ? (
        <div className="notice">
          Grade {grade} only has content under {matrix.roots.length === 1 ? 'one strand' : 'no strand'} so far — nothing to compare across yet.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {matrix.roots.map((r) => <th key={r.id}>{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.roots.map((rowRoot, i) => (
                  <tr key={rowRoot.id}>
                    <th>{rowRoot.label}</th>
                    {matrix.roots.map((colRoot, j) => {
                      if (j <= i) return <td key={colRoot.id}></td>
                      const cell = cellFor(rowRoot.id, colRoot.id)!
                      const hasConn = cell.assertedCount > 0 || cell.suggestedThreads.length > 0
                      const pendingOnly = !hasConn && cell.pendingCount > 0
                      const reviewed = !hasConn && !pendingOnly && cell.reviewedNoConnection
                      const color = hasConn ? 'var(--good)' : pendingOnly ? 'var(--series-a)' : reviewed ? 'var(--text-muted)' : 'var(--warning)'
                      return (
                        <td key={colRoot.id}>
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
              {matrix.orphanObjectIds.length} of {matrix.totalObjects} topics in grade {grade} aren&apos;t tagged to a strand, so they can&apos;t show up in this matrix yet.
            </div>
          )}

          {selected && (
            <StrandPairPanel
              cell={selected}
              grade={grade}
              project={project}
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

function StrandPairPanel({
  cell,
  grade,
  project,
  branchId,
  canManage,
  supabase,
  onClose,
  onChanged,
}: {
  cell: StrandCell
  grade: string
  project: { id: string; parent_project_id: string | null }
  branchId: string
  canManage: boolean
  supabase: ProjectOutletContext['supabase']
  onClose: () => void
  onChanged: () => void
}) {
  const [objectsA, setObjectsA] = useState<GradeBandObject[]>([])
  const [objectsB, setObjectsB] = useState<GradeBandObject[]>([])
  const [literature, setLiterature] = useState<LiteratureReferenceRow[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)

  useEffect(() => {
    setNote('')
    setNotice(null)
    setShowConnectForm(false)
    listObjectsInGradeAndStrand(supabase, project, branchId, grade, cell.rootA).then(setObjectsA)
    listObjectsInGradeAndStrand(supabase, project, branchId, grade, cell.rootB).then(setObjectsB)
    listLiteratureReferences(supabase, project.id).then(setLiterature)
  }, [supabase, project, branchId, grade, cell.rootA, cell.rootB])

  const hasConn = cell.assertedCount > 0 || cell.suggestedThreads.length > 0

  const submitReview = async () => {
    if (!note.trim()) return
    setBusy(true)
    const { error } = await markStrandReviewedNoConnection(supabase, { projectId: project.id, branchId, grade, rootA: cell.rootA, rootB: cell.rootB, note: note.trim() })
    setBusy(false)
    if (error) setNotice(error.message)
    else { setNotice('Recorded — this pair now shows as checked instead of open.'); onChanged() }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{cell.labelA} ↔ {cell.labelB} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(grade {grade})</span></h3>
        <button className="btn btn-mini" onClick={onClose}><X size={11} /></button>
      </div>

      {hasConn ? (
        <div>
          {cell.assertedCount > 0 && <p>{cell.assertedCount} curriculum-required connection(s) already span these strands in grade {grade}.</p>}
          {cell.suggestedThreads.length > 0 && (
            <p>Connected through {cell.suggestedThreads.length} coherence thread(s): {cell.suggestedThreads.map((t) => t.title).join('; ')}</p>
          )}
        </div>
      ) : cell.pendingCount > 0 ? (
        <div className="notice">{cell.pendingCount} connection(s) already proposed for this pair — awaiting review before teachers see them.</div>
      ) : cell.reviewedNoConnection ? (
        <div className="notice">Reviewed already: &ldquo;{cell.reviewedNoConnection.note}&rdquo;</div>
      ) : (
        <p className="muted">No connection recorded yet between these two strands in grade {grade}.</p>
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
              labelA={cell.labelA}
              labelB={cell.labelB}
              objectsA={objectsA}
              objectsB={objectsB}
              literature={literature}
              projectId={project.id}
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

// Real feedback ae39e124: "plan for options for higher level comparative
// analyses (How coherent is Germany's 7th grade curriculum across
// states?) -- but that is secondary and more advanced in the UI." Not
// built this session -- shown honestly as a real, named next step rather
// than faked, since comparing across PROJECTS (not just within one) needs
// its own access-control thinking first (a viewer here may not be a
// member of the other project being compared against).
function CrossCurriculumStub() {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="card empty">
        <Layers size={28} />
        <p>Comparing coherence across different curricula isn&apos;t built yet.</p>
        <p className="muted" style={{ maxWidth: 440, margin: '4px auto 0' }}>
          The idea: e.g. how coherent is grade 7 across every German state&apos;s own curriculum
          repository, across projects rather than within just one. That needs real thinking about
          access first — comparing against a project you&apos;re not a member of isn&apos;t a small
          addition to the matrix above. Planned as a real next step; nothing built on it this session.
        </p>
      </div>
    </div>
  )
}

function ConnectForm({
  labelA,
  labelB,
  objectsA,
  objectsB,
  literature,
  projectId,
  branchId,
  supabase,
  onDone,
}: {
  labelA: string
  labelB: string
  objectsA: GradeBandObject[]
  objectsB: GradeBandObject[]
  literature: LiteratureReferenceRow[]
  projectId: string
  branchId: string
  supabase: ProjectOutletContext['supabase']
  onDone: () => void
}) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [kind, setKind] = useState<'asserted' | 'suggested'>('suggested')
  const [rationale, setRationale] = useState('')
  const [evidenceId, setEvidenceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <label>From — {labelA}</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Choose a topic…</option>
          {objectsA.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label>To — {labelB}</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Choose a topic…</option>
          {objectsB.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Kind</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'asserted' | 'suggested')}>
          <option value="suggested">Suggested — a proposed connection the curriculum doesn&apos;t require</option>
          <option value="asserted">Asserted — the curriculum itself requires this order</option>
        </select>
      </div>
      <div className="field">
        <label>Why — a real, checkable reason, never a vague gloss</label>
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
