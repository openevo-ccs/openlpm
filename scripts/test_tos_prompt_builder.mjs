#!/usr/bin/env node
// Tests for the Theories of Schooling context text (src/lib/tos-prompt-builder.ts): plain domain names, record codes only in brackets, the review
// state always named, and the visibility of each statement respected. Bundles the TypeScript with esbuild, then runs node:test.
// No database and no network are used.
//   node scripts/test_tos_prompt_builder.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'tos-prompt-'))
const out = path.join(dir, 'tos-prompt-builder.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/tos-prompt-builder.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const B = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const model = JSON.parse(readFileSync(path.join(root, 'public/vendor/openevo-atlas/atlas/model-schooling-domains-v1.json'), 'utf8'))
const example = () => structuredClone(JSON.parse(readFileSync(path.join(root, 'scripts/data/tos-example-profile.json'), 'utf8')))
const all = { audience: 'lab', domainIds: [], statementCodes: null, firmOnly: false }
const ID = 'OE-SCHOOLINGPROFILE-example-community'

// Everything outside square brackets: where no record code may appear.
const outsideBrackets = (text) => text.replace(/\[[^\]]*\]/g, '')

test('the text names the theory, who holds it, how far it was checked, and gives each statement a code in brackets', () => {
  const r = B.buildTosContext([example()], model, all)
  assert.equal(r.included, 6)
  assert.match(r.text, /^Background: ideas about schooling/)
  assert.match(r.text, /Held by An imaginary village school community \(a community's theory\)/)
  assert.match(r.text, /Review state: An invented example/)
  for (const id of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) assert.ok(r.text.includes(`[${ID}#${id}]`), id)
  assert.match(r.text, /- Proposal: Older students should help plan and run the school garden/)
  assert.match(r.text, /- Claim: The school was built so that village children/)
  assert.match(r.text, /- Observation: Exams matter because employers/)
})

test('record codes and schema words appear only where they should', () => {
  const r = B.buildTosContext([example()], model, all)
  assert.ok(!/OE-/.test(outsideBrackets(r.text)), 'a record code outside brackets')
  for (const word of ['super-domain', 'sub-domain', 'placement', 'elements', 'schema', 'JSON', 'warrant']) assert.ok(!r.text.toLowerCase().includes(word.toLowerCase()), word)
})

test('domains are named in everyday words with their one-line meaning', () => {
  const r = B.buildTosContext([example()], model, all)
  assert.match(r.text, /Human development\. How people grow, learn and change over a lifetime\./)
  assert.match(r.text, /\(sits under: Development, Optimal schooling\)/)
  // an aspect of schooling gets its own heading when it is chosen
  const optimal = B.buildTosContext([example()], model, { ...all, domainIds: ['optimal'] })
  assert.match(optimal.text, /Theories of optimal schooling\. Ideas about what the best possible schooling would be like\. 2 statements listed here\./)
})

test('a statement that belongs to two domains is written once', () => {
  const r = B.buildTosContext([example()], model, all)
  for (const id of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) assert.equal(r.text.split(`[${ID}#${id}]`).length - 1, 1, id)
})

test('choosing a domain keeps only the statements placed there', () => {
  const r = B.buildTosContext([example()], model, { ...all, domainIds: ['optimal'] })
  assert.equal(r.included, 2)
  assert.ok(r.text.includes('#e2]') && r.text.includes('#e3]'))
  assert.ok(!r.text.includes('#e1]'))
  assert.equal(r.skipped, 4)
})

test('only clear fits: a weaker placement is left out when asked, kept otherwise', () => {
  const weak = B.buildTosContext([example()], model, { ...all, domainIds: ['improvement'] })
  assert.ok(weak.text.includes('#e3]'))
  const firm = B.buildTosContext([example()], model, { ...all, domainIds: ['improvement'], firmOnly: true })
  assert.equal(firm.included, 0)
  assert.match(firm.text, /No statement matches/)
})

test('a statement chosen by code only', () => {
  const r = B.buildTosContext([example()], model, { ...all, statementCodes: [`${ID}#e4`] })
  assert.equal(r.included, 1)
  assert.ok(r.text.includes('#e4]') && !r.text.includes('#e3]'))
  assert.equal(B.buildTosContext([example()], model, { ...all, statementCodes: [] }).included, 0)
})

test('within a domain, proposals come before claims and observations', () => {
  const r = B.buildTosContext([example()], model, { ...all, domainIds: ['adaptive-fit'] })
  assert.ok(r.text.indexOf('- Proposal:') < r.text.indexOf('- Observation:'))
})

test('the review state is always named, in plain words, for every state', () => {
  const words = { 'ai-draft': /not yet checked by an expert/, 'author-reviewed': /Checked by the author/, 'expert-reviewed': /Checked by an expert/, 'illustrative-example': /An invented example/ }
  for (const [status, re] of Object.entries(words)) {
    const p = example()
    p.provenance.reviewStatus = status
    const r = B.buildTosContext([p], model, all)
    assert.match(r.text, new RegExp(`Review state: .*`))
    assert.match(r.text, re, status)
  }
})

test('the note about the sorting is written unless every theory was checked by an expert', () => {
  const draft = B.buildTosContext([example()], model, all)
  assert.ok(draft.text.includes(B.SORTING_NOTE))
  const checked = example()
  checked.provenance.reviewStatus = 'expert-reviewed'
  assert.ok(!B.buildTosContext([checked], model, all).text.includes(B.SORTING_NOTE))
  const mixed = B.buildTosContext([checked, example()], model, all)
  assert.ok(mixed.text.includes(B.SORTING_NOTE))
})

test('for people outside the lab, a statement kept inside the lab shows only its short name', () => {
  const p = example()
  p.visibility = 'lab-only'
  p.elements[0].visibility = 'public'
  p.elements[1].label = 'Hands-on learning'
  const r = B.buildTosContext([p], model, { ...all, audience: 'public' })
  assert.ok(r.text.includes('The school was built so that village children'), 'the public statement keeps its wording')
  assert.ok(!r.text.includes('Children learn best when they do things with their hands'), 'a lab-only wording leaks')
  assert.ok(r.text.includes('Hands-on learning'))
  assert.ok(r.text.includes(B.PLACEHOLDER_KEPT_INSIDE), 'a statement with no short name gets the placeholder')
  assert.equal(r.withheld, 5)
  assert.match(r.text, /5 statements are shown by short name only/)
  for (const e of p.elements.slice(1)) assert.ok(!r.text.includes(e.statement), e.id)
})

test('for people in the lab, everything appears in full whatever the visibility', () => {
  const p = example()
  p.visibility = 'lab-only'
  const r = B.buildTosContext([p], model, all)
  assert.equal(r.withheld, 0)
  for (const e of p.elements) assert.ok(r.text.includes(e.statement), e.id)
})

test('a profile marked local is treated as kept inside the lab', () => {
  const p = example()
  p.visibility = 'local'
  const r = B.buildTosContext([p], model, { ...all, audience: 'public' })
  assert.equal(r.withheld, 6)
  for (const e of p.elements) assert.ok(!r.text.includes(e.statement), e.id)
})

test('statements with no placement are listed as not placed, and can be chosen on their own', () => {
  const p = example()
  p.elements.push({ id: 'e7', type: 'question', statement: 'Who decides what the school garden grows?', placement: { super: [], sub: [] } })
  const everything = B.buildTosContext([p], model, all)
  assert.match(everything.text, /Not placed in a domain yet\. Statements that nobody has sorted into a domain yet\./)
  assert.ok(everything.text.includes('- Open question: Who decides'))
  const only = B.buildTosContext([p], model, { ...all, domainIds: [B.NOT_PLACED] })
  assert.equal(only.included, 1)
})

test('a statement that the source reports from someone else says so', () => {
  const p = example()
  p.elements[0].stance = 'attributed'
  assert.match(B.buildTosContext([p], model, all).text, /reports from someone else/)
})

test('the question is added at the end exactly as written, and an empty one is left out', () => {
  const asked = B.buildTosContext([example()], model, { ...all, question: '  How could our school use the garden?  ' })
  assert.ok(asked.text.endsWith('My question: How could our school use the garden?'))
  assert.ok(!B.buildTosContext([example()], model, { ...all, question: '   ' }).text.includes('My question'))
})

test('with several theories each one is named and each statement carries its own code', () => {
  const a = example()
  const b = example()
  b.id = 'OE-SCHOOLINGPROFILE-second'
  b.title = 'A second theory'
  const r = B.buildTosContext([a, b], model, all)
  assert.equal(r.included, 12)
  assert.ok(r.text.includes('[OE-SCHOOLINGPROFILE-second#e1]'))
  assert.ok(r.text.includes('A second theory. Held by'))
})

test('no theory gives a plain sentence instead of an empty text', () => {
  const r = B.buildTosContext([], model, all)
  assert.match(r.text, /No statement matches/)
  assert.equal(r.included, 0)
})

test('listStatements and statementCode give the citation form', () => {
  const rows = B.listStatements([example()])
  assert.equal(rows.length, 6)
  assert.equal(rows[0].code, `${ID}#e1`)
  assert.equal(B.statementCode({ id: 'P' }, { id: 'x' }), 'P#x')
})

test('every kind of statement has a plain name', () => {
  for (const t of model.elementTypes) assert.ok(B.KIND_PLAIN[t.id], t.id)
})
