import type { Database } from '@/lib/supabase/database.types'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']
type ElementLike = Pick<SchemaElement, 'definition' | 'metadata'> | null | undefined

// A concept can carry its ConceptBase link and its definition in two shapes.
// The in-app "Import from ConceptBase" tool writes the definition to the
// `definition` column and tags `metadata.source = 'conceptbase'`. The seed
// migrations for the synthetic spaces (Bio-Core, Interdisciplinary and their
// capstones) stored the same facts inside `metadata` only (`conceptbase_id`,
// `vocabulary`, `definition`). Pages that read only the column showed those
// concepts as "No definition yet" and "Added directly to this project" even
// though each one is linked and defined (Dustin, feedback 001dca81,
// 2026-10-25). Everything that shows a concept's definition or origin reads it
// through these helpers, so both shapes display correctly.
//
// Added 2026-10-28 (four-space review, item X18): a seeded id looks like a
// registered one even when ConceptBase holds no record under it (261 of 304
// concept entries). The origin now says "registered" only when ConceptBase is
// known to hold the record, and says "proposed" otherwise. The id itself is not
// shown to readers.

function meta(el: ElementLike): Record<string, unknown> {
  const m = el?.metadata
  return m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** The concept's definition: the column if set, otherwise the one stored in metadata. */
export function conceptDefinition(el: ElementLike): string | null {
  return text(el?.definition) ?? text(meta(el).definition)
}

export type ConceptSource =
  | { kind: 'conceptbase'; conceptbaseId: string; vocabulary: string | null; version: string | null; url: string }
  | { kind: 'proposed' }
  | { kind: 'project' }

/**
 * Where a concept comes from. `registered` is the set of ids ConceptBase holds a record for, when it could be read. With it, an id that is
 * not in the set means the concept is only proposed. Without it (registry not read), the concept's own flag decides, and an unflagged id is
 * treated as registered as before.
 */
export function conceptSource(el: ElementLike, registered?: ReadonlySet<string> | null): ConceptSource {
  const m = meta(el)
  const id = text(m.conceptbase_id)
  if (!id) return { kind: 'project' }
  const proposed = registered ? !registered.has(id) : m.proposed_not_in_conceptbase === true
  if (proposed) return { kind: 'proposed' }
  return {
    kind: 'conceptbase',
    conceptbaseId: id,
    vocabulary: text(m.vocabulary),
    version: m.version != null ? String(m.version) : null,
    url: `https://w3id.org/openevo/concept/${encodeURIComponent(id)}`,
  }
}

/** True for a meaning of a general concept in one field (a "discipline facet"), for example "Agency (biology)". */
export function isFieldMeaning(el: ElementLike): boolean {
  const m = meta(el)
  return m.level === 'discipline-facet' || typeof m.facet_of === 'string'
}

/** The field a field meaning belongs to, taken from the closing bracket of its label: "Agency (AI and computation)" gives "AI and computation". */
export function fieldOf(label: string): string | null {
  const hit = /\(([^()]+)\)\s*$/.exec(label)
  return hit ? hit[1].trim() : null
}

export interface ConceptExtension {
  /** The general definition that holds across fields. */
  general: string | null
  /** What does not carry over from one field to another. */
  excludes: string | null
  confidence: string | null
  curriculumUse: string | null
  draftNote: string | null
  sources: string[]
}

/** Reads the general definition and the "does not carry over" note a wide-vocabulary space stores on a general concept. */
export function conceptExtension(el: ElementLike): ConceptExtension | null {
  const raw = meta(el).proposed_extension
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const x = raw as Record<string, unknown>
  return {
    general: text(x.general),
    excludes: text(x.excludes),
    confidence: text(x.confidence),
    curriculumUse: text(x.curriculum_use),
    draftNote: text(x.draft_note),
    sources: plainSources(x.grounding),
  }
}

/**
 * The papers and books named in a grounding list, without library-style codes. Entries that only name a record of one of the shared libraries
 * ("OE-CONCEPT-...", "ConceptBase OE-...") are dropped. A code in brackets after a citation ("LiteratureBase OE-LITERATURE-...") is cut.
 */
export function plainSources(grounding: unknown): string[] {
  if (!Array.isArray(grounding)) return []
  const out: string[] = []
  for (const g of grounding) {
    if (typeof g !== 'string') continue
    let s = g.trim()
    if (!s || /^(OE-|ConceptBase\b|LiteratureBase\b)/i.test(s)) continue
    s = s.replace(/;\s*LiteratureBase\s+OE-[A-Za-z0-9-]+/g, '').replace(/\s*\(([^()]*?)\s*LiteratureBase\s+OE-[A-Za-z0-9-]+\)/g, '')
    s = s.replace(/\bLiteratureBase\s+OE-[A-Za-z0-9-]+(?:\s+and\s+OE-[A-Za-z0-9-]+)?/g, '').replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim()
    if (s) out.push(s)
  }
  return out
}
