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

test('hierarchy layout: the general item is on top, each step down is one tier lower and a parent is centred over its children', () => {
  const ids = ['models', 'sim', 'abm', 'other']
  const links = [['abm', 'sim'], ['sim', 'models']]
  const p = G.hierarchyLayoutPositions(ids, links)
  assert.ok(p.get('models').y < p.get('sim').y && p.get('sim').y < p.get('abm').y)
  const tiers = [p.get('models').y, p.get('sim').y, p.get('abm').y]
  assert.equal(tiers[1] - tiers[0], tiers[2] - tiers[1])
  assert.equal(p.get('models').x, p.get('abm').x, 'a chain stands straight')
  assert.ok(p.get('other').y > p.get('abm').y, 'an item in no link goes under the tree')
})

test('hierarchy layout: two children share a parent that sits in the middle above them', () => {
  const p = G.hierarchyLayoutPositions(['top', 'a', 'b'], [['a', 'top'], ['b', 'top']])
  assert.ok(p.get('a').x < p.get('b').x)
  assert.equal(p.get('top').x, (p.get('a').x + p.get('b').x) / 2)
  assert.equal(p.get('a').y, p.get('b').y)
})

test('hierarchy layout: an item with two broader items sits under the deeper one, and no two items share a spot', () => {
  const ids = ['root', 'mid', 'leaf', 'otherRoot', 'otherLeaf']
  const links = [['mid', 'root'], ['leaf', 'mid'], ['leaf', 'otherRoot'], ['otherLeaf', 'otherRoot']]
  const p = G.hierarchyLayoutPositions(ids, links)
  assert.ok(p.get('leaf').y > p.get('mid').y, 'one tier below the deepest broader item')
  assert.equal(new Set([...p.values()].map((v) => `${v.x},${v.y}`)).size, ids.length)
})

test('hierarchy layout: a cycle in the data and a link to an unknown id do not break it, and the result is the same every time', () => {
  const ids = ['a', 'b', 'c']
  const links = [['a', 'b'], ['b', 'a'], ['c', 'zzz']]
  const p1 = G.hierarchyLayoutPositions(ids, links)
  const p2 = G.hierarchyLayoutPositions(ids, links)
  assert.equal(p1.size, 3)
  assert.deepEqual([...p1], [...p2])
  assert.equal(G.hierarchyLayoutPositions([], []).size, 0)
})

test('the saved layout setting may be hierarchy', () => {
  assert.equal(G.sanitizeGraphSettings({ layout: 'hierarchy' }).layout, 'hierarchy')
  assert.equal(G.sanitizeGraphSettings({ layout: 'nonsense' }).layout, 'fixed')
})

test('hierarchy layout: many leaves under one parent are wrapped into a grid, so the picture is not one long row', () => {
  const leaves = Array.from({ length: 40 }, (_, i) => `leaf${i}`)
  const ids = ['area', ...leaves]
  const p = G.hierarchyLayoutPositions(ids, leaves.map((l) => [l, 'area']))
  const xs = leaves.map((l) => p.get(l).x)
  const width = Math.max(...xs) - Math.min(...xs)
  assert.ok(width < 40 * 130 / 3, `width ${width}`)
  assert.ok(leaves.every((l) => p.get(l).y > p.get('area').y), 'every leaf is below its parent')
  assert.equal(new Set([...p.values()].map((v) => `${v.x},${v.y}`)).size, ids.length, 'no two items share a spot')
  const mid = (Math.max(...xs) + Math.min(...xs)) / 2
  assert.equal(p.get('area').x, mid, 'the parent is centred over the grid')
})

test('hierarchy layout: a parent with a few leaves keeps them in one row, and an area with sub-areas is not wrapped', () => {
  const few = G.hierarchyLayoutPositions(['p', 'a', 'b', 'c'], [['a', 'p'], ['b', 'p'], ['c', 'p']])
  assert.equal(few.get('a').y, few.get('c').y)
  const ids = ['top', 's1', 's2', ...Array.from({ length: 8 }, (_, i) => `x${i}`)]
  const links = [['s1', 'top'], ['s2', 'top'], ...Array.from({ length: 8 }, (_, i) => [`x${i}`, i < 4 ? 's1' : 's2'])]
  const p = G.hierarchyLayoutPositions(ids, links)
  assert.equal(p.get('s1').y, p.get('s2').y, 'the two sub-areas are on one tier')
  assert.ok(p.get('x0').y > p.get('s1').y)
})

test('hierarchy layout: many separate trees are packed into rows instead of one long strip, and tiers are reported', () => {
  const ids = []
  const links = []
  for (let t = 0; t < 30; t++) {
    ids.push(`root${t}`, `a${t}`, `b${t}`)
    links.push([`a${t}`, `root${t}`], [`b${t}`, `root${t}`])
  }
  const tiers = new Map()
  const p = G.hierarchyLayoutPositions(ids, links, { tiersOut: tiers })
  const xs = [...p.values()].map((v) => v.x)
  const ys = [...p.values()].map((v) => v.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  assert.ok(width < 30 * 3 * 130 / 2, `width ${width}`)
  assert.ok(height > 120 * 2, `height ${height}: the trees are in more than one row`)
  assert.equal(new Set([...p.values()].map((v) => `${v.x},${v.y}`)).size, ids.length, 'no two items share a spot')
  assert.equal(tiers.get('root0'), 0)
  assert.equal(tiers.get('a7'), 1)
})
