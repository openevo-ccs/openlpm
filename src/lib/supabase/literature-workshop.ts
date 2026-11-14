import type { SupabaseClient } from '@supabase/supabase-js'

// EvoKE Literature Workshop (migration 246): reviews and suggested papers that members add to LiteratureBase records.
// The two tables are new and not yet in database.types.ts, so they are reached through a loosely typed client here.

export const WORKSHOP_TAG = 'literature-workshop'

export const AGE_BANDS = ['K-2 (about 5-8)', '3-5 (about 8-11)', '6-8 (about 11-14)', '9-12 (about 14-18)', 'college', 'teachers or adults', 'several bands'] as const

export const TOPICS = [
  'natural selection',
  'variation and heredity',
  'genetic drift or non-adaptive change',
  'common descent and tree thinking',
  'deep time',
  'speciation and diversity',
  'adaptation, function or teleology',
  'essentialism or typological thinking',
  'evolution in general',
  'learning progression method',
  'assessment or instrument',
  'teaching or curriculum',
  'other',
] as const

export const DESIGNS = ['cross-sectional', 'longitudinal', 'intervention before and after', 'framework or review', 'qualitative case', 'other', 'cannot tell'] as const

// The domain tags the library already uses, as a way to pick a slice of it. 'All records' has no filter.
export const SLICES: { label: string; domain: string | null }[] = [
  { label: 'Evolution education (all)', domain: 'Evolution Education' },
  { label: 'Learning progressions', domain: 'Learning Progressions' },
  { label: 'Misconceptions', domain: 'Misconceptions' },
  { label: 'Conceptual change', domain: 'Conceptual Change' },
  { label: 'Assessment instruments', domain: 'Assessment Instruments' },
  { label: 'Teaching methods', domain: 'Teaching Methods' },
  { label: 'Teacher education', domain: 'Teacher Education' },
  { label: 'Religion and worldview', domain: 'Religion and Worldview' },
  { label: 'US policy and acceptance', domain: 'US Policy and Acceptance' },
  { label: 'International and comparative', domain: 'International and Comparative' },
  { label: 'Computational modeling', domain: 'Computational Modeling' },
  { label: 'Cultural evolution', domain: 'Cultural Evolution' },
  { label: 'Cooperation', domain: 'Cooperation' },
  { label: 'Records with no topic tag yet', domain: '__none__' },
  { label: 'All records', domain: null },
]

export interface ReviewRow {
  id: string
  project_id: string
  record_id: string
  reviewer_id: string
  reviewer_name: string
  citation_ok: 'correct' | 'needs-fix' | 'cannot-tell'
  fix_note: string | null
  relevance: 'yes' | 'partly' | 'no'
  age_bands: string[]
  topics: string[]
  design: string | null
  instrument: string | null
  country: string | null
  adds_note: string | null
  created_at: string
  exported_at: string | null
}

export interface SuggestionRow {
  id: string
  project_id: string
  doi: string
  title: string | null
  note: string | null
  suggested_by: string
  suggested_name: string
  status: 'waiting' | 'added' | 'declined'
  created_at: string
}

export interface QueueRecord {
  id: string
  slug: string
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  doi: string | null
  type: string | null
  domains: string[]
  review_status: string | null
  citation: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>
const loose = (c: unknown) => c as Loose

export async function listReviews(supabase: unknown, projectId: string): Promise<ReviewRow[]> {
  const out: ReviewRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await loose(supabase).from('literature_reviews').select('*').eq('project_id', projectId).order('created_at', { ascending: true }).range(from, from + 999)
    out.push(...((data ?? []) as ReviewRow[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function addReview(supabase: unknown, row: Omit<ReviewRow, 'id' | 'created_at' | 'exported_at'>): Promise<ReviewRow | null> {
  const { data, error } = await loose(supabase).from('literature_reviews').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data as ReviewRow
}

export async function listSuggestions(supabase: unknown, projectId: string): Promise<SuggestionRow[]> {
  const { data } = await loose(supabase).from('literature_suggestions').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  return (data ?? []) as SuggestionRow[]
}

export async function addSuggestion(supabase: unknown, row: Omit<SuggestionRow, 'id' | 'created_at' | 'status'>): Promise<SuggestionRow | null> {
  const { data, error } = await loose(supabase).from('literature_suggestions').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data as SuggestionRow
}

/** Records of one slice of the library, in a stable shuffled order that differs per person, so reviewers do not all start on the same record. */
export async function loadQueue(supabase: unknown, domain: string | null, seed: string, limit = 400): Promise<QueueRecord[]> {
  const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    return h >>> 0
  }
  const filtered = (q: ReturnType<ReturnType<Loose['from']>['select']>) => {
    if (domain === '__none__') return q.eq('domains', '{}')
    if (domain) return q.contains('domains', [domain])
    return q
  }
  // The service returns at most 1000 rows a request, so a big slice is read from a start point that depends on the person.
  const { count } = await filtered(loose(supabase).from('literaturebase_snapshot').select('id', { count: 'exact', head: true }))
  const total = count ?? 0
  const offset = total > 1000 ? hash(seed + String(domain)) % (total - 999) : 0
  const { data } = await filtered(loose(supabase).from('literaturebase_snapshot').select('id,slug,title,authors,year,venue,doi,type,domains,review_status,data')).order('id').range(offset, offset + 999)
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title ?? ''),
    authors: (r.authors as string[]) ?? [],
    year: (r.year as number | null) ?? null,
    venue: (r.venue as string | null) ?? null,
    doi: (r.doi as string | null) ?? null,
    type: (r.type as string | null) ?? null,
    domains: (r.domains as string[]) ?? [],
    review_status: (r.review_status as string | null) ?? null,
    citation: (((r.data as Record<string, unknown> | null) ?? {}).citation as Record<string, unknown>) ?? {},
  }))
  rows.sort((a, b) => hash(seed + a.id) - hash(seed + b.id))
  return rows.slice(0, limit)
}

/** The latest review of each record by each person. */
export function latestReviews(reviews: ReviewRow[]): ReviewRow[] {
  const m = new Map<string, ReviewRow>()
  for (const r of reviews) m.set(`${r.record_id}|${r.reviewer_id}`, r) // reviews arrive oldest first
  return [...m.values()]
}

export function reviewsToCsv(reviews: ReviewRow[]): string {
  const cols = ['record_id', 'reviewer_name', 'created_at', 'citation_ok', 'fix_note', 'relevance', 'age_bands', 'topics', 'design', 'instrument', 'country', 'adds_note']
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...reviews.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(','))].join('\n')
}
