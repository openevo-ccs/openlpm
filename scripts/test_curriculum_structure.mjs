#!/usr/bin/env node
// Tests for the structure overview library (src/lib/supabase/curriculum-structure.ts): tree building, goal roll-up, labels, search.
//   node scripts/test_curriculum_structure.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'curriculum-structure-'))
const out = path.join(dir, 'structure.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/curriculum-structure.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const S = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const node = (id, parent, level, key, extra = {}) => ({
  id, parent_id: parent, level, node_key: key, sort_order: 0, label_de: null, label_en: null, summary_de: null, summary_en: null,
  subject: null, grade_band: null, ...extra,
})
const nodes = [
  node('e', null, 'edition', 'e', { label_de: 'Biologie', label_en: 'Biology', subject: 'biologie' }),
  node('b', 'e', 'grade_band', 'e/b', { label_en: 'Grade 9', grade_band: '9' }),
  node('t2', 'b', 'topic', 'e/b/t2', { label_de: 'Ökologie', label_en: 'Ecology', summary_en: 'Pupils study ecosystems.', sort_order: 2 }),
  node('t1', 'b', 'topic', 'e/b/t1', { label_de: 'Zellen', label_en: 'Cells', summary_de: 'Lernende mikroskopieren.', sort_order: 1 }),
  node('s1', 't1', 'subtopic', 'e/b/t1/s1', { label_en: 'Plant cells' }),
  node('orphan', 'missing', 'topic', 'x', { label_en: 'Lost' }),
]
const goals = new Map([
  ['s1', [{ projectId: 'p1', projectName: 'EvoMentor', goals: 3 }]],
  ['t2', [{ projectId: 'p1', projectName: 'EvoMentor', goals: 2 }, { projectId: 'p2', projectName: 'Sandbox', goals: 1 }]],
])

test('children are ordered by sort_order and orphans are dropped', () => {
  const roots = S.buildTree(nodes, goals)
  assert.equal(roots.length, 1)
  const band = roots[0].children[0]
  assert.deepEqual(band.children.map((c) => c.node.id), ['t1', 't2'])
  assert.equal(roots[0].descendants, 4)
})

test('goal counts roll up to every ancestor, per project', () => {
  const roots = S.buildTree(nodes, goals)
  const rolled = Object.fromEntries(roots[0].goals.map((g) => [g.projectId, g.goals]))
  assert.deepEqual(rolled, { p1: 5, p2: 1 })
  const t1 = roots[0].children[0].children[0]
  assert.deepEqual(t1.goals.map((g) => g.goals), [3])
})

test('labels fall back to the other language and say so', () => {
  const t1 = nodes.find((n) => n.id === 't1')
  assert.deepEqual(S.nodeLabel(t1, 'de'), { text: 'Zellen', fellBack: false })
  assert.deepEqual(S.nodeLabel(nodes.find((n) => n.id === 'b'), 'de'), { text: 'Grade 9', fellBack: true })
  assert.deepEqual(S.nodeSummary(nodes.find((n) => n.id === 't2'), 'de'), { text: 'Pupils study ecosystems.', fellBack: true })
  assert.deepEqual(S.nodeSummary(nodes.find((n) => n.id === 's1'), 'en'), { text: null, fellBack: false })
})

test('search keeps matches, their ancestors and their descendants, in either language', () => {
  const roots = S.buildTree(nodes, goals)
  assert.equal(S.searchMatches(roots, '  '), null)
  assert.deepEqual([...S.searchMatches(roots, 'mikroskopieren')].sort(), ['b', 'e', 's1', 't1'])
  assert.deepEqual([...S.searchMatches(roots, 'ecology')].sort(), ['b', 'e', 't2'])
  assert.deepEqual([...S.searchMatches(roots, 'zellen plant')].sort(), []) // every word must be in one node
  assert.equal(S.searchMatches(roots, 'nothing like this').size, 0)
})

test('review filter and counts cover topics, subtopics and units only', () => {
  const reviewed = nodes.map((n) => (n.id === 's1' ? { ...n, review_status: 'expert-reviewed' } : { ...n, review_status: 'ai-draft' }))
  const roots = S.buildTree(reviewed, goals)
  assert.deepEqual(S.reviewCounts(roots[0]), { reviewed: 1, total: 3 })
  assert.deepEqual([...S.reviewFilter(roots, 'reviewed')].sort(), ['b', 'e', 's1', 't1'])
  assert.deepEqual([...S.reviewFilter(roots, 'open')].sort(), ['b', 'e', 't1', 't2'])
})
