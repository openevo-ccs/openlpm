import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LogIn, ShieldAlert, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectRow } from '@/lib/supabase/projects'
import { checkJoinEligibility, selfJoinProject, type JoinEligibility } from '@/lib/supabase/join'
import { OpenLpmLogo } from '@/components/openlpm-logo'

// The landing screen for a shareable "join this group" link
// (…/#/join/:slug), and the same screen the profile page's own "Join a
// group" box sends someone to after they type or paste a slug. Wrapped in
// <RequireAuth> in App.tsx, so an unauthenticated visitor is bounced to
// sign in first and lands back here afterward (same REDIRECT_KEY mechanism
// every other protected route already uses) -- one link works whether
// someone already has an account or not.
export default function JoinPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const supabase = createClient()

  const [state, setState] = useState<{ project: ProjectRow | null; role: string | null } | null>(null)
  const [eligibility, setEligibility] = useState<JoinEligibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setState(null)
    setEligibility(null)
    getProjectBySlug(supabase, slug).then((result) => {
      setState(result)
      // Already a member -- nothing to do here, go straight to the group.
      if (result.project && result.role) {
        navigate(`/dashboard/${slug}`, { replace: true })
        return
      }
      if (result.project) {
        checkJoinEligibility(supabase, result.project.id).then(setEligibility)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const join = async () => {
    if (!state?.project || !eligibility?.role) return
    setBusy(true)
    setError(null)
    const { error } = await selfJoinProject(supabase, state.project.id, eligibility.role)
    setBusy(false)
    if (error) {
      setError(error.message)
    } else {
      navigate(`/dashboard/${slug}`, { replace: true })
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="page page-narrow" style={{ maxWidth: 420, marginTop: 80 }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <OpenLpmLogo size={40} style={{ color: 'var(--series-a)' }} />
        </div>
        {children}
      </div>
    </div>
  )

  if (state === null) {
    return (
      <Shell>
        <p className="muted" style={{ textAlign: 'center' }}>Loading…</p>
      </Shell>
    )
  }

  if (!state.project) {
    return (
      <Shell>
        <div className="card empty" style={{ border: 'none' }}>
          <ShieldAlert size={32} />
          <p>This join link isn&apos;t valid.</p>
          <p className="muted">Double-check the link, or ask whoever shared it with you for a fresh one.</p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">Back to your project spaces</Link></p>
      </Shell>
    )
  }

  const { project } = state

  if (eligibility === null) {
    return (
      <Shell>
        <p className="muted" style={{ textAlign: 'center' }}>Checking…</p>
      </Shell>
    )
  }

  if (!eligibility.eligible) {
    return (
      <Shell>
        <div className="card empty" style={{ border: 'none' }}>
          <ShieldAlert size={32} />
          <p>Can&apos;t join &ldquo;{project.name}&rdquo; automatically.</p>
          <p className="muted">
            This group isn&apos;t open for self-serve joining with your account&apos;s email address. Ask an
            owner of the group to add you directly, or check that you&apos;re signed in with the right email.
          </p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">Back to your project spaces</Link></p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center' }}>
        <UserCheck size={32} style={{ color: 'var(--series-a)' }} />
        <h1 style={{ marginTop: 8 }}>Join {project.name}</h1>
        {project.description && <p className="muted">{project.description}</p>}
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          You&apos;ll join as <strong className="capitalize">{eligibility.role}</strong>.
        </p>
      </div>
      {error && <div className="notice notice-bad" style={{ marginTop: 12 }}>{error}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={join}>
        <LogIn size={16} />
        {busy ? 'Joining…' : `Join ${project.name}`}
      </button>
      <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">Cancel</Link></p>
    </Shell>
  )
}
