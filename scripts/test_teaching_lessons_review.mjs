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
