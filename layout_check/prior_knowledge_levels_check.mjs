#!/usr/bin/env node
// Checks the fourth prior-knowledge level "Nicht bekannt" and the hover texts (feedback 1fab704b, Dustin Eirdosh 2026-11-13, chosen 2026-11-21) on
// the Jena Planen page. Without --migrated the one library request is answered with the library plus what migration 255 adds (read-only, nothing is
// written). With --migrated nothing is simulated, so it reads what the database holds.
//
// Usage: node layout_check/prior_knowledge_levels_check.mjs [base] [--migrated]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const migrated = process.argv.includes('--migrated')
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const base = args[0] || 'http://localhost:5281/'
const outDir = path.join(ROOT, 'layout_check', 'out', 'prior-knowledge-levels')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const LEVELS = [
  ['keins', 'Kein Vorwissen', 'Das Thema war noch nicht Unterrichtsgegenstand. Die Klasse beginnt ohne fachliche Grundlagen.'],
  ['grundlagen', 'Grundbegriffe bekannt', 'Die zentralen Begriffe sind bekannt. Zusammenhänge zwischen ihnen sind noch nicht gesichert.'],
  ['solide', 'Solides Grundwissen', 'Begriffe und Zusammenhänge sind gesichert. Die Klasse kann sie auf Beispiele anwenden.'],
  ['unbekannt', 'Nicht bekannt', 'Ich weiß nicht, was die Klasse schon kann. Der Prompt bittet dann um einen kurzen Einstieg, der das Vorwissen erfasst.', 'Vorwissen unbekannt: beginne mit einer kurzen Eingangsdiagnose und passe die weitere Planung an deren Ergebnis an'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e?.stack ?? String(e)))
await page.route((u) => /\/rest\/v1\/prompt_template_libraries/.test(u.pathname), async (route) => {
  const response = await route.fetch()
  if (migrated || !response.ok()) return route.fulfill({ response })
  const body = await response.json()
  const patch = (row) => (row && row.option_lists ? { ...row, option_lists: { ...row.option_lists, prior_knowledge_levels: LEVELS } } : row)
  return route.fulfill({ response, json: Array.isArray(body) ? body.map(patch) : patch(body) })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.goto(base + '#/dashboard/evomentor-thuringia/planen', { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.locator('select').first().selectOption('klassenstufe')
await page.waitForTimeout(800)
const gradeSelect = page.locator('.student-prompt-card').first().locator('select').nth(1)
const gradeValues = await gradeSelect.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
if (gradeValues.length) await gradeSelect.selectOption(gradeValues[gradeValues.length > 2 ? 2 : 0])
await page.waitForTimeout(1500)

const card = page.locator('.student-prompt-card', { has: page.getByRole('heading', { name: /Basiskonzeptbezug/ }) })
const field = card.locator('.field', { has: page.locator('select') }).first()
const select = field.locator('select')
check('a prior-knowledge select is on the page', (await select.count()) === 1)
const options = await select.locator('option').evaluateAll((os) => os.map((o) => ({ label: o.textContent, title: o.title })))
check('four levels are offered', options.length === 4, options.map((o) => o.label).join(' | '))
check('the fourth is "Nicht bekannt"', options[3]?.label === 'Nicht bekannt')
check('every level has a hover text on its entry', options.every((o) => o.title && o.title.length > 20))
check('the second level is still the default', (await select.inputValue()) === 'grundlagen')
check('the select itself shows the meaning of the chosen level on hover', (await select.getAttribute('title')) === LEVELS[1][2], await select.getAttribute('title'))
await select.selectOption('unbekannt')
await page.waitForTimeout(300)
check('choosing "Nicht bekannt" changes the hover text to its meaning', ((await select.getAttribute('title')) || '').startsWith('Ich weiß nicht, was die Klasse schon kann'))
const icon = field.locator('span[title][tabindex="0"]')
check('an info icon lists all four meanings on hover', (await icon.count()) === 1 && ((await icon.getAttribute('title')) || '').split('\n\n').length === 4)
const prompt = await page.locator('pre').first().innerText()
const line = prompt.split('\n').find((l) => l.includes('Vorwissen unbekannt')) || ''
check('the prompt carries the note for "Nicht bekannt"', /^- .+: Nicht bekannt \(Vorwissen unbekannt: beginne mit einer kurzen Eingangsdiagnose/.test(line), line.slice(0, 160))
await select.selectOption('solide')
await page.waitForTimeout(300)
const prompt2 = await page.locator('pre').first().innerText()
check('another level prints just its label, as before', /: Solides Grundwissen\n/.test(prompt2) && !prompt2.includes('Vorwissen unbekannt'))
await select.selectOption('grundlagen')
await field.hover()
await card.screenshot({ path: path.join(outDir, 'levels.png') })
await page.setViewportSize({ width: 390, height: 800 })
await page.waitForTimeout(400)
check('no sideways overflow on a phone', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0)
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 600))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
