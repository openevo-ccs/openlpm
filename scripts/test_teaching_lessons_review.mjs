#!/usr/bin/env node
// Tests for the TeachingBase link-checking rules: item keys and the "start here" sample (scripts/lib/teachingbase-review.mjs) and the
// verdict rules (src/lib/supabase/teaching-lessons-review.ts). Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_teaching_lessons_review.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { itemKey, keysFor, pickSample, seededRandom } from './lib/teachingbase-review.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'teaching-review-'))
const out = path.join(dir, 'lib.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/teaching-lessons-review.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const R = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const link = (over = {}) => ({ type: 'concept', to: 'OE-CONCEPT-x', label: 'X', evidence: 'quote', ...over })

test('item key is 12 hex characters and stable', () => {
  const k = itemKey(link())
  assert.match(k, /^[0-9a-f]{12}$/)
  assert.equal(itemKey(link()), k)
})

test('item key ignores extra spaces and changes when content changes', () => {
  assert.equal(itemKey(link({ evidence: '  quote  ' })), itemKey(link()))
  assert.notEqual(itemKey(link({ to: 'OE-CONCEPT-y' })), itemKey(link()))
  assert.notEqual(itemKey(link({ evidence: 'other' })), itemKey(link()))
})

test('a component uses its title where a link uses its label', () => {
  assert.equal(itemKey({ type: 'reading', title: 'T', evidence: 'e' }), itemKey({ type: 'reading', label: 'T', evidence: 'e' }))
})

test('identical items in one lesson still get different keys', () => {
  const keys = keysFor([link(), link(), link({ to: 'other' })])
  assert.equal(new Set(keys).size, 3)
  assert.equal(keys[1], `${keys[0]}-2`)
})

function fakeCandidates() {
  const rand = seededRandom(7)
  const types = ['concept', 'method', 'theory', 'species', 'question']
  const conf = ['high', 'medium', 'low']
  const out = []
  for (let lesson = 0; lesson < 40; lesson++) {
    for (let i = 0; i < 8; i++) {
      out.push({ lesson: `l${lesson}`, lessonType: `lt${lesson % 4}`, key: `k${i}`, type: types[Math.floor(rand() * 5)], confidence: conf[Math.floor(rand() * 3)], quoteFound: rand() > 0.3 })
    }
  }
  return out
}

test('the sample has the requested size and is the same every time', () => {
  const c = fakeCandidates()
  const a = pickSample(c, { target: 60, seed: 1 })
  const b = pickSample(c, { target: 60, seed: 1 })
  assert.equal(a.size, 60)
  assert.deepEqual([...a].sort(), [...b].sort())
  assert.notDeepEqual([...a].sort(), [...pickSample(c, { target: 60, seed: 2 })].sort())
})

test('the sample covers every link type, confidence and quote result, and respects the per-lesson cap', () => {
  const c = fakeCandidates()
  const picked = pickSample(c, { target: 60, seed: 1, perLesson: 3 })
  const chosen = c.filter((x) => picked.has(`${x.lesson}|${x.key}`))
  for (const field of ['type', 'confidence', 'quoteFound', 'lessonType']) {
    assert.deepEqual(new Set(chosen.map((x) => x[field])), new Set(c.map((x) => x[field])), field)
  }
  const perLesson = {}
  for (const x of chosen) perLesson[x.lesson] = (perLesson[x.lesson] ?? 0) + 1
  assert.ok(Math.max(...Object.values(perLesson)) <= 3)
})

test('a target larger than the pool returns what there is', () => {
  const c = fakeCandidates().slice(0, 5)
  assert.equal(pickSample(c, { target: 50, seed: 1, perLesson: 99 }).size, 5)
})

const lesson = (id, keys, extra = {}) => ({
  id, label: id, collections: ['c1'], graph_present: keys.length > 0, link_count: keys.length, sample_count: 0,
  data: { slug: id, title: { en: id }, description: {}, grades: [], subjects: [], material_types: [], collections: ['c1'], materials: [], components: [], assets: [], rights_flags: [], links: keys.map((k, i) => ({ item_key: k, type: 'concept', to: 'x', sample: i === 0 })), ...extra },
})
const v = (lesson_id, item_key, verdict, reviewed_at, item_kind = 'link') => ({ id: `${lesson_id}${item_key}${reviewed_at}`, lesson_id, item_kind, item_key, item_summary: {}, verdict, note: null, reviewer_id: 'u', reviewer_name: 'Ann', reviewed_at })

test('the latest verdict wins, and a later change replaces an earlier one', () => {
  const latest = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z'), v('a', 'k1', 'wrong', '2026-11-11T11:00:00Z'), v('a', 'k2', 'unsure', '2026-11-11T09:00:00Z')])
  assert.equal(latest.size, 2)
  assert.equal(latest.get(R.verdictKey('a', 'link', 'k1')).verdict, 'wrong')
})

test('a link and a component with the same key are separate items', () => {
  const latest = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z'), v('a', 'k1', 'wrong', '2026-11-11T10:00:01Z', 'component')])
  assert.equal(latest.size, 2)
})

test('progress counts links judged out of links total, and the sample on its own', () => {
  const lessons = [lesson('a', ['k1', 'k2', 'k3']), lesson('b', ['k1', 'k2'])]
  const latest = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z'), v('a', 'k1', 'wrong', '2026-11-11T11:00:00Z'), v('b', 'k2', 'unsure', '2026-11-11T11:00:00Z')])
  assert.deepEqual(R.linkProgress(lessons, latest), { judged: 2, total: 5 })
  assert.deepEqual(R.linkProgress(lessons, latest, true), { judged: 1, total: 2 })
})

test('lesson progress includes components; a lesson is reviewed when every link has a verdict', () => {
  const a = lesson('a', ['k1', 'k2'], { components: [{ item_key: 'c1', type: 'reading' }] })
  const latest = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z')])
  assert.deepEqual(R.lessonProgress(a, latest), { judged: 1, total: 3 })
  assert.equal(R.isLessonReviewed(a, latest), false)
  const all = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z'), v('a', 'k2', 'wrong', '2026-11-11T10:00:00Z')])
  assert.equal(R.isLessonReviewed(a, all), true)
  assert.equal(R.isLessonReviewed(lesson('empty', []), all), false)
})

test('filters combine', () => {
  const a = lesson('a', ['k1'])
  const b = lesson('b', ['k1'])
  b.sample_count = 1
  const c = lesson('c', [])
  c.collections = ['c2']
  const latest = R.latestVerdicts([v('a', 'k1', 'correct', '2026-11-11T10:00:00Z')])
  const base = { collection: '', review: '', sampleOnly: false, graphOnly: false, search: '' }
  const ids = (f) => R.filterLessons([a, b, c], latest, { ...base, ...f }).map((l) => l.id)
  assert.deepEqual(ids({}), ['a', 'b', 'c'])
  assert.deepEqual(ids({ review: 'reviewed' }), ['a'])
  assert.deepEqual(ids({ review: 'open' }), ['b'])
  assert.deepEqual(ids({ sampleOnly: true }), ['b'])
  assert.deepEqual(ids({ graphOnly: true }), ['a', 'b'])
  assert.deepEqual(ids({ collection: 'c2' }), ['c'])
  assert.deepEqual(ids({ search: 'B' }), ['b'])
})

test('target ids read as plain words', () => {
  assert.equal(R.readableTarget('OE-CONCEPT-bio-core-natural-selection'), 'bio core natural selection')
  assert.equal(R.readableTarget('OE-METHOD-causal-mapping'), 'causal mapping')
  assert.equal(R.readableTarget('resource:some_thing'), 'some thing')
})

test('the download holds the latest verdict per item with reviewer and date', () => {
  const latest = R.latestVerdicts([v('b', 'k1', 'correct', '2026-11-11T10:00:00Z'), v('a', 'k1', 'wrong', '2026-11-11T10:00:00Z'), v('a', 'k1', 'unsure', '2026-11-11T12:00:00Z')])
  const rows = R.verdictsExport(latest)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((r) => r.lesson_id), ['a', 'b'])
  assert.deepEqual(Object.keys(rows[0]).sort(), ['date', 'item_key', 'item_kind', 'item_summary', 'lesson_id', 'note', 'reviewer', 'verdict'])
  assert.equal(rows[0].verdict, 'unsure')
  assert.equal(rows[0].reviewer, 'Ann')
})

// ---- named reviewers (migration 241) and the TeachingBase tab filters ----

test('admins and named reviewers may use the page, nobody else', () => {
  assert.equal(R.mayUseReviewPage(true, false), true)
  assert.equal(R.mayUseReviewPage(false, true), true)
  assert.equal(R.mayUseReviewPage(true, true), true)
  assert.equal(R.mayUseReviewPage(false, false), false)
})

test('a search is cleaned so it cannot change the meaning of the filter', () => {
  assert.equal(R.cleanSearch('  Ann,  name.eq.x) '), 'Ann name.eq.x')
  assert.equal(R.cleanSearch('a%b_c*d"e'), 'a b c d e')
  assert.equal(R.cleanSearch('(),'), '')
})

test('reviewers show newest first with name and email, and a missing person still shows', () => {
  const rows = R.reviewerRows(
    [{ user_id: 'u1', added_at: '2026-11-10T10:00:00Z' }, { user_id: 'u2', added_at: '2026-11-11T10:00:00Z' }, { user_id: 'u3', added_at: '2026-11-09T10:00:00Z' }],
    [{ id: 'u1', name: 'Ann', email: 'ann@x.org' }, { id: 'u2', name: 'Bo', email: 'bo@x.org' }],
  )
  assert.deepEqual(rows.map((r) => r.user_id), ['u2', 'u1', 'u3'])
  assert.equal(rows[0].email, 'bo@x.org')
  assert.equal(rows[2].name, '')
  assert.equal(rows[2].email, 'u3')
})

test('people already named as reviewers are left out of the search results', () => {
  const hits = [{ id: 'a', name: 'A', email: 'a@x' }, { id: 'b', name: 'B', email: 'b@x' }]
  assert.deepEqual(R.candidatesFor(hits, new Set(['a'])).map((h) => h.id), ['b'])
  assert.equal(R.candidatesFor(hits, new Set()).length, 2)
})

test('start-here and still-to-check follow the links and the newest verdicts', () => {
  const lesson = { id: 'L', data: { links: [{ item_key: 'a', sample: true }, { item_key: 'b' }], components: [] } }
  const none = { id: 'M', data: { links: [], components: [] } }
  assert.equal(R.hasStartHere(lesson), true)
  assert.equal(R.hasStartHere(none), false)
  const open = R.latestVerdicts([])
  assert.equal(R.isStillOpen(lesson, open), true)
  assert.equal(R.isStillOpen(none, open), false)
  const half = R.latestVerdicts([{ lesson_id: 'L', item_kind: 'link', item_key: 'a', verdict: 'correct', reviewed_at: '2026-11-11T10:00:00Z' }])
  assert.equal(R.isStillOpen(lesson, half), true)
  const all = R.latestVerdicts([
    { lesson_id: 'L', item_kind: 'link', item_key: 'a', verdict: 'correct', reviewed_at: '2026-11-11T10:00:00Z' },
    { lesson_id: 'L', item_kind: 'link', item_key: 'b', verdict: 'wrong', reviewed_at: '2026-11-11T10:00:00Z' },
  ])
  assert.equal(R.isStillOpen(lesson, all), false)
})

// ---- "check first" order ----
import { applyCheckFirst } from './lib/teachingbase-review.mjs'

test('flagged links come first, most doubtful first, and the others keep their order', () => {
  const links = [{ item_key: 'a' }, { item_key: 'b', check_first: true, check_rank: 5 }, { item_key: 'c' }, { item_key: 'd', check_first: true, check_rank: 2 }]
  const { first, rest } = R.checkFirstLinks(links)
  assert.deepEqual(first.map((l) => l.item_key), ['d', 'b'])
  assert.deepEqual(rest.map((l) => l.item_key), ['a', 'c'])
})

test('a lesson sorts by its most doubtful flagged link; lessons without any go last', () => {
  const les = (...ranks) => ({ data: { links: ranks.map((r) => (r ? { check_first: true, check_rank: r } : {})) } })
  assert.equal(R.lessonCheckSortKey(les(7, 3)), '00003')
  assert.equal(R.lessonCheckSortKey(les(null)), '99999')
  assert.ok(R.lessonCheckSortKey(les(3)) < R.lessonCheckSortKey(les(null)))
  assert.equal(R.flaggedCount(les(7, null, 3)), 2)
})

test('the reason shows only after the signed-in person has judged that link', () => {
  const link = { item_key: 'k', check_reason: 'Because.' }
  const mine = R.ownJudgedKeys([{ lesson_id: 'L', item_kind: 'link', item_key: 'k', reviewer_id: 'me' }, { lesson_id: 'L', item_kind: 'link', item_key: 'z', reviewer_id: 'other' }], 'me')
  assert.equal(R.showCheckReason(link, 'L', mine), true)
  assert.equal(R.showCheckReason({ item_key: 'z', check_reason: 'x' }, 'L', mine), false)
  assert.equal(R.showCheckReason({ item_key: 'k' }, 'L', mine), false)
  assert.equal(R.showCheckReason(link, 'L', R.ownJudgedKeys([], null)), false)
})

test('the sync step marks flagged links, leaves withheld ones bare, and orders by rank', () => {
  const lessons = [{ slug: 'l1', links: [{ item_key: 'a' }, { item_key: 'b' }, { item_key: 'c' }, { item_key: 'd' }] }]
  const feed = { links: [
    { link_id: 'l1|a', check_first: true, reason: 'R1', badge_withheld: false },
    { link_id: 'l1|b', check_first: true, reason: 'R2', badge_withheld: false },
    { link_id: 'l1|c', check_first: false, reason: '', badge_withheld: true },
    { link_id: 'l1|d', check_first: false, reason: 'R4', badge_withheld: false },
    { link_id: 'l9|x', check_first: true, reason: 'gone', badge_withheld: false },
  ] }
  const ranked = [{ link_id: 'l1|a', rank_most_doubtful_first: 40 }, { link_id: 'l1|b', rank_most_doubtful_first: 12 }, { link_id: 'l1|c', rank_most_doubtful_first: 1 }, { link_id: 'l9|x', rank_most_doubtful_first: 3 }]
  const c = applyCheckFirst(lessons, feed, ranked)
  const [a, b, cc, d] = lessons[0].links
  assert.equal(b.check_rank < a.check_rank, true)
  assert.equal(a.check_first, true)
  assert.deepEqual(Object.keys(cc), ['item_key'])
  assert.equal(d.check_first, undefined)
  assert.equal(d.check_reason, 'R4')
  assert.deepEqual(c, { matched: 4, flagged: 2, withheld: 1, reasons: 3, unmatched: 1 })
})

test('German reasons are looked up sentence by sentence and fall back to English', async () => {
  const { build } = await import('esbuild')
  const f = path.join(dir, 'strings.mjs')
  await build({ entryPoints: [path.join(root, 'src/lib/teachingbase-review-strings.ts')], bundle: true, format: 'esm', platform: 'node', outfile: f, logLevel: 'error' })
  const S = await import(pathToFileURL(f).href)
  assert.match(S.reasonText('The lesson only mentions this in passing. Something new.', 'de'), /Das Material erwähnt dies nur am Rande\. Something new\.$/)
  assert.equal(S.reasonText('Something new.', 'en'), 'Something new.')
  const visible = JSON.stringify([S.T.en, S.T.de, S.CHECK_REASONS_DE]).toLowerCase()
  for (const word of ['swarm', 'triage', 'auc', 'hold-out', 'holdout', 'deepseek', 'qwen', 'gemma']) assert.equal(new RegExp(`\\b${word}\\b`).test(visible), false, word)
})

// ---- review mode: which link comes next, what shares a screen, the map, the resume pointer, target descriptions ----
const rmFile = path.join(dir, 'rm.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/teachingbase-review-mode.ts')], bundle: true, format: 'esm', platform: 'node', outfile: rmFile, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const M = await import(pathToFileURL(rmFile).href)
const tgFile = path.join(dir, 'tg.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/teachingbase-targets.ts')], bundle: true, format: 'esm', platform: 'node', outfile: tgFile, logLevel: 'error', alias: { '@': path.join(root, 'src') }, loader: { '.json': 'json' } })
const G = await import(pathToFileURL(tgFile).href)

const lk = (key, over = {}) => ({ item_key: key, type: 'concept', to: `OE-CONCEPT-${key}`, evidence: `quote ${key}`, ...over })
const les = (id, label, links) => ({ id, label, data: { links, components: [], collections: ['c1'] } })
const done = (lessonId, key) => [`${lessonId}|link|${key}`, { lesson_id: lessonId, item_kind: 'link', item_key: key, verdict: 'correct', reviewer_id: 'me', reviewed_at: '2026-11-12T10:00:00Z' }]
const world = () => [
  les('a', 'A lesson', [lk('a1'), lk('a2', { check_first: true, check_rank: 9 }), lk('a3', { sample: true })]),
  les('b', 'B lesson', [lk('b1', { check_first: true, check_rank: 2, type: 'method' }), lk('b2')]),
  les('c', 'C lesson', [lk('c1', { sample: true, type: 'method' })]),
]

test('in a lesson the flagged links come first, most doubtful first, then the rest in order', () => {
  const [a] = world()
  assert.deepEqual(M.lessonLinkOrder(a).map((l) => l.item_key), ['a2', 'a1', 'a3'])
})

test('next in lesson skips judged and skipped links and wraps round', () => {
  const [a] = world()
  const latest = new Map([done('a', 'a2')])
  assert.equal(M.nextInLesson(a, latest, new Set())?.item_key, 'a1')
  assert.equal(M.nextInLesson(a, latest, new Set(['a|a1']))?.item_key, 'a3')
  assert.equal(M.nextInLesson(a, latest, new Set(), 'a1')?.item_key, 'a3')
  assert.equal(M.nextInLesson(a, new Map([done('a', 'a1'), done('a', 'a2'), done('a', 'a3')]), new Set()), null)
})

test('the most doubtful link elsewhere takes only flagged links, so held-back links never come first', () => {
  const w = world()
  assert.deepEqual(M.mostDoubtful(w, new Map(), new Set()), { lessonId: 'b', itemKey: 'b1' })
  assert.deepEqual(M.mostDoubtful(w, new Map([done('b', 'b1')]), new Set()), { lessonId: 'a', itemKey: 'a2' })
  assert.equal(M.mostDoubtful(w, new Map([done('b', 'b1'), done('a', 'a2')]), new Set()), null)
  assert.deepEqual(M.mostDoubtful(w, new Map(), new Set(), 'b'), { lessonId: 'a', itemKey: 'a2' })
  const heldBackOnly = [les('h', 'H', [lk('h1'), lk('h2')])]
  assert.equal(M.mostDoubtful(heldBackOnly, new Map(), new Set()), null)
})

test('a lesson looks urgent only while one of its flagged links is open', () => {
  const [a, , c] = world()
  assert.equal(M.lessonStatus(a, new Map()).urgent, true)
  assert.equal(M.lessonStatus(a, new Map([done('a', 'a2')])).urgent, false)
  assert.equal(M.lessonStatus(c, new Map()).urgent, false)
  assert.deepEqual(M.lessonStatus(a, new Map([done('a', 'a1')])), { judged: 1, total: 3, remaining: 2, urgent: true, bestRank: 9 })
})

test('start reviewing begins with the start-here selection, then the most doubtful link, then anything open', () => {
  const w = world()
  assert.deepEqual(M.startingRef(w, new Map(), new Set()), { lessonId: 'a', itemKey: 'a3' })
  assert.deepEqual(M.startingRef(w, new Map([done('a', 'a3'), done('c', 'c1')]), new Set()), { lessonId: 'b', itemKey: 'b1' })
  assert.deepEqual(M.startingRef(w, new Map([done('a', 'a3'), done('c', 'c1'), done('b', 'b1'), done('a', 'a2')]), new Set()), { lessonId: 'a', itemKey: 'a1' })
  assert.equal(M.startingRef(w, new Map(w.flatMap((l) => l.data.links.map((k) => done(l.id, k.item_key)))), new Set()), null)
})

test('up to three links share a screen, only in one lesson and on one quote', () => {
  const l = les('x', 'X', [lk('x1', { evidence: 'Same  words' }), lk('x2', { evidence: ' same words ' }), lk('x3', { evidence: 'same words' }), lk('x4', { evidence: 'same words' }), lk('x5', { evidence: 'other' })])
  assert.deepEqual(M.screenGroup(l, 'x1', new Map()).map((k) => k.item_key), ['x1', 'x2', 'x3'])
  assert.deepEqual(M.screenGroup(l, 'x5', new Map()).map((k) => k.item_key), ['x5'])
  assert.deepEqual(M.screenGroup(l, 'x2', new Map([done('x', 'x1')])).map((k) => k.item_key), ['x2', 'x3', 'x4'])
  assert.deepEqual(M.screenGroup(les('y', 'Y', [lk('y1', { evidence: '' }), lk('y2', { evidence: '' })]), 'y1', new Map()).map((k) => k.item_key), ['y1'])
})

test('the next choices: next in lesson, the most doubtful elsewhere, and a topic chooser', () => {
  const w = world()
  const o1 = M.nextOptions(w, new Map([done('a', 'a2')]), new Set(), { lessonId: 'a', itemKey: 'a2' })
  assert.deepEqual(o1.map((o) => o.kind), ['inLesson', 'doubtful', 'topic'])
  assert.equal(o1[0].ref.itemKey, 'a1')
  assert.equal(o1[1].ref.itemKey, 'b1')
  const all = new Map(w[0].data.links.map((k) => done('a', k.item_key)))
  const o2 = M.nextOptions(w, all, new Set(), { lessonId: 'a', itemKey: 'a1' })
  assert.equal(o2[0].kind, 'nextLesson')
  assert.ok(o2.length <= 3)
})

test('topics list only what is still open, and the first link of a topic puts flagged links first', () => {
  const w = world()
  const t = M.topicChoices(w, new Map([done('c', 'c1')]))
  assert.deepEqual(t.types.map((x) => x.id), ['concept', 'method'])
  assert.equal(t.types.find((x) => x.id === 'method').remaining, 1)
  assert.deepEqual(M.firstOfTopic(w, new Map(), new Set(), { type: 'method' }), { lessonId: 'b', itemKey: 'b1' })
  assert.equal(M.firstOfTopic(w, new Map(), new Set(), { type: 'species' }), null)
})

test('the map leaves out lessons with nothing to check and groups the rest by collection', () => {
  const w = [...world(), les('z', 'Z', [])]
  const m = M.mapLessons(w, new Map())
  assert.equal(m.withoutLinks, 1)
  assert.deepEqual(m.items.map((i) => i.id), ['a', 'b', 'c'])
  assert.equal(m.items[0].collection, 'c1')
})

test('the resume pointer reads back, ignores junk and stops counting once the link is gone', () => {
  assert.deepEqual(M.parsePointer(JSON.stringify({ lessonId: 'a', itemKey: 'a1' })), { lessonId: 'a', itemKey: 'a1' })
  for (const junk of [null, '', 'not json', '{}', JSON.stringify({ lessonId: 'a' }), JSON.stringify({ lessonId: '', itemKey: 'x' }), '42']) assert.equal(M.parsePointer(junk), null, String(junk))
  const w = world()
  assert.deepEqual(M.pointerIfValid(w, { lessonId: 'b', itemKey: 'b2' }), { lessonId: 'b', itemKey: 'b2' })
  assert.equal(M.pointerIfValid(w, { lessonId: 'b', itemKey: 'gone' }), null)
  assert.equal(M.pointerIfValid(w, null), null)
})

test('target descriptions come from each kind of record, in the language of the reader', () => {
  const method = { label: '{"en":"Causal Mapping"}', data: { label: { en: 'Causal Mapping' }, description: { de: 'Diagramme', en: 'Diagrams of causes' } } }
  assert.equal(G.descriptionFromRow('method', method, 'en').description, 'Diagrams of causes')
  assert.equal(G.descriptionFromRow('method', method, 'de').description, 'Diagramme')
  assert.equal(G.descriptionFromRow('competency', { label: 'HS-LS4-2', data: { statement: { en: 'Construct explanations' } } }, 'en').description, 'Construct explanations')
  assert.equal(G.descriptionFromRow('theory', { label: 'T', data: { statement: 'A plain statement' } }, 'en').description, 'A plain statement')
  assert.equal(G.descriptionFromRow('question', { label: 'Q', data: { statement: 'Why?' } }, 'en').description, 'Why?')
  assert.match(G.descriptionFromRow('quote', { label: 'Q', text: 'Words', attribution: 'Haidt 2012', data: {} }, 'en').description, /Words \(Haidt 2012\)/)
  const lit = G.descriptionFromRow('literature', { title: 'A Title', authors: ['Ostrom, Elinor'], year: 2009, venue: 'Science', data: {} }, 'en')
  assert.equal(lit.description, null)
  assert.equal(lit.reference, 'Ostrom (2009) A Title. Science')
  assert.deepEqual(G.descriptionFromRow('species', { data: {} }, 'en'), { name: null, description: null, reference: null })
})

test('a concept description prefers the language of the reader and falls back to the other one', () => {
  const c = { definitions: { en: { biology: 'English words' }, de: { biology: 'Deutsche Worte' } } }
  assert.equal(G.conceptDescription(c, 'de'), 'Deutsche Worte')
  assert.equal(G.conceptDescription(c, 'en'), 'English words')
  assert.equal(G.conceptDescription({ definitions: { en: { x: 'Only English' } } }, 'de'), 'Only English')
  assert.equal(G.conceptDescription({ definitions: {} }, 'en'), null)
})

test('review-mode wording is plain: no banned terms in any visible string, and both languages have the same keys', async () => {
  const f = path.join(dir, 'strings2.mjs')
  await build({ entryPoints: [path.join(root, 'src/lib/teachingbase-review-strings.ts')], bundle: true, format: 'esm', platform: 'node', outfile: f, logLevel: 'error' })
  const S = await import(pathToFileURL(f).href)
  const visible = JSON.stringify([S.RM, S.TYPE_GUIDANCE, S.TIPS]).toLowerCase()
  for (const word of ['swarm', 'triage', 'auc', 'hold-out', 'holdout', 'deepseek', 'qwen', 'gemma', 'score', 'percent']) assert.equal(new RegExp(`\\b${word}\\b`).test(visible), false, word)
  assert.deepEqual(Object.keys(S.RM.en).sort(), Object.keys(S.RM.de).sort())
  assert.deepEqual(Object.keys(S.TIPS.en).sort(), Object.keys(S.TIPS.de).sort())
  assert.deepEqual(Object.keys(S.TYPE_GUIDANCE.en).sort(), Object.keys(S.TYPE_GUIDANCE.de).sort())
})

test('on the map only the most doubtful quarter of the flagged links makes a lesson look most urgent', () => {
  const w = [
    les('p', 'P', [lk('p1', { check_first: true, check_rank: 1 }), lk('p2', { check_first: true, check_rank: 2 })]),
    les('q', 'Q', [lk('q1', { check_first: true, check_rank: 3 }), lk('q2', { check_first: true, check_rank: 4 })]),
    les('r', 'R', [lk('r1', { check_first: true, check_rank: 7 }), lk('r2', { check_first: true, check_rank: 8 })]),
    les('s', 'S', [lk('s1', { check_first: true, check_rank: 5 }), lk('s2', { check_first: true, check_rank: 6 })]),
    les('h', 'H', [lk('h1'), lk('h2')]),
  ]
  assert.equal(M.urgentCutoff(w), 2)
  const tiers = Object.fromEntries(M.mapLessons(w, new Map()).items.map((i) => [i.id, i.tier]))
  assert.deepEqual(tiers, { p: 2, q: 1, r: 1, s: 1, h: 0 })
  const afterP = Object.fromEntries(M.mapLessons(w, new Map([done('p', 'p1'), done('p', 'p2')])).items.map((i) => [i.id, i.tier]))
  assert.equal(afterP.p, 0)
  assert.equal(M.urgentCutoff([les('h', 'H', [lk('h1')])]), 0)
})
