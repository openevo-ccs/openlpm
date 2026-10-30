import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// student_work_entries and student_activity_events (migration 192) aren't in
// the generated types yet -- cast at the query boundary, same convention as
// groups.ts and dashboard-views.ts.

// Open vocabulary on purpose (the column is plain TEXT): a later seminar task
// adds a kind here without a schema change.
export type WorkKind =
  | 'topic'
  | 'grade_bands'
  | 'link_judgment'
  | 'link_proposal'
  | 'topic_basiskonzept'
  | 'cross_cutting'
  | 'reflection'
  | 'meta'

export interface WorkEntry<P = Record<string, any>> {
  id: string
  project_id: string
  user_id: string
  kind: WorkKind
  entry_key: string
  payload: P
  created_at: string
  updated_at: string
}

export interface ActivityEvent {
  id: string
  event_type: string
  details: Record<string, any>
  created_at: string
}

export const JUDGMENT_CRITERIA = [
  { key: 'correctness', label: 'Fachliche Korrektheit', hint: 'Stimmt die Verknüpfung fachlich?' },
  { key: 'own_knowledge', label: 'Beitrag zum eigenen Fachwissen', hint: 'Habe ich dadurch etwas Neues oder Genaueres verstanden?' },
  { key: 'didactic_relevance', label: 'Didaktische Relevanz', hint: 'Hilft die Verknüpfung, den Unterricht zu planen?' },
] as const

export type CriterionKey = (typeof JUDGMENT_CRITERIA)[number]['key']

// Four steps, no neutral midpoint: forces a lean, which is what the seminar's
// judgment task asks for. Labels are the same for every criterion.
export const JUDGMENT_SCALE: { value: number; label: string }[] = [
  { value: 1, label: 'trifft nicht zu' },
  { value: 2, label: 'trifft eher nicht zu' },
  { value: 3, label: 'trifft eher zu' },
  { value: 4, label: 'trifft voll zu' },
]

export const LIEBLINGSTHEMEN = [
  'Ökologie',
  'Botanik/Pflanzen',
  'Zoologie/Tiere',
  'Mikrobiologie',
  'Zellbiologie',
  'Genetik',
  'Molekularbiologie',
  'Evolutionsbiologie',
  'Entwicklungsbiologie',
  'Verhaltensbiologie',
  'Humanbiologie',
] as const

// The cross-cutting themes of the Thuringia curricula, as listed on the
// seminar 2 slide ("Überfachliche Kompetenzen und Querschnittsaufgaben").
export const QUERSCHNITTSTHEMEN = [
  'Sprachbildung',
  'Demokratiebildung',
  'Medienbildung',
  'Kulturelle Bildung',
  'Berufliche und arbeitsweltliche Orientierung',
  'Bildung für nachhaltige Entwicklung (BNE)',
  'Gesundheitserziehung',
  'Sexualerziehung',
] as const

export const GRADE_BANDS = ['5/6', '7/8', '9/10'] as const

export const REFLECTION_PROMPTS = [
  { key: 'tool_usability', label: 'Beurteile die Nutzerfreundlichkeit von EvoMentor: Was ist positiv hervorzuheben? Was war unklar, fehlte oder hat gestört? Was sollte verbessert werden?' },
  { key: 'own_learning', label: 'Was hast du durch die Aufgabe über den Lehrplan und die Basiskonzepte gelernt?' },
] as const

export function linkKey(lernzielId: string, basiskonzeptId: string): string {
  return `${lernzielId}|${basiskonzeptId}`
}

export async function listMyWorkEntries(supabase: Client, projectId: string): Promise<WorkEntry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await (supabase as any)
    .from('student_work_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  return (data ?? []) as WorkEntry[]
}

/** Creates or updates the single row identified by (project, me, kind, entry_key). */
export async function saveWorkEntry(
  supabase: Client,
  projectId: string,
  kind: WorkKind,
  entryKey: string,
  payload: Record<string, any>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }
  const { error } = await (supabase as any).from('student_work_entries').upsert(
    {
      project_id: projectId,
      user_id: user.id,
      kind,
      entry_key: entryKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,user_id,kind,entry_key' }
  )
  if (!error) void logStudentEvent(supabase, projectId, 'work_saved', { kind, entry_key: entryKey })
  return { error }
}

export async function deleteWorkEntry(supabase: Client, projectId: string, kind: WorkKind, entryKey: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }
  const { error } = await (supabase as any)
    .from('student_work_entries')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('kind', kind)
    .eq('entry_key', entryKey)
  if (!error) void logStudentEvent(supabase, projectId, 'work_removed', { kind, entry_key: entryKey })
  return { error }
}

/**
 * Fire-and-forget, like logActivity: a missed timeline entry is a small
 * loss and must never block or break what the student is doing.
 */
export async function logStudentEvent(
  supabase: Client,
  projectId: string,
  eventType: string,
  details: Record<string, any> = {}
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await (supabase as any)
      .from('student_activity_events')
      .insert({ project_id: projectId, user_id: user.id, event_type: eventType, details })
    if (error) console.warn('student event write failed (non-fatal):', error.message)
  } catch (e) {
    console.warn('student event write failed (non-fatal):', e)
  }
}

export async function listMyActivityEvents(supabase: Client, projectId: string): Promise<ActivityEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await (supabase as any)
    .from('student_activity_events')
    .select('id, event_type, details, created_at')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(5000)
  return (data ?? []) as ActivityEvent[]
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomParticipantCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return `JBD-${chars.slice(0, 4)}-${chars.slice(4)}`
}

/**
 * The random code that stands in for the student's name in the files they
 * hand in. Created once, stored on the student's own account, never shown to
 * anyone else. The files carry no name or email, so the instructor can
 * anonymise after the Moodle submission.
 */
export async function getOrCreateParticipantCode(supabase: Client, projectId: string, entries: WorkEntry[]): Promise<string> {
  const existing = entries.find((e) => e.kind === 'meta' && e.entry_key === 'participant')
  if (existing?.payload?.participant_code) return existing.payload.participant_code as string
  const code = randomParticipantCode()
  await saveWorkEntry(supabase, projectId, 'meta', 'participant', { participant_code: code })
  return code
}
