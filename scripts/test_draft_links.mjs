#!/usr/bin/env node
// Tests for the grouping of links to draft parts (src/lib/comparison/draft-links.ts). Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_draft_links.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'draft-links-'))
const out = path.join(dir, 'draft-links.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/comparison/draft-links.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const D = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const part = (id, title, band, strandId, strandTitle, order) => ({ id, title, gradeBand: band, status: 'draft', strandId, strandTitle, order })
const link = (id, objectId, createdAt = '2026-10-30T10:00:00Z') => ({ id, objectId, recordId: 'r-' + id, relationType: 'proposed_relates_to', rationale: 'why', createdAt, createdBy: null, proposed: true })

test('groups links by strand and part, parts in band order', () => {
  const parts = [part('p3', 'C', '6-8', 's1', 'S1', 3), part('p1', 'A', 'K-2', 's1', 'S1', 1), part('p2', 'B', '3-5', 's1', 'S1', 2), part('q1', 'Q', '9-12', 's2', 'S2', 4)]
  const links = [link('l1', 'p3'), link('l2', 'p1'), link('l3', 'q1'), link('l4', 'p1', '2026-10-30T09:00:00Z')]
  const g = D.groupDraftLinks(parts, links)
  assert.deepEqual(g.strands.map((s) => s.strandTitle), ['S1', 'S2'])
  assert.deepEqual(g.strands[0].parts.map((p) => p.part.id), ['p1', 'p3'])
  assert.equal(g.linkCount, 4)
  assert.equal(g.strands[0].linkCount, 3)
  assert.deepEqual(g.strands[0].parts[0].links.map((l) => l.id), ['l4', 'l2'], 'oldest link first within a part')
})

test('parts without links are returned apart and never listed in a strand', () => {
  const parts = [part('p1', 'A', 'K-2', 's1', 'S1', 1), part('p2', 'B', '3-5', 's1', 'S1', 2)]
  const g = D.groupDraftLinks(parts, [link('l1', 'p1')])
  assert.deepEqual(g.withoutLinks.map((p) => p.id), ['p2'])
  assert.equal(g.strands[0].parts.length, 1)
})

test('links whose part is not a draft part are ignored', () => {
  const g = D.groupDraftLinks([part('p1', 'A', 'K-2', 's1', 'S1', 1)], [link('l1', 'accepted-part')])
  assert.equal(g.linkCount, 0)
  assert.equal(g.strands.length, 0)
})

test('parts with no strand come last', () => {
  const parts = [part('b1', 'Bridge', '3-5', null, null, 1), part('p1', 'A', 'K-2', 's1', 'S1', 5)]
  const g = D.groupDraftLinks(parts, [link('l1', 'b1'), link('l2', 'p1')])
  assert.deepEqual(g.strands.map((s) => s.strandId), ['s1', null])
})

test('empty input gives empty groups', () => {
  const g = D.groupDraftLinks([], [])
  assert.deepEqual(g, { strands: [], withoutLinks: [], linkCount: 0 })
})
