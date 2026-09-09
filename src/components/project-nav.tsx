import { NavLink } from 'react-router-dom'

export function ProjectNav({ items }: { items: { href: string; content: React.ReactNode }[] }) {
  return (
    <nav>
      {items.map(({ href, content }) => (
        <NavLink key={href} to={href} end className={({ isActive }) => (isActive ? 'active' : '')}>
          {content}
        </NavLink>
      ))}
    </nav>
  )
}
