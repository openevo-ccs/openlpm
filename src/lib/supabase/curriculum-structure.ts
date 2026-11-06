import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// The structure overview of a Curriculum Repository (migration 216): how each curriculum document is organised, in our own words, with
// German and English labels. One row per node (edition > grade band > topic > subtopic or unit). Goal counts per project come from
// curriculum_repository_node_goals, which a viewer sees only for projects they belong to.
export type StructureNode = Database['public']['Tables']['curriculum_repository_structure_nodes']['Row']

export type Lang = 'de' | 'en'

export interface NodeGoalCount {
  projectId: string
  projectName: string
  goals: number
}

export interface TreeNode {
  node: StructureNode
  children: TreeNode[]
  /** Goals per project under this node and everything below it. */
  goals: NodeGoalCount[]
  /** Number of nodes at or below this one that carry the given level (used for the "N units" lines). */
  descendants: number
}

export async function listStructureNodes(supabase: Client, repositoryProjectId: string): Promise<StructureNode[]> {
  const rows: StructureNode[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('curriculum_repository_structure_nodes')
      .select('*')
      .eq('project_id', repositoryProjectId)
      .order('sort_order', { ascending: true })
      .order('node_key', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

/** Goal links for these nodes, grouped per node and project, with the project's name. RLS limits it to projects the viewer belongs to. */
export async function listNodeGoalCounts(supabase: Client, nodeIds: string[]): Promise<Map<string, NodeGoalCount[]>> {
  const out = new Map<string, NodeGoalCount[]>()
  if (nodeIds.length === 0) return out
  const counts = new Map<string, number>()
  const names = new Map<string, string>()
  for (let i = 0; i < nodeIds.length; i += 200) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('curriculum_repository_node_goals')
        .select('node_id, project_id, project:projects(name)')
        .in('node_id', nodeIds.slice(i, i + 200))
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      for (const row of (data ?? []) as unknown as { node_id: string; project_id: string; project: { name: string } | null }[]) {
        const k = `${row.node_id}|${row.project_id}`
        counts.set(k, (counts.get(k) ?? 0) + 1)
        if (row.project?.name) names.set(row.project_id, row.project.name)
      }
      if (!data || data.length < 1000) break
    }
  }
  for (const [k, goals] of counts) {
    const [nodeId, projectId] = k.split('|')
    const list = out.get(nodeId) ?? []
    list.push({ projectId, projectName: names.get(projectId) ?? '?', goals })
    out.set(nodeId, list)
  }
  return out
}

function addGoals(into: Map<string, NodeGoalCount>, from: NodeGoalCount[]) {
  for (const g of from) {
    const cur = into.get(g.projectId)
    if (cur) cur.goals += g.goals
    else into.set(g.projectId, { ...g })
  }
}

/** Builds the forest from flat rows. Orphans (parent not visible) are dropped; goal counts roll up to every ancestor. */
export function buildTree(nodes: StructureNode[], goalsByNode: Map<string, NodeGoalCount[]>): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  for (const n of nodes) byId.set(n.id, { node: n, children: [], goals: [], descendants: 0 })
  const roots: TreeNode[] = []
  for (const t of byId.values()) {
    const parent = t.node.parent_id ? byId.get(t.node.parent_id) : null
    if (parent) parent.children.push(t)
    else if (!t.node.parent_id) roots.push(t)
  }
  const sortKids = (t: TreeNode) => {
    t.children.sort((a, b) => a.node.sort_order - b.node.sort_order || a.node.node_key.localeCompare(b.node.node_key))
    t.children.forEach(sortKids)
  }
  roots.sort((a, b) => (a.node.subject ?? '').localeCompare(b.node.subject ?? '') || a.node.node_key.localeCompare(b.node.node_key))
  roots.forEach(sortKids)
  const roll = (t: TreeNode): Map<string, NodeGoalCount> => {
    const sum = new Map<string, NodeGoalCount>()
    addGoals(sum, goalsByNode.get(t.node.id) ?? [])
    let desc = 0
    for (const c of t.children) {
      addGoals(sum, [...roll(c).values()])
      desc += 1 + c.descendants
    }
    t.goals = [...sum.values()].sort((a, b) => a.projectName.localeCompare(b.projectName))
    t.descendants = desc
    return sum
  }
  roots.forEach(roll)
  return roots
}

export function nodeLabel(node: StructureNode, lang: Lang): { text: string; fellBack: boolean } {
  const wanted = lang === 'de' ? node.label_de : node.label_en
  if (wanted) return { text: wanted, fellBack: false }
  return { text: node.label_de ?? node.label_en ?? node.node_key, fellBack: true }
}

export function nodeSummary(node: StructureNode, lang: Lang): { text: string | null; fellBack: boolean } {
  const wanted = lang === 'de' ? node.summary_de : node.summary_en
  if (wanted) return { text: wanted, fellBack: false }
  const other = lang === 'de' ? node.summary_en : node.summary_de
  return { text: other, fellBack: other != null }
}

/** Ids of nodes to keep for a search: every node whose label or summary (either language) contains all words, plus their ancestors and descendants. */
export function searchMatches(roots: TreeNode[], query: string): Set<string> | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const keep = new Set<string>()
  const hay = (n: StructureNode) =>
    [n.label_de, n.label_en, n.summary_de, n.summary_en, n.subject, n.grade_band].filter(Boolean).join(' ').toLowerCase()
  const addAll = (t: TreeNode) => {
    keep.add(t.node.id)
    t.children.forEach(addAll)
  }
  const visit = (t: TreeNode, trail: TreeNode[]): void => {
    if (words.every((w) => hay(t.node).includes(w))) {
      trail.forEach((a) => keep.add(a.node.id))
      addAll(t)
    }
    t.children.forEach((c) => visit(c, [...trail, t]))
  }
  roots.forEach((r) => visit(r, []))
  return keep
}

export const REVIEW_STATUS_LABEL: Record<string, { de: string; en: string }> = {
  'ai-draft': { de: 'LLM-erzeugter Entwurf, Prüfung ausstehend', en: 'LLM synthesized draft, awaiting review' },
  'checked-against-source': { de: 'Mit der Quelle abgeglichen', en: 'Checked against the source' },
  'expert-reviewed': { de: 'Von Fachleuten geprüft', en: 'Reviewed by an expert' },
}

// ---- Review in the app (Dustin, 2026-11-02: experts such as Susan review and curate here, not in a PDF or a chat) ----

export const REVIEWED = 'expert-reviewed'

export type NodeTextPatch = Partial<Pick<StructureNode, 'label_de' | 'label_en' | 'summary_de' | 'summary_en' | 'review_note'>>

/** Name to record when someone marks a node reviewed: their profile name, else their email. */
export async function currentReviewerName(supabase: Client): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'unknown'
  const { data } = await supabase.from('users').select('name, email').eq('id', user.id).maybeSingle()
  return data?.name || data?.email || user.email || 'unknown'
}

/** Saves edited texts. A node that was reviewed goes back to ai-draft when its text changes, because the review no longer covers the new text. */
export async function saveNodeTexts(supabase: Client, node: StructureNode, patch: NodeTextPatch, markReviewed: boolean, reviewer: string): Promise<{ node: StructureNode | null; error: string | null }> {
  const changed = (Object.keys(patch) as (keyof NodeTextPatch)[]).some((k) => k !== 'review_note' && (patch[k] ?? null) !== (node[k] ?? null))
  const update: Database['public']['Tables']['curriculum_repository_structure_nodes']['Update'] = { ...patch }
  if (markReviewed) {
    update.review_status = REVIEWED
    update.reviewed_by = reviewer
    update.reviewed_on = new Date().toISOString().slice(0, 10)
  } else if (changed && node.review_status === REVIEWED) {
    update.review_status = 'ai-draft'
    update.reviewed_by = null
    update.reviewed_on = null
  }
  const { data, error } = await supabase.from('curriculum_repository_structure_nodes').update(update).eq('id', node.id).select('*').maybeSingle()
  return { node: data ?? null, error: error?.message ?? (data ? null : 'Nothing was saved. Your role may not allow editing here.') }
}

export async function reopenNode(supabase: Client, node: StructureNode): Promise<{ node: StructureNode | null; error: string | null }> {
  const { data, error } = await supabase
    .from('curriculum_repository_structure_nodes')
    .update({ review_status: 'ai-draft', reviewed_by: null, reviewed_on: null })
    .eq('id', node.id)
    .select('*')
    .maybeSingle()
  return { node: data ?? null, error: error?.message ?? (data ? null : 'Nothing was saved.') }
}

/** Nodes that still await review (plus their ancestors), or that are reviewed (plus ancestors). Leaves editions and bands out of the count. */
export function reviewFilter(roots: TreeNode[], wanted: 'open' | 'reviewed'): Set<string> {
  const keep = new Set<string>()
  const visit = (t: TreeNode, trail: TreeNode[]) => {
    const countable = t.node.level !== 'edition' && t.node.level !== 'grade_band'
    const reviewed = t.node.review_status === REVIEWED
    if (countable && (wanted === 'reviewed' ? reviewed : !reviewed)) {
      trail.forEach((a) => keep.add(a.node.id))
      keep.add(t.node.id)
    }
    t.children.forEach((c) => visit(c, [...trail, t]))
  }
  roots.forEach((r) => visit(r, []))
  return keep
}

/** Reviewed and total counts of the topics, subtopics and units at or below a node. */
export function reviewCounts(t: TreeNode): { reviewed: number; total: number } {
  let reviewed = 0
  let total = 0
  const walk = (x: TreeNode) => {
    if (x.node.level !== 'edition' && x.node.level !== 'grade_band') {
      total += 1
      if (x.node.review_status === REVIEWED) reviewed += 1
    }
    x.children.forEach(walk)
  }
  walk(t)
  return { reviewed, total }
}
