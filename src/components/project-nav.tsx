import { NavLink } from 'react-router-dom'

export interface ProjectNavItem {
  href: string
  icon: React.ReactNode
  label: string
  end?: boolean
}

// `label` is rendered both as the visible text (hidden via CSS, not
// removed, when the sidebar is collapsed -- see .project-side.collapsed
// .nav-label in globals.css) and as a `title` tooltip, so a collapsed,
// icon-only item still tells you what it is on hover.
export function ProjectNav({ items }: { items: ProjectNavItem[] }) {
  return (
    <nav>
      {items.map(({ href, icon, label, end = true }) => (
        <NavLink key={href} to={href} end={end} title={label} className={({ isActive }) => (isActive ? 'active' : '')}>
          {icon}
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
