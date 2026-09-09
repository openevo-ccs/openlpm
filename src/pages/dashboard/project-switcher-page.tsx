import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'

export default function ProjectSwitcherPage() {
  const supabase = useMemo(() => createClient(), [])
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)

  useEffect(() => {
    getUserProjects(supabase).then(setMemberships)
  }, [supabase])

  if (memberships === null) {
    return <p className="muted">Loading…</p>
  }

  return (
    <div>
      <h1>Your projects</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Pick a project to work in. Everything below it — literature, schema, discussions —
        is scoped to that project alone.
      </p>

      {memberships.length === 0 ? (
        <div className="card empty">
          <FolderKanban size={32} />
          <p>You aren&apos;t a member of any project yet.</p>
          <p className="muted">Ask a project owner to add you, or create a new project.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {memberships.map(({ project, role }) => (
            <Link key={project.id} to={`/dashboard/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{project.name}</h3>
                  <span className="chip capitalize">{role}</span>
                </div>
                <p className="muted">{project.description}</p>
                <EpistemicStatusBadge status={project.epistemic_status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
