import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>
type FeedbackRow = Database['public']['Tables']['feedback']['Row']

export interface FeedbackItem extends FeedbackRow {
  submitter: { name: string; email: string } | null
  project: { name: string; slug: string } | null
}

// Admin-only per RLS (migration 033) -- a non-admin gets an empty array
// back, not an error, since the policy just excludes every row.
export async function listFeedback(supabase: Client): Promise<FeedbackItem[]> {
  const { data } = await supabase
    .from('feedback')
    .select('*, submitter:users(name, email), project:projects(name, slug)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as FeedbackItem[]
}

export async function setFeedbackStatus(supabase: Client, id: string, status: 'open' | 'resolved') {
  return supabase.from('feedback').update({ status }).eq('id', id)
}

// Screenshots live in a private bucket -- a signed URL is the only way to
// actually view one, and (per migration 033) only resolves for an admin.
export async function getScreenshotUrl(supabase: Client, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('feedback-screenshots').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
