#!/usr/bin/env node
// Tests for how a concept's origin, field meanings and sources are read (src/lib/concept-source.ts).
//   node scripts/test_concept_source.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'concept-source-'))
const out = path.join(dir, 'concept-source.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/concept-source.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const C = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const el = (metadata, definition = null) => ({ definition, metadata })

test('no id means the concept belongs to the project', () => {
  assert.deepEqual(C.conceptSource(el({})), { kind: 'project' })
  assert.deepEqual(C.conceptSource(null), { kind: 'project' })
})

test('with the registry read, only an id in it counts as registered', () => {
  const reg = new Set(['OE-CONCEPT-bio-core-adaptation'])
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-bio-core-adaptation' }), reg).kind, 'conceptbase')
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-bio-core-speciation' }), reg).kind, 'proposed')
})

test('a flagged concept is proposed even when its id looks registered, if the registry was not read', () => {
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-x', proposed_not_in_conceptbase: true })).kind, 'proposed')
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-x' })).kind, 'conceptbase')
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-x' }), null).kind, 'conceptbase')
})

test('the registry beats the flag', () => {
  const reg = new Set(['OE-CONCEPT-x'])
  assert.equal(C.conceptSource(el({ conceptbase_id: 'OE-CONCEPT-x', proposed_not_in_conceptbase: true }), reg).kind, 'conceptbase')
})

test('definition comes from the column first, then from metadata', () => {
  assert.equal(C.conceptDefinition(el({ definition: 'from meta' }, 'from column')), 'from column')
  assert.equal(C.conceptDefinition(el({ definition: 'from meta' })), 'from meta')
  assert.equal(C.conceptDefinition(el({})), null)
})

test('field meanings are recognised by level or facet_of', () => {
  assert.equal(C.isFieldMeaning(el({ level: 'discipline-facet' })), true)
  assert.equal(C.isFieldMeaning(el({ facet_of: 'Agency' })), true)
  assert.equal(C.isFieldMeaning(el({ level: 'extension' })), false)
})

test('the field is the closing bracket of the label', () => {
  assert.equal(C.fieldOf('Agency (biology)'), 'biology')
  assert.equal(C.fieldOf('Agency (AI and computation)'), 'AI and computation')
  assert.equal(C.fieldOf('Agency'), null)
})

test('the extension gives the general wording and the does-not-carry-over note', () => {
  const x = C.conceptExtension(el({ proposed_extension: { general: 'G', excludes: 'E', confidence: 'medium', curriculum_use: 'U', draft_note: 'N', grounding: [] } }))
  assert.equal(x.general, 'G')
  assert.equal(x.excludes, 'E')
  assert.equal(x.confidence, 'medium')
  assert.equal(C.conceptExtension(el({})), null)
  assert.equal(C.conceptExtension(el({ proposed_extension: [] })), null)
})

test('sources keep citations and drop library-style codes', () => {
  const s = C.plainSources([
    'OE-CONCEPT-oe-interdisciplinary-agency',
    'OE-PROPOSITION-agency-legitimate-in-many-cases',
    'ConceptBase OE-CONCEPT-oe-interdisciplinary-agency',
    'doi:10.1002/bies.202100185 (Sultan, Moczek & Walsh 2022; Crossref-checked)',
    'ISBN 9781107122109 (Walsh 2015, Organisms, Agency, and Evolution; Open Library-checked)',
    'DOI 10.1080/00219266.2025.2486963 (Hanisch, Eirdosh & González Galli 2025, Crossref checked; LiteratureBase OE-LITERATURE-hanisch-2025)',
    'LiteratureBase OE-LITERATURE-ariew-panchanathan-2023 and OE-LITERATURE-moore-et-al-2002 (agency ascribed to evolution as a learning problem)',
  ])
  assert.equal(s.length, 3)
  assert.ok(s[0].startsWith('doi:10.1002'))
  for (const line of s) assert.ok(!/OE-[A-Z]+-/.test(line), line)
  assert.ok(s[2].includes('Hanisch, Eirdosh & González Galli 2025'))
})

test('sources tolerate a missing or odd grounding value', () => {
  assert.deepEqual(C.plainSources(undefined), [])
  assert.deepEqual(C.plainSources('text'), [])
  assert.deepEqual(C.plainSources([1, null, '']), [])
})
