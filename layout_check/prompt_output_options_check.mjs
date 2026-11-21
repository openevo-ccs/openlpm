#!/usr/bin/env node
// Checks Dustin's feedback row e3c38ffb (2026-11-13): the Jena KI-Prompt-Generator (page Planen) printed "Gewünschte Ausgabe" at the end of
// the prompt but had no controls for it. Now there is a section 8 with tone, length, detail level, output types and notes.
//
// Part 1 reads the real German library as it is today (migration 251 not pushed): section 8 is there, the old two lengths show, and there is
// no detail control yet (a library without detail levels shows none, which is the safe behaviour before the push).
// Part 2 answers the one library request with the library plus what migration 251 will add, to see the finished screen. Read-only: nothing
// is written to any table.
//
// Usage: node layout_check/prompt_output_options_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const migrated = process.argv.includes('--migrated') // migration 251 is live: part 1 already sees the detail control, nothing is simulated
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const base = args[0] || 'http://localhost:5271/'
const outDir = args[1] || path.join(ROOT, 'layout_check', 'out', 'prompt-output-options')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const AFTER_MIGRATION = {
  lengths: [['kurz', 'Kurz (1 bis 2 Seiten pro Unterrichtsstunde)'], ['mittel', 'Mittel (3 bis 4 Seiten pro Unterrichtsstunde)'], ['ausführlich', 'Ausführlich (ohne Seitenbegrenzung)']],
  detail_levels: [['knapp', 'Kurz und knapp: nur die wichtigsten Angaben, Verlaufsordnungen in Stichpunkten'], ['ausfuehrlicher', 'Ausführlicher: zusätzlich kurze Erklärungen und Beispiele für Methoden und Arbeitsmaterial'], ['sehr-detailliert', 'Sehr detailliert: ausformuliert, mit didaktischen Begründungen, Vorschlägen für Variationen und Arbeitsmaterial für alle Phasen']],
  default_detail: 'ausfuehrlicher',
}
let simulate = false

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/prompt_template_libraries/.test(u.pathname), async (route) => {
  const response = await route.fetch()
  if (!simulate || !response.ok()) return route.fulfill({ response })
  const body = await response.json()
  const patch = (row) => {
    if (!row || typeof row !== 'object' || !row.option_lists) return row
    return { ...row, option_lists: { ...row.option_lists, ...AFTER_MIGRATION }, section_labels: { ...row.section_labels, detail_label: 'Detailgrad:' } }
  }
  return route.fulfill({ response, json: Array.isArray(body) ? body.map(patch) : patch(body) })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
const open = async () => {
  await page.goto(base + '#/dashboard/evomentor-thuringia/planen', { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.locator('select').first().selectOption('klassenstufe')
  await page.waitForTimeout(800)
  // the grade picker appears under "Umfang"; take the first real grade so the preview has learning goals in it
  const gradeSelect = page.locator('.student-prompt-card').first().locator('select').nth(1)
  const gradeValues = await gradeSelect.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
  if (gradeValues.length) await gradeSelect.selectOption(gradeValues[gradeValues.length > 2 ? 2 : 0])
  await page.waitForTimeout(1200)
}
const preview = async () => await page.locator('pre').first().innerText().catch(() => '')

// ---- part 1: the real library today ----
await open()
const card8 = page.locator('.student-prompt-card', { has: page.getByRole('heading', { name: /Gewünschte Ausgabe/ }) })
check('section 8 "Gewünschte Ausgabe" is on the page', (await card8.count()) === 1)
const labels1 = (await card8.locator('label').allInnerTexts()).map((t) => t.trim())
check('it offers Ton, Länge, the output types and a notes box', ['Ton', 'Länge', 'Was soll die Antwort enthalten?', 'Weitere Hinweise zur Ausgabe'].every((l) => labels1.includes(l)), labels1.slice(0, 5).join(' | '))
check(migrated ? 'with migration 251 live the Detailgrad control is there' : 'before migration 251 there is no Detailgrad control', labels1.includes('Detailgrad') === migrated)
const typeBoxes = await card8.locator('input[type="checkbox"]').count()
check('the output types are checkboxes (8 in the German library)', typeBoxes === 8, `${typeBoxes} boxes`)
check('the prompt shows the output block as before', /GEWÜNSCHTE AUSGABE:/.test(await preview()))
await page.screenshot({ path: path.join(outDir, '1-section-8-today.png'), fullPage: false })
await card8.scrollIntoViewIfNeeded()
await card8.screenshot({ path: path.join(outDir, '1-section-8-card.png') })

// ---- part 2: with the data migration 251 adds ----
simulate = true
await open()
const card8b = page.locator('.student-prompt-card', { has: page.getByRole('heading', { name: /Gewünschte Ausgabe/ }) })
const labels2 = (await card8b.locator('label').allInnerTexts()).map((t) => t.trim())
check('after the migration a Detailgrad control appears', labels2.includes('Detailgrad'))
const lengthOptions = await card8b.locator('select').nth(1).locator('option').allInnerTexts()
check('Länge now has three choices', lengthOptions.length === 3, lengthOptions.join(' | '))
const first = await preview()
check('the prompt starts with the default detail line (Ausführlicher)', /- Detailgrad: Ausführlicher: zusätzlich kurze Erklärungen und Beispiele für Methoden und Arbeitsmaterial/.test(first))
await card8b.locator('select').nth(1).selectOption('kurz')
await card8b.locator('select').nth(2).selectOption('sehr-detailliert')
await card8b.locator('textarea').fill('Bitte ohne Tabellen.')
await card8b.locator('input[type="checkbox"]').nth(3).check()
await page.waitForTimeout(500)
const changed = await preview()
const tail = changed.slice(changed.indexOf('GEWÜNSCHTE AUSGABE:'))
console.log('\n--- end of the prompt ---\n' + tail + '\n--- end ---\n')
check('the prompt carries the chosen length', /Länge: kurz/.test(tail))
check('the prompt carries the chosen detail level in plain words', /- Detailgrad: Sehr detailliert: ausformuliert, mit didaktischen Begründungen, Vorschlägen für Variationen und Arbeitsmaterial für alle Phasen/.test(tail))
check('the prompt carries the note', /Bitte ohne Tabellen\./.test(tail))
check('the extra output type is in the prompt', /Hinweise auf Materialien \/ Medien/.test(tail))
await card8b.scrollIntoViewIfNeeded()
await card8b.screenshot({ path: path.join(outDir, '2-section-8-after-migration.png') })

// ---- phone width ----
await page.setViewportSize({ width: 390, height: 800 })
await page.waitForTimeout(400)
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('no sideways overflow on a phone', overflow <= 0, `${overflow}px`)
await card8b.scrollIntoViewIfNeeded()
await card8b.screenshot({ path: path.join(outDir, '3-section-8-phone.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
