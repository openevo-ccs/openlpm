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

// user_favorite_methods (migration 077) -- real feedback 7b32d01c (Susan
// Hanisch, 2026-10-02): "add possibility to tag individual methods as
// favorits." A teaching method (prompt-builder.tsx's options.methods) is a
// plain string, not a row with an id, so method_key IS that string --
// same convention as cfg.methoden already storing the exact option text.

export async function listFavoriteMethodKeys(supabase: Client): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await (supabase as any)
    .from('user_favorite_methods')
    .select('method_key')
    .eq('user_id', user.id)
  return new Set((data ?? []).map((r: { method_key: string }) => r.method_key))
}

export async function toggleFavoriteMethod(supabase: Client, methodKey: string, isFavorite: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }

  if (isFavorite) {
    return (supabase as any)
      .from('user_favorite_methods')
      .delete()
      .eq('user_id', user.id)
      .eq('method_key', methodKey)
  }
  return (supabase as any)
    .from('user_favorite_methods')
    .insert({ user_id: user.id, method_key: methodKey })
}

// user_favorite_goal_methods (migration 119) -- real feedback 3f22dcd5
// (Susan Hanisch, 2026-10-09): favoriting the specific method SUGGESTION
// shown on one Lernziel, not the method category in general (that's what
// user_favorite_methods above is still for -- the Lernziele sidebar's
// filter checkboxes and the Prompt Generator's general methods checklist
// are both unaffected by this). Keys are composite
// `${data_object_id}::${method_key}` strings so the UI can check
// membership with one Set lookup, same ergonomic as listFavoriteIds.

function goalMethodKey(dataObjectId: string, methodKey: string) {
  return `${dataObjectId}::${methodKey}`
}

export async function listFavoriteGoalMethods(supabase: Client): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await (supabase as any)
    .from('user_favorite_goal_methods')
    .select('data_object_id, method_key')
    .eq('user_id', user.id)
  return new Set((data ?? []).map((r: { data_object_id: string; method_key: string }) => goalMethodKey(r.data_object_id, r.method_key)))
}

export async function toggleFavoriteGoalMethod(supabase: Client, dataObjectId: string, methodKey: string, isFavorite: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Sign in required') }

  if (isFavorite) {
    return (supabase as any)
      .from('user_favorite_goal_methods')
      .delete()
      .eq('user_id', user.id)
      .eq('data_object_id', dataObjectId)
      .eq('method_key', methodKey)
  }
  return (supabase as any)
    .from('user_favorite_goal_methods')
    .insert({ user_id: user.id, data_object_id: dataObjectId, method_key: methodKey })
}

/** Every (learning goal, method) favorite the user has among a given set of learning goal ids -- the Prompt Generator's "favorites relevant to your selection" lookup (feedback 3f22dcd5). */
export async function listFavoriteGoalMethodsFor(supabase: Client, dataObjectIds: string[]): Promise<{ data_object_id: string; method_key: string }[]> {
  if (dataObjectIds.length === 0) return []
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await (supabase as any)
    .from('user_favorite_goal_methods')
    .select('data_object_id, method_key')
    .eq('user_id', user.id)
    .in('data_object_id', dataObjectIds)
  return data ?? []
}

export { goalMethodKey }
