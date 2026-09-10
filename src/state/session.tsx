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
}
const C = createContext<Ctx>({ session: null, loading: true, passwordRecovery: false, consumePasswordRecovery: () => {} })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })

    // Password-reset links (like the old magic links) are commonly opened in
    // a *new* tab from the mail client -- the tab someone's actually
    // watching never fires its own onAuthStateChange, since the session was
    // created in a different JS runtime. localStorage writes there still
    // fire a `storage` event here (standard same-origin, cross-tab browser
    // behavior), so re-check on that and on refocus rather than requiring a
    // manual reload.
    const recheck = () => supabase.auth.getSession().then(({ data }) => setSession(data.session))
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

  return <C.Provider value={{ session, loading, passwordRecovery, consumePasswordRecovery }}>{children}</C.Provider>
}

export function useSession() {
  return useContext(C)
}
