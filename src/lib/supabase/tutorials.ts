import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type TutorialRow = Database['public']['Tables']['tutorials']['Row']
export interface TutorialStep {
  title: string
  body: string
}

export interface TutorialWithProject extends TutorialRow {
  project: { name: string; slug: string } | null
}

/**
 * Every tutorial the current user can see -- RLS already does the real
 * access-control work (general tutorials for anyone signed in, project
 * ones for that project's own members), so this is a plain select, not a
 * client-side membership cross-check. Project name/slug is joined in so
 * the picker can group/label by project without a second round trip.
 */
export async function listAvailableTutorials(supabase: Client): Promise<TutorialWithProject[]> {
  const { data } = await supabase
    .from('tutorials')
    .select('*, project:projects(name, slug)')
    .order('sort_order')
  return (data as any) ?? []
}

export function tutorialSteps(tutorial: TutorialRow): TutorialStep[] {
  return (tutorial.steps as TutorialStep[] | null) ?? []
}
