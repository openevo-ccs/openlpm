import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/state/session'

const REDIRECT_KEY = 'openlpm:post_login_redirect'

// Soft gate only -- RLS is the real access-control boundary (see
// lib/supabase/client.ts). This just decides what renders, and remembers
// where the visitor was headed so login can send them back after the OAuth
// round-trip drops them back at the site root (see App.tsx's redirect effect).
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!session) {
    const wanted = location.pathname + location.search
    if (wanted !== '/') window.localStorage.setItem(REDIRECT_KEY, wanted)
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

export { REDIRECT_KEY }
