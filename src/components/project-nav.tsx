import { NavLink } from 'react-router-dom'

export function ProjectNav({ items }: { items: { href: string; content: React.ReactNode; end?: boolean }[] }) {
  return (
    <nav>
      {items.map(({ href, content, end = true }) => (
        <NavLink key={href} to={href} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {content}
        </NavLink>
      ))}
    </nav>
  )
}
