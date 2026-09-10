import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type DataObjectRow = Database['public']['Tables']['lpm_data_objects']['Row']
export type ConnectionRow = Database['public']['Tables']['lpm_connections']['Row']
export type ThreadRow = Database['public']['Tables']['lpm_threads']['Row']
export type ThreadStationRow = Database['public']['Tables']['lpm_thread_stations']['Row']
export type SchemaElementRow = Database['public']['Tables']['lpm_schema_elements']['Row']

// Lightweight shape for the browsable topic list -- deliberately excludes
// `content` (each real Lernziel's full JSONB can carry didactic-strategy
// prose this list view never needs) so 300+ topics load as one cheap query.
export type TopicListItem = Pick<DataObjectRow, 'id' | 'title' | 'description' | 'grade_band' | 'object_type'> & {
  thema: string | null
  unterthema: string | null
}

/**
 * Every topic (data object) in a branch's own content -- the browsable list
 * for the "how does this connect" explorer. Reads a couple of extra fields
 * out of each row's own `content` JSONB for grouping/search convenience
 * (thema/unterthema) -- best-effort only, since a different project's
 * content shape won't have these and the UI treats their absence as normal.
 */
export async function listTopics(supabase: Client, projectId: string, branchId: string): Promise<TopicListItem[]> {
  // Pulls just the two extra text fields out of each row's own `content`
  // JSONB via PostgREST's ->> operator, rather than downloading the full
  // blob (didactic-strategy prose etc.) for all 300+ rows just to group a
  // list view by topic -- that content is only fetched per-row on demand,
  // once a teacher actually opens one topic (see getTopic).
  // Cast to `any` for this one query -- PostgREST's aliased computed-column
  // select syntax (content->>thema) sends TypeScript's overload resolution
  // into infinite recursion against the generated Database type. The result
  // is cast back to a concrete shape below regardless.
  const { data } = await (supabase.from('lpm_data_objects') as any)
    .select('id, title, description, grade_band, object_type, thema:content->>thema, unterthema:content->>unterthema')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .order('grade_band', { ascending: true })

  return (data ?? []) as unknown as TopicListItem[]
}

export async function getTopic(supabase: Client, id: string): Promise<DataObjectRow | null> {
  const { data } = await supabase.from('lpm_data_objects').select('*').eq('id', id).maybeSingle()
  return data
}

export interface ResolvedConnection {
  connection: ConnectionRow
  direction: 'incoming' | 'outgoing'
  other: DataObjectRow
}

/**
 * The curriculum-asserted connections touching one topic, in both
 * directions, each paired with the actual other topic row so the UI never
 * needs a second round trip per edge. `direction` is from this topic's own
 * point of view -- 'outgoing' means this topic leads to `other`; 'incoming'
 * means `other` leads to this topic. Only 'accepted' connections show here --
 * a teacher-facing view, never a place for an unreviewed proposal to leak
 * out (see coherence.ts's createConnection, which is how a new one enters
 * at 'proposed' and has to clear review first).
 */
export async function getAssertedConnections(supabase: Client, objectId: string): Promise<ResolvedConnection[]> {
  const { data } = await supabase
    .from('lpm_connections')
    .select('*, from_object:lpm_data_objects!lpm_connections_from_object_id_fkey(*), to_object:lpm_data_objects!lpm_connections_to_object_id_fkey(*)')
    .or(`from_object_id.eq.${objectId},to_object_id.eq.${objectId}`)
    .eq('status', 'accepted')

  return (data ?? []).map((row: any) => {
    const outgoing = row.from_object_id === objectId
    return {
      connection: row as ConnectionRow,
      direction: outgoing ? 'outgoing' : 'incoming',
      other: outgoing ? row.to_object : row.from_object,
    }
  })
}

export interface ThreadStationWithThread extends ThreadStationRow {
  thread: ThreadRow & { explained_by: SchemaElementRow | null }
  via_element: SchemaElementRow | null
}

/**
 * Every named coherence thread this topic is a station in, thread attached
 * -- including the thread's own "hub" concept (explained_by), fetched
 * eagerly so the collapsed card can name the connecting idea (e.g. "via
 * Evolutive Entwicklung") before a teacher clicks anything. Progressive
 * disclosure means the headline is visible up front; only the full
 * narrative and station-by-station path wait for the expand click.
 */
export async function getThreadStationsForTopic(supabase: Client, objectId: string): Promise<ThreadStationWithThread[]> {
  const { data } = await supabase
    .from('lpm_thread_stations')
    .select('*, thread:lpm_threads(*, explained_by:lpm_schema_elements!lpm_threads_explained_by_element_id_fkey(*)), via_element:lpm_schema_elements!lpm_thread_stations_via_element_id_fkey(*)')
    .eq('data_object_id', objectId)

  // Filtered client-side rather than via an embedded-resource query filter --
  // simpler than the !inner + dotted-column-filter syntax PostgREST needs for
  // filtering by a to-one embed's own column, and the data volume here never
  // justifies the complexity. Same reasoning as getAssertedConnections: a
  // proposed-but-not-yet-reviewed thread never reaches a teacher.
  return ((data ?? []) as unknown as ThreadStationWithThread[]).filter((s) => s.thread.status === 'accepted')
}

export interface FullThread {
  thread: ThreadRow
  explainedBy: SchemaElementRow | null
  stations: (ThreadStationRow & { object: DataObjectRow; via_element: SchemaElementRow | null })[]
}

/** The complete ordered station list for one thread -- for the "see the full thread" expansion. */
export async function getFullThread(supabase: Client, threadId: string): Promise<FullThread | null> {
  const { data: thread } = await supabase.from('lpm_threads').select('*').eq('id', threadId).maybeSingle()
  if (!thread) return null

  const [{ data: explainedBy }, { data: stations }] = await Promise.all([
    thread.explained_by_element_id
      ? supabase.from('lpm_schema_elements').select('*').eq('id', thread.explained_by_element_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('lpm_thread_stations')
      .select('*, object:lpm_data_objects(*), via_element:lpm_schema_elements(*)')
      .eq('thread_id', threadId)
      .order('sequence', { ascending: true }),
  ])

  return {
    thread,
    explainedBy: explainedBy ?? null,
    stations: (stations ?? []) as unknown as FullThread['stations'],
  }
}
