import { NavLink } from 'react-router-dom'
import { CalendarRange, ClipboardList, Dna, Sparkles, Users } from 'lucide-react'

// Two groups, four items -- EvoMentor DE v1.2's own real sidebar shape
// (ERKUNDEN: Lernziele, Basiskonzepte / PLANEN: KI-Prompt-Generator,
// Wochenplan), carried over deliberately since it's the exact reference
// Dustin asked this student view to match. Intentionally narrow by design
// for a first-time student user, not a placeholder to expand later --
// which is why Groups (the one real exception) is its own clearly-separate
// third section, shown only when the project owner has actually turned it
// on (migration 075), rather than folded into ERKUNDEN/PLANEN as if it
// were part of the original EvoMentor DE reference.
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
export function StudentNav({ slug, groupsEnabled }: { slug: string; groupsEnabled: boolean }) {
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
