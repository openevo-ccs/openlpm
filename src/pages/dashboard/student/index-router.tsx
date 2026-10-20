import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from '../project-layout'
import DashboardPage from '../dashboard-page'
import LearningGoalsPage from '../learning-goals-page'
import StudentLernzielePage from './student-lernziele-page'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'

// The project's own root URL (/dashboard/:project) has to resolve to
// different content depending on the active view -- the researcher
// Dashboard, the Jena pilot's bespoke Lernziele explorer, or (the 4
// 2026-10-20 German/US custom views) the ordinary researcher Learning
// Goals page reused as-is, since those views don't need their own
// simplified content explorer the way Jena's does.
export default function ProjectIndexRouter() {
  const context = useOutletContext<ProjectOutletContext>()
  if (!context.isStudentView) return <DashboardPage />
  if (getCurriculumConnectionsViewConfig(context.templateId)) return <LearningGoalsPage />
  return <StudentLernzielePage />
}
