import type { createClient } from '@/lib/supabase/client'
import { pickLocalized } from '@/lib/method-text'
import { definitionRows, loadMeaningsSnapshot, type MeaningConcept } from '@/lib/concept-meanings'
import { readableTarget, type LessonLink } from '@/lib/supabase/teaching-lessons-review'

// What a suggested link points at, in plain words: the target's name and a short description taken from the target's own record. Records
// come from the base-repo snapshot tables that exist (methods, competencies, theories and principles, questions, quotes, papers) and from the
// dated ConceptBase copy for concepts. Species and lesson features have no records of their own yet, so they show only their name.

type Client = ReturnType<typeof createClient>

export interface TargetInfo {
  name: string
  /** A short plain description, or null when no record with a description was found. */
  description: string | null
  /** For a paper: the reference line. */
  reference?: string | null
  /** True when the suggestion names something that does not exist in the knowledge bases yet. */
  isNew: boolean
}

const TABLE_BY_TYPE: Record<string, string> = {
  method: 'methodsbase_snapshot',
  competency: 'competencybase_snapshot',
  theory: 'theorybase_snapshot',
  question: 'questionbase_snapshot',
  quote: 'quotebase_snapshot',
  literature: 'literaturebase_snapshot',
}

/** Link types whose targets have no record with a description yet. */
export const TYPES_WITHOUT_RECORDS = ['species', 'feature']

const text = (v: unknown, lang: string): string | null => pickLocalized(v, lang)?.text ?? null
const clip = (s: string, n = 420) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)

/** The description of a snapshot row of the given link type, in the reader's language where the record has it. Pure. */
export function descriptionFromRow(type: string, row: Record<string, any>, lang: string): { name: string | null; description: string | null; reference: string | null } {
  const d = (row.data ?? {}) as Record<string, any>
  if (type === 'method') return { name: text(d.label, lang) ?? text(row.label, lang), description: text(d.description, lang) ?? text(d.whenToUse, lang), reference: null }
  if (type === 'competency') return { name: text(row.label, lang), description: text(d.statement, lang), reference: null }
  if (type === 'theory') return { name: text(row.label, lang), description: text(d.statement, lang) ?? text(row.summary, lang), reference: null }
  if (type === 'question') return { name: text(row.label, lang), description: text(d.statement, lang), reference: null }
  if (type === 'quote') {
    const q = text(row.text ?? d.text, lang)
    const who = text(row.attribution ?? d.attribution, lang)
    return { name: text(row.label, lang), description: q ? `${q}${who ? ` (${who})` : ''}` : null, reference: null }
  }
  if (type === 'literature') {
    const authors = Array.isArray(row.authors) ? (row.authors as string[]).map((a) => a.split(',')[0]).slice(0, 3).join(', ') : ''
    const reference = [authors, row.year ? `(${row.year})` : '', row.title ? `${row.title}.` : '', row.venue ?? ''].filter(Boolean).join(' ')
    const summary = text(d.plain_language_summary?.text ?? d.plain_language_summary, lang)
    return { name: text(row.title, lang), description: summary, reference: reference || null }
  }
  return { name: null, description: null, reference: null }
}

/** A concept's description from the dated ConceptBase copy: the reader's language first, then any other. Pure. */
export function conceptDescription(c: MeaningConcept, lang: string): string | null {
  const rows = definitionRows(c)
  const mine = rows.find((r) => r.lang === lang) ?? rows[0]
  return mine?.text ?? null
}

const cache = new Map<string, TargetInfo>()
let conceptIndex: Map<string, MeaningConcept> | null = null

async function concepts(): Promise<Map<string, MeaningConcept>> {
  if (!conceptIndex) {
    const snap = await loadMeaningsSnapshot()
    conceptIndex = new Map([...snap.concepts, ...snap.pending].map((c) => [c.id, c]))
  }
  return conceptIndex
}

/** Looks up what one suggested link points at. Cached per target. Never throws: a failed lookup gives a name with no description. */
export async function loadTargetInfo(supabase: Client, link: Pick<LessonLink, 'type' | 'to' | 'label'>, lang: string): Promise<TargetInfo> {
  const key = `${link.type}|${link.to}|${lang}`
  const hit = cache.get(key)
  if (hit) return hit
  const fallbackName = link.label || readableTarget(link.to)
  const isNew = link.to === 'NEW' || link.to.startsWith('NEW')
  let info: TargetInfo = { name: fallbackName, description: null, isNew }
  try {
    if (!isNew && link.type === 'concept') {
      const c = (await concepts()).get(link.to)
      if (c) info = { name: c.labels?.[lang] ?? c.label ?? fallbackName, description: conceptDescription(c, lang), isNew }
    } else if (!isNew && TABLE_BY_TYPE[link.type]) {
      const { data } = await (supabase as any).from(TABLE_BY_TYPE[link.type]).select('*').eq('id', link.to).maybeSingle()
      if (data) {
        const r = descriptionFromRow(link.type, data, lang)
        info = { name: r.name ?? fallbackName, description: r.description ? clip(r.description) : null, reference: r.reference, isNew }
      }
    }
  } catch { /* keep the name only */ }
  cache.set(key, info)
  return info
}
