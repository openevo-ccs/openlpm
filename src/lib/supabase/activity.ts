import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type ActivityLogRow = Database['public']['Tables']['activity_log']['Row']

/**
 * Records one project activity entry. Fire-and-forget by design (logging a
 * side effect should never block or fail the action it's describing) --
 * errors are swallowed with a console warning rather than surfaced to the
 * user, since a missed log entry is a minor loss, not a correctness bug.
 * `actionType` is a short, stable, human-describable key (e.g.
 * 'connection_proposed', 'member_added') -- open vocabulary, not an enum,
 * so any future feature can log its own kind of event without a migration.
 */
export async function logActivity(
  supabase: Client,
  params: { projectId: string; actionType: string; targetType?: string; targetId?: string; details?: Record<string, unknown> }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('activity_log').insert({
    project_id: params.projectId,
    user_id: user?.id ?? null,
    action_type: params.actionType,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    details: params.details ?? {},
  })
  if (error) console.warn('activity log write failed (non-fatal):', error.message)
}

export interface ActivityEntry extends ActivityLogRow {
  actor: { name: string; email: string } | null
}

export async function listRecentActivity(supabase: Client, projectId: string, limit = 8): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from('activity_log')
    .select('*, actor:users(name, email)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as ActivityEntry[]
}

// Plain-language descriptions for the action types this app actually emits
// -- a fallback humanizes anything else so a future, un-glossed action_type
// still renders as something readable rather than a raw snake_case key.
const ACTION_DESCRIPTIONS: Record<string, string> = {
  connection_proposed: 'proposed a connection',
  connection_reviewed: 'reviewed a proposed connection',
  literature_added: 'added a paper to the collection',
  member_added: 'added a member',
  member_invited: 'invited someone by email',
}

export function describeActivity(entry: ActivityEntry): string {
  const who = entry.actor?.name ?? 'Someone'
  const what = ACTION_DESCRIPTIONS[entry.action_type] ?? entry.action_type.replace(/_/g, ' ')
  return `${who} ${what}`
}
