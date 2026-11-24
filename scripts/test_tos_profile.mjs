#!/usr/bin/env node
// Tests for the Theories of Schooling profile checks and flattening (src/lib/tos-profile.ts). Bundles the TypeScript with esbuild, then runs node:test.
// No database and no network are used.
//   node scripts/test_tos_profile.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'tos-profile-'))
const out = path.join(dir, 'tos-profile.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/tos-profile.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const P = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const vendor = path.join(root, 'public/vendor/openevo-atlas/atlas')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const model = readJson(path.join(vendor, 'model-schooling-domains-v1.json'))
const schema = readJson(path.join(vendor, 'schooling-theory-profile-v1.schema.json'))
const example = () => structuredClone(readJson(path.join(root, 'scripts/data/tos-example-profile.json')))

const el = (id, extra = {}) => ({ id, type: 'proposition', statement: `Statement number ${id}`, placement: { super: [{ id: 'development', strength: 'firm' }], sub: [{ id: 'optimal', strength: 'firm' }] }, ...extra })
const profile = (over = {}) => ({ ...example(), elements: [el('a'), el('b')], warrants: [], domainLinks: [], ...over })

test('the example profile passes and flattens into one row per statement', () => {
  const r = P.validateProfile(example(), model)
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
  assert.equal(r.profile.id, 'OE-SCHOOLINGPROFILE-example-community')
  const rows = P.flattenProfile(r.profile)
  assert.equal(rows.length, 6)
  const e3 = rows.find((x) => x.element_id === 'e3')
  assert.deepEqual(e3.supers, ['development', 'self'])
  assert.deepEqual(e3.subs, ['optimal', 'improvement'])
  assert.equal(e3.type, 'design')
  assert.equal(e3.visibility, 'public')
  assert.equal(e3.label, null)
  assert.equal(e3.ref, null)
})

test('profileRowFields copies the fields that the table keeps beside the data', () => {
  const f = P.profileRowFields(example())
  assert.equal(f.profile_id, 'OE-SCHOOLINGPROFILE-example-community')
  assert.equal(f.holder_kind, 'community')
  assert.equal(f.visibility, 'public')
  assert.equal(f.theory_ref, null)
  assert.equal(f.version, '0.1.0')
  assert.equal(f.review_status, 'illustrative-example')
  assert.equal(f.data.elements.length, 6)
})

test('a value that is not a profile is refused in plain words', () => {
  for (const bad of [null, 'text', 42, [], undefined]) {
    const r = P.validateProfile(bad, model)
    assert.equal(r.ok, false)
    assert.equal(r.profile, null)
    assert.match(r.errors[0], /not a theory of schooling profile/)
  }
  const noSchema = P.validateProfile({ id: 'x' }, model)
  assert.equal(noSchema.ok, false)
  assert.match(noSchema.errors[0], /schema/)
  const other = P.validateProfile({ ...example(), schema: 'something-else/1' }, model)
  assert.equal(other.ok, false)
})

test('an older or newer format version is refused, with the format named', () => {
  const r = P.validateProfile({ ...example(), schema: 'openevo-schooling-theory-profile/2' }, model)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('openevo-schooling-theory-profile/2') && e.includes('openevo-schooling-theory-profile/1')))
})

test('required fields are named one by one', () => {
  const p = example()
  delete p.title
  delete p.license
  delete p.provenance
  p.version = 'one'
  p.id = 'my-theory'
  const r = P.validateProfile(p, model)
  assert.equal(r.ok, false)
  const all = r.errors.join('\n')
  assert.match(all, /OE-SCHOOLINGPROFILE-my-theory/)
  assert.match(all, /title/)
  assert.match(all, /licence/)
  assert.match(all, /version needs three numbers/)
  assert.match(all, /provenance/)
})

test('the holder needs a known kind and a name', () => {
  const p = example()
  p.holder = { kind: 'robot', label: 'x' }
  assert.match(P.validateProfile(p, model).errors.join('\n'), /"robot" is not one of/)
  p.holder = { kind: 'community' }
  assert.match(P.validateProfile(p, model).errors.join('\n'), /whose theory it is/)
})

test('the elements list is required and a profile with none is allowed with a note', () => {
  const p = example()
  delete p.elements
  assert.equal(P.validateProfile(p, model).ok, false)
  const empty = P.validateProfile(profile({ elements: [] }), model)
  assert.equal(empty.ok, true)
  assert.ok(empty.warnings.some((w) => /no statements yet/.test(w)))
})

test('two statements with the same id are refused', () => {
  const r = P.validateProfile(profile({ elements: [el('a'), el('a')] }), model)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /share the id a/.test(e)))
})

test('a statement id with odd characters is refused', () => {
  const r = P.validateProfile(profile({ elements: [el('a b')] }), model)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /characters that are not allowed/.test(e)))
})

test('an unknown domain id is refused, in either list', () => {
  const unknownSuper = P.validateProfile(profile({ elements: [el('a', { placement: { super: [{ id: 'cosmos' }], sub: [] } })] }), model)
  assert.equal(unknownSuper.ok, false)
  assert.ok(unknownSuper.errors.some((e) => e.includes('"cosmos"')))
  // a sub-domain id placed in the super list is also unknown there
  const swapped = P.validateProfile(profile({ elements: [el('a', { placement: { super: [{ id: 'optimal' }], sub: [{ id: 'development' }] } })] }), model)
  assert.equal(swapped.ok, false)
  assert.equal(swapped.errors.length, 2)
})

test('a placement may be a bare id, as the widget allows', () => {
  const r = P.validateProfile(profile({ elements: [el('a', { placement: { super: ['development'], sub: ['optimal'] } })] }), model)
  assert.equal(r.ok, true)
  assert.deepEqual(P.flattenProfile(r.profile)[0].supers, ['development'])
})

test('a strength other than firm or single is refused', () => {
  const r = P.validateProfile(profile({ elements: [el('a', { placement: { super: [{ id: 'development', strength: 'strong' }], sub: [] } })] }), model)
  assert.equal(r.ok, false)
})

test('wording length: too short and too long are refused, 600 characters is fine', () => {
  assert.equal(P.validateProfile(profile({ elements: [el('a', { statement: 'ab' })] }), model).ok, false)
  assert.equal(P.validateProfile(profile({ elements: [el('a', { statement: 'x'.repeat(601) })] }), model).ok, false)
  assert.equal(P.validateProfile(profile({ elements: [el('a', { statement: 'x'.repeat(600) })] }), model).ok, true)
})

test('an unknown kind of statement is refused', () => {
  const r = P.validateProfile(profile({ elements: [el('a', { type: 'rumour' })] }), model)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /"rumour"/.test(e)))
})

test('a statement needs a placement with both lists', () => {
  const r = P.validateProfile(profile({ elements: [el('a', { placement: { super: [] } })] }), model)
  assert.equal(r.ok, false)
})

test('statements with no placement are allowed and counted in a note', () => {
  const r = P.validateProfile(profile({ elements: [el('a', { placement: { super: [], sub: [] } }), el('b', { placement: { super: [], sub: [] } })] }), model)
  assert.equal(r.ok, true)
  assert.ok(r.warnings.some((w) => /2 statements are not placed/.test(w)))
})

test('reasons must point at statements that exist', () => {
  const ok = P.validateProfile(profile({ warrants: [{ id: 'w1', design: 'a', basis: ['b'] }] }), model)
  assert.equal(ok.ok, true)
  const noDesign = P.validateProfile(profile({ warrants: [{ id: 'w1', design: 'zzz', basis: ['b'] }] }), model)
  assert.equal(noDesign.ok, false)
  const noBasis = P.validateProfile(profile({ warrants: [{ id: 'w1', design: 'a', basis: ['zzz'] }] }), model)
  assert.equal(noBasis.ok, false)
  const emptyBasis = P.validateProfile(profile({ warrants: [{ id: 'w1', design: 'a', basis: [] }] }), model)
  assert.equal(emptyBasis.ok, false)
  const twice = P.validateProfile(profile({ warrants: [{ id: 'w1', design: 'a', basis: ['b'] }, { id: 'w1', design: 'b', basis: ['a'] }] }), model)
  assert.equal(twice.ok, false)
})

test('links between domains need known domains of the stated scope', () => {
  const ok = P.validateProfile(profile({ domainLinks: [{ scope: 'sub', from: 'adaptive-fit', to: 'futures', relation: 'leads to' }] }), model)
  assert.equal(ok.ok, true)
  assert.equal(P.validateProfile(profile({ domainLinks: [{ scope: 'sub', from: 'development', to: 'futures' }] }), model).ok, false)
  assert.equal(P.validateProfile(profile({ domainLinks: [{ scope: 'super', from: 'self', to: 'self' }] }), model).ok, false)
  assert.equal(P.validateProfile(profile({ domainLinks: [{ scope: 'galaxy', from: 'self', to: 'society' }] }), model).ok, false)
})

test('a local profile is allowed and the person is told it will be shared with the space', () => {
  const r = P.validateProfile(profile({ visibility: 'local' }), model)
  assert.equal(r.ok, true)
  assert.ok(r.warnings.some((w) => /every member of the space/.test(w)))
  assert.equal(P.validateProfile(profile({ visibility: 'secret' }), model).ok, false)
})

test('a profile that names another domain model gets a note and still passes', () => {
  const r = P.validateProfile(profile({ model: 'OE-SCHOOLINGMODEL-other' }), model)
  assert.equal(r.ok, true)
  assert.ok(r.warnings.some((w) => /OE-SCHOOLINGMODEL-other/.test(w)))
})

test('a link whose code does not look like a base record gets a note, a link with no ref is refused', () => {
  const odd = P.validateProfile(profile({ elements: [el('a', { links: [{ ref: 'somewhere' }] })] }), model)
  assert.equal(odd.ok, true)
  assert.ok(odd.warnings.some((w) => /somewhere/.test(w)))
  const none = P.validateProfile(profile({ elements: [el('a', { links: [{ relation: 'uses' }] })] }), model)
  assert.equal(none.ok, false)
})

test('too many statements are refused', () => {
  const many = Array.from({ length: P.MAX_STATEMENTS + 1 }, (_, i) => el(`s${i}`))
  assert.equal(P.validateProfile(profile({ elements: many }), model).ok, false)
})

test('one statement keeps its own visibility, otherwise it takes the profile one, and only public counts as public', () => {
  const lab = { visibility: 'lab-only' }
  assert.equal(P.elementVisibility(lab, {}), 'lab-only')
  assert.equal(P.elementVisibility(lab, { visibility: 'public' }), 'public')
  assert.equal(P.elementVisibility({ visibility: 'public' }, { visibility: 'lab-only' }), 'lab-only')
  assert.equal(P.elementVisibility({ visibility: 'public' }, {}), 'public')
  assert.equal(P.elementVisibility({ visibility: 'local' }, {}), 'lab-only')
})

test('flattening keeps the short name, the base record and the visibility of each statement', () => {
  const p = profile({ visibility: 'lab-only', elements: [el('a', { label: 'Short', ref: 'OE-DESIGNPRINCIPLE-x' }), el('b', { visibility: 'public' })] })
  const rows = P.flattenProfile(p)
  assert.equal(rows[0].label, 'Short')
  assert.equal(rows[0].ref, 'OE-DESIGNPRINCIPLE-x')
  assert.equal(rows[0].visibility, 'lab-only')
  assert.equal(rows[1].visibility, 'public')
})

test('placedIds drops repeats and empty entries, firmIds drops weaker placements', () => {
  const list = [{ id: 'a' }, 'b', { id: 'a', strength: 'single' }, { id: '' }, { id: 'c', strength: 'single' }, null]
  assert.deepEqual(P.placedIds(list), ['a', 'b', 'c'])
  assert.deepEqual(P.firmIds(list), ['a', 'b'])
  assert.deepEqual(P.placedIds(undefined), [])
})

test('reading text: empty, broken JSON, a byte order mark and a huge file', () => {
  assert.match(P.parseProfileText('   ').error, /nothing to read/)
  assert.match(P.parseProfileText('{ "a": ').error, /not valid JSON/)
  assert.equal(P.parseProfileText('﻿{"a":1}').error, null)
  assert.deepEqual(P.parseProfileText('﻿{"a":1}').value, { a: 1 })
  assert.match(P.parseProfileText('x'.repeat(P.MAX_FILE_BYTES + 1)).error, /larger than 3 MB/)
})

test('review states have plain wording and an unknown one says so', () => {
  for (const s of ['ai-draft', 'author-reviewed', 'expert-reviewed', 'illustrative-example']) assert.ok(P.reviewStatusPlain(s).length > 10)
  assert.match(P.reviewStatusPlain('ai-draft'), /not yet checked by an expert/)
  assert.equal(P.reviewStatusPlain('whatever'), 'Review state not known')
  assert.equal(P.reviewStatusPlain(undefined), 'Review state not known')
  assert.equal(P.holderKindPlain(model, 'community'), "A community's theory")
  assert.equal(P.holderKindPlain(model, 'zzz'), 'zzz')
})

test('the download name is safe', () => {
  assert.equal(P.profileFileName({ id: 'OE-SCHOOLINGPROFILE-a/b c', version: '1.2.3' }), 'OE-SCHOOLINGPROFILE-a-b-c-v1.2.3.json')
})

test('the lists in the code match the widget schema and the domain model, so a change there shows up here', () => {
  const el0 = schema.properties.elements.items.properties
  assert.deepEqual([...el0.type.enum].sort(), model.elementTypes.map((t) => t.id).sort())
  assert.deepEqual([...schema.properties.holder.properties.kind.enum].sort(), model.holderKinds.map((k) => k.id).sort())
  assert.deepEqual([...schema.properties.visibility.enum].sort(), ['lab-only', 'local', 'public'])
  assert.deepEqual([...schema.properties.provenance.properties.reviewStatus.enum].sort(), Object.keys(P.REVIEW_STATUS_PLAIN).sort())
  assert.equal(schema.properties.schema.const, P.PROFILE_SCHEMA)
  assert.equal(el0.statement.maxLength, P.MAX_STATEMENT_LENGTH)
  assert.equal(model.supers.length, 5)
  assert.equal(model.subs.length, 5)
})

test('the copy of the widget folder holds no lab-only link, because every file in public/ is served to anyone', () => {
  const links = readJson(path.join(vendor, 'base-links.json'))
  let seen = 0
  for (const d of Object.values(links.domains)) for (const list of Object.values(d)) for (const item of list) { seen++; assert.notEqual(item.lab_only, true, item.label) }
  assert.ok(seen > 20)
})
