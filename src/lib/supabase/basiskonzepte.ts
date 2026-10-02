import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ============================================================================
// Construct crosswalk -- core OpenLPM data model <-> the German, student-
// facing UI's own vocabulary (student-nav.tsx, student-*-page.tsx). Kept
// here, next to the functions that actually do the translating, so the
// mapping can't quietly drift as the student UI grows. Every German label
// below names a REAL OpenLPM table/column; nothing here is a student-UI-only
// invention with no backing data.
//
//   OpenLPM construct (researcher UI)         Student UI (German)
//   ---------------------------------         --------------------
//   lpm_data_objects row                      ein Lernziel (Lernziele page)
//   lpm_schema_elements, parent_id IS NULL     ein Basiskonzept (Basiskonzepte page)
//   content.basiskonzeptbezug[] (JSONB)        Relevanz-Punkte je Basiskonzept
//     .basiskonzept_id                           (see buildBkLabelMap below --
//                                                  this is the one field that
//                                                  needs translating, since it's
//                                                  a free-text id from the
//                                                  original EvoMentor DE import,
//                                                  not a real foreign key)
//   lpm_connections, status='accepted'         "Reihenfolge im Lehrplan"
//                                                 (Davor/Danach, on a Lernziel's
//                                                 own detail page)
//   lpm_threads + lpm_thread_stations,         Kohärenzfäden / "Warum hängt
//     status='accepted'                          das zusammen?" thread cards
//   content.ist_konzeptanker (bool)            Konzeptanker badge
//   content.ist_praktisch (bool)               "praktische Lernziele" stat
//   content.geschaetzte_unterrichtsstunden     "Unterrichtsstunden gesamt" stat
//
// One thing on this list is NOT a first-class OpenLPM construct: the
// Basiskonzept-to-Basiskonzept relation lines drawn in the Netz tab. There is
// no `lpm_concept_relations` table (checked directly against the schema
// 2026-09-30) -- those lines are a DERIVED aggregate over real, accepted
// lpm_connections rows (two Lernziele under different Basiskonzepte having a
// real asserted connection), computed client-side, never authored data.
// Label them as derived wherever they appear -- don't let a reader mistake
// them for a first-class relation OpenLPM itself stores.
// ============================================================================

type Client = SupabaseClient<Database>
type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']

export interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
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

export function buildBkLabelMap(bkIds: string[], rootConcepts: { id: string; label: string }[]): Record<string, string> {
  const normalized = rootConcepts.map((c) => ({ id: c.id, label: c.label, norm: normalizeGerman(c.label) }))
  const map: Record<string, string> = {}
  for (const id of bkIds) {
    // Real gap found live 2026-09-30 (reported as "weird code instead of the
    // label"): at least one imported row's basiskonzeptbezug entry uses the
    // Basiskonzept's own lpm_schema_elements.id (a raw UUID) instead of the
    // "bk_xxx" string the rest of the import uses -- token-matching a UUID
    // against a German label never matches anything, so it fell straight
    // through to the raw id. Check for a direct id match first; only a value
    // that matches NEITHER convention still falls back to the raw id.
    const direct = normalized.find((c) => c.id === id)
    if (direct) { map[id] = direct.label; continue }
    const tokens = id.replace(/^bk_/, '').split('_').filter(Boolean)
    const match = normalized.find((c) => tokens.every((t) => c.norm.includes(t)))
    if (match) map[id] = match.label
  }
  return map
}

export interface BkGroup { rootId: string; label: string; rawIds: string[] }

/**
 * Groups every distinct raw basiskonzept_id actually seen in a project's
 * content by which REAL root concept it resolves to. Real gap found live
 * 2026-09-30, reported directly by Dustin with a screenshot: a raw-id list
 * on its own can hold more than one spelling for the very same concept --
 * the "weird code" fix above means a UUID-shaped id (a stray one exists in
 * the real Thuringia data, see buildBkLabelMap's own comment) now resolves
 * to the correct German label, but a checkbox/selector list built by
 * rendering "one row per raw id" then shows that one real Basiskonzept
 * TWICE, with two different colors -- a real regression this introduced
 * even though each individual label is now correct. Anything building a
 * concept checkbox list or selector from a raw id list should group through
 * this first, not map over the raw ids directly. An id that resolves to
 * nothing keeps its own singleton group (same fallback buildBkLabelMap uses
 * -- still visible, never silently dropped).
 */
export function groupBkIdsByRoot(rawIds: string[], rootConcepts: { id: string; label: string }[]): BkGroup[] {
  const resolvedLabel = buildBkLabelMap(rawIds, rootConcepts)
  const labelToRoot = new Map(rootConcepts.map((r) => [r.label, r]))
  const byKey = new Map<string, BkGroup>()
  for (const rawId of rawIds) {
    const label = resolvedLabel[rawId]
    const root = label ? labelToRoot.get(label) : undefined
    const key = root?.id ?? rawId
    if (!byKey.has(key)) byKey.set(key, { rootId: key, label: root?.label ?? rawId, rawIds: [] })
    byKey.get(key)!.rawIds.push(rawId)
  }
  // Real feedback 478397f9 (Susan, 2026-10-02): sorted to match
  // rootConcepts' own order (see getRootConcepts' own comment) rather than
  // "whichever raw id this Set happened to see first" -- the Lernziele
  // sidebar's Basiskonzepte filter list reads this order directly.
  const rootIndex = new Map(rootConcepts.map((r, i) => [r.id, i]))
  return Array.from(byKey.values()).sort((a, b) => (rootIndex.get(a.rootId) ?? 999) - (rootIndex.get(b.rootId) ?? 999))
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

/**
 * The project's own real root-level Basiskonzepte, falling back to the
 * parent's copy only for a label this project doesn't have its own row for.
 * Real bug found live 2026-09-30 (screenshot feedback: "duplicate
 * basiskonzepte nodes on the left are not doing anything for us"): a
 * project that already has its OWN full set (evomentor-thuringia, seeded
 * 2026-09-09) still gets the parent hub's set unioned in too (evomentor,
 * seeded 2026-09-12) -- confirmed directly against the live data, 12 rows
 * back for 6 real concepts, same German labels but different ids. A flat
 * union is correct for a project that hasn't had its own copy seeded yet
 * (the original reason this function unions at all) but wrong once a
 * project has its own -- dedupe by label, preferring this project's own
 * row, so every consumer (Dashboard/Netz/Detail tabs) sees exactly one row
 * per real Basiskonzept regardless of which projects happen to hold a copy.
 */
// Real feedback 478397f9 (Susan, 2026-10-02): the Basiskonzepte Dashboard
// showed a different order (and, since every view colors a root concept by
// its position among rootConcepts, different colors) than the Lernziele
// window. Root cause checked directly against the real data: the query
// below has no ORDER BY, and lpm_schema_elements has no sequence/position
// column to sort by either (all 6 real Thuringia root rows share the exact
// same created_at, a single seed-time batch insert) -- so its result order
// was never guaranteed, and different pages' own independent queries were
// free to come back in different native row order. The real Thuringia
// Basiskonzepte vocabulary (KMK's own six) has one conventional sequence,
// named directly by Susan -- sorted to it here, once, so every page that
// colors/orders by position in this array (Dashboard, Netz, Detail,
// Lernziele) is now consistent by construction. A project using different
// root-concept labels (unrecognized here) keeps the query's own order for
// those -- this never hides or reorders-wrong a concept this list doesn't
// know about.
const ROOT_CONCEPT_ORDER = [
  'Evolutive Entwicklung',
  'Individuelle Entwicklung',
  'Struktur und Funktion',
  'Steuerung und Regelung',
  'Stoff- und Energieumwandlung',
  'Information und Kommunikation',
]

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
  const byLabel = new Map<string, SchemaElement>()
  for (const row of data ?? []) {
    const existing = byLabel.get(row.label)
    if (!existing || (existing.project_id !== project.id && row.project_id === project.id)) {
      byLabel.set(row.label, row)
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => {
    const ai = ROOT_CONCEPT_ORDER.indexOf(a.label)
    const bi = ROOT_CONCEPT_ORDER.indexOf(b.label)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

/**
 * Every schema element for a project (and its parent hub) -- root
 * Basiskonzepte AND their real sub-concepts, keyed by id. Unlike
 * getRootConcepts above, no dedup-by-label here: a student view resolving
 * a Lernziel's own relevante_unterkonzepte_taxonomie[].taxonomyElementId
 * needs the EXACT row that id points to, not a label-deduped stand-in.
 */
export async function getConceptElementsById(
  supabase: Client,
  project: { id: string; parent_project_id: string | null }
): Promise<Map<string, SchemaElement>> {
  const projectIds = Array.from(new Set([project.parent_project_id ?? project.id, project.id]))
  const { data } = await supabase.from('lpm_schema_elements').select('*').in('project_id', projectIds)
  return new Map((data ?? []).map((row) => [row.id, row]))
}

/** 0 for a root Basiskonzept, 1 for a real Unterkonzept, 2 for its finer sub-concept. */
export function elementDepth(id: string, byId: Map<string, SchemaElement>): number {
  let depth = 0
  let cur = byId.get(id)
  while (cur?.parent_id) {
    depth++
    cur = byId.get(cur.parent_id)
  }
  return depth
}

/** Walks up from `id` to its ancestor at exactly `targetDepth` (e.g. depth 1 for a depth-2 node's real Unterkonzept parent). Undefined if `id` is already shallower than `targetDepth`. */
export function ancestorAtDepth(id: string, targetDepth: number, byId: Map<string, SchemaElement>): SchemaElement | undefined {
  let cur = byId.get(id)
  let depth = elementDepth(id, byId)
  while (cur && depth > targetDepth) {
    cur = byId.get(cur.parent_id!)
    depth--
  }
  return depth === targetDepth ? cur : undefined
}
