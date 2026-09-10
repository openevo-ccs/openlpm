import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, Compass, FileText, FolderKanban, Grid3x3, Layers, MessageSquare, Network, ShieldAlert, Shapes, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectMemberRole, type ProjectRow } from '@/lib/supabase/projects'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'
import { ProjectNav } from '@/components/project-nav'

export interface ProjectOutletContext {
  project: ProjectRow
  role: ProjectMemberRole
  slug: string
  supabase: ReturnType<typeof createClient>
  // Every project has exactly one home for its own content (guaranteed by
  // the on_project_created trigger) -- this used to be a user-visible
  // "branch" someone had to pick; now it's resolved automatically and never
  // shown, so a Project's Explore/Coherence/Schema/Review tabs work the
  // moment you open the Project, with nothing extra to understand first.
  defaultBranchId: string
}

export default function ProjectLayout() {
  const { project: slug } = useParams<{ project: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ project: ProjectRow | null; role: ProjectMemberRole | null } | null>(null)
  const [parent, setParent] = useState<{ slug: string; name: string } | null>(null)
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null)

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

  useEffect(() => {
    setDefaultBranchId(null)
    if (!state?.project?.id) return
    supabase
      .from('branches')
      .select('id')
      .eq('project_id', state.project.id)
      .eq('is_trunk', true)
      .maybeSingle()
      .then(({ data }) => setDefaultBranchId(data?.id ?? null))
  }, [supabase, state?.project?.id])

  if (!slug || state === null) {
    return <p className="muted">Loading…</p>
  }

  const { project, role } = state

  if (!project) {
    return (
      <div>
        <Link to="/dashboard" className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          Back to your project spaces
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
          Back to your project spaces
        </Link>
        <div className="card empty">
          <ShieldAlert size={32} />
          <p>You aren&apos;t a member of &ldquo;{project.name}&rdquo;.</p>
          <p className="muted">Ask one of its owners or maintainers to add you.</p>
        </div>
      </div>
    )
  }

  if (!defaultBranchId) {
    return <p className="muted">Loading…</p>
  }

  const nav = [
    { href: `/dashboard/${slug}`, content: <><FileText size={14} />Overview</> },
    { href: `/dashboard/${slug}/explore`, content: <><Compass size={14} />Explore</> },
    { href: `/dashboard/${slug}/coherence`, content: <><Grid3x3 size={14} />Coherence</> },
    { href: `/dashboard/${slug}/review`, content: <><Clock size={14} />Review</> },
    { href: `/dashboard/${slug}/schema`, content: <><Shapes size={14} />Schema</> },
    { href: `/dashboard/${slug}/standards`, content: <><Layers size={14} />Standards</> },
    { href: `/dashboard/${slug}/literature`, content: <><BookOpen size={14} />Literature</> },
    { href: `/dashboard/${slug}/projects`, content: <><FolderKanban size={14} />Projects</> },
    { href: `/dashboard/${slug}/portfolios`, content: <><Network size={14} />Portfolios</> },
    { href: `/dashboard/${slug}/discussions`, content: <><MessageSquare size={14} />Discussions</> },
    { href: `/dashboard/${slug}/members`, content: <><Users size={14} />Members</> },
  ]

  const context: ProjectOutletContext = { project, role, slug, supabase, defaultBranchId }
  const isSpace = !project.parent_project_id

  return (
    <div className="project-shell">
      <aside className="project-side">
        <Link to="/dashboard" className="row muted">
          <ArrowLeft size={14} />
          All project spaces
        </Link>
        <p className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 10, marginBottom: 0 }}>
          {isSpace ? 'Project Space' : 'Project'}
        </p>
        <h2 style={{ marginTop: 2, marginBottom: 2 }}>{project.name}</h2>
        {parent && (
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Part of the <Link to={`/dashboard/${parent.slug}`}>{parent.name}</Link> Project Space
          </p>
        )}
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          <EpistemicStatusBadge status={project.epistemic_status} />
          <MaturityBadge status={project.maturity} />
        </div>
        <ProjectNav items={nav} />
      </aside>

      <div className="project-main">
        <Outlet context={context} />
      </div>
    </div>
  )
}
