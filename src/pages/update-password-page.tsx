import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { OpenLpmLogo } from '@/components/openlpm-logo'
import { useSession } from '@/state/session'

// Landing point for the link in a "forgot password" email. Supabase's PKCE
// flow (client.ts's detectSessionInUrl) already turns that link's ?code=
// param into a real (short-lived, recovery-scoped) session before this
// component ever renders -- the same mechanism that already handles the
// GitHub OAuth round-trip, no separate code path needed. All this page does
// is call updateUser with the new password while that session is live.
export default function UpdatePasswordPage() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setNotice({ kind: 'bad', text: error.message })
    } else {
      setNotice({ kind: 'ok', text: 'Password updated. Taking you to your dashboard…' })
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
    }
  }

  return (
    <div className="page page-narrow" style={{ maxWidth: 380, marginTop: 80 }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <OpenLpmLogo size={40} style={{ color: 'var(--series-a)' }} />
        </div>
        <h1 style={{ textAlign: 'center', color: 'var(--brand-navy)' }}>Set a new password</h1>

        {loading ? (
          <p className="muted" style={{ textAlign: 'center' }}>Loading…</p>
        ) : !session ? (
          <div className="notice notice-bad">
            This link has expired or was already used. Request a new one from the sign-in page.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>New password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <KeyRound size={16} />
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}
        {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}
      </div>
    </div>
  )
}
