import type { createClient } from '@/lib/supabase/client'

// TeachingBase tab of the Base Repo Explorer (migrations 240 and 241): experts check the links a machine drafted between TeachingBase lessons and the other base repos.
// The lessons come from teachingbase_snapshot (a copy, refreshed by scripts/sync_teachingbase_snapshot.mjs). Each judgement is a row in
// teachingbase_link_verdicts; rows are never changed, and the newest row per item is the one that counts.
// Design note: lab_manager/docs/design-notes/openlpm-teaching-lessons-review-2026-11-11.md

type Client = ReturnType<typeof createClient>

export type Verdict = 'correct' | 'wrong' | 'unsure'
export const VERDICTS: Verdict[] = ['correct', 'wrong', 'unsure']
export type ItemKind = 'link' | 'component'

export interface LessonLink {
  item_key: string
  type: string
  to: string
  label?: string | null
  relation?: string | null
  evidence?: string | null
  confidence?: string | null
  why?: string | null
  checks?: { id_exists?: boolean; quote_found?: boolean; was_candidate?: boolean } | null
  state?: string | null
  sample?: boolean
}

export interface LessonComponent {
  item_key: string
  id?: string
  type: string
  title?: string | null
  evidence?: string | null
  checks?: { quote_found?: boolean } | null
  state?: string | null
}

export interface LessonAsset {
  id?: string
  kind?: string | null
  label?: string | null
  url?: string | null
  anchor_text?: string | null
  rights?: { status?: string | null } | null
}

export interface RightsFlag {
  issue?: string | null
  evidence?: string | null
}

export interface LessonData {
  slug: string
  title: { en: string; de?: string | null }
  description: { en?: string | null; de?: string | null }
  grades: string[]
  subjects: string[]
  material_types: string[]
  collections: string[]
  source_pages?: Record<string, string>
  materials: { label?: string | null; url?: string | null }[]
  components: LessonComponent[]
  assets: LessonAsset[]
  links: LessonLink[]
  rights_flags: RightsFlag[]
}

export interface LessonRow {
  id: string
  label: string
  collections: string[]
  graph_present: boolean
  link_count: number
  sample_count: number
  data: LessonData
}

export interface VerdictRow {
  id: string
  lesson_id: string
  item_kind: ItemKind
  item_key: string
  item_summary: Record<string, unknown>
  verdict: Verdict
  note: string | null
  reviewer_id: string | null
  reviewer_name: string
  reviewed_at: string
}

const PAGE_SIZE = 1000

// ---------------------------------------------------------------------------------------------
// Pure rules (tested by scripts/test_teaching_lessons_review.mjs)
// ---------------------------------------------------------------------------------------------

export const verdictKey = (lessonId: string, kind: ItemKind, itemKey: string) => `${lessonId}|${kind}|${itemKey}`

/** The newest verdict per item. Ties on the timestamp go to the row that comes later in the list. */
export function latestVerdicts(rows: VerdictRow[]): Map<string, VerdictRow> {
  const out = new Map<string, VerdictRow>()
  for (const r of rows) {
    const k = verdictKey(r.lesson_id, r.item_kind, r.item_key)
    const cur = out.get(k)
    if (!cur || r.reviewed_at >= cur.reviewed_at) out.set(k, r)
  }
  return out
}

/** What the progress rules need from a lesson: its id and its data. A TeachingBase row in the Explorer has both. */
export type LessonKey = Pick<LessonRow, 'id' | 'data'>

export interface Progress { judged: number; total: number }

/** Links judged out of links total, over the given lessons. With sampleOnly, only the "start here" links count. */
export function linkProgress(lessons: LessonKey[], latest: Map<string, VerdictRow>, sampleOnly = false): Progress {
  let judged = 0
  let total = 0
  for (const l of lessons) {
    for (const link of l.data.links ?? []) {
      if (sampleOnly && !link.sample) continue
      total += 1
      if (latest.has(verdictKey(l.id, 'link', link.item_key))) judged += 1
    }
  }
  return { judged, total }
}

/** Progress for one lesson, links and components together. */
export function lessonProgress(lesson: LessonKey, latest: Map<string, VerdictRow>): Progress {
  let judged = 0
  let total = 0
  for (const link of lesson.data.links ?? []) { total += 1; if (latest.has(verdictKey(lesson.id, 'link', link.item_key))) judged += 1 }
  for (const c of lesson.data.components ?? []) { total += 1; if (latest.has(verdictKey(lesson.id, 'component', c.item_key))) judged += 1 }
  return { judged, total }
}

/** A lesson is reviewed when it has links and every link has a verdict. */
export function isLessonReviewed(lesson: LessonKey, latest: Map<string, VerdictRow>): boolean {
  const p = linkProgress([lesson], latest)
  return p.total > 0 && p.judged === p.total
}

export interface LessonFilter {
  collection: string
  review: '' | 'open' | 'reviewed'
  sampleOnly: boolean
  graphOnly: boolean
  search: string
}

export function filterLessons(lessons: LessonRow[], latest: Map<string, VerdictRow>, f: LessonFilter): LessonRow[] {
  const q = f.search.trim().toLowerCase()
  return lessons.filter((l) => {
    if (f.collection && !l.collections.includes(f.collection)) return false
    if (f.graphOnly && !l.graph_present) return false
    if (f.sampleOnly && l.sample_count === 0) return false
    if (f.review === 'reviewed' && !isLessonReviewed(l, latest)) return false
    if (f.review === 'open' && (l.link_count === 0 || isLessonReviewed(l, latest))) return false
    if (q && !`${l.label} ${l.data.title?.de ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

/** "OE-CONCEPT-bio-core-natural-selection" becomes "bio core natural selection". Ids that do not follow the pattern are shown as they are. */
export function readableTarget(id: string): string {
  const m = /^OE-[A-Z]+-(.+)$/.exec(id)
  const rest = m ? m[1] : id.replace(/^[a-z]+:/, '')
  return rest.replace(/[-_]+/g, ' ')
}

/** What a reviewer was looking at, stored with the verdict. */
export function summaryOf(item: LessonLink | LessonComponent, kind: ItemKind): Record<string, unknown> {
  if (kind === 'component') {
    const c = item as LessonComponent
    return { type: c.type, label: c.title ?? null, evidence: c.evidence ?? null }
  }
  const l = item as LessonLink
  return { type: l.type, to: l.to, label: l.label ?? null, evidence: l.evidence ?? null }
}

/** The file "Download verdicts" saves: the newest verdict per item, in a stable order. */
export function verdictsExport(latest: Map<string, VerdictRow>) {
  return [...latest.values()]
    .sort((a, b) => a.lesson_id.localeCompare(b.lesson_id) || a.item_kind.localeCompare(b.item_kind) || a.item_key.localeCompare(b.item_key))
    .map((r) => ({
      lesson_id: r.lesson_id,
      item_kind: r.item_kind,
      item_key: r.item_key,
      item_summary: r.item_summary,
      verdict: r.verdict,
      note: r.note,
      reviewer: r.reviewer_name,
      date: r.reviewed_at,
    }))
}

// ---------------------------------------------------------------------------------------------
// Database calls
// ---------------------------------------------------------------------------------------------

/** Every lesson. `available` is false when the tables are not there yet (before migration 240 is pushed). */
export async function listLessons(supabase: Client): Promise<{ lessons: LessonRow[]; available: boolean }> {
  const all: LessonRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from('teachingbase_snapshot')
      .select('id, label, collections, graph_present, link_count, sample_count, data')
      .order('label', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { lessons: [], available: false }
    const page = (data ?? []) as LessonRow[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { lessons: all, available: true }
}

export async function listVerdicts(supabase: Client): Promise<{ rows: VerdictRow[]; available: boolean }> {
  const all: VerdictRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from('teachingbase_link_verdicts')
      .select('*')
      .order('reviewed_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { rows: [], available: false }
    const page = (data ?? []) as VerdictRow[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { rows: all, available: true }
}

export async function currentReviewer(supabase: Client): Promise<{ id: string; name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('name, email').eq('id', user.id).maybeSingle()
  return { id: user.id, name: data?.name || data?.email || user.email || 'unknown' }
}

/** Adds a verdict row. Changing a verdict is another call with the new value; nothing is overwritten. */
export async function addVerdict(
  supabase: Client,
  reviewer: { id: string; name: string },
  input: { lesson_id: string; item_kind: ItemKind; item_key: string; item_summary: Record<string, unknown>; verdict: Verdict; note: string | null },
): Promise<{ row: VerdictRow | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('teachingbase_link_verdicts')
    .insert({ ...input, reviewer_id: reviewer.id, reviewer_name: reviewer.name })
    .select('*')
    .single()
  if (error) return { row: null, error: error.message }
  return { row: data as VerdictRow, error: null }
}

// ---------------------------------------------------------------------------------------------
// Named reviewers (migration 241): admins can name other people who may use this page and record verdicts.
// ---------------------------------------------------------------------------------------------

/** Where a named reviewer who is not an admin opens TeachingBase. It sits outside the Admin area and shows only that tab. */
export const REVIEWER_REVIEW_PATH = '/dashboard/teaching-base'
/** Where admins open it: the TeachingBase tab of the Base Repo Explorer. */
export const ADMIN_TEACHINGBASE_PATH = '/dashboard/admin/explore?tab=teachingbase'

export interface ReviewerRow { user_id: string; name: string; email: string; added_at: string }
export interface PersonHit { id: string; name: string; email: string }

/** Admins and named reviewers may use the page. */
export function mayUseReviewPage(isAdmin: boolean, isNamedReviewer: boolean): boolean {
  return isAdmin || isNamedReviewer
}

/** True when the lesson has at least one link in the "start here" sample. */
export function hasStartHere(lesson: LessonKey): boolean {
  return (lesson.data.links ?? []).some((l) => l.sample)
}

/** True when the lesson has links and some of them still have no verdict. */
export function isStillOpen(lesson: LessonKey, latest: Map<string, VerdictRow>): boolean {
  const p = linkProgress([lesson], latest)
  return p.total > 0 && p.judged < p.total
}

/** Makes a typed search safe for a PostgREST or-filter (commas, parentheses, wildcards and quotes have their own meaning there). */
export function cleanSearch(raw: string): string {
  return raw.replace(/[,()%*_\\"']/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Joins reviewer rows with the people's names. A person who cannot be found still shows, by id. Newest first. */
export function reviewerRows(rows: { user_id: string; added_at: string }[], people: PersonHit[]): ReviewerRow[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  return rows
    .map((r) => ({ user_id: r.user_id, name: byId.get(r.user_id)?.name ?? '', email: byId.get(r.user_id)?.email ?? r.user_id, added_at: r.added_at }))
    .sort((a, b) => b.added_at.localeCompare(a.added_at) || a.name.localeCompare(b.name))
}

/** People found by a search, without anyone who is already a reviewer. */
export function candidatesFor(hits: PersonHit[], reviewerIds: Set<string>): PersonHit[] {
  return hits.filter((h) => !reviewerIds.has(h.id))
}

/** Whether the signed-in person is a named reviewer. False when the table is not there yet. */
export async function isNamedReviewer(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).from('teachingbase_reviewers').select('user_id').eq('user_id', userId).maybeSingle()
  return !error && !!data
}

export async function listReviewers(supabase: Client): Promise<ReviewerRow[]> {
  const { data, error } = await (supabase as any).from('teachingbase_reviewers').select('user_id, added_at')
  if (error || !data || data.length === 0) return []
  const ids = (data as { user_id: string }[]).map((r) => r.user_id)
  const { data: people } = await supabase.from('users').select('id, name, email').in('id', ids)
  return reviewerRows(data as { user_id: string; added_at: string }[], (people ?? []) as PersonHit[])
}

/** Finds existing OpenLPM accounts by name or email. */
export async function searchPeople(supabase: Client, query: string): Promise<PersonHit[]> {
  const q = cleanSearch(query)
  if (q.length < 2) return []
  const { data } = await supabase.from('users').select('id, name, email').or(`name.ilike.%${q}%,email.ilike.%${q}%`).order('name', { ascending: true }).limit(10)
  return (data ?? []) as PersonHit[]
}

export async function addReviewer(supabase: Client, userId: string, addedBy: string): Promise<string | null> {
  const { error } = await (supabase as any).from('teachingbase_reviewers').insert({ user_id: userId, added_by: addedBy })
  return error ? error.message : null
}

export async function removeReviewer(supabase: Client, userId: string): Promise<string | null> {
  const { error } = await (supabase as any).from('teachingbase_reviewers').delete().eq('user_id', userId)
  return error ? error.message : null
}
