#!/usr/bin/env node
// Tests for the review-state rule (src/lib/review-state.ts). Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_review_state.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'review-state-'))
const out = path.join(dir, 'review-state.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/review-state.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const R = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const row = (status, recommendation = null, reviewer_id = null) => ({ status, recommendation, reviewer_id })

test('no assignment means an AI draft', () => {
  assert.deepEqual(R.reviewSummary(undefined), { state: 'ai-draft', reviewers: 0 })
  assert.deepEqual(R.reviewSummary([]), { state: 'ai-draft', reviewers: 0 })
})

test('an assigned reviewer with no completed review means under review', () => {
  assert.equal(R.reviewSummary([row('pending')]).state, 'under-review')
  assert.equal(R.reviewSummary([row('in_progress'), row('pending')]).state, 'under-review')
})

test('one completed review is enough for reviewed, whatever it recommends', () => {
  assert.deepEqual(R.reviewSummary([row('completed', 'accept', 'a')]), { state: 'reviewed', reviewers: 1 })
  assert.deepEqual(R.reviewSummary([row('completed', 'revise', 'a')]), { state: 'reviewed', reviewers: 1 })
})

test('two completed reviews that agree stay reviewed and count both reviewers', () => {
  assert.deepEqual(R.reviewSummary([row('completed', 'revise', 'a'), row('completed', 'major_revision', 'b')]), { state: 'reviewed', reviewers: 2 })
  assert.deepEqual(R.reviewSummary([row('completed', 'accept', 'a'), row('completed', 'accept', 'b')]), { state: 'reviewed', reviewers: 2 })
})

test('one accept and one request for changes is contested', () => {
  assert.equal(R.reviewSummary([row('completed', 'accept', 'a'), row('completed', 'revise', 'b')]).state, 'contested')
  assert.equal(R.reviewSummary([row('completed', 'accept', 'a'), row('completed', 'reject', 'b')]).state, 'contested')
})

test('a pending row beside a completed one does not hide the completed review', () => {
  assert.deepEqual(R.reviewSummary([row('pending', null, 'b'), row('completed', 'accept', 'a')]), { state: 'reviewed', reviewers: 1 })
})

test('the same reviewer counted once', () => {
  assert.equal(R.reviewSummary([row('completed', 'accept', 'a'), row('completed', 'accept', 'a')]).reviewers, 1)
})

test('labels in both languages', () => {
  assert.equal(R.reviewStateLabel({ state: 'ai-draft', reviewers: 0 }), 'AI draft, no expert review yet')
  assert.equal(R.reviewStateLabel({ state: 'reviewed', reviewers: 1 }), 'Reviewed by 1 reviewer')
  assert.equal(R.reviewStateLabel({ state: 'reviewed', reviewers: 2 }), 'Reviewed by 2 reviewers')
  assert.equal(R.reviewStateLabel({ state: 'ai-draft', reviewers: 0 }, 'de'), 'KI-Entwurf, noch ohne fachliche Prüfung')
})

test('grouping by target', () => {
  const m = R.groupByTarget([{ reviewable_id: 'x' }, { reviewable_id: 'y' }, { reviewable_id: 'x' }])
  assert.equal(m.get('x').length, 2)
  assert.equal(m.get('y').length, 1)
})
