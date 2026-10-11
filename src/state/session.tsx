import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// Mirrors eva-graph/apps/kgdj's SessionProvider (src/state/session.tsx):
// one client-side Supabase auth listener shared by the whole app, no
// server/middleware involved. RLS (supabase/migrations/*) is what actually
// gates data access -- this context only gates which UI renders.
interface Ctx {
  session: Session | null
  loading: boolean
  // True for exactly one tick after a password-reset email's link is
  // followed -- Supabase's own onAuthStateChange fires a distinct
  // 'PASSWORD_RECOVERY' event for this (not 'SIGNED_IN'), so App.tsx's
  // post-login redirect can send the visitor to "set a new password"
  // instead of their normal dashboard landing. Consumed once via
  // consumePasswordRecovery() so it doesn't re-fire on a later refresh.
  passwordRecovery: boolean
  consumePasswordRecovery: () => void
  // True for exactly one tick after a blocked account's session is caught and
  // signed back out (see resolveSession below) -- lets <RequireAuth> show a
  // real "your account is blocked" message instead of silently bouncing to
  // the login screen like an ordinary signed-out visitor.
  blocked: boolean
  // The real users.role column for the signed-in account (migration 001/049)
  // -- null while loading or signed out. Added 2026-10-10 alongside isAdmin
  // below, replacing a hardcoded single-email ADMIN_EMAIL constant that
  // every admin-gated page used to compare against: that approach silently
  // broke the moment a second real admin existed (granted via the users
  // table directly), since nothing about it depended on the actual role
  // column. Fetched in the same query as blocked_at below, not a separate
  // round trip.
  role: string | null
  isAdmin: boolean
}
const C = createContext<Ctx>({
  session: null,
  loading: true,
  passwordRecovery: false,
  consumePasswordRecovery: () => {},
  blocked: false,
  role: null,
  isAdmin: false,
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    // Reversible admin-set account lock (migration 049, users.blocked_at) --
    // see lab_manager/docs/design-notes/
    // openlpm-system-wide-admin-page-scoping-2026-09-30.md. Enforced here,
    // once, for the whole app, rather than per-page: a real sign-in still
    // succeeds at the Supabase Auth layer (their password is still correct),
    // this just immediately signs them back out the moment the session
    // context notices blocked_at is set, before anything protected ever
    // renders. blocked_at may not exist yet on the live database if this
    // code ships before migration 049 is pushed -- fail OPEN (treat as not
    // blocked) on any query error here, so an unmigrated database never
    // breaks sign-in for every real user.
    const resolveSession = async (s: Session | null): Promise<Session | null> => {
      if (!s) { setRole(null); return null }
      const { data, error } = await (supabase as any)
        .from('users')
        .select('blocked_at, role')
        .eq('id', s.user.id)
        .maybeSingle()
      if (!error && data?.blocked_at) {
        setBlocked(true)
        setRole(null)
        await supabase.auth.signOut()
        return null
      }
      setRole(!error ? data?.role ?? null : null)
      return s
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(await resolveSession(data.session))
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      // The signOut() inside resolveSession fires its own SIGNED_OUT event
      // right back into this same listener -- handle it as a plain sign-out
      // rather than re-running resolveSession(null), which would have no
      // session to check and would otherwise just be a no-op anyway.
      if (event === 'SIGNED_OUT') {
        setSession(null)
        return
      }
      setSession(await resolveSession(s))
    })

    // Password-reset links (like the old magic links) are commonly opened in
    // a *new* tab from the mail client -- the tab someone's actually
    // watching never fires its own onAuthStateChange, since the session was
    // created in a different JS runtime. localStorage writes there still
    // fire a `storage` event here (standard same-origin, cross-tab browser
    // behavior), so re-check on that and on refocus rather than requiring a
    // manual reload.
    const recheck = () => supabase.auth.getSession().then(async ({ data }) => setSession(await resolveSession(data.session)))
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith('sb-')) recheck()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)

    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [supabase])

  const consumePasswordRecovery = () => setPasswordRecovery(false)

  return <C.Provider value={{ session, loading, passwordRecovery, consumePasswordRecovery, blocked, role, isAdmin: role === 'admin' }}>{children}</C.Provider>
}

export function useSession() {
  return useContext(C)
}
