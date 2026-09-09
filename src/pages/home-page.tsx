import { Link } from 'react-router-dom'
import { BookOpen, GitBranch, MessageSquare, Search } from 'lucide-react'
import { useSession } from '@/state/session'

export default function HomePage() {
  const { session } = useSession()

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <GitBranch size={22} />
          OpenLPM
        </div>
        <nav className="row" style={{ marginLeft: 'auto' }}>
          {session ? (
            <Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>
          ) : (
            <>
              <Link className="btn" to="/auth/login">Login</Link>
              <Link className="btn btn-primary" to="/auth/login">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <main className="page page-narrow">
        <section style={{ textAlign: 'center', padding: '48px 0' }}>
          <h1 style={{ fontSize: 32 }}>Collaborative Learning Progression Management</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 560, margin: '0 auto 20px' }}>
            A cost-free, scientifically rigorous platform for collaborative development of learning progressions.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to={session ? '/dashboard' : '/auth/login'}>
              {session ? 'Go to dashboard' : 'Start collaborating'}
            </Link>
          </div>
        </section>

        <section className="grid grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <Search size={20} style={{ color: 'var(--series-a)' }} />
            <h3>Literature management</h3>
            <p className="muted">Search, verify, and organize scientific literature with DOI verification and evidence linking.</p>
          </div>
          <div className="card">
            <GitBranch size={20} style={{ color: 'var(--good)' }} />
            <h3>Schema co-design</h3>
            <p className="muted">Collaboratively design and refine learning progression schema elements with version tracking.</p>
          </div>
          <div className="card">
            <BookOpen size={20} style={{ color: 'var(--serious)' }} />
            <h3>Peer review</h3>
            <p className="muted">Structured peer review workflows with transparent feedback and revision tracking.</p>
          </div>
          <div className="card">
            <MessageSquare size={20} style={{ color: 'var(--warning)' }} />
            <h3>Discussion forums</h3>
            <p className="muted">Rich discussions with threading, annotations, and linking to specific content elements.</p>
          </div>
        </section>
      </main>

      <footer className="page page-narrow muted" style={{ textAlign: 'center', paddingTop: 0 }}>
        © 2026 OpenLPM · Open source, self-hostable, free
      </footer>
    </div>
  )
}
