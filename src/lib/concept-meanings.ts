// Reads and organises the dated copy of ConceptBase that the Concept meanings page shows (src/data/concept-meanings.json, made by
// scripts/build_concept_meanings_snapshot.py). Pure functions, tested by scripts/test_concept_meanings.mjs.
//
// In plain words. A concept can have several stated meanings: one per discipline, one per word list, and a drafted meaning waiting in
// an unmerged branch. A comparison says how two concepts of different word lists relate. A use is a place where a source (a NetLogo
// model, a strand guide) uses the word. This file only reads and groups those. It never links a model's topic tag to a concept by its
// name (Dustin, 3 Nov 2026): the tag list shows which entries share the word and says that they have not been compared yet.

export type ConceptTier = 'registered' | 'sandbox' | 'pending'

export interface MeaningConcept {
  id: string
  tier: ConceptTier
  label: string
  labels: Record<string, string>
  vocabulary: string | null
  status: string | null
  version: string | null
  aliases: Record<string, string[]>
  definitions: Record<string, Record<string, string>>
  examples: string[]
  nonExamples: string[]
  broader: string[]
  narrower: string[]
  related: string[]
  citations: string[]
  /** pending concepts only: the registered concept with the same label, if any */
  replaces?: string | null
  /** pending concepts only: true when the English definition is word for word the one of the concept it replaces */
  sameDefinitionAsReplaced?: boolean
}

export interface MeaningAlignment {
  id: string
  subject: string
  object: string
  matchType: string | null
  status: string | null
  assertedBy: string[]
  date: string | null
  rationale: string
}

export type TagPile = 'in-conceptbase' | 'pending' | 'probable-match' | 'topic-label' | 'no-entry' | 'unsorted'

export interface NetlogoTag {
  tag: string
  models: { slug: string; title: string }[]
  pile: TagPile
  candidate: string | null
  sameWord: string[]
}

export interface NetlogoCitation {
  concept: string
  guide: string
  guideTitle: string
  count: number
  inConceptBase: boolean
  inPendingBranch: boolean
  unknownId: boolean
}

export interface MeaningsSnapshot {
  asOf: string
  sources: { conceptbase: { repo: string; ref: string; commit: string; pendingBranch: string | null }; netlogo: { repo: string; ref: string; commit: string } }
  concepts: MeaningConcept[]
  alignments: MeaningAlignment[]
  pending: MeaningConcept[]
  netlogoTags: NetlogoTag[]
  netlogoCitations: NetlogoCitation[]
}

export async function loadMeaningsSnapshot(): Promise<MeaningsSnapshot> {
  const mod = await import('@/data/concept-meanings.json')
  return (mod.default ?? mod) as unknown as MeaningsSnapshot
}

/** "BIO-CORE-v1.0.0:OE-CONCEPT-bio-core-natural-selection" -> the vocabulary and the concept id. A bare id has no vocabulary. */
export function parseRef(ref: string): { vocabulary: string | null; id: string } {
  const at = ref.indexOf(':OE-')
  return at > 0 ? { vocabulary: ref.slice(0, at), id: ref.slice(at + 1) } : { vocabulary: null, id: ref }
}

const MATCH_LABEL: Record<string, string> = {
  'skos:exactMatch': 'Same meaning',
  'skos:closeMatch': 'Close in meaning',
  'skos:broadMatch': 'The other idea is broader',
  'skos:narrowMatch': 'The other idea is narrower',
  'skos:relatedMatch': 'Related ideas',
}

export function matchTypeLabel(matchType: string | null | undefined): string {
  return (matchType && MATCH_LABEL[matchType]) || 'Link of an unknown kind'
}

const ALIGN_STATUS: Record<string, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  contested: 'Contested (kept visible on purpose)',
}

export function alignmentStatusLabel(status: string | null | undefined): string {
  return (status && ALIGN_STATUS[status]) || status || 'No status'
}

/** The chip colour class suffix used elsewhere for the same words (see .chip-* in globals.css). */
export function alignmentStatusChip(status: string | null | undefined): string {
  if (status === 'accepted') return 'good'
  if (status === 'contested') return 'critical'
  return 'proposed'
}

const PILE_LABEL: Record<TagPile, string> = {
  'in-conceptbase': 'Has an entry in ConceptBase',
  pending: 'Entry drafted in the unmerged Bio-Core branch',
  'probable-match': 'Probably the same idea as an entry under another name',
  'topic-label': 'Names a whole subject area',
  'no-entry': 'No entry anywhere yet',
  unsorted: 'Not sorted yet',
}

const PILE_HELP: Record<TagPile, string> = {
  'in-conceptbase': 'Compare how each model uses the word with the entry.',
  pending: 'Waits for the branch to merge, then the same comparison.',
  'probable-match': 'A person confirms or rejects the match.',
  'topic-label': 'Can stay a plain tag.',
  'no-entry': 'Needs a drafted entry, or a decision that it stays a plain tag.',
  unsorted: 'A person sorts it.',
}

export const PILE_ORDER: TagPile[] = ['in-conceptbase', 'pending', 'probable-match', 'no-entry', 'topic-label', 'unsorted']

export function pileLabel(p: TagPile): string {
  return PILE_LABEL[p]
}

export function pileHelp(p: TagPile): string {
  return PILE_HELP[p]
}

/** Every stated definition of one concept as a flat list, English first, then other languages; within a language in the order given. */
export function definitionRows(c: MeaningConcept): { lang: string; discipline: string; text: string }[] {
  const langs = Object.keys(c.definitions).sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)))
  const out: { lang: string; discipline: string; text: string }[] = []
  for (const lang of langs) for (const [discipline, text] of Object.entries(c.definitions[lang])) out.push({ lang, discipline, text })
  return out
}

/** Comparisons that name this concept on either side, with the other side's reference and which side this concept is on. */
export function alignmentsFor(id: string, all: MeaningAlignment[]): { alignment: MeaningAlignment; other: { vocabulary: string | null; id: string }; side: 'subject' | 'object' }[] {
  const rows: { alignment: MeaningAlignment; other: { vocabulary: string | null; id: string }; side: 'subject' | 'object' }[] = []
  for (const a of all) {
    const s = parseRef(a.subject)
    const o = parseRef(a.object)
    if (s.id === id) rows.push({ alignment: a, other: o, side: 'subject' })
    else if (o.id === id) rows.push({ alignment: a, other: s, side: 'object' })
  }
  return rows
}

/** Strand guides that cite this concept by id, and model tags that use the same word (not compared yet). */
export function usesFor(id: string, label: string, snap: Pick<MeaningsSnapshot, 'netlogoCitations' | 'netlogoTags'>): { cited: NetlogoCitation[]; sameWordTags: NetlogoTag[] } {
  const cited = snap.netlogoCitations.filter((c) => c.concept === id)
  const sameWordTags = snap.netlogoTags.filter((t) => t.sameWord.includes(id) || t.tag.toLowerCase() === label.toLowerCase())
  return { cited, sameWordTags }
}

/** The pending branch's drafts for the entries that already exist under another id: old id -> new id. This is the mapping the branch itself lacks. */
export function idChanges(pending: MeaningConcept[]): { oldId: string; newId: string; label: string; sameDefinition: boolean }[] {
  return pending.filter((p) => p.replaces).map((p) => ({ oldId: p.replaces as string, newId: p.id, label: p.label, sameDefinition: !!p.sameDefinitionAsReplaced }))
}

export function citationsByOldId(changes: ReturnType<typeof idChanges>, citations: NetlogoCitation[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const ch of changes) m.set(ch.oldId, citations.filter((c) => c.concept === ch.oldId).reduce((n, c) => n + c.count, 0))
  return m
}

export function searchConcepts(concepts: MeaningConcept[], query: string): MeaningConcept[] {
  const q = query.trim().toLowerCase()
  if (!q) return concepts
  return concepts.filter((c) => {
    const alias = Object.values(c.aliases).flat().join(' ')
    const defs = definitionRows(c).map((d) => d.text).join(' ')
    return `${c.label} ${c.id} ${alias} ${defs}`.toLowerCase().includes(q)
  })
}

export function vocabularyShort(v: string | null): string {
  if (!v) return 'No word list'
  return v.replace(/-v\d+\.\d+\.\d+$/, '').replace('OE-INTERDISCIPLINARY', 'Interdisciplinary').replace('BIO-CORE', 'Bio-Core')
}
