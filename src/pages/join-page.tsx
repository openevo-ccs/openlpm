import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LogIn, ShieldAlert, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjectBySlug, type ProjectRow } from '@/lib/supabase/projects'
import { checkJoinEligibility, selfJoinProject, type JoinEligibility } from '@/lib/supabase/join'
import { OpenLpmLogo } from '@/components/openlpm-logo'
import { isJenaTemplate } from '@/lib/student-view-templates'

// The landing screen for a shareable "join this group" link
// (…/#/join/:slug), and the same screen the profile page's own "Join a
// group" box sends someone to after they type or paste a slug. Wrapped in
// <RequireAuth> in App.tsx, so an unauthenticated visitor is bounced to
// sign in first and lands back here afterward (same REDIRECT_KEY mechanism
// every other protected route already uses) -- one link works whether
// someone already has an account or not.
//
// A German-language space (the Jena seminar spaces) gets German text. With
// ?auto=1 -- which the welcome page (welcome-page.tsx) adds -- an eligible
// visitor is joined without a second click, since they already pressed
// "create account" or "sign in" to get here.

const TEXT = {
  en: {
    loading: 'Loading…',
    checking: 'Checking…',
    invalidTitle: "This join link isn't valid.",
    invalidBody: 'Double-check the link, or ask whoever shared it with you for a fresh one.',
    back: 'Back to your project spaces',
    cantTitle: (n: string) => `Can't join “${n}” automatically.`,
    cantBody:
      "This group isn't open for self-serve joining with your account's email address. Ask an owner of the group to add you directly, or check that you're signed in with the right email.",
    joinHeading: (n: string) => `Join ${n}`,
    joinAs: 'You’ll join as',
    joinButton: (n: string) => `Join ${n}`,
    joining: 'Joining…',
    cancel: 'Cancel',
  },
  de: {
    loading: 'Lädt…',
    checking: 'Prüft…',
    invalidTitle: 'Dieser Link ist nicht gültig.',
    invalidBody: 'Prüfe den Link oder bitte die Person, die ihn geschickt hat, um einen neuen.',
    back: 'Zurück zu deinen Bereichen',
    cantTitle: (n: string) => `Du kannst „${n}“ nicht selbst beitreten.`,
    cantBody:
      'Mit der E-Mail-Adresse deines Kontos ist der Beitritt nicht freigegeben. Melde dich mit deiner Uni-Jena-Adresse (…@uni-jena.de) an oder wende dich an die Dozentin.',
    joinHeading: (n: string) => `${n} beitreten`,
    joinAs: 'Du trittst bei als',
    joinButton: (n: string) => `${n} beitreten`,
    joining: 'Tritt bei…',
    cancel: 'Abbrechen',
  },
}

function isGerman(project: ProjectRow): boolean {
  const langs = (project as any).working_languages as string[] | null | undefined
  return (langs?.length === 1 && langs[0] === 'de') || isJenaTemplate((project as any).student_view_template)
}

export default function JoinPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const auto = searchParams.get('auto') === '1'
  const navigate = useNavigate()
  const supabase = createClient()
  const autoStarted = useRef(false)

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

  useEffect(() => {
    if (auto && !autoStarted.current && state?.project && eligibility?.eligible && eligibility.role) {
      autoStarted.current = true
      void join()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, state, eligibility])

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
        <p className="muted" style={{ textAlign: 'center' }}>{TEXT.en.loading}</p>
      </Shell>
    )
  }

  if (!state.project) {
    const t = TEXT.en
    return (
      <Shell>
        <div className="card empty" style={{ border: 'none' }}>
          <ShieldAlert size={32} />
          <p>{t.invalidTitle}</p>
          <p className="muted">{t.invalidBody}</p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">{t.back}</Link></p>
      </Shell>
    )
  }

  const { project } = state
  const t = isGerman(project) ? TEXT.de : TEXT.en

  if (eligibility === null) {
    return (
      <Shell>
        <p className="muted" style={{ textAlign: 'center' }}>{t.checking}</p>
      </Shell>
    )
  }

  if (!eligibility.eligible) {
    return (
      <Shell>
        <div className="card empty" style={{ border: 'none' }}>
          <ShieldAlert size={32} />
          <p>{t.cantTitle(project.name)}</p>
          <p className="muted">{t.cantBody}</p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">{t.back}</Link></p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center' }}>
        <UserCheck size={32} style={{ color: 'var(--series-a)' }} />
        <h1 style={{ marginTop: 8 }}>{t.joinHeading(project.name)}</h1>
        {project.description && <p className="muted">{project.description}</p>}
        {!isGerman(project) && (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {t.joinAs} <strong className="capitalize">{eligibility.role}</strong>.
          </p>
        )}
      </div>
      {error && <div className="notice notice-bad" style={{ marginTop: 12 }}>{error}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={join}>
        <LogIn size={16} />
        {busy ? t.joining : t.joinButton(project.name)}
      </button>
      <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/dashboard">{t.cancel}</Link></p>
    </Shell>
  )
}
