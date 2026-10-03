import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, BookOpen, CalendarRange, Clock, FileText, GitBranch, Layers, Library, Lightbulb, Map as MapIcon, MessageSquare, Network, Newspaper, PanelLeftClose, PanelLeftOpen, Settings, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectMemberRole, type ProjectRow } from '@/lib/supabase/projects'
import { hasRepositoryContent } from '@/lib/supabase/curriculum-repository'
import { groupsSettings } from '@/lib/supabase/groups'
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
// this project -- kept in sessionStorage rather than the URL. The URL-based
// version (?view=student) broke the moment anyone clicked a link inside
// the preview: every nav link only points at its own plain path, so the
// query param silently dropped and the very next navigation snapped back
// to the researcher view after just one page -- confirmed live, exactly
// the bug reported. sessionStorage survives navigation without every link
// in the app needing to remember to carry a query param forward.
function previewKey(slug: string) {
  return `openlpm:preview_student:${slug}`
}

// Real feedback bbf55cf2 (2026-10-01): "make all sidebar menus adjustable
// and collapsible." Scoped to the device (localStorage) rather than the
// project or account -- this is a display preference like a window size,
// the same researcher/student toggle either way regardless of which
// project you're in.
const SIDEBAR_COLLAPSED_KEY = 'openlpm:sidebar_collapsed'

function readStoredSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function ProjectLayout() {
  const { project: slug } = useParams<{ project: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ project: ProjectRow | null; role: ProjectMemberRole | null; joinedVia: string | null } | null>(null)
  const [parent, setParent] = useState<{ slug: string; name: string } | null>(null)
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  // Not one of the fixed 10 sidebar items below -- only shown for a project
  // that actually has curriculum-repository content of its own (e.g. the
  // Germany/New York repository spaces) or has declared grounding in one,
  // so an ordinary LPM project's nav stays exactly Dustin's 10-item spec.
  const [hasRepo, setHasRepo] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    setSidebarCollapsed(readStoredSidebarCollapsed())
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch { /* private window */ }
      return next
    })
  }

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

  useEffect(() => {
    setHasRepo(false)
    if (!state?.project?.id) return
    // A curriculum-repository-custom-view (migration 095) never holds
    // records of its own -- it's a view of its parent Curriculum
    // Repository's content, so this checks the PARENT's id rather than the
    // view's own, or the Repository browser tab would wrongly never appear
    // for it.
    const repoCheckId =
      (state.project as any).project_kind === 'curriculum-repository-custom-view'
        ? (state.project as any).parent_project_id ?? state.project.id
        : state.project.id
    hasRepositoryContent(supabase, repoCheckId).then(setHasRepo)
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

  // project_kind (migration 072/094) isn't in the generated types yet.
  const isRepository = (project as any).project_kind === 'curriculum-repository'
  const isCustomView = (project as any).project_kind === 'curriculum-repository-custom-view'

  // Exactly these 10 items, in this order -- Dustin's explicit, final sidebar
  // spec for the 2026-09-13 restructure. Projects and Members are folded into
  // Dashboard; Schema is folded into Concepts; Explore is replaced by the
  // project-scoped search bar below (not a nav item); Import/export is now a
  // function inside Learning Goals (and, later, Literature/Concepts/Theories)
  // rather than its own tab.
  //
  // A Curriculum Repository gets a deliberately different, much shorter
  // nav -- real feedback d9522fb3: "they won't have theories, literature,
  // review, etc. necessarily." It still gets Dashboard (which already
  // folds in Members/Projects-in-this-Space) and the Curriculum Repository
  // browser itself (still gated on hasRepo -- the PARENT "Curriculum
  // Repositories" space holds no records of its own, just two
  // sub-repositories, so it doesn't get that tab either). A
  // curriculum-repository-custom-view (migration 095) gets the exact same
  // reduced nav -- it's a view of the same underlying content, just with
  // its own membership and never listed in the main switcher (see
  // project-switcher-page.tsx).
  // Real feedback 67375983 (2026-10-01): "settings page should be at the
  // bottom of the sidebar menu." Shown to every member, including
  // non-owners/maintainers -- same as today's Members list, the page itself
  // still gates each editable section (color, invites, self-join, student
  // view, danger zone) to canManage/owner exactly as before.
  const nav = isRepository || isCustomView
    ? [
        { href: `/dashboard/${slug}`, icon: <FileText size={14} />, label: 'Dashboard' },
        ...(hasRepo ? [{ href: `/dashboard/${slug}/curriculum-repository`, icon: <Library size={14} />, label: 'Curriculum Repository', end: false }] : []),
        ...(hasRepo ? [{ href: `/dashboard/${slug}/timeline`, icon: <CalendarRange size={14} />, label: 'Timeline' }] : []),
        ...(hasRepo ? [{ href: `/dashboard/${slug}/context`, icon: <Newspaper size={14} />, label: 'News & Debates' }] : []),
        ...(hasRepo ? [{ href: `/dashboard/${slug}/map`, icon: <MapIcon size={14} />, label: 'Map', end: false }] : []),
        { href: `/dashboard/${slug}/settings`, icon: <Settings size={14} />, label: 'Settings', end: false },
      ]
    : [
        { href: `/dashboard/${slug}`, icon: <FileText size={14} />, label: 'Dashboard' },
        { href: `/dashboard/${slug}/learning-goals`, icon: <Layers size={14} />, label: 'Learning Goals', end: false },
        { href: `/dashboard/${slug}/concepts`, icon: <Sparkles size={14} />, label: 'Concepts', end: false },
        { href: `/dashboard/${slug}/theories`, icon: <Lightbulb size={14} />, label: 'Theories', end: false },
        { href: `/dashboard/${slug}/strands`, icon: <GitBranch size={14} />, label: 'Strands', end: false },
        { href: `/dashboard/${slug}/literature`, icon: <BookOpen size={14} />, label: 'Literature' },
        { href: `/dashboard/${slug}/review`, icon: <Clock size={14} />, label: 'Review' },
        { href: `/dashboard/${slug}/discussions`, icon: <MessageSquare size={14} />, label: 'Discussions' },
        { href: `/dashboard/${slug}/notebooks`, icon: <Network size={14} />, label: 'Notebooks', end: false },
        ...(groupsSettings(project).enabled ? [{ href: `/dashboard/${slug}/groups`, icon: <Users size={14} />, label: 'Groups', end: false }] : []),
        { href: `/dashboard/${slug}/analytics`, icon: <BarChart3 size={14} />, label: 'Analytics' },
        ...(hasRepo ? [{ href: `/dashboard/${slug}/curriculum-repository`, icon: <Library size={14} />, label: 'Curriculum Repository', end: false }] : []),
        { href: `/dashboard/${slug}/settings`, icon: <Settings size={14} />, label: 'Settings', end: false },
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
        <aside className={`project-side${sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="project-side-top">
            <Link to="/dashboard" className="row muted" title="Alle Bereiche">
              <ArrowLeft size={14} />
              <span className="nav-label">Alle Bereiche</span>
            </Link>
            <button type="button" className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}>
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          <h2 className="project-side-title" style={{ marginTop: 10, marginBottom: 2 }}>{project.name}</h2>
          <StudentNav slug={slug} groupsEnabled={groupsSettings(project).enabled} />
        </aside>
        <div className="project-main">
          {canManage && (
            // Real bug reported live 2026-09-30: the exit was a small text
            // link inside a thin gray notice bar -- easy to miss entirely
            // next to the student view's own bright colored cards/headers,
            // and once missed, sessionStorage keeps the preview flag set
            // for that whole browser tab, making it look like there's no
            // way back at all. Sticky, high-contrast, a real button, and
            // repeated on every student page (this shell wraps all of
            // them) -- not something to have to scroll up and hunt for.
            <div className="preview-exit-bar">
              <span>👁 You&apos;re previewing this as a student would see it.</span>
              <button type="button" className="btn btn-primary btn-mini" onClick={exitPreview}>
                <ArrowLeft size={12} />
                Exit preview — back to the full researcher view
              </button>
            </div>
          )}
          <Outlet context={context} />
        </div>
      </div>
    )
  }

  return (
    <div className="project-shell">
      <aside className={`project-side${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="project-side-top">
          <Link to="/dashboard" className="row muted" title="All project spaces">
            <ArrowLeft size={14} />
            <span className="nav-label">All project spaces</span>
          </Link>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <div className="project-side-info">
          <p className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 10, marginBottom: 0 }}>
            {isCustomView ? 'Custom View' : isRepository ? (isSpace ? 'Curriculum Repository Space' : 'Curriculum Repository') : (isSpace ? 'Project Space' : 'Project')}
          </p>
          <h2 style={{ marginTop: 2, marginBottom: 2 }}>{project.name}</h2>
          {parent && (
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              {isCustomView ? 'A view of ' : 'Part of the '}
              <Link to={`/dashboard/${parent.slug}`}>{parent.name}</Link>
              {isCustomView ? '' : ` ${isRepository ? 'Curriculum Repository' : 'Project Space'}`}
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
        </div>
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
