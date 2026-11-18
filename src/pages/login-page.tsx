import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Github, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { REDIRECT_KEY } from '@/components/require-auth'
import { OpenLpmLogo } from '@/components/openlpm-logo'
import { explainAuthError, SIGNUP_ALREADY_REGISTERED_TEXT, signUpHitExistingAccount, type AuthProblem } from '@/lib/auth-messages'

type Mode = 'signin' | 'signup' | 'forgot'

// Email+password is the primary sign-in path now (Dustin's own framing:
// "create account, enter your email, enter your password, only send emails
// if they forget their password") -- matching the shape eva-graph/apps/kgdj
// already shipped (signUp/signInWithPassword/resetPasswordForEmail, default
// Supabase email template), so the two apps' email/password mechanics agree
// even though only OpenLPM also has GitHub OAuth. Magic-link sign-in
// (signInWithOtp) is retired in favor of this -- GitHub is the one method
// explicitly kept alongside it. A signed-in user can still add a password to
// a GitHub-first account, or link GitHub to a password-first one, from their
// profile page (see profile-page.tsx).
export default function LoginPage() {
  const [githubLoading, setGithubLoading] = useState(false)
  const [searchParams] = useSearchParams()
  // Homepage's "Get started"/"Start collaborating" links pass ?mode=signup
  // so a brand-new visitor lands on the sign-up form directly instead of
  // a "Welcome back" sign-in screen they have to notice a secondary link
  // to get past.
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [problem, setProblem] = useState<AuthProblem | null>(null)
  const [resent, setResent] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const error = searchParams.get('error') || searchParams.get('error_description')
  const navigate = useNavigate()

  const signInWithGithub = async () => {
    setGithubLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setGithubLoading(false)
      setNotice({ kind: 'bad', text: error.message })
      console.error('github sign-in failed:', error.message)
    }
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    setProblem(null)
    setResent(false)
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      })
      if (error) {
        const e = explainAuthError(error)
        setProblem(e.problem)
        setNotice({ kind: 'bad', text: e.text })
      } else if (signUpHitExistingAccount(data.user)) {
        // No email is sent in this case, so say so instead of showing "check your inbox".
        setProblem('already_registered')
        setNotice({ kind: 'bad', text: SIGNUP_ALREADY_REGISTERED_TEXT })
      } else {
        setNotice({
          kind: 'ok',
          text: 'Schau in dein Postfach (auch im Spam-Ordner) und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden.\n\nCheck your inbox (and spam) to confirm your email, then sign in.',
        })
      }
    } else if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        const e = explainAuthError(error)
        setProblem(e.problem)
        setNotice({ kind: 'bad', text: e.text })
      } else {
        // <RedirectAfterLogin> (App.tsx) only acts at pathname === '/' --
        // built for the OAuth/password-reset round-trip that lands back at
        // site root. A direct email+password sign-in never leaves this page
        // at all, so that effect's guard would never fire here (confirmed
        // live 2026-09-14 -- a real, successful sign-in left the visitor
        // stranded on /auth/login). Navigate explicitly instead, honoring
        // the same REDIRECT_KEY <RequireAuth> already sets when it bounces
        // someone off a protected route.
        const stored = window.localStorage.getItem(REDIRECT_KEY)
        window.localStorage.removeItem(REDIRECT_KEY)
        navigate(stored || '/dashboard', { replace: true })
      }
    } else {
      // Deliberately the plain site root. A '#/auth/update-password' hash
      // target would break the flow: Supabase appends '?code=...' after this
      // URL, and under HashRouter anything after the '#' is fragment and never
      // a query string, so detectSessionInUrl (client.ts) would never see the code
      // if it were appended after a hash path. Same fix already applied to
      // the GitHub OAuth redirect. App.tsx's PASSWORD_RECOVERY handling
      // sends the visitor on to the update-password page from there.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      })
      if (error) {
        const e = explainAuthError(error)
        setNotice({ kind: 'bad', text: e.text })
      } else {
        setNotice({
          kind: 'ok',
          text: 'Schau in dein Postfach (auch im Spam-Ordner): Dort ist ein Link, mit dem du ein neues Passwort setzt.\n\nCheck your inbox (and spam) for a link to set a new password.',
        })
      }
    }
    setBusy(false)
  }

  const resendConfirmation = async () => {
    setBusy(true)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      const e = explainAuthError(error)
      setNotice({ kind: 'bad', text: e.text })
    } else {
      setResent(true)
      setNotice({
        kind: 'ok',
        text: 'Die Bestätigungs-E-Mail ist unterwegs. Schau auch im Spam-Ordner nach.\n\nThe confirmation email is on its way. Check spam too.',
      })
    }
    setBusy(false)
  }

  const titles: Record<Mode, string> = {
    signin: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
  }

  return (
    <div className="page page-narrow" style={{ maxWidth: 380, marginTop: 80 }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <OpenLpmLogo size={40} style={{ color: 'var(--series-a)' }} />
        </div>
        <h1 style={{ textAlign: 'center', color: 'var(--brand-navy)' }}>{titles[mode]}</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
          Sign in to collaborate on learning progressions
        </p>

        {error && <div className="notice notice-bad">Sign-in failed. Please try again.</div>}

        {mode !== 'forgot' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <button className="btn" disabled={githubLoading} onClick={signInWithGithub}>
                <Github size={16} />
                {githubLoading ? 'Redirecting…' : 'Continue with GitHub'}
              </button>
            </div>

            <div className="row" style={{ margin: '4px 0 14px', color: 'var(--text-muted)', fontSize: 12 }}>
              <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
              or
              <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
            </div>
          </>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" />
          </div>
          {mode !== 'forgot' && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 'normal', fontSize: 12.5, marginTop: 4 }}>
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                Passwort anzeigen / Show password
              </label>
            </div>
          )}
          <button className="btn" type="submit" disabled={busy}>
            <KeyRound size={16} />
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        {notice && (
          <div className={`notice notice-${notice.kind}`} style={{ whiteSpace: 'pre-line' }}>
            {notice.text}
            {problem === 'not_confirmed' && !resent && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-mini" disabled={busy} onClick={() => void resendConfirmation()}>
                  Bestätigungs-E-Mail erneut senden / Send confirmation again
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 12.5, marginTop: 4 }}>
          {mode === 'signin' && (
            <>
              <button type="button" className="btn-linklike" onClick={() => { setMode('signup'); setNotice(null); setProblem(null) }}>Need an account? Sign up</button>
              {' · '}
              <button type="button" className="btn-linklike" onClick={() => { setMode('forgot'); setNotice(null); setProblem(null) }}>Forgot password?</button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null); setProblem(null) }}>Already have an account? Sign in</button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null); setProblem(null) }}>Back to sign in</button>
          )}
        </p>

        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>Secure authentication powered by Supabase</p>
        <p style={{ textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
          <Link to="/">Back to home</Link>
        </p>

        {/* Real feedback 2a332362 (2026-10-01): OpenEvo/CCP/Bienenhaus/
            UniJena logo footer + legal links, matching openevo.net's own
            real footer -- scoped to this page only (Dustin's own call,
            2026-10-01); the signed-in app does not get it. */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div className="login-footer-logos">
            <img src={`${import.meta.env.BASE_URL}assets/logos/openevo-wordmark.png`} alt="OpenEvo" />
            <img src={`${import.meta.env.BASE_URL}assets/logos/mpg-logo.png`} alt="Max Planck Society and the Department of Comparative Cultural Psychology" />
            <img src={`${import.meta.env.BASE_URL}assets/logos/bienenhaus-logo.png`} alt="Bienenhaus, AG Biologiedidaktik, Friedrich-Schiller-Universität Jena" />
            <img src={`${import.meta.env.BASE_URL}assets/logos/unijena-logo.png`} alt="Friedrich-Schiller-Universität Jena" />
          </div>
          <p className="muted" style={{ textAlign: 'center', fontSize: 11.5, margin: 0 }}>
            A project of the OpenEvo Computational Curriculum Studies Lab
          </p>
          <div className="login-footer-legal">
            <Link to="/impressum">Impressum</Link>
            <Link to="/privacy">Datenschutzerklärung / Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
