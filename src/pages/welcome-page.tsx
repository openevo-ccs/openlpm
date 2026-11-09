import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { KeyRound, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { REDIRECT_KEY } from '@/components/require-auth'
import { useSession } from '@/state/session'
import { WELCOME_CONFIGS } from '@/lib/welcome-config'
// Fonts are served from this site. Loading them from Google would send every
// student's address to Google, which a university course page should avoid.
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/400-italic.css'
import './welcome-page.css'

// The one link a seminar sends to students (…/#/willkommen/evomentor-thuringia).
// Public: it must work for someone with no account. It does three things the
// general sign-in page does not: it speaks German, it accepts only the
// seminar's email domain, and once the person is signed in it joins them to
// the space and opens their student view, with no second screen to find.
//
// Email confirmation: Supabase sends a link that lands on the site root. If
// the student opens it in the same browser, REDIRECT_KEY (set below) sends
// them on to the join step. If they open it on another device, they arrive
// signed in on the dashboard, where project-switcher-page.tsx offers the
// same join step.

type Mode = 'signup' | 'signin' | 'forgot'

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>()
  const config = slug ? WELCOME_CONFIGS[slug] : undefined
  const navigate = useNavigate()
  const { session, loading } = useSession()
  // ?mode=signin opens the sign-in form, for people who already have an account (the notice shown
  // after an email link opened in another browser sends them here, see email-link-notice.tsx).
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signin' ? 'signin' : 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const joinPath = `/join/${slug}?auto=1`
  const logos = `${import.meta.env.BASE_URL}assets/logos`

  useEffect(() => {
    if (!loading && session && config) navigate(joinPath, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, config])

  if (!config) {
    return (
      <div className="page page-narrow" style={{ maxWidth: 480, marginTop: 80 }}>
        <div className="card">
          <p>Dieser Link ist nicht gültig. Bitte prüfe ihn oder frage die Dozentin nach einem neuen.</p>
          <p><Link to="/">Zur Startseite</Link></p>
        </div>
      </div>
    )
  }

  const domainOk = (value: string) => value.trim().toLowerCase().endsWith(`@${config.allowedDomain}`)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNotice(null)
    const supabase = createClient()
    const cleanEmail = email.trim().toLowerCase()

    if (mode !== 'forgot' && !domainOk(cleanEmail) && mode === 'signup') {
      setNotice({ kind: 'bad', text: `Bitte nutze deine Adresse der Universität (${config.domainExample}). Mit anderen Adressen kannst du dich hier nicht registrieren.` })
      return
    }

    setBusy(true)
    if (mode === 'signup') {
      window.localStorage.setItem(REDIRECT_KEY, joinPath)
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
          data: { full_name: name.trim() },
        },
      })
      if (error) {
        setNotice({ kind: 'bad', text: error.message })
      } else if (data.session) {
        navigate(joinPath, { replace: true })
      } else {
        setSentTo(cleanEmail)
      }
    } else if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (error) setNotice({ kind: 'bad', text: 'Anmeldung nicht möglich: E-Mail-Adresse oder Passwort stimmen nicht, oder die Adresse wurde noch nicht bestätigt.' })
      else navigate(joinPath, { replace: true })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      })
      setNotice(error ? { kind: 'bad', text: error.message } : { kind: 'ok', text: 'Wir haben dir einen Link zum Neusetzen des Passworts geschickt.' })
    }
    setBusy(false)
  }

  const steps = [
    'Konto mit deiner Uni-Jena-Adresse anlegen',
    'Den Bestätigungslink in der E-Mail anklicken',
    'Du landest direkt in EvoMentor und kannst loslegen',
  ]

  return (
    <div className="welcome">
      <header className="welcome-top">
        <p className="welcome-top-label">Ein Projekt der</p>
        <div className="welcome-top-logos">
          <span className="welcome-logo-tile">
            <img src={`${logos}/unijena-logo.png`} alt="Friedrich-Schiller-Universität Jena" />
          </span>
          <span className="welcome-logo-tile">
            <img src={`${logos}/bienenhaus-logo.png`} alt="Bienenhaus, AG Biologiedidaktik, Friedrich-Schiller-Universität Jena" />
          </span>
        </div>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero">
          <blockquote className="welcome-quote">
            <p>„Nichts in der Biologie ergibt einen Sinn, außer im Licht der Evolution.“</p>
            <footer>Theodosius Dobzhansky, 1973</footer>
          </blockquote>
          <p className="welcome-lead">
            Das EvoMentor-Projekt unterstützt Lehrkräfte dabei, den Biologieunterricht zu stärken, indem Evolution
            und verwandte Konzepte tiefer in den Unterricht eingebunden werden.
          </p>
        </section>

      <div className="card welcome-card">
        {config.sandbox && <div className="notice notice-bad" style={{ marginBottom: 12 }}><strong>SANDBOX.</strong> Nur für synthetische Testpersonen.</div>}
        <h1 className="welcome-card-title">{config.heading}</h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>{config.intro}</p>

        {sentTo ? (
          <div className="notice notice-ok" style={{ marginTop: 16 }}>
            <MailCheck size={18} />{' '}
            <strong>Fast geschafft.</strong> Wir haben eine E-Mail an <strong>{sentTo}</strong> geschickt. Öffne sie und klicke auf den Link darin. Danach kommst du direkt in EvoMentor.
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Die E-Mail kann einige Minuten brauchen. Schau auch im Spam-Ordner nach. Wenn nach einer halben Stunde nichts da ist, melde dich bei der Dozentin.
              Wenn du den Link auf einem anderen Gerät öffnest, melde dich dort an, und du bekommst einen Knopf zum Beitreten.
            </p>
          </div>
        ) : (
          <>
            <ol style={{ margin: '16px 0', paddingLeft: 20, fontSize: 14 }}>
              {steps.map((s) => <li key={s}>{s}</li>)}
            </ol>

            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              {mode === 'signup' ? 'Konto anlegen' : mode === 'signin' ? 'Anmelden' : 'Passwort zurücksetzen'}
            </h2>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mode === 'signup' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="welcome-name">Dein Name (so sehen dich die Mitglieder deiner Gruppe)</label>
                  <input id="welcome-name" type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" autoComplete="name" />
                </div>
              )}
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="welcome-email">E-Mail-Adresse der Universität</label>
                <input id="welcome-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={config.domainExample} autoComplete="email" />
              </div>
              {mode !== 'forgot' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="welcome-password">Passwort (mindestens 8 Zeichen)</label>
                  <input
                    id="welcome-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={busy}>
                <KeyRound size={16} />
                {busy ? 'Einen Moment…' : mode === 'signup' ? 'Konto anlegen' : mode === 'signin' ? 'Anmelden' : 'Link zum Zurücksetzen senden'}
              </button>
            </form>
            {notice && <div className={`notice notice-${notice.kind}`} style={{ marginTop: 10 }}>{notice.text}</div>}

            <p style={{ textAlign: 'center', fontSize: 13, marginTop: 10 }}>
              {mode === 'signup' && <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null) }}>Ich habe schon ein Konto</button>}
              {mode === 'signin' && (
                <>
                  <button type="button" className="btn-linklike" onClick={() => { setMode('signup'); setNotice(null) }}>Neues Konto anlegen</button>
                  {' · '}
                  <button type="button" className="btn-linklike" onClick={() => { setMode('forgot'); setNotice(null) }}>Passwort vergessen</button>
                </>
              )}
              {mode === 'forgot' && <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null) }}>Zurück zur Anmeldung</button>}
            </p>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12, fontSize: 12.5 }} className="muted">
          <strong>Wer sieht was?</strong> Deine Dozentin und das OpenEvo-Team können deine Arbeit in diesem Bereich einsehen (gemerkte Lernziele,
          Beurteilungen, Gruppen). Andere Studierende sehen deinen Namen in der Gruppenliste und nur das aus deiner Arbeit, was du mit deiner Gruppe teilst.
          Deine E-Mail-Adresse sehen sie nicht.
          Die Daten liegen auf einem Server in Frankfurt. Wenn du nicht möchtest, dass deine Daten von externen KI-Diensten
          verarbeitet werden, kannst du das nach der Anmeldung im Profil einstellen. Dort kannst du auch beantragen, dass dein Konto
          und deine Daten gelöscht werden. Mehr steht in der <Link to="/privacy?lang=de">Datenschutzerklärung</Link>.
        </div>
      </div>
      </main>

      <footer className="welcome-foot">
        <p>EvoMentor ist Teil von OpenLPM und wird gemeinsam mit dem OpenEvo-Netzwerk entwickelt.</p>
        <p>
          <Link to="/impressum">Impressum</Link>
          {' · '}
          <Link to="/privacy?lang=de">Datenschutzerklärung</Link>
        </p>
      </footer>
    </div>
  )
}
