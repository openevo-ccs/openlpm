import { NavLink } from 'react-router-dom'
import { ClipboardList, Dna, Sparkles, Users } from 'lucide-react'

// Two groups, three items -- EvoMentor DE v1.2's own real sidebar shape
// (ERKUNDEN: Lernziele, Basiskonzepte / PLANEN: KI-Prompt-Generator),
// carried over deliberately since it's the exact reference Dustin asked
// this student view to match. Intentionally narrow by design for a
// first-time student user, not a placeholder to expand later -- which is
// why Groups (the one real exception) is its own clearly-separate third
// section, shown only when the project owner has actually turned it on
// (migration 075), rather than folded into ERKUNDEN/PLANEN as if it were
// part of the original EvoMentor DE reference.
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
