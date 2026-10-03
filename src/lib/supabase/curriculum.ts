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
  // Not yet in database.types.ts -- added by migration 091, not pushed to
  // production yet at the time of this commit. Real document position
  // (see that migration's own header); null for a project/item that hasn't
  // been given one, which the 'sequence' sort falls back to end-of-list for.
  curriculum_sequence: number | null
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
  // Real gap, feedback b70e39a5 (Susan, 2026-10-03): nothing here ever
  // filtered on status, so a 'draft' row (migration 028's own stated intent:
  // "a human reviews from Browse before these count as real, visible
  // content") showed up in the browse list exactly like real, reviewed
  // content. Excluding anything not 'accepted' -- there's no separate
  // draft-review UI anywhere in the app that depends on seeing them here.
  // curriculum_sequence (migration 091) is selected defensively: this code
  // can reach production before Dustin's own `supabase db push` lands (the
  // standing deploy order in this repo -- frontend and migration commit
  // together, the db push follows by hand). Confirmed live, 2026-10-03:
  // selecting an unknown column makes PostgREST fail the WHOLE query
  // (error 42703), so without this fallback every topic would vanish from
  // every Lernziele page -- not a missing sort, a missing list -- for
  // however long that gap lasts. Retrying without the column once, on
  // exactly that error code, keeps the page working in the meantime; the
  // 'sequence' sort just can't do better than its old grade-only ordering
  // until the real column is live.
  let { data, error } = await (supabase.from('lpm_data_objects') as any)
    .select('id, title, description, grade_band, object_type, curriculum_sequence, thema:content->>thema, unterthema:content->>unterthema')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .eq('status', 'accepted')

  if (error?.code === '42703') {
    ;({ data } = await (supabase.from('lpm_data_objects') as any)
      .select('id, title, description, grade_band, object_type, thema:content->>thema, unterthema:content->>unterthema')
      .eq('project_id', projectId)
      .eq('branch_id', branchId)
      .eq('status', 'accepted'))
  }

  const items = (data ?? []) as unknown as TopicListItem[]
  // Real bug, feedback 78e4e0ca (Susan, 2026-10-03): grade_band is TEXT, so
  // Postgres's own ORDER BY sorted it lexicographically ("10" before "5").
  // Sorting numerically here instead -- every consumer of this list (the
  // default view, the "Reihenfolge im Lehrplan" sort, everything else) was
  // silently inheriting that broken order, since nothing re-sorted it later.
  items.sort((a, b) => (parseInt(a.grade_band ?? '', 10) || 0) - (parseInt(b.grade_band ?? '', 10) || 0))
  return items
}

export async function getTopic(supabase: Client, id: string): Promise<DataObjectRow | null> {
  const { data } = await supabase.from('lpm_data_objects').select('*').eq('id', id).maybeSingle()
  return data
}

/**
 * Every topic's own `content` for a project, in one query -- for a view
 * that needs to read something out of `content` (Basiskonzept relevance
 * dots, favorite filtering) for every row on screen at once. The student
 * Lernziele/Basiskonzepte pages originally fetched this one row at a time
 * per topic (305 individual requests for the real Thuringia data) --
 * confirmed live as a genuine, needless slowdown; this is the fix, not the
 * original design.
 */
export async function listTopicContents(supabase: Client, projectId: string): Promise<Map<string, unknown>> {
  const { data } = await supabase.from('lpm_data_objects').select('id, content').eq('project_id', projectId)
  return new Map((data ?? []).map((r) => [r.id, r.content]))
}

/**
 * Every real, curriculum-asserted connection in a project -- one bulk query,
 * same reasoning as listTopicContents above. Used by the student Netz tab to
 * derive which Basiskonzepte genuinely relate to each other (two Lernziele
 * under different Basiskonzepte, joined by a real accepted connection) --
 * see the crosswalk note at the top of lib/supabase/basiskonzepte.ts for why
 * that derived relation is never treated as a first-class OpenLPM construct.
 */
export async function listAcceptedConnections(supabase: Client, projectId: string): Promise<{ from_object_id: string; to_object_id: string }[]> {
  const { data } = await supabase
    .from('lpm_connections')
    .select('from_object_id, to_object_id')
    .eq('project_id', projectId)
    .eq('status', 'accepted')
  return data ?? []
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
