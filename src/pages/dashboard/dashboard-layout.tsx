import { Link, Outlet } from 'react-router-dom'
import { GitBranch, LogOut, User } from 'lucide-react'
import { useSession } from '@/state/session'
import { createClient } from '@/lib/supabase/client'

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
          <GitBranch size={20} />
          OpenLPM
        </Link>
        <div className="whoami" style={{ marginLeft: 'auto' }}>
          <span className="muted">{session?.user.email}</span>
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
    </div>
  )
}
