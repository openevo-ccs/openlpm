import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from '../project-layout'
import DashboardPage from '../dashboard-page'
import StudentLernzielePage from './student-lernziele-page'
import CurriculumConnectionsPage from './curriculum-connections-page'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'

// The project's own root URL (/dashboard/:project) has to resolve to
// different content depending on the active view -- the researcher
// Dashboard, the Jena pilot's bespoke Lernziele explorer, or (the 4
// 2026-10-20 German/US custom views) their own Overview page
// (curriculum-connections-page.tsx). Originally this reused the plain
// researcher LearningGoalsPage here, which wasn't template-language-aware
// -- fixed the same day the nav grew real sidebar items, since that
// redesign made a German custom view's English-rendering root page much
// more visible to a reader.
export default function ProjectIndexRouter() {
  const context = useOutletContext<ProjectOutletContext>()
  if (!context.isStudentView) return <DashboardPage />
  if (getCurriculumConnectionsViewConfig(context.templateId)) return <CurriculumConnectionsPage />
  return <StudentLernzielePage />
}
