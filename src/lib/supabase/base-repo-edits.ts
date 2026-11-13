import type { createClient } from '@/lib/supabase/client'
import { BASE_REPO_CONFIGS, detectLanguages, plainLabel, type BaseRepoKey, type SnapshotRow } from '@/lib/supabase/base-repo-explorer'
import { getPath, setPath, type EditValue } from '@/lib/base-repo-edit-fields'
import { methodClassesOf, type TagField, type TagNameOverlay } from '@/lib/method-text'

// In-app edits to Base Repo records (feedback 0afc62a5, Susan Hanisch 2026-11-08; migration 237). The Explorer's records are a copy of the
// source repos, refreshed by a script, so an edit is stored as its own row and shown on top of the copy. Rows are the change log as well:
// nothing is overwritten or deleted. Undoing an edit adds a row that puts the field back to the repo copy.

type Client = ReturnType<typeof createClient>

export interface BaseRepoEdit {
  id: string
  base_repo: BaseRepoKey
  record_id: string
  field_path: string
  before_value: unknown
  after_value: unknown
  is_reset: boolean
  note: string | null
  edited_by: string | null
  edited_at: string
  exported_at: string | null
  export_batch: string | null
  /** Filled in by listEdits: the editor's name or email. */
  editor_name?: string
}

const PAGE_SIZE = 1000

/** Every edit of one base, oldest first. `available` is false when the table is not there yet (before migration 237 is pushed). */
export async function listEdits(supabase: Client, repoKey: BaseRepoKey): Promise<{ edits: BaseRepoEdit[]; available: boolean }> {
  // The editor's name comes with the edit. If that join is refused for any reason, the edits still load, just without names.
  for (const withNames of [true, false]) {
    const all: BaseRepoEdit[] = []
    let failed = false
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (supabase as any)
        .from('base_repo_record_edits')
        .select(withNames ? '*, editor:users!base_repo_record_edits_edited_by_fkey(name, email)' : '*')
        .eq('base_repo', repoKey)
        .order('edited_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) { failed = true; break }
      const page = (data ?? []) as any[]
      for (const r of page) all.push({ ...r, editor_name: r.editor?.name ?? r.editor?.email ?? undefined })
      if (page.length < PAGE_SIZE) break
    }
    if (!failed) return { edits: all, available: true }
  }
  return { edits: [], available: false }
}

// Names of tags are saved as edits too, so they have the same log, the same undo and the same way back to the repo. They belong to no
// record. Their record id is "vocab:" and the field ("vocab:learningApproaches"), and each row's path is "<language>|<tag>", for
// example "en|kooperativ" (Dustin, 2026-11-13: tags can be named in either language).
export const VOCAB_PREFIX = 'vocab:'
export const isVocabRecord = (recordId: string): boolean => recordId.startsWith(VOCAB_PREFIX)
export const vocabRecordId = (field: TagField): string => `${VOCAB_PREFIX}${field}`

/** What a row of the edit log is about, in words: the record's name, or "Tag names: learning approaches". */
export function vocabLabel(recordId: string): string {
  const field = recordId.slice(VOCAB_PREFIX.length)
  return `Tag names: ${field === 'lessonPhases' ? 'lesson phases' : field === 'learningApproaches' ? 'learning approaches' : field}`
}

/** "en|kooperativ" is the English name of the tag kooperativ. */
export function splitVocabPath(path: string): { lang: 'en' | 'de'; term: string } | null {
  const bar = path.indexOf('|')
  const lang = path.slice(0, bar)
  return bar > 0 && (lang === 'en' || lang === 'de') ? { lang, term: path.slice(bar + 1) } : null
}

/** The tag names set in the app, from the log of edits of MethodsBase. */
export function tagNamesFromEdits(edits: BaseRepoEdit[]): TagNameOverlay {
  const out: TagNameOverlay = { lessonPhases: {}, learningApproaches: {} }
  for (const [recordId, fields] of latestEditsByRecord(edits)) {
    if (!isVocabRecord(recordId)) continue
    const field = recordId.slice(VOCAB_PREFIX.length) as TagField
    if (!out[field]) continue
    for (const [path, edit] of fields) {
      const p = splitVocabPath(path)
      if (!p || typeof edit.after_value !== 'string' || !edit.after_value.trim()) continue
      out[field][p.term] = { ...out[field][p.term], [p.lang]: edit.after_value.trim() }
    }
  }
  return out
}

export interface TagNameChange { term: string; lang: 'en' | 'de'; before: string | null; after: string }

/** Saves tag names, one row per name. Returns an error message, or null when everything was saved. */
export async function saveTagNames(
  supabase: Client,
  args: { field: TagField; userId: string; changes: TagNameChange[]; note: string }
): Promise<string | null> {
  return saveEdits(supabase, {
    repoKey: 'methodsbase', recordId: vocabRecordId(args.field), userId: args.userId, note: args.note,
    changes: args.changes.map((c) => ({ path: `${c.lang}|${c.term}`, before: c.before, after: c.after })),
  })
}

/** The latest edit of each field, per record. A reset row removes the field's edit. */
export function latestEditsByRecord(edits: BaseRepoEdit[]): Map<string, Map<string, BaseRepoEdit>> {
  const out = new Map<string, Map<string, BaseRepoEdit>>()
  for (const e of edits) {
    const rec = out.get(e.record_id) ?? new Map<string, BaseRepoEdit>()
    if (e.is_reset) rec.delete(e.field_path)
    else rec.set(e.field_path, e)
    out.set(e.record_id, rec)
  }
  return out
}

function rederive(repoKey: BaseRepoKey, row: SnapshotRow): SnapshotRow {
  const cfg = BASE_REPO_CONFIGS.find((c) => c.key === repoKey)
  const data = row.data
  const next = { ...row }
  if (repoKey === 'literaturebase') {
    const title = getPath(data, 'citation.title')
    if (typeof title === 'string' && title) next.label = title
    const year = getPath(data, 'citation.year')
    if (year !== undefined && year !== null && year !== '') next.secondary = String(year)
  } else {
    const named = (data as any).label ?? (data as any).title ?? (data as any).statement
    const label = plainLabel(named)
    if (label) next.label = label
  }
  if (repoKey === 'methodsbase') {
    const cls = methodClassesOf((data as any).methodClass).join(', ')
    next.secondary = cls || null
    next.filterValue = next.secondary
  }
  if (cfg?.secondaryFilter) {
    const raw = (data as any)[cfg.secondaryFilter.dataKey]
    next.secondaryFilterValues = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' && raw ? [raw] : []
  }
  next.languages = detectLanguages(data)
  return next
}

/**
 * The rows with their in-app edits laid on top. A row without edits is returned as the same object, so nothing downstream
 * (search text, memoized lists) is rebuilt for it.
 */
export function applyEdits(repoKey: BaseRepoKey, rows: SnapshotRow[], edits: BaseRepoEdit[]): SnapshotRow[] {
  if (edits.length === 0) return rows
  const byRecord = latestEditsByRecord(edits)
  return rows.map((row) => {
    const mine = byRecord.get(row.id)
    if (!mine || mine.size === 0) return row
    let data = row.data
    for (const [path, edit] of mine) data = setPath(data, path, edit.after_value as EditValue)
    const edited = rederive(repoKey, { ...row, data })
    edited.editedPaths = Array.from(mine.keys())
    edited.pendingEditCount = Array.from(mine.values()).filter((e) => !e.exported_at).length
    return edited
  })
}

/** The edit history of one record, newest first, including undone edits. */
export function historyFor(edits: BaseRepoEdit[], recordId: string): BaseRepoEdit[] {
  return edits.filter((e) => e.record_id === recordId).sort((a, b) => b.edited_at.localeCompare(a.edited_at))
}

export interface FieldChange {
  path: string
  before: unknown
  after: EditValue
}

/** Saves one row per changed field. Returns an error message, or null when everything was saved. */
export async function saveEdits(
  supabase: Client,
  args: { repoKey: BaseRepoKey; recordId: string; userId: string; changes: FieldChange[]; note: string }
): Promise<string | null> {
  if (args.changes.length === 0) return null
  const rows = args.changes.map((c) => ({
    base_repo: args.repoKey,
    record_id: args.recordId,
    field_path: c.path,
    before_value: c.before === undefined ? null : c.before,
    after_value: c.after,
    is_reset: false,
    note: args.note.trim() || null,
    edited_by: args.userId,
  }))
  const { error } = await (supabase as any).from('base_repo_record_edits').insert(rows)
  return error ? error.message : null
}

/** Puts one field back to the repo copy. */
export async function resetEdit(
  supabase: Client,
  args: { repoKey: BaseRepoKey; recordId: string; userId: string; path: string; before: unknown }
): Promise<string | null> {
  const { error } = await (supabase as any).from('base_repo_record_edits').insert({
    base_repo: args.repoKey,
    record_id: args.recordId,
    field_path: args.path,
    before_value: args.before === undefined ? null : args.before,
    after_value: null,
    is_reset: true,
    edited_by: args.userId,
  })
  return error ? error.message : null
}

/** Edits whose latest state is still on top of the repo copy and not yet sent back. */
export function pendingEdits(edits: BaseRepoEdit[]): BaseRepoEdit[] {
  const pending: BaseRepoEdit[] = []
  for (const rec of latestEditsByRecord(edits).values()) for (const e of rec.values()) if (!e.exported_at) pending.push(e)
  return pending.sort((a, b) => a.edited_at.localeCompare(b.edited_at))
}

/** Marks edits as applied to the source repo. */
export async function markSentBack(supabase: Client, ids: string[], batch: string): Promise<string | null> {
  if (ids.length === 0) return null
  const { error } = await (supabase as any)
    .from('base_repo_record_edits')
    .update({ exported_at: new Date().toISOString(), export_batch: batch })
    .in('id', ids)
  return error ? error.message : null
}
