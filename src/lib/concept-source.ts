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
// through these two helpers, so both shapes display correctly.

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
  | { kind: 'project' }

/** Where a concept comes from: a ConceptBase record, or this project alone. */
export function conceptSource(el: ElementLike): ConceptSource {
  const m = meta(el)
  const id = text(m.conceptbase_id)
  if (!id) return { kind: 'project' }
  return {
    kind: 'conceptbase',
    conceptbaseId: id,
    vocabulary: text(m.vocabulary),
    version: m.version != null ? String(m.version) : null,
    url: `https://w3id.org/openevo/concept/${encodeURIComponent(id)}`,
  }
}
