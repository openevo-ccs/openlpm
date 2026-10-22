import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient<any, any, any>

export type EditableTable = 'lpm_data_objects' | 'curriculum_repository_records'

/**
 * The fields a V1 admin editor exposes per table. Deliberately excludes
 * structural/relational columns (project_id, branch_id, object_type,
 * record_type, source_repo, source_record_id, submitted_by,
 * schema_version) -- those change what a record *is* or where it lives,
 * a different and riskier kind of edit than correcting its content.
 */
export const EDITABLE_FIELDS: Record<EditableTable, string[]> = {
  lpm_data_objects: ['title', 'description', 'grade_band', 'subject_area', 'status', 'curriculum_sequence', 'content'],
  curriculum_repository_records: ['title', 'jurisdiction', 'access_tier', 'license_or_rights_note', 'content'],
}

export const DISPLAY_FIELDS: Record<EditableTable, string[]> = {
  lpm_data_objects: ['id', 'object_type', 'title', 'description', 'grade_band', 'subject_area', 'status', 'curriculum_sequence', 'content', 'project_id'],
  curriculum_repository_records: ['id', 'record_type', 'title', 'jurisdiction', 'access_tier', 'license_or_rights_note', 'content', 'project_id'],
}

// -----------------------------------------------------------------------
// Running-note edit sessions (Dustin, 2026-10-22): no explicit start/stop.
// A session is created the first time an edit actually happens under a
// given note string; typing/clearing the note alone never writes
// anything. Changing the note text starts a new session on the next edit.
// Lives in module state rather than localStorage -- a page reload starting a
// fresh session is an accepted V1 simplification (noted in the design doc).
// -----------------------------------------------------------------------

let activeNote = ''
let activeSessionId: string | null = null

export function getCurrentNote(): string {
  return activeNote
}

export function setCurrentNote(note: string) {
  if (note !== activeNote) {
    activeNote = note
    activeSessionId = null // next edit starts a new session under the new note
  }
}

async function ensureSession(supabase: Client, userId: string): Promise<string | null> {
  if (!activeNote.trim()) return null
  if (activeSessionId) {
    // Best-effort heartbeat; a failed touch doesn't invalidate the session.
    await supabase.from('content_edit_sessions').update({ last_activity_at: new Date().toISOString() }).eq('id', activeSessionId)
    return activeSessionId
  }
  const { data, error } = await supabase
    .from('content_edit_sessions')
    .insert({ started_by: userId, note: activeNote })
    .select('id')
    .single()
  if (error || !data) return null
  activeSessionId = (data as { id: string }).id
  return activeSessionId
}

export interface EditResult {
  error: Error | null
  /** Set when the data write itself succeeded but the change-log entry didn't -- the edit is real, just unannotated. */
  logError: Error | null
}

/**
 * Updates one record and logs exactly which of its columns actually
 * changed, comparing the live "before" value rather than just what the
 * caller passed in -- a save with no real change writes no log row. The
 * data write and the log write are two sequential requests rather than one
 * DB transaction; if the log write fails, the data change still stands --
 * surfaced to the caller via `logError` rather than silently dropped the
 * way activity_log's own fire-and-forget logging is.
 */
export async function updateRecordWithLog(
  supabase: Client,
  userId: string,
  table: EditableTable,
  recordId: string,
  patch: Record<string, unknown>,
  perFieldNote?: string,
): Promise<EditResult> {
  const columns = Object.keys(patch)
  if (columns.length === 0) return { error: null, logError: null }

  const { data: beforeRow, error: fetchErr } = await (supabase as any)
    .from(table)
    .select(columns.join(','))
    .eq('id', recordId)
    .single()
  if (fetchErr || !beforeRow) {
    return { error: fetchErr ?? new Error('Record not found'), logError: null }
  }

  const { error: updateErr } = await (supabase as any).from(table).update(patch).eq('id', recordId)
  if (updateErr) return { error: updateErr, logError: null }

  const changed = columns.filter((c) => JSON.stringify((beforeRow as any)[c] ?? null) !== JSON.stringify(patch[c] ?? null))
  if (changed.length === 0) return { error: null, logError: null }

  try {
    const sessionId = await ensureSession(supabase, userId)
    const rows = changed.map((c) => ({
      session_id: sessionId,
      table_name: table,
      record_id: recordId,
      field_name: c,
      before_value: (beforeRow as any)[c] ?? null,
      after_value: patch[c] ?? null,
      note: perFieldNote || null,
      edited_by: userId,
    }))
    const { error: logErr } = await supabase.from('content_edit_log').insert(rows)
    if (logErr) return { error: null, logError: logErr }
  } catch (e) {
    return { error: null, logError: e instanceof Error ? e : new Error(String(e)) }
  }
  return { error: null, logError: null }
}

/** Deletes a record and logs the full row as the "before" value so a deletion can still be reconstructed from the log. */
export async function deleteRecordWithLog(
  supabase: Client,
  userId: string,
  table: EditableTable,
  recordId: string,
  reason?: string,
): Promise<EditResult> {
  const { data: beforeRow, error: fetchErr } = await (supabase as any).from(table).select('*').eq('id', recordId).single()
  if (fetchErr || !beforeRow) return { error: fetchErr ?? new Error('Record not found'), logError: null }

  const { error: deleteErr } = await (supabase as any).from(table).delete().eq('id', recordId)
  if (deleteErr) return { error: deleteErr, logError: null }

  try {
    const sessionId = await ensureSession(supabase, userId)
    const { error: logErr } = await supabase.from('content_edit_log').insert({
      session_id: sessionId,
      table_name: table,
      record_id: recordId,
      field_name: '(entire record)',
      before_value: beforeRow,
      after_value: null,
      note: reason || null,
      edited_by: userId,
    })
    if (logErr) return { error: null, logError: logErr }
  } catch (e) {
    return { error: null, logError: e instanceof Error ? e : new Error(String(e)) }
  }
  return { error: null, logError: null }
}

export interface EditLogRow {
  id: string
  session_id: string | null
  table_name: EditableTable
  record_id: string
  field_name: string
  before_value: unknown
  after_value: unknown
  note: string | null
  edited_by: string
  edited_at: string
  editor_email?: string
  session_note?: string | null
}

/** Recent edit-log entries, optionally scoped to one table and/or one record, newest first. */
export async function listEditLog(
  supabase: Client,
  opts: { table?: EditableTable; recordId?: string; limit?: number } = {},
): Promise<{ data: EditLogRow[]; error: Error | null }> {
  let query = (supabase as any)
    .from('content_edit_log')
    .select('*, editor:edited_by(email), session:session_id(note)')
    .order('edited_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.table) query = query.eq('table_name', opts.table)
  if (opts.recordId) query = query.eq('record_id', opts.recordId)
  const { data, error } = await query
  if (error) return { data: [], error }
  const rows: EditLogRow[] = (data ?? []).map((r: any) => ({
    ...r,
    editor_email: r.editor?.email,
    session_note: r.session?.note ?? null,
  }))
  return { data: rows, error: null }
}
