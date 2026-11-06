// The review state of one reviewable item (a part, a thread, a theory, a link), worked out from its review assignments.
// It answers one question for a reader: has anyone outside the lab looked at this?
//
// The ladder (decided by Dustin on 2026-10-28, design note openlpm-four-space-review-2026-10-28):
//   ai-draft      no review has been assigned yet
//   under-review  a reviewer is assigned and no review is complete
//   reviewed      at least one review is complete and the completed reviews agree
//   contested     two completed reviews disagree (one accepts, another asks for changes or rejects)

export type ReviewState = 'ai-draft' | 'under-review' | 'reviewed' | 'contested'

export interface ReviewRowLike {
  status: 'pending' | 'in_progress' | 'completed'
  recommendation: 'accept' | 'reject' | 'revise' | 'major_revision' | null
  reviewer_id?: string | null
}

export interface ReviewSummary {
  state: ReviewState
  /** Number of completed reviews, counted once per reviewer when the reviewer is known. */
  reviewers: number
}

export function reviewSummary(rows: ReviewRowLike[] | undefined): ReviewSummary {
  if (!rows || rows.length === 0) return { state: 'ai-draft', reviewers: 0 }
  const done = rows.filter((r) => r.status === 'completed')
  if (done.length === 0) return { state: 'under-review', reviewers: 0 }
  const reviewerKeys = new Set(done.map((r, i) => r.reviewer_id ?? `row-${i}`))
  const accepts = done.some((r) => r.recommendation === 'accept')
  const asksChange = done.some((r) => r.recommendation === 'reject' || r.recommendation === 'revise' || r.recommendation === 'major_revision')
  return { state: accepts && asksChange ? 'contested' : 'reviewed', reviewers: reviewerKeys.size }
}

export function groupByTarget<T extends { reviewable_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const list = m.get(r.reviewable_id) ?? []
    list.push(r)
    m.set(r.reviewable_id, list)
  }
  return m
}

export function reviewStateLabel(summary: ReviewSummary, lang: 'en' | 'de' = 'en'): string {
  const n = summary.reviewers
  if (lang === 'de') {
    if (summary.state === 'ai-draft') return 'KI-Entwurf, noch ohne fachliche Prüfung'
    if (summary.state === 'under-review') return 'In Prüfung'
    if (summary.state === 'contested') return 'Geprüft, Gutachten widersprechen sich'
    return `Geprüft von ${n} ${n === 1 ? 'Gutachter/in' : 'Gutachter/innen'}`
  }
  if (summary.state === 'ai-draft') return 'AI draft, no expert review yet'
  if (summary.state === 'under-review') return 'Under review'
  if (summary.state === 'contested') return 'Reviewed, reviewers disagree'
  return `Reviewed by ${n} ${n === 1 ? 'reviewer' : 'reviewers'}`
}
