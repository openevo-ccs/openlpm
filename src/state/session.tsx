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
}
const C = createContext<Ctx>({ session: null, loading: true })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [supabase])

  return <C.Provider value={{ session, loading }}>{children}</C.Provider>
}

export function useSession() {
  return useContext(C)
}
