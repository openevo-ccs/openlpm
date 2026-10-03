import { Link } from 'react-router-dom'
import {
  BookOpen,
  GitBranch,
  GraduationCap,
  Landmark,
  Layers,
  MessageSquare,
  Microscope,
  Network,
  Search,
} from 'lucide-react'
import { useSession } from '@/state/session'
import { OpenLpmLogo } from '@/components/openlpm-logo'
import { OpenEvoAttribution } from '@/components/openevo-mark'

const AUDIENCES = [
  {
    icon: Microscope,
    color: 'var(--map-3)',
    title: 'Researchers',
    text: 'Build learning progressions on evidence from the research literature, with every source traceable back to its original study.',
  },
  {
    icon: GraduationCap,
    color: 'var(--map-1)',
    title: 'Educators',
    text: 'See the thinking and classroom context behind a learning goal before you bring it into your own teaching, then suggest changes based on what you learn from using it.',
  },
  {
    icon: Landmark,
    color: 'var(--map-4)',
    title: 'Curriculum policy makers',
    text: 'See how learning goals connect across grades and subjects, and track how a curriculum improves as classroom experience comes in.',
  },
]

const FEATURES = [
  {
    icon: Search,
    color: 'var(--series-a)',
    title: 'Literature management',
    text: 'Search and organize the research behind a learning progression, with built-in checks that catch broken or incorrect citations.',
  },
  {
    icon: GitBranch,
    color: 'var(--good)',
    title: 'Concepts & strands',
    text: 'Build out curriculum concepts and learning progression strands together. Every change is saved as its own version, so a team can try new ideas, compare drafts, and never lose earlier work.',
  },
  {
    icon: BookOpen,
    color: 'var(--serious)',
    title: 'Peer review',
    text: 'Get structured feedback from colleagues on a learning progression before it reaches classrooms, with a clear record of what changed and why.',
  },
  {
    icon: MessageSquare,
    color: 'var(--warning)',
    title: 'Discussion forums',
    text: 'Discuss a specific concept or learning goal directly, with replies, notes, and a link back to the exact material under discussion.',
  },
  {
    icon: Layers,
    color: 'var(--series-a)',
    title: 'Learning goals',
    text: 'Track learning goals by grade level and connect each one to the concepts and standards it builds on.',
  },
  {
    icon: Network,
    color: 'var(--good)',
    title: 'Notebooks & AI prompts',
    text: 'Collect the curriculum material you are working with, then generate and test AI-assisted teaching prompts built directly from it.',
  },
]

export default function HomePage() {
  const { session } = useSession()

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <OpenLpmLogo size={22} />
          OpenLPM
        </div>
        <nav className="row" style={{ marginLeft: 'auto' }}>
          {session ? (
            <Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>
          ) : (
            <>
              <Link className="btn" to="/auth/login">Login</Link>
              <Link className="btn btn-primary" to="/auth/login?mode=signup">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="home-hero">
        <div className="page page-narrow" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <span className="chip" style={{ marginBottom: 16 }}>Open source · Free for schools, universities, and ministries</span>
          <h1 style={{ fontSize: 34, marginTop: 14 }}>Collaborative Learning Progression Management</h1>
          <p className="muted" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto 24px' }}>
            A free, open platform for researchers, teachers, and curriculum policy makers to build learning
            progressions together, and keep improving them as classroom experience comes in.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to={session ? '/dashboard' : '/auth/login?mode=signup'}>
              {session ? 'Go to dashboard' : 'Start collaborating'}
            </Link>
          </div>
        </div>
      </section>

      <main className="page page-narrow">
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Built for research, teaching, and policy together</h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>
            Each group gets what it needs from the same shared learning progression.
          </p>
          <div className="grid grid-3">
            {AUDIENCES.map(({ icon: Icon, color, title, text }) => (
              <div className="card home-feature-card" key={title}>
                <div className="home-feature-icon" style={{ background: color }}>
                  <Icon size={18} color="#fff" />
                </div>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-2" style={{ marginBottom: 24 }}>
          {FEATURES.map(({ icon: Icon, color, title, text }) => (
            <div className="card home-feature-card" key={title}>
              <div className="home-feature-icon" style={{ background: color }}>
                <Icon size={18} color="#fff" />
              </div>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="page page-narrow muted" style={{ textAlign: 'center', paddingTop: 0 }}>
        <p style={{ marginBottom: 10 }}>© 2026 OpenLPM · Open source, self-hostable, free</p>
        <OpenEvoAttribution />
      </footer>
    </div>
  )
}
