import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Github, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { OpenLpmLogo } from '@/components/openlpm-logo'
import { OpenEvoAttribution } from '@/components/openevo-mark'

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
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error') || searchParams.get('error_description')

  const signInWithGithub = async () => {
    setGithubLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setGithubLoading(false)
      console.error('github sign-in failed:', error.message)
    }
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      })
      setNotice(error ? { kind: 'bad', text: error.message } : { kind: 'ok', text: 'Check your inbox to confirm your email, then sign in.' })
    } else if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setNotice({ kind: 'bad', text: error.message })
      // On success, the session listener in state/session.tsx picks this up
      // and App.tsx's <RedirectAfterLogin> sends them on -- nothing to do here.
    } else {
      // Deliberately the plain site root, not a '#/auth/update-password'
      // hash target -- Supabase appends '?code=...' after this URL, and
      // under HashRouter anything after the '#' is fragment, not query
      // string, so detectSessionInUrl (client.ts) would never see the code
      // if it were appended after a hash path. Same fix already applied to
      // the GitHub OAuth redirect. App.tsx's PASSWORD_RECOVERY handling
      // sends the visitor on to the update-password page from there.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      })
      setNotice(error ? { kind: 'bad', text: error.message } : { kind: 'ok', text: 'Check your inbox for a link to set a new password.' })
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
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
          )}
          <button className="btn" type="submit" disabled={busy}>
            <KeyRound size={16} />
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

        <p style={{ textAlign: 'center', fontSize: 12.5, marginTop: 4 }}>
          {mode === 'signin' && (
            <>
              <button type="button" className="btn-linklike" onClick={() => { setMode('signup'); setNotice(null) }}>Need an account? Sign up</button>
              {' · '}
              <button type="button" className="btn-linklike" onClick={() => { setMode('forgot'); setNotice(null) }}>Forgot password?</button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null) }}>Already have an account? Sign in</button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="btn-linklike" onClick={() => { setMode('signin'); setNotice(null) }}>Back to sign in</button>
          )}
        </p>

        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>Secure authentication powered by Supabase</p>
        <p style={{ textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
          <Link to="/">Back to home</Link>
        </p>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <OpenEvoAttribution />
        </div>
      </div>
    </div>
  )
}
