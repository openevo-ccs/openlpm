import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type PromptExperimentRow = Database['public']['Tables']['prompt_experiments']['Row']

/**
 * Every curriculum item a Notebook has linked as a canonical reference
 * (portfolio_items with target_type='data_object'), resolved against the
 * real lpm_data_objects rows -- the wizard's item pool. Reuses the same
 * FK-reference pattern portfolios.ts's getPortfolioGraph already
 * establishes, just narrowed to data_objects since a schema_element (a bare
 * concept, not a curriculum item) has no basiskonzeptbezug content to build
 * a prompt from.
 */
export async function getPortfolioCurriculumItems(supabase: Client, portfolioId: string) {
  const { data: items } = await supabase
    .from('portfolio_items')
    .select('target_id')
    .eq('portfolio_id', portfolioId)
    .eq('target_type', 'data_object')

  const ids = (items ?? []).map((i) => i.target_id)
  if (ids.length === 0) return []

  const { data: objects } = await supabase.from('lpm_data_objects').select('*').in('id', ids)
  return objects ?? []
}

export async function listPromptExperiments(supabase: Client, portfolioId: string) {
  const { data } = await supabase
    .from('prompt_experiments')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createPromptExperiment(
  supabase: Client,
  values: Database['public']['Tables']['prompt_experiments']['Insert']
) {
  return supabase.from('prompt_experiments').insert(values).select().single()
}

export async function updatePromptExperiment(
  supabase: Client,
  id: string,
  values: Database['public']['Tables']['prompt_experiments']['Update']
) {
  return supabase
    .from('prompt_experiments')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function deletePromptExperiment(supabase: Client, id: string) {
  return supabase.from('prompt_experiments').delete().eq('id', id)
}
