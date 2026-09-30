import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, BookOpen, Clock, FileText, GitBranch, Layers, Lightbulb, MessageSquare, Network, ShieldAlert, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectMemberRole, type ProjectRow } from '@/lib/supabase/projects'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'
import { ProjectNav } from '@/components/project-nav'
import { LpmSearchBar } from '@/components/lpm-search-bar'
import { StudentNav } from './student/student-nav'

export interface ProjectOutletContext {
  project: ProjectRow
  role: ProjectMemberRole
  slug: string
  supabase: ReturnType<typeof createClient>
  // Every project has exactly one home for its own content (guaranteed by
  // the on_project_created trigger) -- this used to be a user-visible
  // "branch" someone had to pick; now it's resolved automatically and never
  // shown, so a Project's Learning Goals/Analytics/Review tabs work the
  // moment you open the Project, with nothing extra to understand first.
  defaultBranchId: string
  // True for a member who self-joined via a domain/email rule (migration
  // 035/039) and holds a base role, OR an owner/maintainer explicitly
  // previewing that experience (?view=student). Drives which sidebar/pages
  // render -- see the branch below. Never true for an owner/maintainer's
  // own real session, so an instructor can never be accidentally locked
  // into the simplified view.
  isStudentView: boolean
}

// Whether an owner/maintainer is currently previewing the student view for
// this project -- kept in sessionStorage, not the URL. The URL-based
// version (?view=student) broke the moment anyone clicked a link inside
// the preview: every nav link only points at its own plain path, so the
// query param silently dropped and the very next navigation snapped back
// to the researcher view after just one page -- confirmed live, exactly
// the bug reported. sessionStorage survives navigation without every link
// in the app needing to remember to carry a query param forward.
function previewKey(slug: string) {
  return `openlpm:preview_student:${slug}`
}

export default function ProjectLayout() {
  const { project: slug } = useParams<{ project: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ project: ProjectRow | null; role: ProjectMemberRole | null; joinedVia: string | null } | null>(null)
  const [parent, setParent] = useState<{ slug: string; name: string } | null>(null)
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // ?view=student (from a direct link) starts the preview session; from
  // then on it's tracked in sessionStorage, independent of the URL.
  useEffect(() => {
    if (!slug) return
    if (searchParams.get('view') === 'student') {
      sessionStorage.setItem(previewKey(slug), '1')
      searchParams.delete('view')
      setSearchParams(searchParams, { replace: true })
    }
    try {
      setPreviewing(sessionStorage.getItem(previewKey(slug)) === '1')
    } catch {
      // Private-window/blocked-storage: preview toggle just won't persist
      // across navigation -- not worth failing the page load over.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const startPreview = () => {
    if (!slug) return
    try { sessionStorage.setItem(previewKey(slug), '1') } catch { /* see above */ }
    setPreviewing(true)
  }
  const exitPreview = () => {
    if (!slug) return
    try { sessionStorage.removeItem(previewKey(slug)) } catch { /* see above */ }
    setPreviewing(false)
  }

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

  const { project, role, joinedVia } = state

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

  // Exactly these 10 items, in this order -- Dustin's explicit, final sidebar
  // spec for the 2026-09-13 restructure. Projects and Members are folded into
  // Dashboard; Schema is folded into Concepts; Explore is replaced by the
  // project-scoped search bar below (not a nav item); Import/export is now a
  // function inside Learning Goals (and, later, Literature/Concepts/Theories)
  // rather than its own tab.
  const nav = [
    { href: `/dashboard/${slug}`, content: <><FileText size={14} />Dashboard</> },
    { href: `/dashboard/${slug}/learning-goals`, content: <><Layers size={14} />Learning Goals</>, end: false },
    { href: `/dashboard/${slug}/concepts`, content: <><Sparkles size={14} />Concepts</>, end: false },
    { href: `/dashboard/${slug}/theories`, content: <><Lightbulb size={14} />Theories</>, end: false },
    { href: `/dashboard/${slug}/strands`, content: <><GitBranch size={14} />Strands</>, end: false },
    { href: `/dashboard/${slug}/literature`, content: <><BookOpen size={14} />Literature</> },
    { href: `/dashboard/${slug}/review`, content: <><Clock size={14} />Review</> },
    { href: `/dashboard/${slug}/discussions`, content: <><MessageSquare size={14} />Discussions</> },
    { href: `/dashboard/${slug}/notebooks`, content: <><Network size={14} />Notebooks</>, end: false },
    { href: `/dashboard/${slug}/analytics`, content: <><BarChart3 size={14} />Analytics</> },
  ]

  const canManage = role === 'owner' || role === 'maintainer'
  // student_view_template (migration 045) isn't in the generated types yet.
  const studentViewTemplate = (project as any).student_view_template as string | null
  // Real bug found live 2026-09-30: this used to be purely a viewer-role
  // question (self-joined vs. owner), which meant "Preview as student"
  // appeared on EVERY project any owner manages, and rendered the SAME
  // German Jena-pilot UI regardless of which project it was. Whether a
  // project HAS a student template at all is a property of the project
  // itself, set explicitly by its own owner (dashboard-page.tsx's Student
  // view settings card) -- without one, this is never true, no matter who's
  // viewing or how they joined.
  const isStudentView = !!studentViewTemplate && ((joinedVia === 'self_join_rule' && !canManage) || (canManage && previewing))

  const context: ProjectOutletContext = { project, role, slug, supabase, defaultBranchId, isStudentView }
  const isSpace = !project.parent_project_id

  if (isStudentView) {
    return (
      <div className="project-shell student-shell">
        <aside className="project-side">
          <Link to="/dashboard" className="row muted">
            <ArrowLeft size={14} />
            Alle Bereiche
          </Link>
          <h2 style={{ marginTop: 10, marginBottom: 2 }}>{project.name}</h2>
          <StudentNav slug={slug} />
        </aside>
        <div className="project-main">
          {canManage && (
            <div className="notice" style={{ marginBottom: 12 }}>
              Vorschau: So sehen echte Studierende diesen Bereich.{' '}
              <button type="button" className="btn-linklike" onClick={exitPreview}>Zur vollen Forschungsansicht</button>
            </div>
          )}
          <Outlet context={context} />
        </div>
      </div>
    )
  }

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
          <WorkingLanguagesTag languages={project.working_languages} />
        </div>
        {canManage && studentViewTemplate && (
          <button type="button" className="btn btn-mini" style={{ marginTop: 8 }} onClick={startPreview}>
            Preview as student
          </button>
        )}
        <ProjectNav items={nav} />
      </aside>

      <div className="project-main">
        <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
          <LpmSearchBar project={project} slug={slug} supabase={supabase} />
        </div>
        <Outlet context={context} />
      </div>
    </div>
  )
}
