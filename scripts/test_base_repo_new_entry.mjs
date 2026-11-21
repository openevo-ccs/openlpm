#!/usr/bin/env node
// Tests for adding a method in the Base Repo Explorer (feedback 5016dccd, Susan Hanisch 2026-11-18): the id made from a title, the refusal of a
// taken title, and how a record created in the app is built from its edit rows (src/lib/supabase/base-repo-edits.ts).
//   node scripts/test_base_repo_new_entry.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'new-entry-'))
const out = path.join(dir, 'edits.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/base-repo-edits.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', alias: { '@': path.join(root, 'src') } })
const E = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const edit = (record_id, field_path, after_value, extra = {}) => ({
  id: `${record_id}/${field_path}/${Math.random()}`, base_repo: 'methodsbase', record_id, field_path, before_value: null, after_value,
  is_reset: false, note: null, edited_by: 'u1', edited_at: '2026-11-18T10:00:00Z', exported_at: null, export_batch: null, ...extra,
})
const marker = (id, slug, extra = {}) => edit(id, '$new', { id, slug, methodClass: 'pedagogical-practice', status: 'active' }, extra)
const repoRow = (id, label) => ({ id, label, secondary: 'pedagogical-practice', filterValue: 'pedagogical-practice', review_status: null, data: { id, label: { en: label }, methodClass: 'pedagogical-practice' }, languages: ['en'], secondaryFilterValues: [] })

test('a title becomes a slug id: lowercase words joined by hyphens, accents and punctuation removed', () => {
  assert.equal(E.slugFromTitle('Group and sort to approach systematics'), 'group-and-sort-to-approach-systematics')
  assert.equal(E.slugFromTitle('  Separate “What is the trait for?” from “How did it come about?”  '), 'separate-what-is-the-trait-for-from-how-did-it-come-about')
  assert.equal(E.slugFromTitle('Schülervorstellungen: Ökologie & Évolution'), 'schulervorstellungen-okologie-evolution')
  assert.equal(E.slugFromTitle('???'), '')
})

test('a long title is cut at a word boundary and never ends with a hyphen', () => {
  const slug = E.slugFromTitle('word '.repeat(40))
  assert.ok(slug.length <= 80 && !slug.endsWith('-') && !slug.startsWith('-'), slug)
})

test('a new method gets the id OE-METHOD-<slug>, a taken title is refused, and an empty one too', () => {
  const ok = E.checkNewMethodTitle('Create family trees of relatives', ['OE-METHOD-other'])
  assert.deepEqual(ok, { ok: true, id: 'OE-METHOD-create-family-trees-of-relatives', slug: 'create-family-trees-of-relatives' })
  const taken = E.checkNewMethodTitle('Create family trees of relatives', ['OE-METHOD-create-family-trees-of-relatives'])
  assert.equal(taken.ok, false)
  assert.match(taken.problem, /already exists/)
  assert.equal(E.checkNewMethodTitle('   ', []).ok, false)
  assert.equal(E.checkNewMethodTitle('!!!', []).ok, false)
})

test('the id never carries a number the person did not type (ids are slugs)', () => {
  const r = E.checkNewMethodTitle('Quiz', [])
  assert.equal(r.id, 'OE-METHOD-quiz')
})

test('a record created in the app shows up with the fields from its edit rows', () => {
  const id = 'OE-METHOD-new-thing'
  const edits = [marker(id, 'new-thing'), edit(id, 'label.en', 'New thing'), edit(id, 'description.en', 'Does a thing.')]
  const rows = E.applyEdits('methodsbase', [repoRow('OE-METHOD-a', 'A')], edits)
  assert.equal(rows.length, 2)
  const made = rows.find((r) => r.id === id)
  assert.equal(made.createdInApp, true)
  assert.equal(made.label, 'New thing')
  assert.deepEqual(made.data.label, { en: 'New thing' })
  assert.equal(made.data.status, 'active')
  assert.deepEqual(made.editedPaths.sort(), ['description.en', 'label.en'])
  assert.equal(made.pendingEditCount, 3)
})

test('once the repo copy has the record, the marker is ignored and the record is not shown twice', () => {
  const id = 'OE-METHOD-new-thing'
  const edits = [marker(id, 'new-thing', { exported_at: 'x', export_batch: 'b' }), edit(id, 'label.en', 'New thing', { exported_at: 'x', export_batch: 'b' })]
  const rows = E.applyEdits('methodsbase', [repoRow(id, 'New thing')], edits)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].createdInApp, undefined)
})

test('the marker is not one of the fields that count as edited, and a record with only the marker still shows', () => {
  const id = 'OE-METHOD-bare'
  const rows = E.applyEdits('methodsbase', [], [marker(id, 'bare')])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].editedPaths, [])
  assert.equal(rows[0].createdInApp, true)
})

test('records without edits are returned as the same objects', () => {
  const a = repoRow('OE-METHOD-a', 'A')
  const b = repoRow('OE-METHOD-b', 'B')
  const rows = E.applyEdits('methodsbase', [a, b], [edit('OE-METHOD-b', 'label.en', 'Bee')])
  assert.equal(rows[0], a)
  assert.notEqual(rows[1], b)
})

test('a created record counts among the edits waiting to be sent back', () => {
  const id = 'OE-METHOD-bare'
  const pending = E.pendingEdits([marker(id, 'bare'), edit(id, 'label.en', 'Bare')])
  assert.equal(pending.length, 2)
  assert.ok(pending.some((e) => e.field_path === '$new'))
})

test('an edit that was sent back no longer covers the field, so a later change in the repo shows (Flash Round, 2026-11-18)', () => {
  const id = 'OE-METHOD-flash'
  const repo = { ...repoRow(id, 'Flash'), data: { id, label: { en: 'Flash' }, description: { en: 'NEW repo text' }, methodClass: 'pedagogical-practice' } }
  const sent = edit(id, 'description.en', 'OLD saved text', { exported_at: '2026-11-13T13:20:00Z', export_batch: 'b' })
  const rows = E.applyEdits('methodsbase', [repo], [sent])
  assert.equal(rows[0].data.description.en, 'NEW repo text')
  assert.deepEqual(rows[0].editedPaths, ['description.en'])
  assert.equal(rows[0].pendingEditCount, 0)
})

test('an edit that is still waiting covers the repo text, and a newer waiting edit wins over a sent one', () => {
  const id = 'OE-METHOD-flash'
  const repo = { ...repoRow(id, 'Flash'), data: { id, label: { en: 'Flash' }, description: { en: 'repo text' }, methodClass: 'pedagogical-practice' } }
  const sent = edit(id, 'description.en', 'sent text', { exported_at: '2026-11-13T13:20:00Z', edited_at: '2026-11-13T13:14:00Z' })
  const waiting = edit(id, 'description.en', 'waiting text', { edited_at: '2026-11-18T09:00:00Z' })
  const rows = E.applyEdits('methodsbase', [repo], [sent, waiting])
  assert.equal(rows[0].data.description.en, 'waiting text')
  assert.equal(rows[0].pendingEditCount, 1)
})

test('a record that exists only in the app keeps showing its edits even after they were sent back, until the repo copy has it', () => {
  const id = 'OE-METHOD-only-here'
  const edits = [marker(id, 'only-here', { exported_at: 'x' }), edit(id, 'label.en', 'Only here', { exported_at: 'x' })]
  const rows = E.applyEdits('methodsbase', [], edits)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].data.label.en, 'Only here')
})

console.log('')

test('every base can start an entry, each with its own id rule', () => {
  const id = (repo, name, taken = []) => { const r = E.checkNewEntryName(repo, name, taken); return r.ok ? r.id : r.problem }
  assert.equal(id('theorybase', 'Niche construction theory'), 'OE-THEORY-niche-construction-theory')
  assert.equal(id('literaturebase', 'The extended evolutionary synthesis'), 'OE-LITERATURE-the-extended-evolutionary-synthesis')
  assert.equal(id('questionbase', 'How do students use agency language?'), 'OE-QUESTION-how-do-students-use-agency-language')
  assert.equal(id('projectbase', 'eMu 2'), 'project:emu-2')
  assert.equal(id('teachingbase', 'Agency in evolution education'), 'agency-in-evolution-education')
})

test('a quote or competency makes its id from the first eight words only', () => {
  assert.equal(E.checkNewEntryName('quotebase', 'We think apes are especially good at cognizing things about the physical world and more', []).id, 'OE-QUOTE-we-think-apes-are-especially-good-at-cognizing')
  assert.equal(E.checkNewEntryName('competencybase', 'Students can explain how traits change across generations in a population', []).id, 'OE-COMPETENCY-students-can-explain-how-traits-change-across-generations')
})

test('a taken name is refused in every base, and an empty one too', () => {
  assert.equal(E.checkNewEntryName('theorybase', 'Commons dilemma', ['OE-THEORY-commons-dilemma']).ok, false)
  assert.equal(E.checkNewEntryName('projectbase', 'eMu', ['project:emu']).ok, false)
  assert.equal(E.checkNewEntryName('questionbase', '   ', []).ok, false)
})

test('the entry saves a marker row with the starter fields and the name at the path of that base', async () => {
  const saved = []
  const supabase = { from: () => ({ insert: async (rows) => { saved.push(...rows); return { error: null } } }) }
  const a = await E.createEntry(supabase, 'competencybase', { userId: 'u1', title: 'Students can explain adaptation', existingIds: [] })
  assert.equal(a.id, 'OE-COMPETENCY-students-can-explain-adaptation')
  assert.deepEqual(saved.map((r) => r.field_path), ['$new', 'statement.en'])
  assert.equal(saved[0].base_repo, 'competencybase')
  assert.equal(saved[0].after_value.type, 'oe:Competency')
  assert.equal(saved[1].after_value, 'Students can explain adaptation')
  saved.length = 0
  await E.createEntry(supabase, 'literaturebase', { userId: 'u1', title: 'A new book', existingIds: [] })
  assert.deepEqual(saved.map((r) => r.field_path), ['$new', 'citation.title'])
})

test('a new quote shows its text as the label in the table', () => {
  const edits = [
    { id: 'a', base_repo: 'quotebase', record_id: 'OE-QUOTE-x', field_path: '$new', before_value: null, after_value: { id: 'OE-QUOTE-x', slug: 'x', status: 'proposed' }, is_reset: false, note: null, edited_by: 'u1', edited_at: '2026-11-21T10:00:00Z', exported_at: null, export_batch: null },
    { id: 'b', base_repo: 'quotebase', record_id: 'OE-QUOTE-x', field_path: 'text', before_value: null, after_value: 'Culture is not a thing.', is_reset: false, note: null, edited_by: 'u1', edited_at: '2026-11-21T10:00:01Z', exported_at: null, export_batch: null },
  ]
  const rows = E.applyEdits('quotebase', [], edits)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'Culture is not a thing.')
  assert.equal(rows[0].createdInApp, true)
})
