import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export interface PortfolioNode {
  id: string
  label: string
  kind: 'canonical' | 'private'
  subtype: string // schema_element/data_object's own type, or the private node_type
  annotation: string | null
  posX: number | null
  posY: number | null
}

export interface PortfolioEdge {
  id: string
  source: string
  target: string
  label: string | null
  rationale: string | null
}

/**
 * Loads one portfolio's full graph: canonical items (referenced by FK, never
 * copied -- resolved here against lpm_schema_elements/lpm_data_objects),
 * private nodes, and the links between either kind. Shaped for both the
 * Cytoscape graph view and the card view, which use the same data.
 */
export async function getPortfolioGraph(supabase: Client, portfolioId: string) {
  const [{ data: items }, { data: privateNodes }, { data: links }] = await Promise.all([
    supabase.from('portfolio_items').select('*').eq('portfolio_id', portfolioId),
    supabase.from('portfolio_private_nodes').select('*').eq('portfolio_id', portfolioId),
    supabase.from('portfolio_links').select('*').eq('portfolio_id', portfolioId),
  ])

  const schemaElementIds = (items ?? []).filter((i) => i.target_type === 'schema_element').map((i) => i.target_id)
  const dataObjectIds = (items ?? []).filter((i) => i.target_type === 'data_object').map((i) => i.target_id)

  const [{ data: schemaElements }, { data: dataObjects }] = await Promise.all([
    schemaElementIds.length
      ? supabase.from('lpm_schema_elements').select('id, label, element_type').in('id', schemaElementIds)
      : Promise.resolve({ data: [] as { id: string; label: string; element_type: string }[] }),
    dataObjectIds.length
      ? supabase.from('lpm_data_objects').select('id, title, object_type').in('id', dataObjectIds)
      : Promise.resolve({ data: [] as { id: string; title: string; object_type: string }[] }),
  ])

  const schemaById = new Map((schemaElements ?? []).map((s) => [s.id, s]))
  const objectById = new Map((dataObjects ?? []).map((o) => [o.id, o]))

  const nodes: PortfolioNode[] = []

  for (const item of items ?? []) {
    const resolved =
      item.target_type === 'schema_element' ? schemaById.get(item.target_id) : objectById.get(item.target_id)
    nodes.push({
      id: `item-${item.id}`,
      label: resolved ? ('label' in resolved ? resolved.label : resolved.title) : '(deleted canonical item)',
      kind: 'canonical',
      subtype: resolved ? ('element_type' in resolved ? resolved.element_type : resolved.object_type) : 'unknown',
      annotation: item.custom_annotation,
      posX: item.pos_x,
      posY: item.pos_y,
    })
  }

  for (const node of privateNodes ?? []) {
    nodes.push({
      id: `priv-${node.id}`,
      label: node.label,
      kind: 'private',
      subtype: node.node_type,
      annotation: node.content,
      posX: node.pos_x,
      posY: node.pos_y,
    })
  }

  const edges: PortfolioEdge[] = (links ?? []).map((link) => ({
    id: link.id,
    source: link.from_item_id ? `item-${link.from_item_id}` : `priv-${link.from_private_id}`,
    target: link.to_item_id ? `item-${link.to_item_id}` : `priv-${link.to_private_id}`,
    label: link.label,
    rationale: link.rationale,
  }))

  return { nodes, edges, itemCount: items?.length ?? 0, privateNodeCount: privateNodes?.length ?? 0 }
}

// The "Shared (explicit grants)" visibility option (portfolios-page.tsx) had
// no way to actually grant anyone access -- portfolio_shares (which RLS
// already checks, migration 004) had zero UI anywhere. Closes that: the
// owner names a grantee by email (matching how project invites work),
// resolved against the users table rather than requiring a raw user id.

export interface ShareGrant {
  id: string
  can_review: boolean
  user: { id: string; name: string; email: string }
}

export async function listShares(supabase: Client, portfolioId: string): Promise<ShareGrant[]> {
  const { data } = await supabase
    .from('portfolio_shares')
    .select('id, can_review, user:users(id, name, email)')
    .eq('portfolio_id', portfolioId)
  return (data ?? []) as unknown as ShareGrant[]
}

export async function addShare(supabase: Client, portfolioId: string, email: string, canReview: boolean) {
  const { data: user, error: lookupError } = await supabase.from('users').select('id').ilike('email', email.trim()).maybeSingle()
  if (lookupError) return { error: lookupError }
  if (!user) return { error: { message: `No OpenLPM account found for "${email}" yet -- they need to sign in at least once first.` } }
  return supabase.from('portfolio_shares').insert({ portfolio_id: portfolioId, user_id: user.id, can_review: canReview })
}

export async function removeShare(supabase: Client, shareId: string) {
  return supabase.from('portfolio_shares').delete().eq('id', shareId)
}
