import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { SessionProvider, useSession } from '@/state/session'
import { RequireAuth, REDIRECT_KEY } from '@/components/require-auth'
import HomePage from '@/pages/home-page'
import LoginPage from '@/pages/login-page'
import UpdatePasswordPage from '@/pages/update-password-page'
import DashboardLayout from '@/pages/dashboard/dashboard-layout'
import ProjectSwitcherPage from '@/pages/dashboard/project-switcher-page'
import ProfilePage from '@/pages/dashboard/profile-page'
import ProjectLayout from '@/pages/dashboard/project-layout'
import OverviewPage from '@/pages/dashboard/overview-page'
import LiteraturePage from '@/pages/dashboard/literature-page'
import MembersPage from '@/pages/dashboard/members-page'
import SchemaPage from '@/pages/dashboard/schema-page'
import StandardsPage from '@/pages/dashboard/standards-page'
import ProjectsPage from '@/pages/dashboard/projects-page'
import ExplorePage from '@/pages/dashboard/explore-page'
import CoherencePage from '@/pages/dashboard/coherence-page'
import ReviewPage from '@/pages/dashboard/review-page'
import DiscussionsPage from '@/pages/dashboard/discussions-page'
import PortfoliosPage from '@/pages/dashboard/portfolios/portfolios-page'
import PortfolioDetailPage from '@/pages/dashboard/portfolios/portfolio-detail-page'

// After an OAuth round-trip, the provider always drops the visitor back at
// the site root (see login-page.tsx's redirectTo) -- this sends them on to
// wherever <RequireAuth> remembered they were actually headed.
function RedirectAfterLogin() {
  const { session, loading, passwordRecovery, consumePasswordRecovery } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading || !session || location.pathname !== '/') return

    // A password-reset email's link lands here the same way an OAuth
    // round-trip does (both go through the same code-exchange at the site
    // root -- see login-page.tsx's resetPasswordForEmail call, which
    // deliberately does NOT target a specific hash route, since a `?code=`
    // appended after a `#/...` path lands inside the hash fragment where
    // Supabase's own URL detection never looks). The PASSWORD_RECOVERY
    // event (session.tsx) is what actually distinguishes "just signed in"
    // from "here to set a new password" -- send this one to a dedicated
    // screen instead of wherever they were headed before.
    if (passwordRecovery) {
      consumePasswordRecovery()
      navigate('/auth/update-password', { replace: true })
      return
    }

    // <RequireAuth> only sets this when it bounced someone off a protected
    // route -- signing in straight from the homepage (the common path)
    // never sets it, so without a fallback the visitor lands back on the
    // public homepage with no visible sign they're actually logged in.
    const stored = window.localStorage.getItem(REDIRECT_KEY)
    window.localStorage.removeItem(REDIRECT_KEY)
    navigate(stored || '/dashboard', { replace: true })
  }, [loading, session, location.pathname, navigate, passwordRecovery, consumePasswordRecovery])

  return null
}

export default function App() {
  return (
    <SessionProvider>
      <RedirectAfterLogin />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ProjectSwitcherPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path=":project" element={<ProjectLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="literature" element={<LiteraturePage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="schema" element={<SchemaPage />} />
            <Route path="standards" element={<StandardsPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="explore/:objectId" element={<ExplorePage />} />
            <Route path="coherence" element={<CoherencePage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="portfolios" element={<PortfoliosPage />} />
            <Route path="portfolios/:portfolioId" element={<PortfolioDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
