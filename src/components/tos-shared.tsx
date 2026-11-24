import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'
import { reviewStatusPlain, type TosModel } from '@/lib/tos-profile'
import { listTosProfiles, loadTosModel, type TosProfileRow } from '@/lib/supabase/tos-profiles'
import { loadReviewProgress } from '@/lib/supabase/tos-edits'
import { progressBadge, type ReviewProgress } from '@/lib/tos-edits'

// Small pieces shared by the three pages of a Theories of Schooling space (migration 256).

/** The roles that may add, change and delete profiles. Same list as is_project_editor in the database (migration 135). */
export const TOS_EDITOR_ROLES = ['owner', 'maintainer', 'editor', 'contributor']

const REVIEW_BUCKET: Record<string, string> = {
  'ai-draft': 'draft',
  'author-reviewed': 'progress',
  'expert-reviewed': 'good',
  'illustrative-example': 'muted',
}

/** One chip that says how far a theory has been checked. Always shown beside a profile. */
export function TosReviewChip({ status }: { status: string | undefined }) {
  const text = reviewStatusPlain(status)
  return (
    <span className={cn('chip', `chip-${REVIEW_BUCKET[status ?? ''] ?? 'muted'}`)} title={text}>
      <span className="dot" />
      {text}
    </span>
  )
}

/** Loads the profiles of a space. */
export function useTosProfiles(supabase: SupabaseClient<Database>, projectId: string) {
  const [rows, setRows] = useState<TosProfileRow[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const reload = useCallback(async () => {
    const res = await listTosProfiles(supabase, projectId)
    setRows(res.data)
    setProblem(res.problem)
  }, [supabase, projectId])
  useEffect(() => {
    setRows(null)
    reload()
  }, [reload])
  return { rows, problem, reload }
}

/** Loads the domain model file that sits next to the Atlas widget. */
export function useTosModel() {
  const [model, setModel] = useState<TosModel | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    loadTosModel().then(
      (m) => alive && setModel(m),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [])
  return { model, failed }
}

/** The event the Atlas page sends after a change was saved, so the badge in the space header counts again. */
export const TOS_PROGRESS_EVENT = 'tos:progress'

/**
 * The badge in the header of a Theories of Schooling space. It replaces the general "Human-Curated" badge, which says the content was made by teachers
 * and researchers. What these spaces hold was sorted by language models, so the badge says how far people have checked it.
 */
export function TosProgressBadge({ supabase, projectId }: { supabase: SupabaseClient<Database>; projectId: string }) {
  const [progress, setProgress] = useState<ReviewProgress | null>(null)
  const load = useCallback(async () => setProgress(await loadReviewProgress(supabase, projectId)), [supabase, projectId])
  useEffect(() => {
    load()
    window.addEventListener(TOS_PROGRESS_EVENT, load)
    return () => window.removeEventListener(TOS_PROGRESS_EVENT, load)
  }, [load])
  const b = progressBadge(progress)
  return (
    <span className={cn('chip', `chip-${b.bucket}`)} title={b.title}>
      <span className="dot" />
      {b.text}
    </span>
  )
}

