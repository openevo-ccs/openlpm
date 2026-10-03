import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ProjectRow } from './projects'

type Client = SupabaseClient<Database>

// project_kind/view_audience/view_language (migration 095) aren't in the
// generated types yet -- cast at the query boundary, same convention as
// project_kind/student_view_template/color elsewhere in this file set.

/** Every curriculum-repository-custom-view row nested directly under this Curriculum Repository. */
export async function listCustomViews(supabase: Client, parentProjectId: string): Promise<ProjectRow[]> {
  const { data } = await (supabase as any)
    .from('projects')
    .select('*')
    .eq('parent_project_id', parentProjectId)
    .eq('project_kind', 'curriculum-repository-custom-view')
    .order('created_at', { ascending: true })
  return data ?? []
}

export interface NewCustomView {
  parentProjectId: string
  slug: string
  name: string
  audience: string | null
  language: string | null
  epistemicStatus: ProjectRow['epistemic_status']
  createdBy: string | null
}

/**
 * Creates a new Custom View as an ordinary `projects` row -- parent_project_id
 * points at the real Curriculum Repository it's a view of, project_kind marks
 * it so project-layout.tsx gives it the same reduced sidebar. Private by
 * default: Dustin's own decision (openlpm-curriculum-context-modeling-
 * 2026-10-03.md) was that a view keeps its own separate membership rather
 * than inheriting the parent's, so it shouldn't be publicly listable until
 * its owner deliberately opens it up via its own Settings page. The usual
 * handle_new_project trigger (migration 015) auto-enrolls the creator as its
 * owner, independent of the parent's own membership.
 */
export async function createCustomView(supabase: Client, input: NewCustomView) {
  const { data, error } = await (supabase as any)
    .from('projects')
    .insert({
      slug: input.slug,
      name: input.name,
      parent_project_id: input.parentProjectId,
      project_kind: 'curriculum-repository-custom-view',
      view_audience: input.audience,
      view_language: input.language,
      working_languages: input.language ? [input.language] : [],
      epistemic_status: input.epistemicStatus,
      is_private: true,
      maturity: 'established',
      created_by: input.createdBy,
    })
    .select()
    .single()
  return { data: data as ProjectRow | null, error }
}
