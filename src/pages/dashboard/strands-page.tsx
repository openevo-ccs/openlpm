import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { GitBranch, Plus, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { Chip } from '@/components/chip'
import { getFullThread, type FullThread, type ThreadRow } from '@/lib/supabase/curriculum'
import { addParentStrand, listChildStrands, listParentStrands, removeParentStrand } from '@/lib/supabase/strands'

// New sidebar space, 2026-09-13 restructure. Every strand here is a row
// that already existed as an `lpm_threads` narrative (a named, curated,
// multi-station sequence through learning goals) -- not thrown away and
// rebuilt, just given a name that matches what it actually is, plus real
// nesting now that migration 020's strand_parents table is live: a strand
// can be nested under more than one higher-level strand (a join table, not
// a single parent_id column, specifically because that's a real thing
// Dustin asked for). Shown as "parents" and "sub-strands" lists on the
// selected strand rather than a recursive tree widget -- correct for an
// arbitrary graph (a tree view would need cycle-detection Postgres doesn't
// enforce on its own) and just as usable for finding your way around.
export default function StrandsPage() {
  const { project, defaultBranchId, role, supabase } = useOutletContext<ProjectOutletContext>()
  const canManage = role !== 'viewer'
  const { strandId } = useParams<{ strandId?: string }>()
  const navigate = useNavigate()
  const [strands, setStrands] = useState<ThreadRow[] | null>(null)

  const reload = () => {
    supabase
      .from('lpm_threads')
      .select('*')
      .eq('project_id', project.id)
      .eq('branch_id', defaultBranchId)
      .order('title', { ascending: true })
      .then(({ data }) => setStrands(data ?? []))
  }

  useEffect(() => {
    setStrands(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  useEffect(() => {
    // A strandId can be stale after a project/branch switch (it belonged to
    // the previous project) or just wrong in a shared link. Once the real
    // list is in, if it's not there, drop back to the bare list instead of
    // leaving a dead strandId sitting in the URL.
    if (strands && strandId && !strands.some((s) => s.id === strandId)) {
      navigate(`/dashboard/${project.slug}/strands`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strands, strandId])

  return (
    <div>
      <h1 className="row"><GitBranch size={18} style={{ color: 'var(--text-muted)' }} />Strands</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Named, curated sequences through learning goals, concepts, and theories, with unlimited
        levels of nesting — a sub-strand can belong to more than one higher-level strand.
      </p>

      {strands === null ? (
        <p className="muted">Loading…</p>
      ) : strands.length === 0 ? (
        <div className="card empty">
          <GitBranch size={32} />
          <p>No strands yet.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="card">
            {strands.map((s) => (
              <button
                key={s.id}
                className="btn-linklike"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: s.id === strandId ? 600 : 400 }}
                onClick={() => navigate(`/dashboard/${project.slug}/strands/${s.id}`)}
              >
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  {s.title}
                  <Chip status={s.status} />
                </span>
              </button>
            ))}
          </div>

          <div className="card" style={{ minHeight: 200 }}>
            {strandId ? (
              <StrandDetail strandId={strandId} strands={strands} canManage={canManage} supabase={supabase} />
            ) : (
              <p className="muted">Pick a strand on the left to see its stations and nesting.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StrandDetail({
  strandId,
  strands,
  canManage,
  supabase,
}: {
  strandId: string
  strands: ThreadRow[]
  canManage: boolean
  supabase: ProjectOutletContext['supabase']
}) {
  const [full, setFull] = useState<FullThread | null>(null)
  const [parents, setParents] = useState<ThreadRow[]>([])
  const [children, setChildren] = useState<ThreadRow[]>([])
  const [showAddParent, setShowAddParent] = useState(false)
  const [candidateParentId, setCandidateParentId] = useState('')

  const reloadNesting = async () => {
    setParents(await listParentStrands(supabase, strandId))
    setChildren(await listChildStrands(supabase, strandId))
  }

  useEffect(() => {
    setFull(null)
    getFullThread(supabase, strandId).then(setFull)
    reloadNesting()
    setShowAddParent(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, strandId])

  const addParent = async () => {
    if (!candidateParentId) return
    await addParentStrand(supabase, strandId, candidateParentId)
    setCandidateParentId('')
    setShowAddParent(false)
    await reloadNesting()
  }

  const removeParent = async (parentId: string) => {
    await removeParentStrand(supabase, strandId, parentId)
    await reloadNesting()
  }

  const parentOptions = strands.filter((s) => s.id !== strandId && !parents.some((p) => p.id === s.id))

  if (!full) return <p className="muted">Loading…</p>

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{full.thread.title}</h3>
      {full.explainedBy && <p className="muted" style={{ fontSize: 12 }}>Tied together by: {full.explainedBy.label}</p>}
      <p>{full.thread.connecting_idea}</p>

      <section style={{ marginBottom: 14 }}>
        <h4 style={{ marginBottom: 4 }}>Nested under</h4>
        {parents.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Not nested under any other strand — this is a top-level strand.</p>
        ) : (
          parents.map((p) => (
            <div key={p.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontSize: 13 }}>{p.title}</span>
              {canManage && (
                <button className="btn-linklike" aria-label="Remove nesting" title="Remove nesting" onClick={() => removeParent(p.id)}><X size={12} /></button>
              )}
            </div>
          ))
        )}
        {canManage && (
          showAddParent ? (
            <div className="row" style={{ marginTop: 6, gap: 6 }}>
              <select value={candidateParentId} onChange={(e) => setCandidateParentId(e.target.value)} style={{ flex: 1 }}>
                <option value="">Choose a strand…</option>
                {parentOptions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <button className="btn btn-mini" onClick={addParent} disabled={!candidateParentId}>Add</button>
              <button className="btn btn-mini" aria-label="Cancel" title="Cancel" onClick={() => setShowAddParent(false)}><X size={12} /></button>
            </div>
          ) : (
            <button className="btn btn-mini" style={{ marginTop: 6 }} onClick={() => setShowAddParent(true)}>
              <Plus size={12} />Nest under another strand
            </button>
          )
        )}
      </section>

      {children.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 4 }}>Sub-strands</h4>
          {children.map((c) => (
            <div key={c.id} style={{ fontSize: 13, padding: '2px 0' }}>{c.title}</div>
          ))}
        </section>
      )}

      <section>
        <h4 style={{ marginBottom: 4 }}>Stations</h4>
        <ol className="thread-path">
          {full.stations.map((st) => (
            <li key={st.id} className="thread-station">
              <strong>{st.object.grade_band ? `Grade ${st.object.grade_band} — ` : ''}{st.object.title}</strong>
              <p className="muted" style={{ margin: '2px 0 0' }}>{st.role_note}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
