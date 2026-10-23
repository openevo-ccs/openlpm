import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// migration 166 hasn't been pushed to production yet, so this table isn't
// in database.types.ts's generated types -- cast at the query boundary,
// same convention as literature-collections.ts.
const db = (supabase: Client) => supabase as any

export type Stance = 'supports' | 'challenges' | 'contextualizes'
export type FlagStatus = 'flagged' | 'reviewed' | 'promoted_to_dispute_graph' | 'dismissed'

export interface LiteratureDisputeFlagRow {
  id: string
  project_id: string
  literaturebase_id: string
  stance: Stance
  target_description: string
  note: string | null
  status: FlagStatus
  dispute_graph_file: string | null
  flagged_by: string | null
  created_at: string
  updated_at: string
}

export const STANCE_LABEL: Record<Stance, string> = {
  supports: 'Supports',
  challenges: 'Challenges / contradicts',
  contextualizes: 'Complicates / adds context to',
}

/** Flags raised against papers in a given collection -- a real disagreement about what a paper shows routes through the existing formal dispute system (decision 3), by capturing it here as a draft a maintainer reviews, same "draft now, human commits the real thing" shape as literature_contributions/theory_contributions. */
export async function listFlagsForPapers(supabase: Client, literaturebaseIds: string[]): Promise<LiteratureDisputeFlagRow[]> {
  if (literaturebaseIds.length === 0) return []
  const { data } = await db(supabase)
    .from('literature_dispute_flags')
    .select('*')
    .in('literaturebase_id', literaturebaseIds)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function raiseFlag(
  supabase: Client,
  projectId: string,
  literaturebaseId: string,
  stance: Stance,
  targetDescription: string,
  note?: string
): Promise<LiteratureDisputeFlagRow> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await db(supabase)
    .from('literature_dispute_flags')
    .insert({ project_id: projectId, literaturebase_id: literaturebaseId, stance, target_description: targetDescription, note: note ?? null, flagged_by: user?.id ?? null })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not raise this flag.')
  return data
}
