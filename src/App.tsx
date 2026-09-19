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
import DashboardPage from '@/pages/dashboard/dashboard-page'
import NewProjectWizard from '@/pages/dashboard/new-project-wizard'
import LiteraturePage from '@/pages/dashboard/literature-page'
import ConceptsPage from '@/pages/dashboard/concepts-page'
import TheoriesPage from '@/pages/dashboard/theories-page'
import StrandsPage from '@/pages/dashboard/strands-page'
import LearningGoalsPage from '@/pages/dashboard/learning-goals-page'
import AnalyticsPage from '@/pages/dashboard/analytics-page'
import ReviewPage from '@/pages/dashboard/review-page'
import DiscussionsPage from '@/pages/dashboard/discussions-page'
import PortfoliosPage from '@/pages/dashboard/portfolios/portfolios-page'
import PortfolioDetailPage from '@/pages/dashboard/portfolios/portfolio-detail-page'
import PromptGeneratorPage from '@/pages/dashboard/portfolios/prompt-generator-page'
import AdminFeedbackPage from '@/pages/dashboard/admin-feedback-page'

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
          <Route path="new-project" element={<NewProjectWizard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin/feedback" element={<AdminFeedbackPage />} />
          <Route path=":project" element={<ProjectLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="new-project" element={<NewProjectWizard />} />
            <Route path="learning-goals" element={<LearningGoalsPage />} />
            <Route path="learning-goals/:objectId" element={<LearningGoalsPage />} />
            <Route path="concepts" element={<ConceptsPage />} />
            <Route path="concepts/:conceptId" element={<ConceptsPage />} />
            <Route path="theories" element={<TheoriesPage />} />
            <Route path="theories/:theoryId" element={<TheoriesPage />} />
            <Route path="strands" element={<StrandsPage />} />
            <Route path="strands/:strandId" element={<StrandsPage />} />
            <Route path="literature" element={<LiteraturePage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="notebooks" element={<PortfoliosPage />} />
            <Route path="notebooks/:portfolioId" element={<PortfolioDetailPage />} />
            <Route path="notebooks/:portfolioId/prompt" element={<PromptGeneratorPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
