import type { createClient } from '@/lib/supabase/client'
import type { BaseRepoKey } from '@/lib/supabase/base-repo-explorer'
import { sameValue } from '@/lib/base-repo-edit-fields'

// Thumbs-up and flag on single fields of a Base Repo record (feedback 1551a6e1, Susan Hanisch 2026-11-25; migration 259).
// Each decision is a row of its own, so the table is a log. The latest row of a field counts, and a 'cleared' row takes the
// thumbs-up or flag away. An approval stores the text it was given to (value_seen) and counts only while the field still says that.

type Client = ReturnType<typeof createClient>

export type FieldVerdict = 'approved' | 'flagged' | 'cleared'

export interface FieldReview {
  id: string
  base_repo: BaseRepoKey
  record_id: string
  field_path: string
  verdict: FieldVerdict
  value_seen: unknown
  note: string | null
  reviewed_by: string | null
  reviewed_at: string
  exported_at: string | null
  export_batch: string | null
  /** Filled in by listFieldReviews: the reviewer's name or email. */
  reviewer_name?: string
}

const PAGE_SIZE = 1000

/** Every field decision of one base, oldest first. `available` is false while migration 259 is not pushed. */
export async function listFieldReviews(supabase: Client, repoKey: BaseRepoKey): Promise<{ reviews: FieldReview[]; available: boolean }> {
  for (const withNames of [true, false]) {
    const all: FieldReview[] = []
    let failed = false
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (supabase as any)
        .from('base_repo_field_reviews')
        .select(withNames ? '*, reviewer:users!base_repo_field_reviews_reviewed_by_fkey(name, email)' : '*')
        .eq('base_repo', repoKey)
        .order('reviewed_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) { failed = true; break }
      const page = (data ?? []) as any[]
      for (const r of page) all.push({ ...r, reviewer_name: r.reviewer?.name ?? r.reviewer?.email ?? undefined })
      if (page.length < PAGE_SIZE) break
    }
    if (!failed) return { reviews: all, available: true }
  }
  return { reviews: [], available: false }
}

/** The latest decision of each field of one record. A 'cleared' row removes the field. The rows can come in any order. */
export function latestReviewsForRecord(reviews: FieldReview[], recordId: string): Map<string, FieldReview> {
  const mine = reviews.filter((r) => r.record_id === recordId).sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at) || a.id.localeCompare(b.id))
  const out = new Map<string, FieldReview>()
  for (const r of mine) {
    if (r.verdict === 'cleared') out.delete(r.field_path)
    else out.set(r.field_path, r)
  }
  return out
}

export type FieldReviewState =
  | { kind: 'none' }
  | { kind: 'approved'; review: FieldReview }
  /** Approved earlier, but the field says something else now. */
  | { kind: 'approved-changed'; review: FieldReview }
  | { kind: 'flagged'; review: FieldReview }

/** What the thumbs-up and flag show for one field, given the text the field holds now. */
export function fieldReviewState(latest: FieldReview | undefined, current: unknown): FieldReviewState {
  if (!latest) return { kind: 'none' }
  if (latest.verdict === 'flagged') return { kind: 'flagged', review: latest }
  return sameValue(latest.value_seen, current) ? { kind: 'approved', review: latest } : { kind: 'approved-changed', review: latest }
}

/** The fields of one record that carry a flag now. */
export function flaggedPaths(reviews: FieldReview[], recordId: string): string[] {
  return Array.from(latestReviewsForRecord(reviews, recordId).values()).filter((r) => r.verdict === 'flagged').map((r) => r.field_path)
}

/**
 * The texts a person has approved, as a map from a path such as "description.de" to the approved text. It has the same shape as
 * savedTextsFromLog, so the draft tag can treat an approved text like a text a person saved: the tag goes away while the field still
 * says exactly what was approved.
 */
export function approvedTexts(reviews: FieldReview[], recordId: string): Map<string, unknown> {
  const out = new Map<string, unknown>()
  for (const [path, r] of latestReviewsForRecord(reviews, recordId)) if (r.verdict === 'approved') out.set(path, r.value_seen)
  return out
}

/** Approvals not yet written into the source repo: the latest decision of a field is an approval and has no export mark. */
export function pendingApprovals(reviews: FieldReview[]): FieldReview[] {
  const byRecord = new Map<string, FieldReview[]>()
  for (const r of reviews) byRecord.set(`${r.base_repo}\u0000${r.record_id}`, [...(byRecord.get(`${r.base_repo}\u0000${r.record_id}`) ?? []), r])
  const out: FieldReview[] = []
  for (const list of byRecord.values()) {
    for (const r of latestReviewsForRecord(list, list[0].record_id).values()) if (r.verdict === 'approved' && !r.exported_at) out.push(r)
  }
  return out.sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at))
}

/** Saves one decision. Returns an error message, or null when it was saved. */
export async function saveFieldReview(
  supabase: Client,
  args: { repoKey: BaseRepoKey; recordId: string; userId: string; path: string; verdict: FieldVerdict; valueSeen: unknown; note?: string }
): Promise<string | null> {
  const { error } = await (supabase as any).from('base_repo_field_reviews').insert({
    base_repo: args.repoKey,
    record_id: args.recordId,
    field_path: args.path,
    verdict: args.verdict,
    value_seen: args.valueSeen === undefined ? null : args.valueSeen,
    note: args.note?.trim() || null,
    reviewed_by: args.userId,
  })
  return error ? error.message : null
}

/** Marks approvals as written into the source repo. */
export async function markApprovalsSentBack(supabase: Client, ids: string[], batch: string): Promise<string | null> {
  if (ids.length === 0) return null
  const { error } = await (supabase as any).from('base_repo_field_reviews').update({ exported_at: new Date().toISOString(), export_batch: batch }).in('id', ids)
  return error ? error.message : null
}
