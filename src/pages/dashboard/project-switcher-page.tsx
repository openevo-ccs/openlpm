import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { EpistemicStatusBadge, CURATION, type Curation } from '@/components/epistemic-status-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'

const CURATION_LABEL: Record<Curation, string> = {
  'human-curated': 'Human-Curated',
  'synthetic-theoretical': 'Synthetic-Theoretical',
}

const CURATION_GLOSS: Record<Curation, string> = {
  'human-curated': 'Made or reviewed by real teachers and researchers, whether or not it has been tried in a classroom yet.',
  'synthetic-theoretical': 'A designed thought experiment -- not yet tried with real students.',
}

export default function ProjectSwitcherPage() {
  const supabase = useMemo(() => createClient(), [])
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  // Both on by default -- this only narrows the view, never hides a project
  // space a user hasn't deliberately chosen to filter out.
  const [visibleCurations, setVisibleCurations] = useState<Set<Curation>>(
    new Set(['human-curated', 'synthetic-theoretical'])
  )

  useEffect(() => {
    getUserProjects(supabase).then(setMemberships)
  }, [supabase])

  if (memberships === null) {
    return <p className="muted">Loading…</p>
  }

  // Group by parent so a real regional or topic-focused effort (e.g.
  // "EvoMentor Thuringia") shows nested under its home Project Space instead
  // of sitting as its own separate tile -- keeps this list from growing one
  // entry per region/language/theme as those get added. Every top-level
  // entry here is a Project Space; everything nested under one is a Project
  // (see [[openlpm-project-hierarchy-architecture]] -- this is the entry
  // point that list is meant to serve).
  const byId = new Map(memberships.map((m) => [m.project.id, m]))
  const topLevel = memberships
    .filter((m) => !m.project.parent_project_id || !byId.has(m.project.parent_project_id))
    .filter((m) => visibleCurations.has(CURATION[m.project.epistemic_status]))
  const childrenOf = (id: string) => memberships.filter((m) => m.project.parent_project_id === id)

  const toggleCuration = (c: Curation) => {
    setVisibleCurations((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Your project spaces</h1>
          <p className="muted" style={{ marginBottom: 12 }}>
            Pick a project space to open it. Everything inside — the curriculum, the literature, the
            people — belongs to that space alone.
          </p>
        </div>
        <Link to="/dashboard/new-project" className="btn btn-primary">
          <Plus size={14} />Start new project
        </Link>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 20 }}>
        {(['human-curated', 'synthetic-theoretical'] as const).map((c) => (
          <label key={c} className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }} title={CURATION_GLOSS[c]}>
            <input type="checkbox" checked={visibleCurations.has(c)} onChange={() => toggleCuration(c)} />
            {CURATION_LABEL[c]}
          </label>
        ))}
      </div>

      {memberships.length === 0 ? (
        <div className="card empty">
          <FolderKanban size={32} />
          <p>You aren&apos;t a member of any project space yet.</p>
          <p className="muted">Ask an owner to add you, or create a new one.</p>
        </div>
      ) : topLevel.length === 0 ? (
        <div className="card empty">
          <p className="muted">No project spaces match the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {topLevel.map(({ project, role }) => {
            const children = childrenOf(project.id)
            return (
              <div key={project.id} className="card" style={{ height: '100%' }}>
                <Link to={`/dashboard/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3>{project.name}</h3>
                    <div className="row" style={{ gap: 4 }}>
                      {project.is_private && <span className="chip" title="Only members can see this project exists">Private</span>}
                      <span className="chip capitalize">{role}</span>
                    </div>
                  </div>
                  <p className="muted">{project.description}</p>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <EpistemicStatusBadge status={project.epistemic_status} />
                    <WorkingLanguagesTag languages={project.working_languages} />
                  </div>
                </Link>
                {children.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                    <span className="muted" style={{ fontSize: 12 }}>Projects inside:</span>
                    {children.map((c) => (
                      <Link key={c.project.id} to={`/dashboard/${c.project.slug}`} className="row" style={{ textDecoration: 'none', color: 'inherit', marginTop: 4, fontSize: 13 }}>
                        {c.project.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
