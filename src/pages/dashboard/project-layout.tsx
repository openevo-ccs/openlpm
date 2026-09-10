import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, FileText, GitBranch, Layers, MessageSquare, Network, ShieldAlert, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectMemberRole, type ProjectRow } from '@/lib/supabase/projects'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { ProjectNav } from '@/components/project-nav'

export interface ProjectOutletContext {
  project: ProjectRow
  role: ProjectMemberRole
  slug: string
  supabase: ReturnType<typeof createClient>
}

export default function ProjectLayout() {
  const { project: slug } = useParams<{ project: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ project: ProjectRow | null; role: ProjectMemberRole | null } | null>(null)
  const [parent, setParent] = useState<{ slug: string; name: string } | null>(null)

  useEffect(() => {
    if (!slug) return
    setState(null)
    getProjectBySlug(supabase, slug).then(setState)
  }, [supabase, slug])

  useEffect(() => {
    setParent(null)
    if (!state?.project?.parent_project_id) return
    supabase
      .from('projects')
      .select('slug, name')
      .eq('id', state.project.parent_project_id)
      .maybeSingle()
      .then(({ data }) => setParent(data))
  }, [supabase, state?.project?.parent_project_id])

  if (!slug || state === null) {
    return <p className="muted">Loading…</p>
  }

  const { project, role } = state

  if (!project) {
    return (
      <div>
        <Link to="/dashboard" className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          Back to your projects
        </Link>
        <div className="card empty">
          <ShieldAlert size={32} />
          <p>No project named &ldquo;{slug}&rdquo;.</p>
        </div>
      </div>
    )
  }

  if (!role) {
    // The project row itself is visible to any authenticated user (projects
    // are a browsable directory), but its content isn't -- RLS would just
    // silently return empty results on every content table, which reads as
    // a confusing "there's nothing here" rather than the real reason.
    return (
      <div>
        <Link to="/dashboard" className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          Back to your projects
        </Link>
        <div className="card empty">
          <ShieldAlert size={32} />
          <p>You aren&apos;t a member of &ldquo;{project.name}&rdquo;.</p>
          <p className="muted">Ask one of its owners or maintainers to add you.</p>
        </div>
      </div>
    )
  }

  const nav = [
    { href: `/dashboard/${slug}`, content: <><FileText size={14} />Overview</> },
    { href: `/dashboard/${slug}/literature`, content: <><BookOpen size={14} />Literature</> },
    { href: `/dashboard/${slug}/schema`, content: <><GitBranch size={14} />Schema</> },
    { href: `/dashboard/${slug}/standards`, content: <><Layers size={14} />Standards</> },
    { href: `/dashboard/${slug}/branches`, content: <><GitBranch size={14} />Drafts</> },
    { href: `/dashboard/${slug}/portfolios`, content: <><Network size={14} />Portfolios</> },
    { href: `/dashboard/${slug}/discussions`, content: <><MessageSquare size={14} />Discussions</> },
    { href: `/dashboard/${slug}/members`, content: <><Users size={14} />Members</> },
  ]

  const context: ProjectOutletContext = { project, role, slug, supabase }

  return (
    <div className="project-shell">
      <aside className="project-side">
        <Link to="/dashboard" className="row muted">
          <ArrowLeft size={14} />
          All projects
        </Link>
        <h2 style={{ marginTop: 8, marginBottom: 2 }}>{project.name}</h2>
        {parent && (
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Part of <Link to={`/dashboard/${parent.slug}`}>{parent.name}</Link>
          </p>
        )}
        <EpistemicStatusBadge status={project.epistemic_status} />
        <ProjectNav items={nav} />
      </aside>

      <div className="project-main">
        <Outlet context={context} />
      </div>
    </div>
  )
}
