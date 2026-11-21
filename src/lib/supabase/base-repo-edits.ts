import type { createClient } from '@/lib/supabase/client'
import { BASE_REPO_CONFIGS, detectLanguages, plainLabel, type BaseRepoKey, type SnapshotRow } from '@/lib/supabase/base-repo-explorer'
import { getPath, setPath, NEW_RECORD_PATH, type EditValue } from '@/lib/base-repo-edit-fields'
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
  return `Tag names: ${field === 'lessonPhases' ? 'lesson phases' : field === 'learningApproaches' ? 'learning approaches' : field === 'disciplineTags' ? 'disciplines' : field}`
}

/** "en|kooperativ" is the English name of the tag kooperativ. */
export function splitVocabPath(path: string): { lang: 'en' | 'de'; term: string } | null {
  const bar = path.indexOf('|')
  const lang = path.slice(0, bar)
  return bar > 0 && (lang === 'en' || lang === 'de') ? { lang, term: path.slice(bar + 1) } : null
}

/** The tag names set in the app, from the log of edits of MethodsBase. */
export function tagNamesFromEdits(edits: BaseRepoEdit[]): TagNameOverlay {
  const out: TagNameOverlay = { lessonPhases: {}, learningApproaches: {}, disciplineTags: {} }
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
    const named = (data as any).label ?? (data as any).title ?? (data as any).statement ?? (row.createdInApp ? (data as any).text : undefined)
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
 * The records people created in the app (feedback 5016dccd, Susan Hanisch 2026-11-18: "need an option to add a new entry into the base repo").
 * A new record is stored as an edit row of its own, at the path NEW_RECORD_PATH, holding the few fields every record needs. The fields people
 * fill in afterwards are ordinary edit rows. Once the record is in the repo and the Explorer's copy has been refreshed, the copy has a row
 * with this id and the marker is ignored.
 */
export function createdRecords(edits: BaseRepoEdit[]): Map<string, { data: Record<string, unknown>; marker: BaseRepoEdit }> {
  const out = new Map<string, { data: Record<string, unknown>; marker: BaseRepoEdit }>()
  for (const [recordId, fields] of latestEditsByRecord(edits)) {
    const marker = fields.get(NEW_RECORD_PATH)
    if (!marker || !marker.after_value || typeof marker.after_value !== 'object' || Array.isArray(marker.after_value)) continue
    out.set(recordId, { data: marker.after_value as Record<string, unknown>, marker })
  }
  return out
}

/**
 * The rows with their waiting in-app edits laid on top, plus the records created in the app that the copy does not have yet. A row without edits
 * is returned as the same object, so nothing downstream (search text, memoized lists) is rebuilt for it.
 */
export function applyEdits(repoKey: BaseRepoKey, rows: SnapshotRow[], edits: BaseRepoEdit[]): SnapshotRow[] {
  if (edits.length === 0) return rows
  const byRecord = latestEditsByRecord(edits)
  const have = new Set(rows.map((r) => r.id))
  const made: SnapshotRow[] = []
  for (const [id, { data }] of createdRecords(edits)) {
    if (have.has(id)) continue
    made.push(rederive(repoKey, { id, label: id, secondary: null, filterValue: null, review_status: null, data, languages: [], secondaryFilterValues: [], createdInApp: true }))
  }
  return [...rows, ...made].map((row) => {
    const mine = byRecord.get(row.id)
    if (!mine || mine.size === 0) return row
    const paths = Array.from(mine.keys()).filter((p) => p !== NEW_RECORD_PATH)
    if (paths.length === 0 && !row.createdInApp) return row
    // Once an edit has been sent back, the repo copy has the value and is the one to show: a later change in the repo (made another way)
    // must not be hidden under the old saved text. Only edits still waiting are laid on top. A record that exists only here has no repo copy
    // yet, so all of its edits count.
    let data = row.data
    for (const p of paths) {
      const edit = mine.get(p)!
      if (edit.exported_at && !row.createdInApp) continue
      data = setPath(data, p, edit.after_value as EditValue)
    }
    const edited = rederive(repoKey, { ...row, data })
    edited.editedPaths = paths
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


// ---- Adding a record in the app ----

/** Lowercase words joined by hyphens, from an English title: "Group and sort to approach systematics" becomes "group-and-sort-to-approach-systematics". */
export function slugFromTitle(title: string): string {
  const words = title
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (words.length <= 80) return words
  const cut = words.slice(0, 80)
  return cut.slice(0, Math.max(cut.lastIndexOf('-'), 1)).replace(/-+$/g, '')
}

/**
 * What a new entry needs in each base (feedback 5016dccd, Susan Hanisch 2026-11-21: "each base could have that option, with the only restriction
 * regarding fields maybe being the name/label"). The person types the name, and everything else is filled in with the ordinary edit form. The id
 * follows each repo's own rule (its GOVERNANCE.md, Identifier Scheme). It is proposed here, and whoever copies the entry into the repo may
 * finish it (for example LiteratureBase ids carry the authors and the year, which are only known after the form is filled in).
 */
export interface NewEntrySpec {
  /** "method", "theory", ... used in the button and the panel. */
  noun: string
  /** The first part of the id. */
  idPrefix: string
  /** The label of the one required field. */
  nameLabel: string
  /** Where the name is stored in the record. */
  namePath: string
  placeholder: string
  /** For a long name such as a quote: how many words make the id. Default: the whole name, cut at 80 characters. */
  idWords?: number
  /** The few fields every record of this base carries, besides id and slug. */
  starter: Record<string, unknown>
}

export const NEW_ENTRY_SPECS: Partial<Record<BaseRepoKey, NewEntrySpec>> = {
  methodsbase: { noun: 'method', idPrefix: 'OE-METHOD-', nameLabel: 'Title (English)', namePath: 'label.en', placeholder: 'For example: Model evolutionary trees with different materials', starter: { methodClass: 'pedagogical-practice', status: 'active' } },
  theorybase: { noun: 'theory', idPrefix: 'OE-THEORY-', nameLabel: 'Name of the theory', namePath: 'label', placeholder: 'For example: Niche construction theory', starter: { status: 'proposed' } },
  literaturebase: { noun: 'reference', idPrefix: 'OE-LITERATURE-', nameLabel: 'Title of the work', namePath: 'citation.title', placeholder: 'For example: The extended evolutionary synthesis', starter: { status: 'proposed' } },
  questionbase: { noun: 'question', idPrefix: 'OE-QUESTION-', nameLabel: 'Short name of the question', namePath: 'label', placeholder: 'For example: How do students use agency language about evolution?', starter: { status: 'open' } },
  quotebase: { noun: 'quote', idPrefix: 'OE-QUOTE-', nameLabel: 'The quote', namePath: 'text', placeholder: 'The words as written in the source', idWords: 8, starter: { status: 'proposed' } },
  competencybase: { noun: 'competency', idPrefix: 'OE-COMPETENCY-', nameLabel: 'Competency statement (English)', namePath: 'statement.en', placeholder: 'For example: Students can explain how traits change across generations', idWords: 8, starter: { type: 'oe:Competency', status: 'proposed' } },
  projectbase: { noun: 'project', idPrefix: 'project:', nameLabel: 'Name of the project', namePath: 'label', placeholder: 'For example: eMu', starter: { status: 'active' } },
  teachingbase: { noun: 'lesson page', idPrefix: '', nameLabel: 'Title (English)', namePath: 'title.en', placeholder: 'For example: Agency in evolution education', starter: {} },
}

export type NewEntryCheck = { ok: true; id: string; slug: string } | { ok: false; problem: string }

/** Whether a name can start a new entry in this base, and the id it would get. `existingIds` are the ids of every record of the base already shown. */
export function checkNewEntryName(repoKey: BaseRepoKey, title: string, existingIds: Iterable<string>): NewEntryCheck {
  const spec = NEW_ENTRY_SPECS[repoKey]
  if (!spec) return { ok: false, problem: 'Adding is not available for this repo.' }
  const source = spec.idWords ? title.trim().split(/\s+/).slice(0, spec.idWords).join(' ') : title
  const slug = slugFromTitle(source)
  if (!title.trim() || !slug) return { ok: false, problem: 'Type the name first.' }
  const id = `${spec.idPrefix}${slug}`
  for (const x of existingIds) if (x === id) return { ok: false, problem: `A ${spec.noun} with this name already exists. Open it from the table, or make the new name more specific.` }
  return { ok: true, id, slug }
}

/**
 * Creates a new record: the marker row and the name. The rest is filled in with the ordinary edit form. Returns an error message, or null
 * when it was saved.
 */
export async function createEntry(
  supabase: Client,
  repoKey: BaseRepoKey,
  args: { userId: string; title: string; existingIds: Iterable<string> }
): Promise<{ error: string | null; id?: string }> {
  const spec = NEW_ENTRY_SPECS[repoKey]
  if (!spec) return { error: 'Adding is not available for this repo.' }
  const check = checkNewEntryName(repoKey, args.title, args.existingIds)
  if (!check.ok) return { error: check.problem }
  const title = args.title.trim()
  const rows = [
    { path: NEW_RECORD_PATH, before: null, after: { id: check.id, slug: check.slug, ...spec.starter } },
    { path: spec.namePath, before: null, after: title },
  ].map((c) => ({
    base_repo: repoKey, record_id: check.id, field_path: c.path, before_value: c.before, after_value: c.after,
    is_reset: false, note: 'New entry created in the Explorer', edited_by: args.userId,
  }))
  const { error } = await (supabase as any).from('base_repo_record_edits').insert(rows)
  return error ? { error: error.message } : { error: null, id: check.id }
}

/** The methods version of the two functions above, kept under its first names. */
export const checkNewMethodTitle = (title: string, existingIds: Iterable<string>): NewEntryCheck => checkNewEntryName('methodsbase', title, existingIds)
export const createMethodEntry = (supabase: Client, args: { userId: string; title: string; existingIds: Iterable<string> }) => createEntry(supabase, 'methodsbase', args)

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
