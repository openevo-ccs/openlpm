import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { GitBranch, Info } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { Chip } from '@/components/chip'
import { getFullThread, type FullThread, type ThreadRow } from '@/lib/supabase/curriculum'

// New sidebar space, 2026-09-13 restructure. Real content: every strand here
// is a row that already existed as an `lpm_threads` narrative (a named,
// curated, multi-station sequence through learning goals) -- not thrown away
// and rebuilt, just given a name that matches what it actually is. What's
// NOT live yet: unlimited nested sub-strands and a sub-strand nestable under
// more than one parent (the new `strand_parents` join table, see migration
// 020_theories_strands_discussions.sql) -- that needs the pending schema
// migration, so this page lists strands flat for now rather than pretending
// a nesting UI works against a table that isn't live.
export default function StrandsPage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const [strands, setStrands] = useState<ThreadRow[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [full, setFull] = useState<FullThread | null>(null)

  useEffect(() => {
    setStrands(null)
    setSelectedId(null)
    setFull(null)
    supabase
      .from('lpm_threads')
      .select('*')
      .eq('project_id', project.id)
      .eq('branch_id', defaultBranchId)
      .order('title', { ascending: true })
      .then(({ data }) => setStrands(data ?? []))
  }, [supabase, project.id, defaultBranchId])

  useEffect(() => {
    if (!selectedId) { setFull(null); return }
    getFullThread(supabase, selectedId).then(setFull)
  }, [supabase, selectedId])

  return (
    <div>
      <h1 className="row"><GitBranch size={18} style={{ color: 'var(--text-muted)' }} />Strands</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Named, curated sequences through learning goals, concepts, and theories — the multi-station
        narratives this LPM is organized around.
      </p>

      <div className="notice">
        <Info size={14} />
        Nested sub-strands (unlimited depth, nestable under more than one parent strand) need the
        new strand_parents schema, written but not yet live. Strands list flat below until then.
      </div>

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
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: s.id === selectedId ? 600 : 400 }}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  {s.title}
                  <Chip status={s.status} />
                </span>
              </button>
            ))}
          </div>

          <div className="card" style={{ minHeight: 200 }}>
            {!full ? (
              <p className="muted">Pick a strand on the left to see its stations.</p>
            ) : (
              <div>
                <h3 style={{ marginTop: 0 }}>{full.thread.title}</h3>
                {full.explainedBy && <p className="muted" style={{ fontSize: 12 }}>Tied together by: {full.explainedBy.label}</p>}
                <p>{full.thread.connecting_idea}</p>
                <ol className="thread-path">
                  {full.stations.map((st) => (
                    <li key={st.id} className="thread-station">
                      <strong>{st.object.grade_band ? `Grade ${st.object.grade_band} — ` : ''}{st.object.title}</strong>
                      <p className="muted" style={{ margin: '2px 0 0' }}>{st.role_note}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
