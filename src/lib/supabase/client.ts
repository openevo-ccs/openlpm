import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Pure client-side Supabase access -- no server, no middleware. Row-Level
// Security (supabase/migrations/*) is the sole access-control boundary,
// same architecture as eva-graph/apps/kgdj's supabaseApi.ts: the anon key is
// meant to be public, RLS policies decide what it can actually read/write.
//
// Module-level singleton -- every call site (login-page.tsx, dashboard-
// layout.tsx's signOut, project-layout.tsx, etc.) used to get its own fresh
// GoTrueClient instance, all sharing the same localStorage key. Confirmed
// live 2026-09-14: this is not just the "Multiple GoTrueClient instances"
// console warning Supabase itself logs -- it's a real, reproducible bug.
// login-page.tsx's own createClient() call performed a real, successful
// signInWithPassword() (verified via a captured 200 response with a real
// access token), but SessionProvider's *separate* instance -- the only one
// anything actually listens to -- never received the SIGNED_IN event, so
// the post-login redirect never fired. A `storage` event (session.tsx's own
// cross-tab fallback) only fires in *other* tabs by browser spec, so same-
// tab, different-instance auth changes were silently invisible. One shared
// client instance fixes this at the root instead of patching each symptom.
let _client: SupabaseClient<Database> | undefined

export function createClient() {
  if (!_client) {
    _client = createSupabaseClient<Database>(
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
  return _client
}
