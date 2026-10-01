import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { ADMIN_EMAIL } from '@/lib/admin'
import { getUserProjects, type ProjectRow, type ProjectMemberRole, type ProjectWithRole } from '@/lib/supabase/projects'
import { listAllProjects } from '@/lib/supabase/admin-users'

// Admin-only: a project the admin can see exists (migration 049's directory
// reach) but isn't personally a member of -- role is null rather than one
// of the real ProjectMemberRole values, distinct from ProjectWithRole's own
// (always-a-real-member) shape used everywhere else in the app.
interface SwitcherEntry {
  project: ProjectRow
  role: ProjectMemberRole | null
}
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
  const navigate = useNavigate()
  const { session } = useSession()
  const isAdmin = session?.user.email === ADMIN_EMAIL
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  const [allProjects, setAllProjects] = useState<ProjectWithRole['project'][] | null>(null)
  // Both on by default -- this only narrows the view, never hides a project
  // space a user hasn't deliberately chosen to filter out.
  const [visibleCurations, setVisibleCurations] = useState<Set<Curation>>(
    new Set(['human-curated', 'synthetic-theoretical'])
  )

  useEffect(() => {
    getUserProjects(supabase).then(setMemberships)
  }, [supabase])

  // Real need, stated directly (2026-10-01): "I need to always be able to
  // see all projects on the platform" -- the admin account's own landing
  // page used to show only its own memberships, same as anyone else, which
  // meant "see everything" only ever lived on a separate admin sub-page.
  // `role` is null for a project the admin can see but isn't actually a
  // member of -- opening one of those still hits ProjectLayout's own "you
  // aren't a member" wall (content RLS is a separate, bigger boundary this
  // doesn't touch); this fixes visibility of what exists, not content access.
  useEffect(() => {
    if (!isAdmin) { setAllProjects(null); return }
    listAllProjects(supabase).then(setAllProjects)
  }, [supabase, isAdmin])

  const entries = useMemo<SwitcherEntry[]>(() => {
    if (!isAdmin) return memberships ?? []
    if (!allProjects) return []
    const roleByProjectId = new Map((memberships ?? []).map((m) => [m.project.id, m.role]))
    return allProjects.map((project) => ({ project, role: roleByProjectId.get(project.id) ?? null }))
  }, [isAdmin, memberships, allProjects])

  // A real student who's only ever joined one group (the common case --
  // this is exactly the Jena pilot's own shape) shouldn't have to pick from
  // a switcher with one tile in it every time they sign in -- send them
  // straight to it. Someone in more than one project space still lands here
  // to choose, same as before. "All project spaces" stays one click away
  // from inside that project, so this is a default, not a dead end. Never
  // applies to the admin account -- it should always land on the full
  // platform-wide view, even on a day it happens to have just one real
  // membership of its own.
  useEffect(() => {
    if (!isAdmin && memberships?.length === 1) {
      navigate(`/dashboard/${memberships[0].project.slug}`, { replace: true })
    }
  }, [isAdmin, memberships, navigate])

  const stillLoading = memberships === null || (isAdmin && allProjects === null)
  const redirecting = !isAdmin && memberships?.length === 1
  if (stillLoading || redirecting) {
    return <p className="muted">Loading…</p>
  }

  // Group by parent so a real regional or topic-focused effort (e.g.
  // "EvoMentor Thuringia") shows nested under its home Project Space instead
  // of sitting as its own separate tile -- keeps this list from growing one
  // entry per region/language/theme as those get added. Every top-level
  // entry here is a Project Space; everything nested under one is a Project
  // (see [[openlpm-project-hierarchy-architecture]] -- this is the entry
  // point that list is meant to serve).
  const byId = new Map(entries.map((m) => [m.project.id, m]))
  const topLevel = entries
    .filter((m) => !m.project.parent_project_id || !byId.has(m.project.parent_project_id))
    .filter((m) => visibleCurations.has(CURATION[m.project.epistemic_status]))
  const childrenOf = (id: string) => entries.filter((m) => m.project.parent_project_id === id)

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

      {entries.length === 0 ? (
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
                      {role ? (
                        <span className="chip capitalize">{role}</span>
                      ) : (
                        <span className="chip" title="You can see this because you're the admin -- you aren't a member" style={{ gap: 3 }}>
                          <ShieldCheck size={10} />Admin view
                        </span>
                      )}
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
