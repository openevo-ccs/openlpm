import type { LiteraturebaseSnapshotRow } from '@/lib/supabase/literature'

// Researcher-facing analytics (decision 4 of lab_manager/docs/design-notes/
// openlpm-literature-collections-and-analytics-strategy-2026-10-23.md),
// built entirely from real, already-curated data already synced onto
// literaturebase_snapshot -- no new table, no fabricated numbers. Each
// record's full YAML -- including its real `related[]` links -- is
// already cached in the snapshot's own `data` JSONB column (migration
// 109/111), so a collection's relation graph and evidence-strength signal
// are just a read and a tally over data that's already there.
//
// What this deliberately does NOT do: claim to be semantic search. GWDG's
// live model roster has zero embedding-capable models right now (checked
// directly, 2026-10-23, via gwdg-dataset-forge's own GWDGClient.list_models()
// -- not assumed from an older note) -- building real semantic search needs
// an embedding model that doesn't exist in this lab's infrastructure yet.
// What's built instead (LiteratureCollectionsPanel's search box) is an
// honestly-labeled full-text search over title AND the plain-language
// summary, not a relabeled stand-in for the real thing.

export type RelationType = 'supports' | 'contradicts' | 'extends' | 'criticises' | 'replicates' | 'related'

export interface RelationEdge {
  id: string
  from: string // literaturebase_id
  to: string // literaturebase_id -- may point outside the given paper set
  relation: RelationType
  note?: string
}

export interface RelationGraph {
  papers: LiteraturebaseSnapshotRow[]
  externalTitles: Map<string, string> // id -> a short label for a related paper not in this collection
  edges: RelationEdge[]
}

interface RawRelated {
  id?: string
  relation?: string
  note?: string
}

const KNOWN_RELATIONS = new Set<RelationType>(['supports', 'contradicts', 'extends', 'criticises', 'replicates', 'related'])

/** Builds the real relation graph for a set of papers from each record's own `related[]` field (literature-record.schema.json's controlled vocabulary: supports/contradicts/extends/criticises/replicates/related). A target outside the given paper set still gets a smaller "external" node -- it's real curated data worth showing, not noise to filter out. */
export function buildRelationGraph(papers: LiteraturebaseSnapshotRow[]): RelationGraph {
  const byId = new Map(papers.map((p) => [p.id, p]))
  const externalTitles = new Map<string, string>()
  const edges: RelationEdge[] = []

  for (const paper of papers) {
    const raw = (paper.data as Record<string, unknown> | null)?.related
    if (!Array.isArray(raw)) continue
    for (const [i, entry] of (raw as RawRelated[]).entries()) {
      if (!entry.id || !entry.relation || !KNOWN_RELATIONS.has(entry.relation as RelationType)) continue
      if (!byId.has(entry.id) && !externalTitles.has(entry.id)) {
        externalTitles.set(entry.id, entry.id.replace(/^OE-LITERATURE-/, '').replace(/-/g, ' '))
      }
      edges.push({ id: `${paper.id}-${i}`, from: paper.id, to: entry.id, relation: entry.relation as RelationType, note: entry.note })
    }
  }
  return { papers, externalTitles, edges }
}

export type EvidenceLabel = 'thin' | 'consensus-leaning' | 'contested'

export interface EvidenceStrength {
  paperCount: number
  edgeCount: number
  reinforcingCount: number // supports | extends | replicates
  tensionCount: number // contradicts | criticises
  tensionRatio: number | null
  label: EvidenceLabel
}

const TENSION_RELATIONS = new Set<RelationType>(['contradicts', 'criticises'])
const REINFORCING_RELATIONS = new Set<RelationType>(['supports', 'extends', 'replicates'])

/**
 * A transparent heuristic, not a rigorous meta-analysis verdict -- every
 * input it's built from is shown alongside it (edge counts), so it can be
 * inspected rather than taken on faith. 'thin' when there isn't enough
 * real linked evidence within the collection to say anything either way;
 * 'contested' when a meaningful share of the real links are
 * contradicts/criticises; 'consensus-leaning' otherwise.
 */
export function computeEvidenceStrength(graph: RelationGraph): EvidenceStrength {
  const edgeCount = graph.edges.length
  const tensionCount = graph.edges.filter((e) => TENSION_RELATIONS.has(e.relation)).length
  const reinforcingCount = graph.edges.filter((e) => REINFORCING_RELATIONS.has(e.relation)).length
  const tensionRatio = edgeCount > 0 ? tensionCount / edgeCount : null
  let label: EvidenceLabel = 'thin'
  if (edgeCount >= 3) {
    label = tensionRatio !== null && tensionRatio >= 0.25 ? 'contested' : 'consensus-leaning'
  }
  return { paperCount: graph.papers.length, edgeCount, reinforcingCount, tensionCount, tensionRatio, label }
}

export const EVIDENCE_LABEL_TEXT: Record<EvidenceLabel, string> = {
  thin: 'Thin linked evidence',
  'consensus-leaning': 'Consensus-leaning',
  contested: 'Contested',
}
