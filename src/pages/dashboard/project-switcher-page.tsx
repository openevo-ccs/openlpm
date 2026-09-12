import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'

export default function ProjectSwitcherPage() {
  const supabase = useMemo(() => createClient(), [])
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)

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
  const topLevel = memberships.filter((m) => !m.project.parent_project_id || !byId.has(m.project.parent_project_id))
  const childrenOf = (id: string) => memberships.filter((m) => m.project.parent_project_id === id)

  return (
    <div>
      <h1>Your project spaces</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Pick a project space to open it. Everything inside — the curriculum, the literature, the
        people — belongs to that space alone.
      </p>

      {memberships.length === 0 ? (
        <div className="card empty">
          <FolderKanban size={32} />
          <p>You aren&apos;t a member of any project space yet.</p>
          <p className="muted">Ask an owner to add you, or create a new one.</p>
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
                    <span className="chip capitalize">{role}</span>
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
