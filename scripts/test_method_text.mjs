#!/usr/bin/env node
// Tests for how method text in two languages is read (src/lib/method-text.ts).
//   node scripts/test_method_text.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'method-text-'))
const out = path.join(dir, 'method-text.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/method-text.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const M = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

test('a reader gets the preferred language, then English, then German', () => {
  const label = { en: 'ABC Method', de: 'ABC-Methode' }
  assert.deepEqual(M.pickLocalized(label, 'de'), { text: 'ABC-Methode', lang: 'de' })
  assert.deepEqual(M.pickLocalized(label, 'en'), { text: 'ABC Method', lang: 'en' })
  assert.deepEqual(M.pickLocalized({ de: 'Nur Deutsch' }, 'en'), { text: 'Nur Deutsch', lang: 'de' })
  assert.deepEqual(M.pickLocalized({ en: 'Only English' }, 'de'), { text: 'Only English', lang: 'en' })
})

test('the answer says which language the text is in, so a screen can label it', () => {
  assert.equal(M.pickLocalized({ en: 'x' }, 'de').lang, 'en')
  assert.equal(M.pickLocalized('plain text', 'de').lang, '')
  assert.equal(M.pickLocalized(null, 'de'), null)
  assert.equal(M.pickLocalized({ en: '   ' }, 'de'), null)
})

test('a name stored as JSON text in the database is read the same way', () => {
  assert.deepEqual(M.pickLocalized('{"en":"ABC Method","de":"ABC-Methode"}', 'de'), { text: 'ABC-Methode', lang: 'de' })
  assert.equal(M.pickLocalized('{not json', 'en').text, '{not json')
})

test('the other languages of a field are listed for display', () => {
  assert.deepEqual(M.otherLanguages({ en: 'ABC Method', de: 'ABC-Methode' }, 'en'), [{ text: 'ABC-Methode', lang: 'de' }])
  assert.deepEqual(M.otherLanguages({ en: 'ABC Method' }, 'en'), [])
  assert.deepEqual(M.languagesOf({ en: 'a', de: '' }), ['en'])
})

test('step lists are picked by language too', () => {
  assert.deepEqual(M.pickLocalizedList({ en: ['one', 'two'] }, 'de'), { items: ['one', 'two'], lang: 'en' })
  assert.deepEqual(M.pickLocalizedList({ en: ['one'], de: ['eins'] }, 'de'), { items: ['eins'], lang: 'de' })
  assert.equal(M.pickLocalizedList({ en: [] }, 'en'), null)
})

test('a tag reads German for German readers and English with the German term for the rest', () => {
  assert.equal(M.tagLabel('lessonPhases', 'Einstieg', 'de'), 'Einstieg')
  assert.equal(M.tagLabel('lessonPhases', 'Einstieg', 'en'), 'Introduction (Einstieg)')
  assert.equal(M.tagLabel('learningApproaches', 'kooperativ', 'en'), 'Cooperative (kooperativ)')
  assert.equal(M.tagLabel('learningApproaches', 'unbekannt', 'en'), 'unbekannt')
})

test('the old misspelling of a learning approach reads as the corrected one', () => {
  assert.equal(M.normalizeTag('konzeptbasiert/vernetztend'), 'konzeptbasiert/vernetzend')
  assert.equal(M.normalizeTag('kooperativ'), 'kooperativ')
  assert.equal(M.tagReading('learningApproaches', 'konzeptbasiert/vernetztend', 'de'), 'konzeptbasiert/vernetzend')
  assert.equal(M.tagReading('learningApproaches', 'konzeptbasiert/vernetztend', 'en'), 'Conceptual/networked')
  assert.equal(M.tagLabel('learningApproaches', 'konzeptbasiert/vernetzend', 'en'), 'Conceptual/networked (konzeptbasiert/vernetzend)')
})

test('a project works in its first working language, English when none is set', () => {
  assert.equal(M.projectUiLanguage(['de']), 'de')
  assert.equal(M.projectUiLanguage(['de', 'en']), 'de')
  assert.equal(M.projectUiLanguage([]), 'en')
  assert.equal(M.projectUiLanguage(null), 'en')
})

test('German texts that Claude drafted are marked until an expert has read them', () => {
  const draft = { textStatus: { de: { state: 'claude-draft-unreviewed', draftedOn: '2026-11-08' } } }
  assert.equal(M.textState(draft, 'de'), 'claude-draft-unreviewed')
  assert.equal(M.textState(draft, 'en'), 'original')
  assert.equal(M.textState({ textStatus: { de: { state: 'reviewed' } } }, 'de'), 'reviewed')
  assert.equal(M.textState({}, 'de'), 'original')
  assert.equal(M.textState(null, 'de'), 'original')
})

// The app keeps its own copy of the English tag readings. When the MethodsBase checkout sits next to this repo, check that
// the two agree, so a new tag cannot be added on one side only.
const vocabPath = path.join(process.env.METHODSBASE_PATH ?? path.join(root, '..', 'methodsbase'), 'vocabularies', 'method-tags.yaml')
test('the app copy of the tag readings matches methodsbase/vocabularies/method-tags.yaml', { skip: !existsSync(vocabPath) }, () => {
  const vocab = yaml.load(readFileSync(vocabPath, 'utf8'))
  for (const [field, entries] of Object.entries(vocab)) {
    const mine = M.TAG_READINGS[field]
    assert.ok(mine, `no readings for ${field}`)
    assert.deepEqual(Object.fromEntries(entries.map((e) => [e.term, e.en])), mine, field)
  }
})
