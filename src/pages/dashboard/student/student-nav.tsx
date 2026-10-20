import { NavLink } from 'react-router-dom'
import { CalendarRange, ClipboardList, Dna, FileText, GitCompare, Network, Sparkles, Users } from 'lucide-react'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { STRINGS } from './curriculum-connections-strings'

// Two groups, four items -- EvoMentor DE v1.2's sidebar shape (ERKUNDEN:
// Lernziele, Basiskonzepte / PLANEN: KI-Prompt-Generator, Wochenplan),
// carried over deliberately since it's the exact reference Dustin asked
// this student view to match. Intentionally narrow by design for a
// first-time student user, kept that way rather than treated as a
// placeholder to expand later -- which is why Groups (the one exception)
// is its own clearly-separate third section, shown only when the project
// owner has actually turned it on (migration 075), rather than folded
// into ERKUNDEN/PLANEN as if it were part of the original EvoMentor DE
// reference.
//
// Wochenplan (added 2026-10-11) links to the same /calendar route and
// CalendarPage component every project uses -- this is the one place that
// page was actually supposed to reach when it was first built (commit
// 9d985e1): it shipped wired into the global standard sidebar instead,
// which is a different render path this component never touches, so it
// never actually showed up here until now. CalendarPage renders its own
// copy in German automatically for a German-only project (which this
// template is always used by), so no extra plumbing is needed beyond
// linking to it.
//
// The 4 2026-10-20 German/US custom views (bio-core/interdisciplinary x
// Sachsen-Thüringen/New York-California) originally shared one flat
// two-item nav. Redesigned the same day into 2 groups / 4 items -- real
// feedback: "much more strategic use of custom side bar menus to create
// much more helpful navigation of a wider range of visualizations" -- each
// item its own real page (curriculum-overview-page.tsx is this nav's root,
// curriculum-network-page.tsx, curriculum-comparison-page.tsx,
// curriculum-report-page.tsx) rather than tabs inside one page.
function CurriculumConnectionsNav({ slug, language }: { slug: string; language: 'de' | 'en' }) {
  const base = `/dashboard/${slug}`
  const t = STRINGS[language]
  return (
    <nav className="student-nav">
      <p className="muted student-nav-group">{t.groupExplore}</p>
      <NavLink to={base} end title={t.navOverview} className={({ isActive }) => (isActive ? 'active' : '')}>
        <ClipboardList size={14} /><span className="nav-label">{t.navOverview}</span>
      </NavLink>
      <NavLink to={`${base}/curriculum-network`} title={t.navNetwork} className={({ isActive }) => (isActive ? 'active' : '')}>
        <Network size={14} /><span className="nav-label">{t.navNetwork}</span>
      </NavLink>
      <p className="muted student-nav-group">{t.groupAnalyze}</p>
      <NavLink to={`${base}/curriculum-comparison`} title={t.navComparison} className={({ isActive }) => (isActive ? 'active' : '')}>
        <GitCompare size={14} /><span className="nav-label">{t.navComparison}</span>
      </NavLink>
      <NavLink to={`${base}/curriculum-report`} title={t.navReport} className={({ isActive }) => (isActive ? 'active' : '')}>
        <FileText size={14} /><span className="nav-label">{t.navReport}</span>
      </NavLink>
    </nav>
  )
}

export function StudentNav({ slug, groupsEnabled, templateId }: { slug: string; groupsEnabled: boolean; templateId?: string | null }) {
  const curriculumConnectionsConfig = getCurriculumConnectionsViewConfig(templateId ?? null)
  if (curriculumConnectionsConfig) {
    return <CurriculumConnectionsNav slug={slug} language={curriculumConnectionsConfig.language} />
  }

  const base = `/dashboard/${slug}`
  return (
    <nav className="student-nav">
      <p className="muted student-nav-group">ERKUNDEN</p>
      <NavLink to={base} end title="Lernziele" className={({ isActive }) => (isActive ? 'active' : '')}>
        <ClipboardList size={14} /><span className="nav-label">Lernziele</span>
      </NavLink>
      <NavLink to={`${base}/basiskonzepte`} title="Basiskonzepte" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Dna size={14} /><span className="nav-label">Basiskonzepte</span>
      </NavLink>
      <p className="muted student-nav-group">PLANEN</p>
      <NavLink to={`${base}/planen`} title="KI-Prompt-Generator" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Sparkles size={14} /><span className="nav-label">KI-Prompt-Generator</span>
      </NavLink>
      <NavLink to={`${base}/calendar`} title="Wochenplan" className={({ isActive }) => (isActive ? 'active' : '')}>
        <CalendarRange size={14} /><span className="nav-label">Wochenplan</span>
      </NavLink>
      {groupsEnabled && (
        <>
          <p className="muted student-nav-group">GRUPPEN</p>
          <NavLink to={`${base}/groups`} title="Gruppen" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Users size={14} /><span className="nav-label">Gruppen</span>
          </NavLink>
        </>
      )}
    </nav>
  )
}
