#!/usr/bin/env node
// Tests for the thumbs-up and flag on single fields in the Base Repo Explorer (feedback 1551a6e1, Susan Hanisch 2026-11-25):
// which decision counts for a field, when an approval is out of date, and which approvals still wait to go into the repo
// (src/lib/supabase/base-repo-field-reviews.ts).
//   node scripts/test_base_repo_field_reviews.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'field-reviews-'))
const out = path.join(dir, 'reviews.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/base-repo-field-reviews.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const R = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

let n = 0
const review = (record_id, field_path, verdict, value_seen, at, extra = {}) => ({
  id: `r${++n}`, base_repo: 'methodsbase', record_id, field_path, verdict, value_seen, note: null, reviewed_by: 'u1',
  reviewed_at: `2026-11-27T10:${String(at).padStart(2, '0')}:00Z`, exported_at: null, export_batch: null, ...extra,
})

test('the latest decision of a field counts, whatever order the rows come in', () => {
  const rows = [review('m1', 'description.de', 'flagged', 'a', 5), review('m1', 'description.de', 'approved', 'a', 1)]
  assert.equal(R.latestReviewsForRecord(rows, 'm1').get('description.de').verdict, 'flagged')
})

test('a cleared row takes the thumbs-up or flag away', () => {
  const rows = [review('m1', 'description.de', 'approved', 'a', 1), review('m1', 'description.de', 'cleared', null, 2)]
  assert.equal(R.latestReviewsForRecord(rows, 'm1').size, 0)
})

test('decisions of another record do not leak in', () => {
  const rows = [review('m1', 'description.de', 'approved', 'a', 1), review('m2', 'description.de', 'flagged', 'a', 2)]
  assert.deepEqual(R.flaggedPaths(rows, 'm1'), [])
  assert.deepEqual(R.flaggedPaths(rows, 'm2'), ['description.de'])
})

test('an approval counts while the field says what was approved, and shows as changed after an edit', () => {
  const approved = review('m1', 'description.de', 'approved', 'Ein Satz.', 1)
  assert.equal(R.fieldReviewState(approved, 'Ein Satz.').kind, 'approved')
  assert.equal(R.fieldReviewState(approved, 'Ein anderer Satz.').kind, 'approved-changed')
  assert.equal(R.fieldReviewState(undefined, 'x').kind, 'none')
})

test('a list approved as a list is compared as a list', () => {
  const approved = review('m1', 'learningApproaches', 'approved', ['a', 'b'], 1)
  assert.equal(R.fieldReviewState(approved, ['a', 'b']).kind, 'approved')
  assert.equal(R.fieldReviewState(approved, ['a']).kind, 'approved-changed')
})

test('a flag stays a flag after the text changes, until someone clears it', () => {
  const flagged = review('m1', 'description.de', 'flagged', 'Ein Satz.', 1, { note: 'Klingt zielgerichtet' })
  assert.equal(R.fieldReviewState(flagged, 'Ein anderer Satz.').kind, 'flagged')
})

test('approved texts only list approvals, so the draft tag can follow them', () => {
  const rows = [review('m1', 'description.de', 'approved', 'Ein Satz.', 1), review('m1', 'whenToUse.de', 'flagged', 'x', 2), review('m1', 'materials.de', 'approved', 'y', 3), review('m1', 'materials.de', 'cleared', null, 4)]
  const map = R.approvedTexts(rows, 'm1')
  assert.deepEqual(Array.from(map.entries()), [['description.de', 'Ein Satz.']])
})

test('approvals wait for the repo until marked, and an approval that was cleared never waits', () => {
  const rows = [
    review('m1', 'description.de', 'approved', 'a', 1),
    review('m1', 'materials.de', 'approved', 'b', 2, { exported_at: '2026-11-27T12:00:00Z', export_batch: 'batch-1' }),
    review('m2', 'description.en', 'approved', 'c', 3), review('m2', 'description.en', 'cleared', null, 4),
    review('m3', 'description.en', 'flagged', 'd', 5),
  ]
  const waiting = R.pendingApprovals(rows)
  assert.deepEqual(waiting.map((r) => `${r.record_id}/${r.field_path}`), ['m1/description.de'])
})
