#!/usr/bin/env node
// Tests for the first-visit text (src/lib/start-here.ts). Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_start_here.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'start-here-'))
const out = path.join(dir, 'start-here.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/start-here.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const S = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const allText = () => [S.HOME_HEADLINE, ...S.LEAD_PARAGRAPHS, S.TOOLKIT_LINE, S.PROGRESSION_GLOSS, S.MODELS_TITLE, S.MODELS_INTRO,
  ...S.FOUR_MODELS.flatMap((m) => [m.name, m.text]),
  ...S.STARTING_POINTS.flatMap((p) => [p.title, p.text, p.spaceName])].join(' ')

test('the lead narrative names the classroom limits and the toolkit', () => {
  const lead = S.LEAD_PARAGRAPHS.join(' ')
  for (const word of ['ministries', 'textbook authors', 'teachers', 'hours', 'one teacher', 'about 30', 'assessments', 'subjects', 'teachable and testable']) {
    assert.ok(new RegExp(word, 'i').test(lead), `lead narrative lacks "${word}"`)
  }
  assert.match(S.TOOLKIT_LINE, /teachers, researchers and AI collaborators/)
})

test('no blanket statement about AI drafting or missing review (status is shown per record by the app)', () => {
  const text = allText()
  for (const bad of [/AI-drafted/i, /awaiting expert/i, /no (subject )?expert/i, /not (yet )?(been )?reviewed/i, /thought experiment/i, /made up/i]) {
    assert.ok(!bad.test(text), `matches ${bad}`)
  }
})

test('three one-subject models and one cross-subject model, in the comparison set order', () => {
  assert.deepEqual(S.FOUR_MODELS.map((m) => m.slug), ['bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth'])
  assert.equal(S.FOUR_MODELS.filter((m) => m.kind === 'one-subject').length, 3)
  assert.equal(S.FOUR_MODELS.filter((m) => m.kind === 'cross-subject').length, 1)
  for (const m of S.FOUR_MODELS) assert.equal(m.text.split(/(?<=\.)\s+/).length, 2, `${m.name} has two sentences`)
})

test('there are exactly three starting points and each links only when the person has access', () => {
  assert.equal(S.STARTING_POINTS.length, 3)
  const none = S.resolveStartingPoints(new Set())
  assert.ok(none.every((p) => p.href === null))
  const some = S.resolveStartingPoints(new Set(['interdisciplinary-lpm-synth']))
  assert.equal(some[0].href, '/dashboard/interdisciplinary-lpm-synth/strands')
  assert.equal(some[1].href, null)
})

test('visible text avoids lab shorthand, filler words and partner names', () => {
  const text = allText()
  for (const bad of ['fork', 'promote', 'schema', 'repository id', 'coherence gap', 'evidentiary', 'Christ', 'Delhi', 'Jena']) {
    assert.ok(!new RegExp(`\b${bad}`, 'i').test(text), `contains "${bad}"`)
  }
  for (const bad of [/, not /, /not just/i, /\breal\b/i, /\bactually\b/i, /\bgenuine/i, /\bhonest/i, /seamless/i, /robust/i, /unlock/i, /leverage/i, /—/]) {
    assert.ok(!bad.test(text), `matches ${bad}`)
  }
})
