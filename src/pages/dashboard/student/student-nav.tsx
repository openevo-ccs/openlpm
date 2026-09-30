import { NavLink } from 'react-router-dom'
import { ClipboardList, Dna, Sparkles } from 'lucide-react'

// Two groups, three items -- EvoMentor DE v1.2's own real sidebar shape
// (ERKUNDEN: Lernziele, Basiskonzepte / PLANEN: KI-Prompt-Generator),
// carried over deliberately since it's the exact reference Dustin asked
// this student view to match. Nothing here reads project settings to
// decide what to show -- unlike the researcher sidebar (10 fixed items,
// Dustin's own 2026-09-13 spec), this one is intentionally narrow by
// design for a first-time student user, not a placeholder to expand later.
export function StudentNav({ slug }: { slug: string }) {
  const base = `/dashboard/${slug}`
  return (
    <nav className="student-nav">
      <p className="muted student-nav-group">ERKUNDEN</p>
      <NavLink to={base} end className={({ isActive }) => (isActive ? 'active' : '')}>
        <ClipboardList size={14} />Lernziele
      </NavLink>
      <NavLink to={`${base}/basiskonzepte`} className={({ isActive }) => (isActive ? 'active' : '')}>
        <Dna size={14} />Basiskonzepte
      </NavLink>
      <p className="muted student-nav-group">PLANEN</p>
      <NavLink to={`${base}/planen`} className={({ isActive }) => (isActive ? 'active' : '')}>
        <Sparkles size={14} />KI-Prompt-Generator
      </NavLink>
    </nav>
  )
}
