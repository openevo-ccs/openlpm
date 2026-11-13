#!/usr/bin/env node
// Tests for the grouped block layout of the graph kit (blockLayoutPositions in src/lib/graph-standards.ts).
//   node scripts/test_graph_block_layout.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'block-layout-'))
const out = path.join(dir, 'graph-standards.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/graph-standards.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const G = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const ids = Array.from({ length: 60 }, (_, i) => `n${i}`)
// Group A: a star of 10 around n0. Group B: a chain of 4. Group C: a pair. The rest have no link.
const links = [
  ...Array.from({ length: 9 }, (_, i) => ['n0', `n${i + 1}`]),
  ['n20', 'n21'], ['n21', 'n22'], ['n22', 'n23'],
  ['n30', 'n31'],
]

test('every item gets a position and no two items share one', () => {
  const p = G.blockLayoutPositions(ids, links)
  assert.equal(p.size, ids.length)
  assert.equal(new Set([...p.values()].map((v) => `${v.x},${v.y}`)).size, ids.length)
})

test('the same input gives the same picture', () => {
  assert.deepEqual([...G.blockLayoutPositions(ids, links)], [...G.blockLayoutPositions(ids, links)])
})

test('linked items sit close together, much closer than the width of the whole picture', () => {
  const p = G.blockLayoutPositions(ids, links)
  const all = [...p.values()]
  const width = Math.max(...all.map((v) => v.x)) - Math.min(...all.map((v) => v.x))
  for (const [a, b] of links) {
    const d = Math.hypot(p.get(a).x - p.get(b).x, p.get(a).y - p.get(b).y)
    assert.ok(d <= 60 * 5, `${a}-${b} ${d}`)
  }
  assert.ok(width > 60 * 5)
})

test('the biggest linked group comes first and items without a link come last', () => {
  const p = G.blockLayoutPositions(ids, links)
  const group = (list) => list.map((id) => p.get(id))
  const starY = Math.min(...group(['n0', 'n1', 'n9']).map((v) => v.y))
  const aloneY = Math.min(...group(['n40', 'n59']).map((v) => v.y))
  assert.ok(starY <= Math.min(...group(['n20', 'n30']).map((v) => v.y)))
  assert.ok(aloneY >= starY)
  // the items without a link share one block: none of them is placed among the linked blocks
  const blockXY = group(['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'])
  for (const id of ['n40', 'n41', 'n42']) assert.ok(!blockXY.some((b) => b.x === p.get(id).x && b.y === p.get(id).y))
})

test('an empty or all-alone input works', () => {
  assert.equal(G.blockLayoutPositions([], []).size, 0)
  assert.equal(G.blockLayoutPositions(['a', 'b', 'c'], []).size, 3)
  assert.equal(G.blockLayoutPositions(['a', 'b'], [['a', 'zzz']]).size, 2)
})

test('physics uses fewer rounds for a big graph', () => {
  assert.equal(G.physicsLayoutOptions(50, 100).numIter, 1000)
  assert.equal(G.physicsLayoutOptions(50, 954).numIter, 200)
})
