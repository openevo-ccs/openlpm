#!/usr/bin/env node
// Tests for which view a viewer gets first (src/lib/supabase/dashboard-views.ts). Bundles with esbuild, then runs node:test.
//   node scripts/test_dashboard_views.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'views-'))
const out = path.join(dir, 'views.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/dashboard-views.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['@supabase/supabase-js'] })
const V = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const view = (id, template_id, extra = {}) => ({ id, project_id: 'p', name: id, kind: template_id ? 'template' : 'standard', page_keys: [], template_id, is_default: false, is_forced: false, created_at: '', ...extra })
const de = view('de', 'x-germany-de'), us = view('us', 'x-united-states-en'), cross = view('cross', 'x-cross-national-en')
const review = view('review', null, { is_default: true, page_keys: ['strands', 'review'] })
const role = (v, r) => ({ view_id: v.id, target_type: 'role', target_value: r })
const viewer = (r, language) => ({ userId: 'u', role: r, joinedVia: null, groupIds: [], language })

test('a German browser gets the German view, any other the English cross-national view', () => {
  const views = [us, cross, de], a = ['viewer'].flatMap((r) => views.map((v) => role(v, r)))
  assert.equal(V.resolveViewerViews(views, a, viewer('viewer', 'de-DE')).defaultViewId, 'de')
  assert.equal(V.resolveViewerViews(views, a, viewer('viewer', 'en-US')).defaultViewId, 'cross')
  assert.equal(V.resolveViewerViews(views, a, viewer('viewer', undefined)).defaultViewId, 'cross')
})

test('the result no longer depends on the order of the assignment rows', () => {
  const views = [de, us, cross], a = views.map((v) => role(v, 'viewer'))
  const first = V.resolveViewerViews(views, a, viewer('viewer', 'fr')).defaultViewId
  const second = V.resolveViewerViews(views, [...a].reverse(), viewer('viewer', 'fr')).defaultViewId
  assert.equal(first, 'cross')
  assert.equal(second, 'cross')
})

test('a reviewer lands on the default Review view and can still switch to the comparison views', () => {
  const views = [de, us, cross, review], a = [de, us, cross, review].map((v) => role(v, 'reviewer'))
  const r = V.resolveViewerViews(views, a, viewer('reviewer', 'de-DE'))
  assert.equal(r.defaultViewId, 'review')
  assert.equal(r.forcedView, null)
  assert.deepEqual(r.eligibleViews.map((v) => v.id).sort(), ['cross', 'de', 'review', 'us'])
})

test('viewers never see the Review view', () => {
  const views = [de, us, cross, review], a = [...[de, us, cross].map((v) => role(v, 'viewer')), role(review, 'reviewer')]
  const r = V.resolveViewerViews(views, a, viewer('viewer', 'en'))
  assert.ok(!r.eligibleViews.some((v) => v.id === 'review'))
})

test('a forced view still wins and removes the switcher', () => {
  const forced = view('forced', 'x-germany-de', { is_forced: true })
  const r = V.resolveViewerViews([forced, cross], [role(forced, 'viewer'), role(cross, 'viewer')], viewer('viewer', 'en'))
  assert.equal(r.forcedView.id, 'forced')
  assert.deepEqual(r.eligibleViews, [])
})

test('owners and maintainers see everything with no default', () => {
  const r = V.resolveViewerViews([de, cross], [], viewer('owner', 'de'))
  assert.equal(r.defaultViewId, null)
  assert.equal(r.eligibleViews.length, 2)
})
