import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

// user_favorite_learning_goals (migration 040) isn't in the generated types
// yet -- cast at the query boundary, same as project_join_rules.

export async function listFavoriteIds(supabase: Client): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await (supabase as any)
    .from('user_favorite_learning_goals')
    .select('data_object_id')
    .eq('user_id', user.id)
  return new Set((data ?? []).map((r: { data_object_id: string }) => r.data_object_id))
}

export async function toggleFavorite(supabase: Client, dataObjectId: string, isFavorite: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }

  if (isFavorite) {
    return (supabase as any)
      .from('user_favorite_learning_goals')
      .delete()
      .eq('user_id', user.id)
      .eq('data_object_id', dataObjectId)
  }
  return (supabase as any)
    .from('user_favorite_learning_goals')
    .insert({ user_id: user.id, data_object_id: dataObjectId })
}
