#!/usr/bin/env node
// Tests for the Explorer's edit form logic (src/lib/base-repo-edit-fields.ts) and the German method class names.
//   node scripts/test_base_repo_edit_fields.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'edit-fields-'))
const out = path.join(dir, 'edit-fields.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/base-repo-edit-fields.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const F = await import(pathToFileURL(out).href)
const outM = path.join(dir, 'method-text.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/method-text.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outM, logLevel: 'error' })
const M = await import(pathToFileURL(outM).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const vocab = { learningApproaches: [], methodClasses: [] }
const paths = (data) => F.fieldsFor('methodsbase', data, vocab).map((f) => f.path)

test('a method with only an English name still offers a German name box (feedback c950e8f8)', () => {
  const p = paths({ label: { en: 'The Noticing Tool' }, description: { en: 'text' } })
  assert.ok(p.includes('label.en') && p.includes('label.de'))
  assert.ok(p.includes('description.de') && p.includes('whenToUse.de') && p.includes('protocolSteps.de'))
  assert.ok(p.indexOf('label.en') < p.indexOf('label.de'))
})

test('a plain string label stays one box and a record with both languages keeps both', () => {
  assert.deepEqual(paths({ label: 'ABC' }).filter((x) => x.startsWith('label')), ['label'])
  assert.deepEqual(paths({ label: { en: 'a', de: 'b' } }).filter((x) => x.startsWith('label')), ['label.en', 'label.de'])
})

test('saving an empty German box changes nothing', () => {
  const data = { label: { en: 'The Noticing Tool' } }
  const f = F.fieldsFor('methodsbase', data, vocab).find((x) => x.path === 'label.de')
  assert.equal(F.toInput(f, F.currentValue(f, data)), '')
  assert.equal(F.sameValue(F.parseInput(f, F.toInput(f, F.currentValue(f, data))), F.parseInput(f, '')), true)
})

const sources = [
  { citation: 'Hofstadter, D. R., & Sander, E. (2013). Surfaces and Essences. Basic Books.', literatureRef: 'OE-LITERATURE-hofstadter-sander-2013' },
  { citation: 'Hanisch, S. et al. (2023). Evolving cooperation. UA Editora.', doi: '10.17617/2.3486776', literatureRef: 'OE-LITERATURE-hanisch-eirdosh-morgan-2023' },
]
const sourceField = () => F.fieldsFor('methodsbase', { primarySources: sources }, vocab).find((x) => x.path === 'primarySources')

test('primary sources are editable, one line each, and a line left alone keeps every key (feedback 53ccb804)', () => {
  const f = sourceField()
  assert.equal(f.kind, 'sources')
  const text = F.toInput(f, F.currentValue(f, { primarySources: sources }))
  assert.equal(text.split('\n').length, 2)
  assert.match(text, /\| https:\/\/doi\.org\/10\.17617\/2\.3486776$/m)
  assert.deepEqual(F.parseInput(f, text), sources)
})

test('changing a source line keeps its LiteratureBase link, a new line is a new entry, a removed line is gone', () => {
  const f = sourceField()
  const lines = F.toInput(f, sources).split('\n')
  const edited = F.parseInput(f, [lines[0].replace('Basic Books', 'Basic Books, New York'), lines[1]].join('\n'))
  assert.equal(edited[0].literatureRef, 'OE-LITERATURE-hofstadter-sander-2013')
  assert.match(edited[0].citation, /New York/)
  assert.deepEqual(edited[1], sources[1])
  const added = F.parseInput(f, [...lines, 'Kattmann, U. (2007). Didaktische Rekonstruktion. | https://example.org/kattmann'].join('\n'))
  assert.equal(added.length, 3)
  assert.deepEqual(added[2], { citation: 'Kattmann, U. (2007). Didaktische Rekonstruktion.', url: 'https://example.org/kattmann' })
  assert.deepEqual(F.parseInput(f, lines[1]), [sources[1]])
})

test('a link typed as a DOI address or a bare DOI is stored as a DOI', () => {
  const f = sourceField()
  assert.deepEqual(F.parseInput(f, 'A paper. | https://doi.org/10.1000/xyz123'), [{ citation: 'A paper.', doi: '10.1000/xyz123' }])
  assert.deepEqual(F.parseInput(f, 'A paper. | 10.1000/xyz123'), [{ citation: 'A paper.', doi: '10.1000/xyz123' }])
  assert.deepEqual(F.parseInput(f, 'A paper with a | bar inside and no link'), [{ citation: 'A paper with a | bar inside and no link' }])
})

test('the German reader sees the method classes as Unterrichtsmethoden and Forschungsmethoden (feedback b28a398a)', () => {
  assert.equal(M.methodClassReading('pedagogical-practice', 'de'), 'Unterrichtsmethoden')
  assert.equal(M.methodClassReading('research-method', 'de'), 'Forschungsmethoden')
  assert.equal(M.methodClassReading('pedagogical-practice', 'en'), 'pedagogical-practice')
  assert.equal(M.methodClassReading('something-new', 'de'), 'something-new')
})
