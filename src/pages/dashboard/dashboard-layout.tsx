import { Link, Outlet } from 'react-router-dom'
import { LogOut, MessageSquareText, User, Users } from 'lucide-react'
import { useSession } from '@/state/session'
import { createClient } from '@/lib/supabase/client'
import { OpenLpmLogo } from '@/components/openlpm-logo'
// import { MemoChatWidget } from '@/components/memo-chat-widget' -- see note below, not mounted yet
import { FeedbackWidget } from '@/components/feedback-widget'
import { HelpWidget } from '@/components/help-widget'
import { ADMIN_EMAIL } from '@/lib/admin'

// Outer top bar, shared by the project switcher (ProjectSwitcherPage) and
// every project-scoped route (which nests its own sidebar nav in
// ProjectLayout). Nothing project-specific belongs here -- a user isn't "in"
// a project until they pick one from the switcher. Auth gating itself lives
// one level up, in <RequireAuth> (App.tsx) -- RLS is the real boundary.
export default function DashboardLayout() {
  const { session } = useSession()

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/dashboard" className="brand">
          <OpenLpmLogo size={20} />
          OpenLPM
        </Link>
        <div className="whoami" style={{ marginLeft: 'auto' }}>
          <span className="muted">{session?.user.email}</span>
          {session?.user.email === ADMIN_EMAIL && (
            <>
              <Link to="/dashboard/admin/users" className="btn btn-mini">
                <Users size={12} />
                Admin
              </Link>
              <Link to="/dashboard/admin/feedback" className="btn btn-mini">
                <MessageSquareText size={12} />
                Feedback
              </Link>
            </>
          )}
          <HelpWidget />
          <Link to="/dashboard/profile" className="btn btn-mini">
            <User size={12} />
            Profile
          </Link>
          <button type="button" className="btn btn-mini btn-danger" onClick={signOut}>
            <LogOut size={12} />
            Logout
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      {/* Real feedback 2a332362 (2026-10-01): German legal-notice duty
          (TMG/DDG) applies to the whole service, not just the page before
          sign-in -- these two links stay reachable from every signed-in
          page without the full logo footer (login-page.tsx) eating real
          working space on every dashboard screen. */}
      <div className="app-legal-footer">
        <Link to="/impressum">Impressum</Link>
        {' · '}
        <Link to="/privacy">Datenschutz</Link>
      </div>

      {/* Not mounted for the live deploy: its backend (curriculum-agents/
          tools/lpm-chat-bridge) only runs on a developer's own machine, not
          anywhere real visitors can reach -- built during the now-dropped
          LocalLPM effort (see lab_manager's superseded design note). Would
          show a working-looking button that fails for every real user.
          Re-enable once it's pointed at a real, deployed backend. */}
      {/* <MemoChatWidget /> */}
      <FeedbackWidget />
    </div>
  )
}
