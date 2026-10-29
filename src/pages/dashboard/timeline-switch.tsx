import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from './project-layout'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import TimelinePage from './timeline-page'
import ComparisonTimelinePage from './comparison/timeline-page'

// Two different pages share the address "timeline": the policy timeline of the
// comparison views and the dated-records timeline of a Curriculum Repository.
// Since the comparison rebuild (2026-10-28) the comparison route was listed
// first and sent every repository's Timeline link back to its dashboard. One
// route now picks the page from the view the project is showing.
export default function TimelineSwitch() {
  const context = useOutletContext<ProjectOutletContext>()
  if (!context.viewsReady) return <p className="muted">…</p>
  if (getCurriculumConnectionsViewConfig(context.templateId)) return <ComparisonTimelinePage />
  return <TimelinePage />
}
