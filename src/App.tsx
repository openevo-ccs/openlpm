import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SessionProvider, useSession } from '@/state/session'
import { RequireAuth, REDIRECT_KEY } from '@/components/require-auth'
import HomePage from '@/pages/home-page'
import LoginPage from '@/pages/login-page'
import UpdatePasswordPage from '@/pages/update-password-page'
import ImpressumPage from '@/pages/impressum-page'
import PrivacyPage from '@/pages/privacy-page'
import DashboardLayout from '@/pages/dashboard/dashboard-layout'
import ProjectSwitcherPage from '@/pages/dashboard/project-switcher-page'
import ProfilePage from '@/pages/dashboard/profile-page'
import ProjectLayout from '@/pages/dashboard/project-layout'
import DashboardPage from '@/pages/dashboard/dashboard-page'
import SettingsPage from '@/pages/dashboard/settings-page'
import TourEditorPage from '@/pages/dashboard/tour-editor-page'
import NewProjectWizard from '@/pages/dashboard/new-project-wizard'
import LiteraturePage from '@/pages/dashboard/literature-page'
import ConceptsPage from '@/pages/dashboard/concepts-page'
import ConceptMeaningsPage from '@/pages/dashboard/concept-meanings-page'
import TheoriesPage from '@/pages/dashboard/theories-page'
import StrandsPage from '@/pages/dashboard/strands-page'
import CalendarPage from '@/pages/dashboard/calendar-page'
import TimePage from '@/pages/dashboard/time-page'
import MethodsPage from '@/pages/dashboard/methods-page'
import CurriculumRepositoryPage from '@/pages/dashboard/curriculum-repository-page'
import CurriculumStructurePage from '@/pages/dashboard/curriculum-structure-page'
import TimelineSwitch from '@/pages/dashboard/timeline-switch'
import ContextItemsPage from '@/pages/dashboard/context-items-page'
import MapPage from '@/pages/dashboard/map-page'
import LearningGoalsPage from '@/pages/dashboard/learning-goals-page'
import AnalyticsPage from '@/pages/dashboard/analytics-page'
import ReviewPage from '@/pages/dashboard/review-page'
import DiscussionsPage from '@/pages/dashboard/discussions-page'
import PortfoliosPage from '@/pages/dashboard/portfolios/portfolios-page'
import PortfolioDetailPage from '@/pages/dashboard/portfolios/portfolio-detail-page'
import PromptGeneratorPage from '@/pages/dashboard/portfolios/prompt-generator-page'
import GroupsPage from '@/pages/dashboard/groups-page'
import GroupDetailPage from '@/pages/dashboard/groups/group-detail-page'
import AdminUsersPage from '@/pages/dashboard/admin-users-page'
import AdminBaseRepoExplorerPage from '@/pages/dashboard/admin-base-repo-explorer-page'
import AdminLayout, { AdminFeedbackTab } from '@/pages/dashboard/admin-layout'
import AdminContentEditorPage from '@/pages/dashboard/admin-content-editor-page'
import JoinPage from '@/pages/join-page'
import WelcomePage from '@/pages/welcome-page'
import StudentWorkPage from '@/pages/dashboard/student/student-work-page'
import ProjectIndexRouter from '@/pages/dashboard/student/index-router'
import StudentLernzielePage from '@/pages/dashboard/student/student-lernziele-page'
import StudentBasiskonzeptePage from '@/pages/dashboard/student/student-basiskonzepte-page'
import StudentPromptPage from '@/pages/dashboard/student/student-prompt-page'
import { ComparisonOnly } from '@/pages/dashboard/comparison/context'
import ComparisonOverviewPage from '@/pages/dashboard/comparison/overview-page'
import ComparisonCoveragePage from '@/pages/dashboard/comparison/coverage-page'
import ComparisonNetworkPage from '@/pages/dashboard/comparison/network-page'
import ComparisonFlowsPage from '@/pages/dashboard/comparison/flows-page'
import ComparisonSchoolYearsPage from '@/pages/dashboard/comparison/school-years-page'
import ComparisonMeasuresPage from '@/pages/dashboard/comparison/measures-page'
import ComparisonSideBySidePage from '@/pages/dashboard/comparison/side-by-side-page'
import ComparisonCuratePage from '@/pages/dashboard/comparison/curate-page'
import ComparisonDraftLinksPage from '@/pages/dashboard/comparison/draft-links-page'
import ComparisonReportPage from '@/pages/dashboard/comparison/report-page'
import ComparisonSpacesPage from '@/pages/dashboard/comparison/spaces-page'

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

function ConceptMeaningsRedirect() {
  const { conceptId } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/dashboard/admin/concept-meanings${conceptId ? `/${conceptId}` : ''}${search}`} replace />
}

export default function App() {
  return (
    <SessionProvider>
      <RedirectAfterLogin />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/willkommen/:slug" element={<WelcomePage />} />
        <Route
          path="/join/:slug"
          element={
            <RequireAuth>
              <JoinPage />
            </RequireAuth>
          }
        />

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
          {/* Old addresses of Concept meanings keep working. The page now lives inside the Admin area. */}
          <Route path="concept-meanings" element={<ConceptMeaningsRedirect />} />
          <Route path="concept-meanings/:conceptId" element={<ConceptMeaningsRedirect />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<AdminUsersPage section="accounts" />} />
            <Route path="projects" element={<AdminUsersPage section="projects" />} />
            <Route path="join-rules" element={<AdminUsersPage section="join-rules" />} />
            <Route path="feedback" element={<AdminFeedbackTab />} />
            <Route path="explore" element={<AdminBaseRepoExplorerPage />} />
            <Route path="concept-meanings" element={<ConceptMeaningsPage />} />
            <Route path="concept-meanings/:conceptId" element={<ConceptMeaningsPage />} />
            <Route path="content" element={<AdminContentEditorPage />} />
          </Route>
          <Route path=":project" element={<ProjectLayout />}>
            <Route index element={<ProjectIndexRouter />} />
            <Route path=":objectId" element={<StudentLernzielePage />} />
            <Route path="basiskonzepte" element={<StudentBasiskonzeptePage />} />
            <Route path="basiskonzepte/:tab" element={<StudentBasiskonzeptePage />} />
            <Route path="planen" element={<StudentPromptPage />} />
            {/* Feedback 1ff0cffa (Susan, 2026-11-07): the address names the task, so more tasks can be added next to it. The old address keeps working. */}
            <Route path="aufgabe1" element={<StudentWorkPage />} />
            <Route path="meine-arbeit" element={<Navigate to="../aufgabe1" replace />} />
            <Route path="coverage" element={<ComparisonOnly><ComparisonCoveragePage /></ComparisonOnly>} />
            <Route path="network" element={<ComparisonOnly><ComparisonNetworkPage /></ComparisonOnly>} />
            <Route path="timeline" element={<TimelineSwitch />} />
            <Route path="flows" element={<ComparisonOnly><ComparisonFlowsPage /></ComparisonOnly>} />
            <Route path="school-years" element={<ComparisonOnly><ComparisonSchoolYearsPage /></ComparisonOnly>} />
            <Route path="measures" element={<ComparisonOnly><ComparisonMeasuresPage /></ComparisonOnly>} />
            <Route path="side-by-side" element={<ComparisonOnly><ComparisonSideBySidePage /></ComparisonOnly>} />
            <Route path="spaces" element={<ComparisonOnly><ComparisonSpacesPage /></ComparisonOnly>} />
            <Route path="curate" element={<ComparisonOnly><ComparisonCuratePage /></ComparisonOnly>} />
            <Route path="draft-links" element={<ComparisonOnly><ComparisonDraftLinksPage /></ComparisonOnly>} />
            <Route path="report" element={<ComparisonOnly><ComparisonReportPage /></ComparisonOnly>} />
            {/* Addresses the comparison views used before the 2026-10-28 rebuild. */}
            <Route path="curriculum-connections" element={<ComparisonOnly><ComparisonOverviewPage /></ComparisonOnly>} />
            <Route path="curriculum-network" element={<Navigate to="../network" replace />} />
            <Route path="curriculum-regions" element={<Navigate to="../coverage" replace />} />
            <Route path="curriculum-comparison" element={<Navigate to="../spaces" replace />} />
            <Route path="curriculum-report" element={<Navigate to="../report" replace />} />
            <Route path="new-project" element={<NewProjectWizard />} />
            <Route path="learning-goals" element={<LearningGoalsPage />} />
            <Route path="learning-goals/:objectId" element={<LearningGoalsPage />} />
            <Route path="methods" element={<MethodsPage />} />
            <Route path="concepts" element={<ConceptsPage />} />
            <Route path="concepts/:conceptId" element={<ConceptsPage />} />
            <Route path="theories" element={<TheoriesPage />} />
            <Route path="theories/:theoryId" element={<TheoriesPage />} />
            <Route path="strands" element={<StrandsPage />} />
            <Route path="strands/:strandId" element={<StrandsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="time" element={<TimePage />} />
            <Route path="curriculum-repository" element={<CurriculumRepositoryPage />} />
            <Route path="curriculum-repository/:recordId" element={<CurriculumRepositoryPage />} />
            <Route path="curriculum-structure" element={<CurriculumStructurePage />} />
            <Route path="context" element={<ContextItemsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="literature" element={<LiteraturePage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="notebooks" element={<PortfoliosPage />} />
            <Route path="notebooks/:portfolioId" element={<PortfolioDetailPage />} />
            <Route path="notebooks/:portfolioId/prompt" element={<PromptGeneratorPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="tours" element={<TourEditorPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
