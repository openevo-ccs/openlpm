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

const vocab = { learningApproaches: [], methodClasses: [], methods: [] }
const paths = (data) => F.fieldsFor('methodsbase', data, vocab).map((f) => f.path)

test('a method with only an English name still offers a German name box (feedback c950e8f8)', () => {
  const p = paths({ label: { en: 'The Noticing Tool' }, description: { en: 'text' } })
  assert.ok(p.includes('label.en') && p.includes('label.de'))
  assert.ok(p.includes('description.de') && p.includes('whenToUse.de') && p.includes('protocolSteps.de'))
  assert.ok(p.indexOf('label.en') < p.indexOf('label.de'))
})

test('a plain string label counts as the English one and a record with both languages keeps both', () => {
  assert.deepEqual(paths({ label: 'ABC' }).filter((x) => x.startsWith('label')), ['label.en', 'label.de'])
  assert.deepEqual(paths({ label: { en: 'a', de: 'b' } }).filter((x) => x.startsWith('label')), ['label.en', 'label.de'])
  const f = F.fieldsFor('methodsbase', { label: 'ABC' }, vocab).find((x) => x.path === 'label.en')
  assert.equal(F.currentValue(f, { label: 'ABC' }), 'ABC')
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

test('a method can have two classes: the class box is a multi-select (Dustin, 2026-11-13)', () => {
  const classes = ['pedagogical-practice', 'research-method']
  const vocab2 = { learningApproaches: [], methodClasses: classes, methods: [{ id: 'OE-METHOD-a', label: 'A' }, { id: 'OE-METHOD-b', label: 'B' }] }
  const fields = F.fieldsFor('methodsbase', { id: 'OE-METHOD-a', methodClass: 'pedagogical-practice' }, vocab2)
  const cls = fields.find((f) => f.path === 'methodClass')
  assert.equal(cls.kind, 'multi')
  assert.deepEqual(cls.choices.map((c) => c.value), classes)
  // one choice stays a plain string, two become a list, none is empty
  assert.equal(F.parseInput(cls, 'research-method'), 'research-method')
  assert.deepEqual(F.parseInput(cls, 'pedagogical-practice,research-method'), ['pedagogical-practice', 'research-method'])
  assert.equal(F.parseInput(cls, ''), '')
  // a record left alone is not seen as changed, whether its class is a string or a list
  for (const stored of ['pedagogical-practice', ['pedagogical-practice', 'research-method']]) {
    const now = F.currentValue(cls, { methodClass: stored })
    assert.equal(F.sameValue(F.parseInput(cls, F.toInput(cls, now)), F.parseInput(cls, F.toInput(cls, now))), true)
    assert.deepEqual(F.parseInput(cls, F.toInput(cls, now)), stored)
  }
})

test('the broader method of a method is chosen from the other methods and always stored as a list', () => {
  const vocab2 = { learningApproaches: [], methodClasses: [], methods: [{ id: 'OE-METHOD-a', label: 'A' }, { id: 'OE-METHOD-b', label: 'B' }] }
  const f = F.fieldsFor('methodsbase', { id: 'OE-METHOD-a' }, vocab2).find((x) => x.path === 'broaderMethods')
  assert.equal(f.kind, 'multi')
  assert.equal(f.asList, true)
  assert.deepEqual(f.choices, [{ value: 'OE-METHOD-b', label: 'B' }], 'a method cannot be its own broader method')
  assert.deepEqual(F.parseInput(f, 'OE-METHOD-b'), ['OE-METHOD-b'])
  assert.deepEqual(F.parseInput(f, ''), [])
  assert.deepEqual(F.currentValue(f, { broaderMethods: ['OE-METHOD-b'] }), ['OE-METHOD-b'])
})

test('method classes read the same for a string, a list and nothing', () => {
  assert.deepEqual(M.methodClassesOf('research-method'), ['research-method'])
  assert.deepEqual(M.methodClassesOf(['pedagogical-practice', 'research-method']), ['pedagogical-practice', 'research-method'])
  assert.deepEqual(M.methodClassesOf(undefined), [])
  assert.equal(M.methodClassesReading(['pedagogical-practice', 'research-method'], 'de'), 'Unterrichtsmethoden, Forschungsmethoden')
  assert.equal(M.methodClassesReading('research-method', 'en'), 'research-method')
})

// ---- two languages for every text (Dustin, 2026-11-13) ----

const fieldsOf = (repo, data) => F.fieldsFor(repo, data, vocab)
const by = (fields, path) => fields.find((f) => f.path === path)

test('a text that is one plain string or list counts as English, and the first German text makes it a pair', () => {
  assert.equal(F.getPath({ discipline: 'Biology' }, 'discipline.en'), 'Biology')
  assert.equal(F.getPath({ discipline: 'Biology' }, 'discipline.de'), undefined)
  assert.deepEqual(F.getPath({ indicators: ['a', 'b'] }, 'indicators.en'), ['a', 'b'])
  assert.deepEqual(F.setPath({ discipline: 'Biology' }, 'discipline.de', 'Biologie'), { discipline: { en: 'Biology', de: 'Biologie' } })
  assert.deepEqual(F.setPath({ indicators: ['a'] }, 'indicators.de', ['x']), { indicators: { en: ['a'], de: ['x'] } })
  assert.deepEqual(F.setPath({ discipline: 'Biology' }, 'discipline.en', 'Life science'), { discipline: { en: 'Life science' } })
  assert.deepEqual(F.setPath({ developmentalProgression: { '6-8': 'text', 'K-2': 'other' } }, 'developmentalProgression.6-8.de', 'Text'), { developmentalProgression: { '6-8': { en: 'text', de: 'Text' }, 'K-2': 'other' } })
  // nothing is changed in the original, and a pair stays a pair
  const data = { label: { en: 'a' } }
  F.setPath(data, 'label.de', 'b')
  assert.deepEqual(data, { label: { en: 'a' } })
  assert.deepEqual(F.setPath({ label: { en: 'a', de: 'b' } }, 'label.de', 'c'), { label: { en: 'a', de: 'c' } })
  // other paths behave as before
  assert.equal(F.getPath({ citation: { title: 'T' } }, 'citation.title'), 'T')
  assert.deepEqual(F.setPath({ citation: { title: 'T' } }, 'citation.year', '2020'), { citation: { title: 'T', year: '2020' } })
})

test('discipline of a method is a pair of boxes even while it is one English line', () => {
  const data = { label: { en: 'A' }, discipline: 'Biology; chemistry' }
  const f = fieldsOf('methodsbase', data)
  assert.equal(F.currentValue(by(f, 'discipline.en'), data), 'Biology; chemistry')
  assert.equal(F.currentValue(by(f, 'discipline.de'), data), '')
  assert.ok(!f.some((x) => x.path === 'discipline'), 'no second, plain box for the same text')
  assert.equal(by(f, 'discipline.de').lang, 'de')
  assert.equal(by(f, 'discipline.de').pair, 'discipline')
})

test('competencies: the statement, the indicators and every grade-band description come in both languages', () => {
  const data = {
    id: 'OE-COMPETENCY-x', statement: { en: 'Be critical' }, indicators: ['Names a system'],
    developmentalProgression: { '6-8': 'Naming tools', 'K-2': 'Noticing', '9-12': 'Evaluating' }, domain: 'critical-pedagogy', humanCodingScheme: 'CAIL',
  }
  const f = fieldsOf('competencybase', data)
  const paths2 = f.map((x) => x.path)
  for (const p of ['statement.en', 'statement.de', 'indicators.en', 'indicators.de', 'developmentalProgression.K-2.en', 'developmentalProgression.K-2.de', 'developmentalProgression.9-12.de']) assert.ok(paths2.includes(p), p)
  assert.ok(!paths2.includes('developmentalProgression'), 'the grade bands are not offered a second time as one box')
  assert.ok(paths2.indexOf('developmentalProgression.K-2.en') < paths2.indexOf('developmentalProgression.6-8.en'), 'bands in grade order')
  assert.equal(by(f, 'indicators.en').kind, 'lines')
  assert.equal(F.currentValue(by(f, 'indicators.en'), data).join('|'), 'Names a system')
  assert.equal(F.currentValue(by(f, 'developmentalProgression.6-8.en'), data), 'Naming tools')
  // fields that do not depend on a language are folded away, the texts are not
  assert.equal(by(f, 'domain').group, 'other')
  assert.equal(by(f, 'statement.en').group, 'text')
  // a competency with a German statement only: the English box is empty
  const de = { statement: { de: 'Die Lernenden analysieren.' } }
  assert.equal(F.currentValue(by(fieldsOf('competencybase', de), 'statement.en'), de), '')
  assert.equal(F.currentValue(by(fieldsOf('competencybase', de), 'statement.de'), de), 'Die Lernenden analysieren.')
})

test('lessons: title and description in both languages, and the page address per language', () => {
  const data = { slug: 'x', title: { de: 'Kumulative Kultur', en: 'Cumulative culture' }, description: { de: 'd', en: 'e' }, source_pages: { de: 'https://a/de', en: 'https://a/en' }, grades: ['6-8'], subjects: [] }
  const f = fieldsOf('teachingbase', data)
  const p = f.map((x) => x.path)
  for (const x of ['title.en', 'title.de', 'description.en', 'description.de', 'source_pages.en', 'source_pages.de']) assert.ok(p.includes(x), x)
  assert.equal(by(f, 'grades').group, 'other')
  assert.ok(!p.includes('slug'))
})

test('a repo that holds English only has single boxes and nothing folded', () => {
  assert.equal(F.hasLanguagePairs('literaturebase'), false)
  assert.equal(F.hasLanguagePairs('methodsbase'), true)
  const f = fieldsOf('literaturebase', { citation: { title: 'T', year: 2020 } })
  assert.ok(f.every((x) => !x.lang && !x.group))
  const q = fieldsOf('questionbase', { id: 'OE-Q', label: 'L', statement: 'S' })
  assert.ok(q.every((x) => !x.lang && x.group !== 'other'))
})

test('tags show in the language of the form and are stored once', () => {
  const data = { learningApproaches: ['kooperativ', 'ein-neuer-ansatz'], lessonPhases: ['Einstieg'], methodClass: 'pedagogical-practice' }
  const f = fieldsOf('methodsbase', data)
  const la = by(f, 'learningApproaches')
  assert.equal(la.kind, 'multi')
  assert.equal(la.asList, true)
  assert.equal(la.reading('kooperativ', 'en'), 'Cooperative/social')
  assert.equal(la.reading('kooperativ', 'de'), 'kooperativ/sozial')
  assert.ok(la.choices.some((c) => c.value === 'ein-neuer-ansatz'), 'a tag the record has is always a choice')
  assert.ok(la.choices.some((c) => c.value === 'selbstreguliert'), 'the other tags of the vocabulary are choices too')
  const lp = by(f, 'lessonPhases')
  assert.equal(lp.reading('Einstieg', 'en'), 'Introduction')
  assert.deepEqual(F.parseInput(lp, 'Einstieg,Erarbeitung'), ['Einstieg', 'Erarbeitung'])
  const mc = by(f, 'methodClass')
  assert.equal(mc.reading('research-method', 'de'), 'Forschungsmethoden')
  assert.equal(mc.reading('research-method', 'en'), 'research-method')
  // an old misspelled tag reads as the corrected one
  const old = { learningApproaches: ['konzeptbasiert/vernetztend'] }
  assert.deepEqual(F.currentValue(by(fieldsOf('methodsbase', old), 'learningApproaches'), old), ['konzeptbasiert/vernetzend'])
})

test('edits in the history read as the field a person knows', () => {
  assert.equal(F.describePath('description.de'), 'Description (German)')
  assert.equal(F.describePath('developmentalProgression.6-8.en'), 'Developmental progression · 6-8 (English)')
  assert.equal(F.describePath('learningApproaches'), 'Learning approaches')
  assert.equal(F.describePath('citation.title'), 'Citation · Title')
})

test('saving a German text for a record that has none changes only that field', () => {
  const data = { label: { en: 'Noticing Tool' }, description: { en: 'Text' } }
  const f = fieldsOf('methodsbase', data)
  const de = by(f, 'description.de')
  const before = F.currentValue(de, data)
  const after = F.parseInput(de, 'Deutscher Text')
  assert.equal(F.sameValue(before, after), false)
  const next = F.setPath(data, de.path, after)
  assert.deepEqual(next.description, { en: 'Text', de: 'Deutscher Text' })
  assert.deepEqual(next.label, { en: 'Noticing Tool' })
  // the English box of the same record is unchanged
  const en = by(f, 'description.en')
  assert.equal(F.sameValue(F.parseInput(en, F.toInput(en, F.currentValue(en, data))), F.parseInput(en, F.toInput(en, F.currentValue(en, next)))), true)
})
