import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from '../project-layout'
import DashboardPage from '../dashboard-page'
import StudentLernzielePage from './student-lernziele-page'
import ComparisonOverviewPage from '../comparison/overview-page'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'

// The project's own root URL (/dashboard/:project) has to resolve to
// different content depending on the active view: the researcher Dashboard,
// the Jena pilot's bespoke Lernziele explorer, or, for the country and
// cross-national comparison views, their Overview page (rebuilt 2026-10-28;
// see pages/dashboard/comparison).
export default function ProjectIndexRouter() {
  const context = useOutletContext<ProjectOutletContext>()
  if (!context.isStudentView) return <DashboardPage />
  if (getCurriculumConnectionsViewConfig(context.templateId)) return <ComparisonOverviewPage />
  return <StudentLernzielePage />
}
