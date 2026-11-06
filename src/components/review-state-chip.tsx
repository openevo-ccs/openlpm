import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'
import { groupByTarget, reviewStateLabel, reviewSummary, type ReviewRowLike, type ReviewSummary } from '@/lib/review-state'

type ReviewableType = Database['public']['Tables']['peer_review_assignments']['Row']['reviewable_type']

const BUCKET: Record<ReviewSummary['state'], string> = {
  'ai-draft': 'draft',
  'under-review': 'progress',
  reviewed: 'good',
  contested: 'critical',
}

/** One chip that says whether anyone outside the lab has reviewed an item. Shown next to the item's own status ("accepted", "proposed"). */
export function ReviewStateChip({ summary, lang = 'en' }: { summary: ReviewSummary; lang?: 'en' | 'de' }) {
  return (
    <span className={cn('chip', `chip-${BUCKET[summary.state]}`)} title={reviewStateLabel(summary, lang)}>
      <span className="dot" />
      {reviewStateLabel(summary, lang)}
    </span>
  )
}

/** Loads the review assignments of one project and one kind of item, and returns a lookup from item id to its review summary. */
export function useReviewSummaries(supabase: SupabaseClient<Database>, projectId: string, reviewableType: ReviewableType) {
  const [byTarget, setByTarget] = useState<Map<string, ReviewRowLike[]>>(new Map())
  useEffect(() => {
    let cancelled = false
    supabase
      .from('peer_review_assignments')
      .select('reviewable_id, status, recommendation, reviewer_id')
      .eq('project_id', projectId)
      .eq('reviewable_type', reviewableType)
      .then(({ data }) => {
        if (!cancelled) setByTarget(groupByTarget(data ?? []))
      })
    return () => {
      cancelled = true
    }
  }, [supabase, projectId, reviewableType])
  return (id: string): ReviewSummary => reviewSummary(byTarget.get(id))
}
