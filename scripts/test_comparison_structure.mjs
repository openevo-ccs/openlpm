#!/usr/bin/env node
// Tests for the size-corrected structure measures (src/lib/comparison/structure.ts).
//   node scripts/test_comparison_structure.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'structure-'))
const out = path.join(dir, 'structure.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/comparison/structure.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const S = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const part = (id, ...cs) => ({ id, concepts: cs.map((c) => ({ id: c.replace('*', ''), primary: c.endsWith('*') })) })

test('measures on a small known structure', () => {
  // a: x*, y   b: y*, z   c: w*   (a and b share y; c stands alone)
  const m = S.measureStructure([part('a', 'x*', 'y'), part('b', 'y*', 'z'), part('c', 'w*')])
  assert.equal(m.parts, 3)
  assert.equal(m.conceptsUsed, 4)
  assert.equal(m.conceptsPerPart, 5 / 3)
  assert.equal(m.mainShare, 3 / 5)
  assert.equal(m.joinedPairs, 1 / 3)
  assert.equal(m.largestGroup, 2 / 3)
  // Jaccard: a-b = 1/3, a-c = 0, b-c = 0
  assert.ok(Math.abs(m.partOverlap - 1 / 9) < 1e-12)
  // weights x1 y2 z1 w1: spread below 1 and above 0
  assert.ok(m.conceptSpread > 0.9 && m.conceptSpread < 1)
})

test('one part has no pair measures', () => {
  const m = S.measureStructure([part('a', 'x*')])
  assert.equal(m.partOverlap, null)
  assert.equal(m.joinedPairs, null)
  assert.equal(m.conceptSpread, null)
})

test('a subsample of every part equals the observed value with no range', () => {
  const parts = [part('a', 'x*', 'y'), part('b', 'y*', 'z'), part('c', 'w*')]
  const obs = S.measureStructure(parts)
  const r = S.subsampleParts(parts, 3, 50, 1)
  for (const k of S.MEASURE_KEYS) {
    if (obs[k] === null) continue
    assert.ok(Math.abs(r[k].mean - obs[k]) < 1e-12, k)
    assert.ok(Math.abs(r[k].hi - r[k].lo) < 1e-12, k)
  }
})

test('subsampling is repeatable for one seed and differs for another', () => {
  const parts = Array.from({ length: 16 }, (_, i) => part('p' + i, 'c' + (i % 5) + '*', 'c' + ((i * 3) % 7)))
  const a = S.subsampleParts(parts, 12, 100, 5)
  const b = S.subsampleParts(parts, 12, 100, 5)
  const c = S.subsampleParts(parts, 12, 100, 6)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.conceptsUsed, c.conceptsUsed)
})

test('a smaller sample sees fewer concepts than the whole', () => {
  const parts = Array.from({ length: 16 }, (_, i) => part('p' + i, 'u' + i + '*'))
  const r = S.subsampleParts(parts, 8, 50, 2)
  assert.equal(r.conceptsUsed.mean, 8)
  assert.ok(S.measureStructure(parts).conceptsUsed === 16)
})

test('dropping no links leaves every measure unchanged', () => {
  const parts = [part('a', 'x*', 'y'), part('b', 'y*', 'z'), part('c', 'w*')]
  const obs = S.measureStructure(parts)
  const r = S.dropLinks(parts, 0, 20, 3)
  for (const k of S.MEASURE_KEYS) {
    if (obs[k] === null) continue
    assert.ok(Math.abs(r[k].mean - obs[k]) < 1e-12, k)
    assert.ok(Math.abs(r[k].hi - r[k].lo) < 1e-12, k)
  }
})

test('dropping a tenth of the links moves the measures by a bounded amount', () => {
  const parts = Array.from({ length: 12 }, (_, i) => part('p' + i, 'c' + (i % 4) + '*', 'c' + ((i + 1) % 4), 'c' + ((i + 2) % 6)))
  const obs = S.measureStructure(parts)
  const r = S.dropLinks(parts, 0.1, 100, 4)
  assert.ok(r.conceptsPerPart.mean < obs.conceptsPerPart)
  assert.ok(r.conceptsPerPart.mean > obs.conceptsPerPart * 0.8)
  assert.ok(r.conceptsPerPart.lo <= r.conceptsPerPart.hi)
})
