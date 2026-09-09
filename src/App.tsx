import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { SessionProvider, useSession } from '@/state/session'
import { RequireAuth, REDIRECT_KEY } from '@/components/require-auth'
import HomePage from '@/pages/home-page'
import LoginPage from '@/pages/login-page'
import DashboardLayout from '@/pages/dashboard/dashboard-layout'
import ProjectSwitcherPage from '@/pages/dashboard/project-switcher-page'
import ProjectLayout from '@/pages/dashboard/project-layout'
import OverviewPage from '@/pages/dashboard/overview-page'
import LiteraturePage from '@/pages/dashboard/literature-page'
import SchemaPage from '@/pages/dashboard/schema-page'
import StandardsPage from '@/pages/dashboard/standards-page'
import BranchesPage from '@/pages/dashboard/branches-page'
import BranchLayout from '@/pages/dashboard/branches/branch-layout'
import BranchOverviewPage from '@/pages/dashboard/branches/branch-overview-page'
import BranchSchemaPage from '@/pages/dashboard/branches/branch-schema-page'
import DiscussionsPage from '@/pages/dashboard/discussions-page'
import PortfoliosPage from '@/pages/dashboard/portfolios/portfolios-page'
import PortfolioDetailPage from '@/pages/dashboard/portfolios/portfolio-detail-page'

// After an OAuth round-trip, the provider always drops the visitor back at
// the site root (see login-page.tsx's redirectTo) -- this sends them on to
// wherever <RequireAuth> remembered they were actually headed.
function RedirectAfterLogin() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading || !session || location.pathname !== '/') return
    // <RequireAuth> only sets this when it bounced someone off a protected
    // route -- signing in straight from the homepage (the common path)
    // never sets it, so without a fallback the visitor lands back on the
    // public homepage with no visible sign they're actually logged in.
    const stored = window.localStorage.getItem(REDIRECT_KEY)
    window.localStorage.removeItem(REDIRECT_KEY)
    navigate(stored || '/dashboard', { replace: true })
  }, [loading, session, location.pathname, navigate])

  return null
}

export default function App() {
  return (
    <SessionProvider>
      <RedirectAfterLogin />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ProjectSwitcherPage />} />
          <Route path=":project" element={<ProjectLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="literature" element={<LiteraturePage />} />
            <Route path="schema" element={<SchemaPage />} />
            <Route path="standards" element={<StandardsPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="branches/:branchSlug" element={<BranchLayout />}>
              <Route index element={<BranchOverviewPage />} />
              <Route path="schema" element={<BranchSchemaPage />} />
            </Route>
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
