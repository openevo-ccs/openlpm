import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Pure client-side Supabase access -- no server, no middleware. Row-Level
// Security (supabase/migrations/*) is the sole access-control boundary,
// same architecture as eva-graph/apps/kgdj's supabaseApi.ts: the anon key is
// meant to be public, RLS policies decide what it can actually read/write.
export function createClient() {
  return createSupabaseClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE, not the 'implicit' default: implicit returns the session in
        // the URL *hash* (#access_token=...), which collides with
        // HashRouter's own use of the hash for routing -- App.tsx's
        // catch-all route clears it before Supabase can read it. PKCE
        // returns a plain ?code= query param instead, which HashRouter
        // never looks at.
        flowType: 'pkce',
      },
    }
  )
}
