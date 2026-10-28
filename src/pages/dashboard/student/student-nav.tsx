import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarRange, ClipboardList, Columns2, Dna, FileText, GitCompare, Grid3x3, ListChecks, Network, PenLine, GraduationCap, Sparkles, Users, Waypoints, type LucideIcon } from 'lucide-react'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { makeT, type StringKey } from '../comparison/strings'
import { KNOWN_COMPARISON_PAIRS } from '@/lib/supabase/comparative-analysis'

// The comparison views (country and cross-national, rebuilt 2026-10-28) share one
// sidebar of four groups: explore the data, compare it, improve it, share it.
// "Between spaces" appears only for a space that has a written comparison with
// another space (today Bio-Core and Interdisciplinary).
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
      <p className="muted student-nav-group">{t('groupShare')}</p>
      {item(`${base}/report`, 'navReport', FileText)}
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
      <p className="muted student-nav-group">MEINE ARBEIT</p>
      <NavLink to={`${base}/meine-arbeit`} title="Meine Arbeit und Abgabe" className={({ isActive }) => (isActive ? 'active' : '')}>
        <PenLine size={14} /><span className="nav-label">Meine Arbeit und Abgabe</span>
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
