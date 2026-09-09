import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Chrome, Github, Mail, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<'github' | 'google' | null>(null)
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  // Supabase appends error/error_description to the redirect URL itself on
  // OAuth failure -- there's no server callback route to normalize that
  // into a friendlier ?error=auth_callback_failed anymore, so read it as-is.
  const error = searchParams.get('error') || searchParams.get('error_description')

  const signInWith = async (provider: 'github' | 'google') => {
    setIsLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setIsLoading(null)
      console.error(`${provider} sign-in failed:`, error.message)
    }
  }

  // Magic-link email sign-in, the same pattern eva-graph/apps/kgdj uses --
  // no password, no OAuth app to misconfigure, just an emailed link. Kept as
  // a second option alongside GitHub/Google rather than replacing them, so
  // people can use whichever already works for them.
  const signInWithEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmailBusy(true)
    setEmailMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setEmailMessage(error ? error.message : 'Check your inbox for the sign-in link.')
    setEmailBusy(false)
  }

  return (
    <div className="page page-narrow" style={{ maxWidth: 380, marginTop: 80 }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <GraduationCap size={40} style={{ color: 'var(--series-a)' }} />
        </div>
        <h1 style={{ textAlign: 'center' }}>Welcome to OpenLPM</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
          Sign in to collaborate on learning progressions
        </p>

        {error && <div className="notice notice-bad">Sign-in failed. Please try again.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <button className="btn" disabled={isLoading !== null} onClick={() => signInWith('github')}>
            <Github size={16} />
            {isLoading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
          </button>
          <button className="btn" disabled={isLoading !== null} onClick={() => signInWith('google')}>
            <Chrome size={16} />
            {isLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
        </div>

        <div className="row" style={{ margin: '4px 0 14px', color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
          or
          <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
        </div>

        <form onSubmit={signInWithEmail} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.org"
            />
          </div>
          <button className="btn" type="submit" disabled={emailBusy}>
            <Mail size={16} />
            {emailBusy ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
        {emailMessage && <div className="notice">{emailMessage}</div>}

        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>Secure authentication powered by Supabase</p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
