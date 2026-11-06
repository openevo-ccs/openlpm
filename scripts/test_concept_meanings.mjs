#!/usr/bin/env node
// Tests for the Concept meanings page helpers (src/lib/concept-meanings.ts) and for the snapshot file the page shows.
//   node scripts/test_concept_meanings.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'concept-meanings-'))
const out = path.join(dir, 'concept-meanings.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/concept-meanings.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const M = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
const snap = JSON.parse(readFileSync(path.join(root, 'src/data/concept-meanings.json'), 'utf8'))

const concept = (id, label, defs = {}, extra = {}) => ({ id, tier: 'registered', label, labels: {}, vocabulary: 'BIO-CORE-v1.0.0', status: 'stable', version: '1.0.0', aliases: {}, definitions: defs, examples: [], nonExamples: [], broader: [], narrower: [], related: [], citations: [], ...extra })

test('a comparison reference splits into word list and id', () => {
  assert.deepEqual(M.parseRef('BIO-CORE-v1.0.0:OE-CONCEPT-bio-core-natural-selection'), { vocabulary: 'BIO-CORE-v1.0.0', id: 'OE-CONCEPT-bio-core-natural-selection' })
  assert.deepEqual(M.parseRef('OE-CONCEPT-x'), { vocabulary: null, id: 'OE-CONCEPT-x' })
})

test('match types and statuses read in plain words, and an unknown one says so', () => {
  assert.equal(M.matchTypeLabel('skos:closeMatch'), 'Close in meaning')
  assert.equal(M.matchTypeLabel('skos:somethingNew'), 'Link of an unknown kind')
  assert.equal(M.alignmentStatusLabel('contested'), 'Contested (kept visible on purpose)')
  assert.equal(M.alignmentStatusChip('contested'), 'critical')
})

test('definitions list English first and keep every discipline', () => {
  const c = concept('OE-CONCEPT-a', 'A', { de: { biology: 'de text' }, en: { biology: 'b', culture: 'c' } })
  assert.deepEqual(M.definitionRows(c).map((d) => `${d.lang}/${d.discipline}`), ['en/biology', 'en/culture', 'de/biology'])
})

test('a comparison is found from either side', () => {
  const a = { id: 'OE-ALIGN-1', subject: 'BIO-CORE-v1.0.0:OE-CONCEPT-bio-core-natural-selection', object: 'OE-INTERDISCIPLINARY-v1.0.0:OE-CONCEPT-oe-interdisciplinary-selection', matchType: 'skos:closeMatch', status: 'contested', assertedBy: [], date: null, rationale: '' }
  assert.equal(M.alignmentsFor('OE-CONCEPT-bio-core-natural-selection', [a])[0].other.id, 'OE-CONCEPT-oe-interdisciplinary-selection')
  assert.equal(M.alignmentsFor('OE-CONCEPT-oe-interdisciplinary-selection', [a])[0].side, 'object')
  assert.equal(M.alignmentsFor('OE-CONCEPT-other', [a]).length, 0)
})

test('search finds a word in the label, the id, an alias or a definition', () => {
  const list = [concept('OE-CONCEPT-a', 'Selection', { en: { biology: 'differential success' } }, { aliases: { en: ['Selective Process'] } }), concept('OE-CONCEPT-b', 'Drift', { en: { biology: 'random change' } })]
  assert.equal(M.searchConcepts(list, 'selective').length, 1)
  assert.equal(M.searchConcepts(list, 'random').length, 1)
  assert.equal(M.searchConcepts(list, '').length, 2)
})

test('the id changes of the unmerged branch pair each old id with the new one', () => {
  const ch = M.idChanges([{ ...concept('OE-CONCEPT-000102', 'Natural Selection'), tier: 'pending', replaces: 'OE-CONCEPT-bio-core-natural-selection', sameDefinitionAsReplaced: true }, { ...concept('OE-CONCEPT-000120', 'Sexual Selection'), tier: 'pending', replaces: null }])
  assert.deepEqual(ch, [{ oldId: 'OE-CONCEPT-bio-core-natural-selection', newId: 'OE-CONCEPT-000102', label: 'Natural Selection', sameDefinition: true }])
})

test('the snapshot: every id change is a registered concept, with the same definition', () => {
  const ids = new Set(snap.concepts.map((c) => c.id))
  const changes = M.idChanges(snap.pending)
  assert.ok(changes.length >= 10)
  for (const c of changes) {
    assert.ok(ids.has(c.oldId), c.oldId)
    assert.equal(c.sameDefinition, true, `${c.label} changed its definition`)
  }
})

test('the snapshot: no model tag points at a concept except through the list of same words, and every tag is sorted', () => {
  for (const t of snap.netlogoTags) {
    assert.notEqual(t.pile, 'unsorted', t.tag)
    assert.ok(Array.isArray(t.sameWord))
  }
  assert.equal(snap.netlogoTags.length, 33)
})

test('the snapshot: every concept named in a comparison exists in the copy (a comparison may also name a competency)', () => {
  const ids = new Set(snap.concepts.map((c) => c.id))
  for (const a of snap.alignments) {
    for (const ref of [a.subject, a.object]) {
      const id = M.parseRef(ref).id
      if (id.startsWith('OE-CONCEPT-') || id.startsWith('OE-SANDBOX-CONCEPT-')) assert.ok(ids.has(id), ref)
    }
    assert.ok([a.subject, a.object].some((r) => ids.has(M.parseRef(r).id)), a.id)
  }
})

test('the snapshot: a contested comparison stays visible (the specification requires it)', () => {
  const natural = snap.concepts.find((c) => c.id === 'OE-CONCEPT-bio-core-natural-selection')
  const rows = M.alignmentsFor(natural.id, snap.alignments)
  assert.ok(rows.some((r) => r.alignment.status === 'contested'))
})
