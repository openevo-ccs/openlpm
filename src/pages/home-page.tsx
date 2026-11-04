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
import {
  FOUR_MODELS,
  HOME_HEADLINE,
  LEAD_PARAGRAPHS,
  MODELS_INTRO,
  MODELS_TITLE,
  PROGRESSION_GLOSS,
  STARTING_POINTS,
  TOOLKIT_LINE,
} from '@/lib/start-here'

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
          <span className="chip" style={{ marginBottom: 16 }}>Open source · Free to use</span>
          <h1 style={{ fontSize: 34, marginTop: 14 }}>{HOME_HEADLINE}</h1>
          <div className="home-lead">
            {LEAD_PARAGRAPHS.map((text) => <p key={text}>{text}</p>)}
            <p><strong>{TOOLKIT_LINE}</strong></p>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to={session ? '/dashboard' : '/auth/login?mode=signup'}>
              {session ? 'Go to dashboard' : 'Create an account'}
            </Link>
            {!session && <Link className="btn" to="/auth/login">Sign in</Link>}
          </div>
        </div>
      </section>

      <main className="page page-narrow">
        <section className="home-section" aria-labelledby="home-models">
          <h2 id="home-models" style={{ textAlign: 'center', marginBottom: 4 }}>{MODELS_TITLE}</h2>
          <p className="muted" style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 8px' }}>{PROGRESSION_GLOSS}</p>
          <p className="muted" style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 20px' }}>{MODELS_INTRO}</p>
          <div className="home-models">
            {FOUR_MODELS.map((m) => (
              <div className={`card home-model home-model-${m.kind}`} key={m.slug}>
                <span className="chip">{m.kind === 'one-subject' ? 'One subject' : 'Across subjects'}</span>
                <h3>{m.name}</h3>
                <p className="muted">{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="home-first">
          <h2 id="home-first" style={{ textAlign: 'center', marginBottom: 4 }}>Three places to look first</h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>
            After you sign in, your project list opens with a short guide and a link to each of these.
          </p>
          <ol className="home-points">
            {STARTING_POINTS.map((p) => (
              <li className="card" key={p.key}>
                <h3>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" aria-labelledby="home-built-for">
          <h2 id="home-built-for" style={{ textAlign: 'center', marginBottom: 4 }}>Built for research, teaching, and policy together</h2>
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

        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>What else the platform does</h2>
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
        <p style={{ marginBottom: 10 }}>© 2026 OpenLPM · Open source and free to use</p>
        <OpenEvoAttribution />
      </footer>
    </div>
  )
}
