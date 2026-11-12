import { checkFirstLinks, verdictKey, type LessonData, type LessonLink, type VerdictRow } from '@/lib/supabase/teaching-lessons-review'

// Pure rules for the TeachingBase review mode: which link comes next, which links share one screen, what the map shows, and the resume pointer.
// Tested by scripts/test_teaching_lessons_review.mjs.
//
// Held-back links (the ones the machine check leaves out on purpose) carry no check_first field. Every rule below that uses the machine order
// reads only check_first, so a held-back link never comes first because of that order and never looks urgent.

export interface ReviewLesson { id: string; label: string; data: LessonData }
export interface Ref { lessonId: string; itemKey: string }
export type Latest = Map<string, VerdictRow>

export const MAX_PER_SCREEN = 3

export const isJudged = (latest: Latest, lessonId: string, link: LessonLink) => latest.has(verdictKey(lessonId, 'link', link.item_key))
export const refKey = (r: Ref) => `${r.lessonId}|${r.itemKey}`

/** The first collection of a lesson, used to group the map. */
export function collectionOf(l: ReviewLesson): string {
  return (l.data.collections ?? [])[0] ?? 'other'
}

/** The links of one lesson in review order: flagged ones first (most doubtful first), then the rest as they come. */
export function lessonLinkOrder(lesson: ReviewLesson): LessonLink[] {
  const { first, rest } = checkFirstLinks(lesson.data.links ?? [])
  return [...first, ...rest]
}

export interface LessonStatus {
  judged: number
  total: number
  remaining: number
  urgent: boolean
  /** Position of the most doubtful flagged link of this lesson that is still open (1 = most doubtful), or null. Used only to pick a visual tier. */
  bestRank: number | null
}

/** How much of a lesson is checked. `urgent` is true only when a flagged link of the lesson is still unjudged. */
export function lessonStatus(lesson: ReviewLesson, latest: Latest): LessonStatus {
  const links = lesson.data.links ?? []
  let judged = 0
  let urgent = false
  let bestRank: number | null = null
  for (const l of links) {
    if (isJudged(latest, lesson.id, l)) judged += 1
    else if (l.check_first) {
      urgent = true
      if (Number.isFinite(l.check_rank)) bestRank = bestRank === null ? (l.check_rank as number) : Math.min(bestRank, l.check_rank as number)
    }
  }
  return { judged, total: links.length, remaining: links.length - judged, urgent, bestRank }
}

const byLabel = (a: ReviewLesson, b: ReviewLesson) => a.label.localeCompare(b.label)

/** First unjudged link of a lesson in review order, leaving out skipped ones. With `after`, only links after that one come first, then the earlier ones. */
export function nextInLesson(lesson: ReviewLesson, latest: Latest, skipped: Set<string>, after?: string): LessonLink | null {
  const order = lessonLinkOrder(lesson)
  const start = after ? order.findIndex((l) => l.item_key === after) + 1 : 0
  const rotated = [...order.slice(start), ...order.slice(0, start)]
  return rotated.find((l) => !isJudged(latest, lesson.id, l) && !skipped.has(`${lesson.id}|${l.item_key}`) && l.item_key !== after) ?? null
}

/** The most doubtful unjudged link, anywhere. Only flagged links qualify, so held-back links never come up here. */
export function mostDoubtful(lessons: ReviewLesson[], latest: Latest, skipped: Set<string>, excludeLessonId?: string): Ref | null {
  let best: { ref: Ref; rank: number } | null = null
  for (const lesson of lessons) {
    if (lesson.id === excludeLessonId) continue
    for (const l of lesson.data.links ?? []) {
      if (!l.check_first || isJudged(latest, lesson.id, l) || skipped.has(`${lesson.id}|${l.item_key}`)) continue
      const rank = l.check_rank ?? Infinity
      if (!best || rank < best.rank) best = { ref: { lessonId: lesson.id, itemKey: l.item_key }, rank }
    }
  }
  return best?.ref ?? null
}

/** The first unjudged link of the next lesson (in the list order) that still has something to check. */
export function nextLessonRef(lessons: ReviewLesson[], latest: Latest, skipped: Set<string>, currentLessonId: string): Ref | null {
  const sorted = [...lessons].sort(byLabel)
  const at = sorted.findIndex((l) => l.id === currentLessonId)
  const rotated = [...sorted.slice(at + 1), ...sorted.slice(0, at + 1)]
  for (const lesson of rotated) {
    if (lesson.id === currentLessonId) continue
    const link = nextInLesson(lesson, latest, skipped)
    if (link) return { lessonId: lesson.id, itemKey: link.item_key }
  }
  return null
}

/**
 * Where "Start reviewing" begins: the unjudged links of the "start here" selection first (lesson by lesson), then the most doubtful flagged
 * link, then any unjudged link. Skipped links come last.
 */
export function startingRef(lessons: ReviewLesson[], latest: Latest, skipped: Set<string>): Ref | null {
  const sorted = [...lessons].sort(byLabel)
  for (const lesson of sorted) {
    const link = lessonLinkOrder(lesson).find((l) => l.sample && !isJudged(latest, lesson.id, l) && !skipped.has(`${lesson.id}|${l.item_key}`))
    if (link) return { lessonId: lesson.id, itemKey: link.item_key }
  }
  const doubtful = mostDoubtful(lessons, latest, skipped)
  if (doubtful) return doubtful
  for (const lesson of sorted) {
    const link = nextInLesson(lesson, latest, skipped)
    if (link) return { lessonId: lesson.id, itemKey: link.item_key }
  }
  // Only skipped links are left: begin with the first of them.
  for (const lesson of sorted) {
    const link = lessonLinkOrder(lesson).find((l) => !isJudged(latest, lesson.id, l))
    if (link) return { lessonId: lesson.id, itemKey: link.item_key }
  }
  return null
}

const normQuote = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Up to three links that share one screen: the focal link plus other unjudged links of the same lesson that point at the same quote. */
export function screenGroup(lesson: ReviewLesson, focalKey: string, latest: Latest): LessonLink[] {
  const links = lessonLinkOrder(lesson)
  const focal = links.find((l) => l.item_key === focalKey)
  if (!focal) return []
  const q = normQuote(focal.evidence)
  if (!q) return [focal]
  const mates = links.filter((l) => l.item_key !== focalKey && normQuote(l.evidence) === q && !isJudged(latest, lesson.id, l))
  return [focal, ...mates].slice(0, MAX_PER_SCREEN)
}

export interface TopicChoice { id: string; remaining: number }

/** The choices for "Pick a topic": link types and collections that still have unjudged links. */
export function topicChoices(lessons: ReviewLesson[], latest: Latest): { types: TopicChoice[]; collections: TopicChoice[] } {
  const types = new Map<string, number>()
  const cols = new Map<string, number>()
  for (const lesson of lessons) for (const l of lesson.data.links ?? []) {
    if (isJudged(latest, lesson.id, l)) continue
    types.set(l.type, (types.get(l.type) ?? 0) + 1)
    const c = collectionOf(lesson)
    cols.set(c, (cols.get(c) ?? 0) + 1)
  }
  const toList = (m: Map<string, number>) => [...m.entries()].map(([id, remaining]) => ({ id, remaining })).sort((a, b) => b.remaining - a.remaining || a.id.localeCompare(b.id))
  return { types: toList(types), collections: toList(cols) }
}

/** The first unjudged link of a type or collection, flagged links first, then lesson by lesson. */
export function firstOfTopic(lessons: ReviewLesson[], latest: Latest, skipped: Set<string>, topic: { type?: string; collection?: string }): Ref | null {
  const matches: { ref: Ref; rank: number; label: string }[] = []
  for (const lesson of lessons) {
    if (topic.collection && collectionOf(lesson) !== topic.collection) continue
    for (const l of lesson.data.links ?? []) {
      if (topic.type && l.type !== topic.type) continue
      if (isJudged(latest, lesson.id, l) || skipped.has(`${lesson.id}|${l.item_key}`)) continue
      matches.push({ ref: { lessonId: lesson.id, itemKey: l.item_key }, rank: l.check_first ? (l.check_rank ?? Infinity) : Infinity, label: lesson.label })
    }
  }
  matches.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
  return matches[0]?.ref ?? null
}

export interface NextOption { kind: 'inLesson' | 'nextLesson' | 'doubtful' | 'topic'; ref?: Ref }

/** The 2 to 3 plain choices offered after a decision. The first is the default. */
export function nextOptions(lessons: ReviewLesson[], latest: Latest, skipped: Set<string>, current: Ref): NextOption[] {
  const lesson = lessons.find((l) => l.id === current.lessonId)
  const out: NextOption[] = []
  const inLesson = lesson ? nextInLesson(lesson, latest, skipped, current.itemKey) : null
  if (lesson && inLesson) out.push({ kind: 'inLesson', ref: { lessonId: lesson.id, itemKey: inLesson.item_key } })
  else {
    const nl = nextLessonRef(lessons, latest, skipped, current.lessonId)
    if (nl) out.push({ kind: 'nextLesson', ref: nl })
  }
  const doubtful = mostDoubtful(lessons, latest, skipped, inLesson ? undefined : current.lessonId)
  if (doubtful && !out.some((o) => o.ref && refKey(o.ref) === refKey(doubtful))) out.push({ kind: 'doubtful', ref: doubtful })
  out.push({ kind: 'topic' })
  return out.slice(0, 3)
}

// ---- Map -------------------------------------------------------------------

/** 0 = nothing urgent, 1 = holds flagged links, 2 = holds some of the most doubtful quarter of the flagged links. Held-back links never count. */
export type UrgencyTier = 0 | 1 | 2

export interface MapLesson { id: string; label: string; collection: string; status: LessonStatus; tier: UrgencyTier }

/** The rank at or below which a flagged link counts as being among the most doubtful quarter. */
export function urgentCutoff(lessons: ReviewLesson[]): number {
  const ranks = lessons.flatMap((l) => (l.data.links ?? []).filter((k) => k.check_first && Number.isFinite(k.check_rank)).map((k) => k.check_rank as number)).sort((a, b) => a - b)
  return ranks.length ? ranks[Math.max(0, Math.ceil(ranks.length * 0.25) - 1)] : 0
}

export function urgencyTier(status: LessonStatus, cutoff: number): UrgencyTier {
  if (!status.urgent) return 0
  return status.bestRank !== null && status.bestRank <= cutoff ? 2 : 1
}

/** Lessons that have something to check, with their state, for the Review map. Lessons with no suggested links are left out. */
export function mapLessons(lessons: ReviewLesson[], latest: Latest): { items: MapLesson[]; withoutLinks: number } {
  const items: MapLesson[] = []
  let withoutLinks = 0
  const cutoff = urgentCutoff(lessons)
  for (const l of lessons) {
    const status = lessonStatus(l, latest)
    if (status.total === 0) { withoutLinks += 1; continue }
    items.push({ id: l.id, label: l.label, collection: collectionOf(l), status, tier: urgencyTier(status, cutoff) })
  }
  items.sort((a, b) => a.collection.localeCompare(b.collection) || a.label.localeCompare(b.label))
  return { items, withoutLinks }
}

// ---- Resume pointer ----------------------------------------------------------

export const POINTER_PREFIX = 'openlpm:teachingbase-review-pointer:'

/** Reads a saved pointer. Anything that is not a lesson id and an item key gives null. */
export function parsePointer(raw: string | null | undefined): Ref | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    if (o && typeof o.lessonId === 'string' && typeof o.itemKey === 'string' && o.lessonId && o.itemKey) return { lessonId: o.lessonId, itemKey: o.itemKey }
  } catch { /* junk */ }
  return null
}

/** A pointer only counts while the link still exists. */
export function pointerIfValid(lessons: ReviewLesson[], p: Ref | null): Ref | null {
  if (!p) return null
  const lesson = lessons.find((l) => l.id === p.lessonId)
  return lesson && (lesson.data.links ?? []).some((l) => l.item_key === p.itemKey) ? p : null
}

export function loadPointer(userId: string | null): Ref | null {
  try { return parsePointer(window.localStorage.getItem(POINTER_PREFIX + (userId ?? 'anon'))) } catch { return null }
}

export function savePointer(userId: string | null, p: Ref): void {
  try { window.localStorage.setItem(POINTER_PREFIX + (userId ?? 'anon'), JSON.stringify(p)) } catch { /* the pointer is a convenience */ }
}
