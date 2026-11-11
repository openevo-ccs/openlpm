import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, BookOpen, FolderKanban, GraduationCap, LogIn, MessageSquareText, PanelLeftClose, PanelLeftOpen, Pencil, Users } from 'lucide-react'
import { useSession } from '@/state/session'
import AdminFeedbackPage from '@/pages/dashboard/admin-feedback-page'
import AdminUsersPage from '@/pages/dashboard/admin-users-page'

// The one Admin area (feedback cc19c44c, Dustin 2026-11-07; design note openlpm-admin-area-tabs-and-single-header-button-2026-11-07.md).
// The header has a single Admin button. This page gives every admin tool its own tab in a sidebar, each with its own address, so a link to
// one tab can be shared. Each tab's page still checks the admin role itself, and the database rules are the real boundary underneath.

interface AdminTab {
  to: string
  label: string
  icon: typeof Users
  /** Other addresses that belong to this tab (the ConceptBase view lives inside "Base repos"). */
  alsoActiveFor?: string
}

const TABS: AdminTab[] = [
  { to: 'users', label: 'Accounts', icon: Users },
  { to: 'projects', label: 'Projects', icon: FolderKanban },
  { to: 'join-rules', label: 'Join rules', icon: LogIn },
  { to: 'feedback', label: 'Feedback', icon: MessageSquareText },
  { to: 'explore', label: 'Base repos', icon: BookOpen, alsoActiveFor: '/dashboard/admin/concept-meanings' },
  { to: 'teaching-lessons', label: 'Teaching lessons', icon: GraduationCap },
  { to: 'content', label: 'Edit data', icon: Pencil },
]

// Same switch and the same remembered setting as a project's sidebar (feedback cea80aaa, Dustin 2026-11-07), so folding the menu in one place
// folds it in the other.
const SIDEBAR_COLLAPSED_KEY = 'openlpm:sidebar_collapsed'

function readStoredSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function AdminLayout() {
  const { isAdmin } = useSession()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readStoredSidebarCollapsed)

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch { /* private window */ }
      return next
    })
  }

  if (!isAdmin) {
    return (
      <div>
        <h1>Admin</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  return (
    <div className="project-shell">
      <aside className={`project-side${collapsed ? ' collapsed' : ''}`} aria-label="Admin sections">
        <div className="project-side-top">
          <Link to="/dashboard" className="row muted" title="All project spaces">
            <ArrowLeft size={14} />
            <span className="nav-label">All project spaces</span>
          </Link>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <h2 className="project-side-title" style={{ marginTop: 10, marginBottom: 2 }}>Admin</h2>
        <nav>
          {TABS.map((tab) => {
            const Icon = tab.icon
            const extra = !!tab.alsoActiveFor && location.pathname.startsWith(tab.alsoActiveFor)
            return (
              <NavLink key={tab.to} to={`/dashboard/admin/${tab.to}`} title={tab.label} className={({ isActive }) => (isActive || extra ? 'active' : '')}>
                <Icon size={14} />
                <span className="nav-label">{tab.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <div className="project-main">
        <Outlet />
      </div>
    </div>
  )
}

/** Feedback tab: the weekly chart on top, the full list below. */
export function AdminFeedbackTab() {
  return <AdminFeedbackPage summary={<AdminUsersPage section="feedback" />} />
}
