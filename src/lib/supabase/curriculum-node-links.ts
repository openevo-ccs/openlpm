import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { REVIEW_STATUS_LABEL, type Lang, type TreeNode } from './curriculum-structure'

type Client = SupabaseClient<Database>

// Stage-to-topic links (migration 225): a stage of a project space (one of the four synthetic LPM spaces) linked to a topic or subtopic of a
// Curriculum Repository's structure overview, with the concepts the two share. Every seeded link is an LLM synthesized draft awaiting review.
// Row level security shows the rows of a space only to its members (and admins). A viewer who belongs to none of the spaces gets one
// count per node from curriculum_repository_node_link_counts(), with no space name and no stage.

export interface NodeLink {
  id: string
  nodeId: string
  projectId: string
  projectName: string
  stageTitle: string
  gradeBand: string | null
  relationType: string
  /** 0 to 1: the share of the stage's concept weight that the topic shares. */
  share: number | null
  sharedConcepts: string[]
  reviewStatus: string
}

export interface NodeLinkTotals {
  /** Links the viewer may see in detail (their own spaces), at this node and everything below it. */
  mine: number
  /** Links from spaces the viewer does not belong to (a count only), at this node and everything below it. */
  others: number
  ownMine: number
  ownOthers: number
}

export interface NodeLinkData {
  mine: Map<string, NodeLink[]>
  others: Map<string, number>
  totals: Map<string, NodeLinkTotals>
}

export const EMPTY_NODE_LINKS: NodeLinkData = { mine: new Map(), others: new Map(), totals: new Map() }

interface RawLinkRow {
  id: string
  node_id: string
  project_id: string
  relation_type: string | null
  share: number | string | null
  shared_concepts: unknown
  review_status: string | null
  project?: { name: string | null } | null
  stage?: { title: string | null; grade_band: string | null } | null
}

/** Concept names from the stored JSON: a list of strings. Anything else is ignored. */
export function conceptNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
}

/** Share as a number between 0 and 1, or null. The database returns numeric columns as numbers, and a string if it was ever sent as one. */
export function parseShare(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null
}

export function sharePercent(share: number | null): number | null {
  return share == null ? null : Math.round(share * 100)
}

export function toNodeLink(row: RawLinkRow): NodeLink {
  return {
    id: row.id,
    nodeId: row.node_id,
    projectId: row.project_id,
    projectName: row.project?.name || '?',
    stageTitle: row.stage?.title || '?',
    gradeBand: row.stage?.grade_band ?? null,
    relationType: row.relation_type ?? 'proposed_covers',
    share: parseShare(row.share),
    sharedConcepts: conceptNames(row.shared_concepts),
    reviewStatus: row.review_status ?? 'ai-draft',
  }
}

/** Groups links by node. Inside a node: by space name, then by the share (highest first), then by stage title. */
export function groupLinksByNode(links: NodeLink[]): Map<string, NodeLink[]> {
  const out = new Map<string, NodeLink[]>()
  for (const l of links) {
    const list = out.get(l.nodeId) ?? []
    list.push(l)
    out.set(l.nodeId, list)
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.projectName.localeCompare(b.projectName) || (b.share ?? 0) - (a.share ?? 0) || a.stageTitle.localeCompare(b.stageTitle))
  }
  return out
}

/** Link counts per node, rolled up to every ancestor (the same way goal counts are). */
export function linkTotals(roots: TreeNode[], mine: Map<string, NodeLink[]>, others: Map<string, number>): Map<string, NodeLinkTotals> {
  const out = new Map<string, NodeLinkTotals>()
  const walk = (t: TreeNode): NodeLinkTotals => {
    const ownMine = mine.get(t.node.id)?.length ?? 0
    const ownOthers = others.get(t.node.id) ?? 0
    const sum: NodeLinkTotals = { mine: ownMine, others: ownOthers, ownMine, ownOthers }
    for (const c of t.children) {
      const sub = walk(c)
      sum.mine += sub.mine
      sum.others += sub.others
    }
    out.set(t.node.id, sum)
    return sum
  }
  roots.forEach(walk)
  return out
}

export function buildNodeLinkData(roots: TreeNode[], links: NodeLink[], others: Map<string, number>): NodeLinkData {
  const mine = groupLinksByNode(links)
  return { mine, others, totals: linkTotals(roots, mine, others) }
}

const RELATION_LABEL: Record<string, { de: string; en: string }> = {
  proposed_covers: { de: 'Passt gut', en: 'Fits well' },
  proposed_partly: { de: 'Passt teilweise', en: 'Fits in part' },
}

/** Plain-words label of a relation. An unknown value shows as it is, so a new kind of link still appears. */
export function relationLabel(relationType: string, lang: Lang): string {
  return RELATION_LABEL[relationType]?.[lang] ?? relationType.replace(/^proposed_/, '').replace(/_/g, ' ')
}

/** The tag text of a link. Seeded links say exactly "LLM synthesized draft, awaiting review" (German: "LLM-erzeugter Entwurf, Prüfung ausstehend"). */
export function linkTag(reviewStatus: string, lang: Lang): string {
  return (REVIEW_STATUS_LABEL[reviewStatus] ?? REVIEW_STATUS_LABEL['ai-draft'])[lang]
}

/** Links of the spaces the viewer belongs to, for the nodes of one repository. Returns nothing (and does not throw) while the table does not exist yet. */
export async function listNodeLinks(supabase: Client, repositoryProjectId: string): Promise<NodeLink[]> {
  const rows: RawLinkRow[] = []
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('curriculum_repository_node_links')
        .select('id, node_id, project_id, relation_type, share, shared_concepts, review_status, project:projects(name), stage:lpm_data_objects(title, grade_band), node:curriculum_repository_structure_nodes!inner(project_id)')
        .eq('node.project_id', repositoryProjectId)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) return []
      rows.push(...((data ?? []) as unknown as RawLinkRow[]))
      if (!data || data.length < 1000) break
    }
  } catch {
    return []
  }
  return rows.map(toNodeLink)
}

/** Links per node from spaces the viewer does not belong to: counts only. Returns nothing while the function does not exist yet. */
export async function listOtherSpaceLinkCounts(supabase: Client, repositoryProjectId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const { data, error } = await (supabase as any).rpc('curriculum_repository_node_link_counts', { p_repository_project_id: repositoryProjectId })
    if (error) return out
    for (const row of (data ?? []) as { node_id: string; links: number }[]) out.set(row.node_id, row.links)
  } catch {
    return out
  }
  return out
}
