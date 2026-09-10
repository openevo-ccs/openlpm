import { useEffect, useState } from 'react'
import { Github, KeyRound, Link2, Unlink } from 'lucide-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { REDIRECT_KEY } from '@/components/require-auth'

// Lets a user end up with either or both sign-in methods, added whenever
// they want rather than only at sign-up -- a GitHub-first user can set a
// password here, and a password-first user can connect GitHub, using
// Supabase's own built-in mechanisms for this rather than anything
// custom-built: updateUser({password}) to add password capability to the
// current account, linkIdentity/unlinkIdentity to add or remove an OAuth
// provider. linkIdentity requires "Manual Linking" enabled in the project's
// Auth settings (a Dashboard toggle, off by default) -- if it's not on yet,
// the button below will show Supabase's own clear error rather than fail
// silently.
export default function ProfilePage() {
  const { session } = useSession()
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [newPassword, setNewPassword] = useState('')

  const reload = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUserIdentities()
    if (!error) setIdentities(data.identities)
  }

  useEffect(() => {
    reload()
  }, [])

  const hasEmailPassword = (identities ?? []).some((i) => i.provider === 'email')
  const hasGithub = (identities ?? []).some((i) => i.provider === 'github')
  const canUnlink = (identities ?? []).length > 1

  const setPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else {
      setNotice({ kind: 'ok', text: 'Password set — you can now sign in with your email and this password.' })
      setNewPassword('')
      await reload()
    }
  }

  const connectGithub = async () => {
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    // redirectTo is deliberately the plain site root, not a hash path --
    // same reason as resetPasswordForEmail in login-page.tsx (a '?code='
    // appended after a '#/...' path lands inside the hash fragment, where
    // detectSessionInUrl never looks). <RequireAuth>'s own REDIRECT_KEY
    // mechanism is what actually gets them back to this page afterward.
    window.localStorage.setItem(REDIRECT_KEY, '/dashboard/profile')
    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setBusy(false)
    if (error) {
      window.localStorage.removeItem(REDIRECT_KEY)
      setNotice({ kind: 'bad', text: error.message })
    }
    // On success this redirects to GitHub, so there's nothing else to do here.
  }

  const unlink = async (identity: UserIdentity) => {
    if (!canUnlink) return
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy(false)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: 'Disconnected.' }); await reload() }
  }

  return (
    <div className="page-narrow" style={{ maxWidth: 480 }}>
      <h1>Your profile</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{session?.user.email}</p>

      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

      <div className="card">
        <h3>Sign-in methods</h3>
        <p className="muted">You can use either or both to get in — set up a second one so you're never locked out.</p>

        <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="row"><KeyRound size={14} />Email and password</span>
          {hasEmailPassword ? (
            <span className="row">
              <span className="chip chip-good">Connected</span>
              {canUnlink && (
                <button className="btn btn-mini" disabled={busy} onClick={() => unlink(identities!.find((i) => i.provider === 'email')!)}>
                  <Unlink size={11} />Remove
                </button>
              )}
            </span>
          ) : (
            <span className="chip">Not set up</span>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
          <span className="row"><Github size={14} />GitHub</span>
          {hasGithub ? (
            <span className="row">
              <span className="chip chip-good">Connected</span>
              {canUnlink && (
                <button className="btn btn-mini" disabled={busy} onClick={() => unlink(identities!.find((i) => i.provider === 'github')!)}>
                  <Unlink size={11} />Remove
                </button>
              )}
            </span>
          ) : (
            <button className="btn btn-mini" disabled={busy} onClick={connectGithub}>
              <Link2 size={11} />Connect
            </button>
          )}
        </div>
      </div>

      {!hasEmailPassword && (
        <div className="card">
          <h3>Set a password</h3>
          <p className="muted">Add a password so you can sign in without GitHub too.</p>
          <form onSubmit={setPassword} className="row">
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>Set password</button>
          </form>
        </div>
      )}
    </div>
  )
}
