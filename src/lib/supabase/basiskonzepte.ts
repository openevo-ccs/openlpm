import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>
type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']

export interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string }[]
}

export function bkEntries(content: unknown): BkbEntry[] {
  return ((content as any)?.basiskonzeptbezug ?? []) as BkbEntry[]
}

// Shared with prompt-generator-page.tsx's own original fix (2026-09-30):
// the six-Basiskonzept ids inside content.basiskonzeptbezug are EvoMentor
// DE's own original identifiers baked into the imported curriculum data --
// there's no slug column on lpm_schema_elements to join against, and a
// mechanical re-slugify of a label doesn't reliably invert back to the
// original id (bk_stoff_energie_umwandlung has an extra word-break inside
// the compound noun "Energieumwandlung" a naive transform wouldn't
// reproduce). Token-matching instead: every underscore-separated token in
// the id must appear as a substring of a real root concept's own label
// (normalized: lowercase, umlauts folded, non-letters stripped). Falls
// back to the raw id rather than guessing wrong when nothing matches --
// not a hardcoded Thuringia-specific table, works for any project using
// this scheme.
export function normalizeGerman(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')
}

export function buildBkLabelMap(bkIds: string[], rootConcepts: { label: string }[]): Record<string, string> {
  const normalized = rootConcepts.map((c) => ({ label: c.label, norm: normalizeGerman(c.label) }))
  const map: Record<string, string> = {}
  for (const id of bkIds) {
    const tokens = id.replace(/^bk_/, '').split('_').filter(Boolean)
    const match = normalized.find((c) => tokens.every((t) => c.norm.includes(t)))
    if (match) map[id] = match.label
  }
  return map
}

/**
 * A short (<=8-char) abbreviation for a Basiskonzept label, for compact UI
 * (chips, legends) where the full German name doesn't fit -- "Struktur und
 * Funktion" -> "Str/Fkt", matching EvoMentor DE's own real abbreviation
 * style (confirmed directly in its live app, e.g. BK_ABBR's "Str/Fkt",
 * "Evol. Ent."). Derived mechanically (first few consonant-led syllables of
 * each significant word) rather than hardcoded per label, since a project
 * using a different concept vocabulary should still get a reasonable
 * abbreviation instead of nothing.
 */
export function bkAbbreviation(label: string): string {
  const words = label.split(/\s+/).filter((w) => !['und', 'der', 'die', 'das'].includes(w.toLowerCase()))
  if (words.length >= 2) return words.map((w) => w.slice(0, 4).replace(/[aeiouäöü]+$/i, '')).join('/')
  return label.slice(0, 6)
}

/** The project's own real root-level Basiskonzepte, unioned with its parent's (same resolution rule concepts-page.tsx already uses). */
export async function getRootConcepts(
  supabase: Client,
  project: { id: string; parent_project_id: string | null }
): Promise<SchemaElement[]> {
  const projectIds = Array.from(new Set([project.parent_project_id ?? project.id, project.id]))
  const { data } = await supabase
    .from('lpm_schema_elements')
    .select('*')
    .in('project_id', projectIds)
    .is('parent_id', null)
  return data ?? []
}
