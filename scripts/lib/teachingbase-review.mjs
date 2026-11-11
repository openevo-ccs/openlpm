// Pure functions for the Teaching lessons review: the stable key of a link or component, and the seeded "start here" sample.
// Used by scripts/sync_teachingbase_snapshot.mjs and tested by scripts/test_teaching_lessons_review.mjs.
import { createHash } from 'node:crypto'

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** First 12 hex characters of a sha1 over type|to|label|evidence. A component has no target, so its title stands in for label. */
export function itemKey(item) {
  const text = [item.type, item.to, item.label ?? item.title, item.evidence].map(norm).join('|')
  return createHash('sha1').update(text).digest('hex').slice(0, 12)
}

/** Keys for a list of items. Two identical items in one lesson get -2, -3 ... so every key in a lesson is unique. */
export function keysFor(items) {
  const seen = new Map()
  return items.map((item) => {
    const base = itemKey(item)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  })
}

/** Small seeded random generator (mulberry32), so the same data and seed always give the same sample. */
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Picks about `target` links spread over link type, confidence, quote check and lesson type.
 * candidates: [{ lesson, lessonType, key, type, confidence, quoteFound }]
 * Round-robin over the groups (type, confidence, quote check). Inside a group, the next pick is the link whose lesson type and
 * lesson are least represented so far; ties are broken by the seeded generator. No lesson gives more than `perLesson` links.
 * Returns a Set of `${lesson}|${key}`.
 */
export function pickSample(candidates, { target = 150, seed = 20261111, perLesson = 3 } = {}) {
  const rand = seededRandom(seed)
  const groups = new Map()
  for (const c of candidates) {
    const g = `${c.type}|${c.confidence ?? 'none'}|${c.quoteFound === true ? 'found' : c.quoteFound === false ? 'missing' : 'unchecked'}`
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(c)
  }
  const order = [...groups.keys()].sort()
  // seeded shuffle of the group order, so no type always goes first
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const picked = new Set()
  const perLessonCount = new Map()
  const perTypeCount = new Map()
  let progress = true
  while (picked.size < target && progress) {
    progress = false
    for (const g of order) {
      if (picked.size >= target) break
      const pool = groups.get(g).filter((c) => !picked.has(`${c.lesson}|${c.key}`) && (perLessonCount.get(c.lesson) ?? 0) < perLesson)
      if (pool.length === 0) continue
      let best = null
      let bestScore = Infinity
      for (const c of pool) {
        const score = (perTypeCount.get(c.lessonType) ?? 0) * 10 + (perLessonCount.get(c.lesson) ?? 0) + rand()
        if (score < bestScore) { best = c; bestScore = score }
      }
      picked.add(`${best.lesson}|${best.key}`)
      perLessonCount.set(best.lesson, (perLessonCount.get(best.lesson) ?? 0) + 1)
      perTypeCount.set(best.lessonType, (perTypeCount.get(best.lessonType) ?? 0) + 1)
      progress = true
    }
  }
  return picked
}
