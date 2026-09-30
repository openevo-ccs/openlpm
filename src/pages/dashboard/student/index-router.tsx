import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from '../project-layout'
import DashboardPage from '../dashboard-page'
import StudentLernzielePage from './student-lernziele-page'

// The project's own root URL (/dashboard/:project) has to resolve to
// different content for the two audiences -- the researcher Dashboard, or
// the student's Lernziele explorer -- decided from the same isStudentView
// flag project-layout.tsx already computed, not a second lookup.
export default function ProjectIndexRouter() {
  const context = useOutletContext<ProjectOutletContext>()
  return context.isStudentView ? <StudentLernzielePage /> : <DashboardPage />
}
