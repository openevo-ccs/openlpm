import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarRange, ClipboardList, Columns2, Dna, FileEdit, FileText, GitCompare, Grid3x3, ListChecks, Network, PenLine, GraduationCap, Sparkles, Users, Waypoints, type LucideIcon } from 'lucide-react'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { makeT, type StringKey } from '../comparison/strings'
import { KNOWN_COMPARISON_PAIRS } from '@/lib/supabase/comparative-analysis'

// The comparison views (country and cross-national, rebuilt 2026-10-28) share one
// sidebar of four groups: explore the data, compare it, improve it, share it.
// "Between spaces" appears only for a space that has a written comparison with
// another space (today Bio-Core and Interdisciplinary).
// Spaces that hold parts nobody has accepted yet and so have a "Draft links" page (src/pages/dashboard/comparison/draft-links-page.tsx).
const DRAFT_LINK_SPACES = new Set(['interdisciplinary-lpm-synth'])

function CurriculumConnectionsNav({ slug, language }: { slug: string; language: 'de' | 'en' }) {
  const base = `/dashboard/${slug}`
  const t = (key: StringKey) => makeT(language)(key)
  const item = (to: string, key: StringKey, Icon: LucideIcon, end = false) => (
    <NavLink to={to} end={end} title={t(key)} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon size={14} /><span className="nav-label">{t(key)}</span>
    </NavLink>
  )
  return (
    <nav className="student-nav">
      <p className="muted student-nav-group">{t('groupExplore')}</p>
      {item(base, 'navOverview', ClipboardList, true)}
      {item(`${base}/coverage`, 'navCoverage', Grid3x3)}
      {item(`${base}/network`, 'navNetwork', Network)}
      {item(`${base}/timeline`, 'navTimeline', CalendarRange)}
      <p className="muted student-nav-group">{t('groupCompare')}</p>
      {item(`${base}/flows`, 'navFlows', Waypoints)}
      {item(`${base}/school-years`, 'navSchoolYears', GraduationCap)}
      {item(`${base}/measures`, 'navMeasures', BarChart3)}
      {item(`${base}/side-by-side`, 'navSideBySide', Columns2)}
      {KNOWN_COMPARISON_PAIRS[slug] && item(`${base}/spaces`, 'navSpaces', GitCompare)}
      <p className="muted student-nav-group">{t('groupImprove')}</p>
      {item(`${base}/curate`, 'navCurate', ListChecks)}
      {DRAFT_LINK_SPACES.has(slug) && item(`${base}/draft-links`, 'navDraftLinks', FileEdit)}
      <p className="muted student-nav-group">{t('groupShare')}</p>
      {item(`${base}/report`, 'navReport', FileText)}
    </nav>
  )
}

// The seminar's further tasks (Susan, 10/29). They stay hidden until the task is
// ready: set visible to true here once the page for it exists (route `path`
// in App.tsx and in JENA_STUDENT_PATHS in project-layout.tsx). The page for
// Aufgabe 2 exists since 2026-11-13 (feedback 1acd80a7); owners can open it by
// address, students cannot until it is switched on in both places.
const SEMINAR_TASKS = [
  { path: 'aufgabe2', label: 'Aufgabe 2: Didaktische Methoden', visible: false },
  { path: 'aufgabe3', label: 'Aufgabe 3', visible: false },
]

// Susan, 11/6 (feedback b4412950): the Wochenplan page is not shown in this view.
// The page and its route stay in the code; set to true to bring the menu entry
// back (and add 'calendar' to JENA_STUDENT_PATHS in project-layout.tsx).
const SHOW_WOCHENPLAN = false

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
      <div className="student-nav-section" data-tour="sidebar.meine-arbeit">
      <p className="muted student-nav-group">MEINE ARBEIT</p>
      <NavLink to={`${base}/aufgabe1`} title="Aufgabe 1: Basiskonzepte" className={({ isActive }) => (isActive ? 'active' : '')}>
        <PenLine size={14} /><span className="nav-label">Aufgabe 1: Basiskonzepte</span>
      </NavLink>
      {SEMINAR_TASKS.filter((task) => task.visible).map((task) => (
        <NavLink key={task.path} to={`${base}/${task.path}`} title={task.label} className={({ isActive }) => (isActive ? 'active' : '')}>
          <PenLine size={14} /><span className="nav-label">{task.label}</span>
        </NavLink>
      ))}
      </div>
      <p className="muted student-nav-group">PLANEN</p>
      <NavLink to={`${base}/planen`} title="KI-Prompt-Generator" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Sparkles size={14} /><span className="nav-label">KI-Prompt-Generator</span>
      </NavLink>
      {SHOW_WOCHENPLAN && (
        <NavLink to={`${base}/calendar`} title="Wochenplan" className={({ isActive }) => (isActive ? 'active' : '')}>
          <CalendarRange size={14} /><span className="nav-label">Wochenplan</span>
        </NavLink>
      )}
      {groupsEnabled && (
        <div className="student-nav-section" data-tour="sidebar.gruppen">
          <p className="muted student-nav-group">GRUPPEN</p>
          <NavLink to={`${base}/groups`} title="Gruppen" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Users size={14} /><span className="nav-label">Gruppen</span>
          </NavLink>
        </div>
      )}
    </nav>
  )
}
