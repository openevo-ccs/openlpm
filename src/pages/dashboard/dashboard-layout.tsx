import { Link, Outlet } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useSession } from '@/state/session'
import { createClient } from '@/lib/supabase/client'
import { OpenLpmLogo } from '@/components/openlpm-logo'
// import { MemoChatWidget } from '@/components/memo-chat-widget' -- see note below, not mounted yet
import { FeedbackWidget } from '@/components/feedback-widget'
import { HelpWidget } from '@/components/help-widget'

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
