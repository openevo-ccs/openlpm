#!/usr/bin/env node
// Tests for checking and correcting a theory of schooling (src/lib/tos-edits.ts, migration 257): what the Atlas widget announces is read strictly, turned
// into rows, and the badge in the space header is worded. Bundles with esbuild, then runs node:test.
//   node scripts/test_tos_edits.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'tos-edits-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
const bundle = async (src, name) => {
  const out = path.join(dir, name + '.mjs')
  await build({ entryPoints: [path.join(root, src)], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
  return import(pathToFileURL(out).href)
}
const E = await bundle('src/lib/tos-edits.ts', 'edits')
const P = await bundle('src/lib/tos-profile.ts', 'profile')

const CODE = 'OE-SCHOOLINGPROFILE-openevo-theory-of-schooling-lab-only'
const move = {
  theory: CODE,
  element: 'OE-PROPOSITION-x',
  note: '  Also about how cultures change ',
  edits: [
    { field: 'placement', before: { super: [{ id: 'society', strength: 'single' }], sub: [{ id: 'optimal', strength: 'firm' }] }, after: { super: [{ id: 'society', strength: 'firm' }, { id: 'cultural-evolution', strength: 'firm' }], sub: [{ id: 'optimal', strength: 'firm' }] } },
    { field: 'review', before: null, after: { status: 'checked', by: 'Someone', at: '1999-01-01', note: ' looks right ' } },
  ],
}

test('a move and a mark are read and the name and time are left to the database', () => {
  const r = E.parseAtlasEdit(move)
  assert.ok(r.ok)
  assert.equal(r.detail.note, 'Also about how cultures change')
  assert.deepEqual(r.detail.edits[1].after, { status: 'checked', note: 'looks right' })
  assert.deepEqual(r.detail.edits[0].after.super.map((p) => p.id), ['society', 'cultural-evolution'])
})

test('taking a mark away (null) is accepted, a wrong status is refused', () => {
  const take = E.parseAtlasEdit({ theory: CODE, element: 'e1', edits: [{ field: 'review', before: { status: 'checked' }, after: null }] })
  assert.ok(take.ok)
  assert.equal(take.detail.edits[0].after, null)
  for (const after of [{ status: 'maybe' }, {}, 'checked', 3]) assert.equal(E.parseAtlasEdit({ theory: CODE, element: 'e1', edits: [{ field: 'review', after }] }).ok, false)
})

test('anything out of shape is refused with a plain reason', () => {
  const bad = [
    [null, /not understood/],
    [{ ...move, theory: 'nope' }, /no theory/],
    [{ ...move, element: 'has space' }, /no statement/],
    [{ ...move, edits: [] }, /nothing to save/],
    [{ ...move, edits: [move.edits[0], move.edits[1], move.edits[1]] }, /nothing to save/],
    [{ ...move, edits: [{ field: 'statement', after: {} }] }, /cannot be changed/],
    [{ ...move, edits: [{ field: 'placement', after: { super: [] } }] }, /placement/],
    [{ ...move, edits: [{ field: 'placement', after: { super: [{ id: 'a b' }], sub: [] } }] }, /placement/],
  ]
  for (const [input, re] of bad) {
    const r = E.parseAtlasEdit(input)
    assert.equal(r.ok, false)
    assert.match(r.problem, re)
  }
})

test('a repeated domain is kept once and a missing strength means firm', () => {
  const r = E.parseAtlasEdit({ theory: CODE, element: 'e1', edits: [{ field: 'placement', after: { super: [{ id: 'self' }, { id: 'self', strength: 'single' }], sub: [] } }] })
  assert.ok(r.ok)
  assert.deepEqual(r.detail.edits[0].after.super, [{ id: 'self', strength: 'firm' }])
})

test('a long note is cut at 400 characters', () => {
  const r = E.parseAtlasEdit({ ...move, note: 'x'.repeat(900) })
  assert.ok(r.ok)
  assert.equal(r.detail.note.length, 400)
})

test('one row per field, in the form of the table', () => {
  const r = E.parseAtlasEdit(move)
  const rows = E.editRows(r.detail, 'project-1', 'user-1')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((x) => x.field_path), ['placement', 'review'])
  for (const x of rows) {
    assert.equal(x.project_id, 'project-1')
    assert.equal(x.profile_code, CODE)
    assert.equal(x.element_id, 'OE-PROPOSITION-x')
    assert.equal(x.edited_by, 'user-1')
    assert.equal(x.note, 'Also about how cultures change')
  }
  assert.equal(rows[1].before_value, null)
  assert.equal(E.editRows({ ...r.detail, note: '' }, 'p', 'u')[0].note, null)
})

test('the badge says how far people have checked', () => {
  assert.deepEqual(E.progressBadge(null).bucket, 'draft')
  assert.equal(E.progressBadge(null).text, 'AI draft, unchecked')
  assert.equal(E.progressBadge({ total: 1684, checked: 0, unsure: 0, excluded: 0 }).bucket, 'draft')
  const part = E.progressBadge({ total: 1684, checked: 212, unsure: 3, excluded: 1 })
  assert.equal(part.text, 'Being checked: 212 of 1684')
  assert.equal(part.bucket, 'progress')
  assert.match(part.title, /3 statements are marked unsure/)
  assert.match(part.title, /1 statement were left out|1 statements were left out|1 statement were/)
  const all = E.progressBadge({ total: 10, checked: 10, unsure: 0, excluded: 0 })
  assert.equal(all.bucket, 'good')
  assert.equal(all.text, 'All statements checked by a person')
})

test('the badge never calls an AI draft human made', () => {
  for (const p of [null, { total: 5, checked: 0, unsure: 0, excluded: 0 }, { total: 5, checked: 2, unsure: 0, excluded: 0 }]) assert.doesNotMatch(E.progressBadge(p).text, /human|curated|made by/i)
})

test('a statement with a review mark is flattened with its status, one without with null', () => {
  const profile = {
    schema: 'openevo-schooling-theory-profile/1', id: CODE, title: 't', holder: { kind: 'group', label: 'T' }, model: 'm', visibility: 'lab-only', license: 'private', version: '0.3.0',
    provenance: { extractedBy: 'llm', reviewStatus: 'ai-draft' },
    elements: [
      { id: 'a', type: 'proposition', statement: 'A', placement: { super: [], sub: [] }, review: { status: 'checked', by: 'D', at: '2026-11-24T10:00:00Z' } },
      { id: 'b', type: 'proposition', statement: 'B', placement: { super: [], sub: [] } },
      { id: 'c', type: 'proposition', statement: 'C', placement: { super: [], sub: [] }, review: { status: 'weird' } },
    ],
  }
  assert.deepEqual(P.flattenProfile(profile).map((r) => r.review_status), ['checked', null, null])
})
